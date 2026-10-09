import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

interface Session { version: 1; pid: number; updatedAt: number; key: string | null }
const lifetime = 30_000;

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; }
}

/** Each extension host owns one file; atomic replacement avoids partial reads. */
export class OpenProjectsRegistry {
  private readonly file: string;
  private pending: Promise<Set<string>> = Promise.resolve(new Set());
  private disposed = false;
  private watcher?: FSWatcher;
  private debounce?: ReturnType<typeof setTimeout>;

  constructor(private readonly directory: string, private readonly isAlive = alive,
    private readonly now = Date.now, private readonly pid = process.pid) {
    this.file = join(directory, `${randomUUID()}.json`);
  }

  update(key: string | null): Promise<Set<string>> {
    if (this.disposed) return Promise.resolve(new Set());
    this.pending = this.pending.catch(() => new Set<string>()).then(async () => {
      if (this.disposed) return new Set<string>();
      await mkdir(this.directory, { recursive: true });
      const session: Session = { version: 1, pid: this.pid, updatedAt: this.now(), key };
      await writeFile(this.file + '.tmp', JSON.stringify(session), { mode: 0o600 });
      await rename(this.file + '.tmp', this.file);
      return this.scan();
    });
    return this.pending;
  }

  private async scan(): Promise<Set<string>> {
    const keys = new Set<string>();
    const files = await readdir(this.directory);
    await Promise.all(files.filter(file => file.endsWith('.json')).map(async file => {
      try {
        const value: unknown = JSON.parse(await readFile(join(this.directory, file), 'utf8'));
        if (!value || typeof value !== 'object') return;
        const entry = value as Partial<Session>;
        if (entry.version !== 1 || !Number.isInteger(entry.pid) || entry.pid! <= 0
          || typeof entry.updatedAt !== 'number' || !Number.isFinite(entry.updatedAt)
          || (entry.key !== null && typeof entry.key !== 'string')) return;
        // Expired files are ignored, not deleted: their owner may be resuming.
        if (this.now() - entry.updatedAt > lifetime || !this.isAlive(entry.pid!)) return;
        if (entry.key) keys.add(entry.key);
      } catch { /* A window can close while its file is being read. */ }
    }));
    return keys;
  }

  async watch(onChange: (keys: Set<string>) => Promise<void>): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    if (this.disposed || this.watcher) return;
    const notify = () => {
      if (this.disposed) return;
      clearTimeout(this.debounce);
      this.debounce = setTimeout(() => {
        if (this.disposed) return;
        // Read only: writing a heartbeat here would make windows notify each other forever.
        this.pending = this.pending.catch(() => new Set<string>()).then(() => this.scan());
        void this.pending.then(keys => { if (!this.disposed) return onChange(keys); }).catch(() => undefined);
      }, 40);
    };
    this.watcher = watch(this.directory, (_event, filename) => {
      if (!filename || (filename.endsWith('.json') && join(this.directory, filename) !== this.file)) notify();
    });
    this.watcher.on('error', () => { this.watcher?.close(); this.watcher = undefined; });
    notify();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    clearTimeout(this.debounce);
    this.watcher?.close();
    await this.pending.catch(() => undefined);
    await Promise.all([this.file, this.file + '.tmp'].map(file => rm(file, { force: true }).catch(() => undefined)));
  }
}
