import { runTests } from '@vscode/test-electron';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const root = resolve(import.meta.dirname, '..');
const temp = await mkdtemp(resolve(tmpdir(), 'recent-switcher-test-'));
await mkdir(resolve(temp, 'folder'));
await writeFile(resolve(temp, 'sample.code-workspace'), JSON.stringify({ folders: [{ path: './folder' }] }));
await build({ entryPoints: [resolve(root, 'test/integration.ts')], bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], outfile: resolve(root, '.vscode-test/integration.cjs') });
await runTests({
  ...(process.env.VSCODE_EXECUTABLE_PATH ? { vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH } : {}),
  extensionDevelopmentPath: root,
  extensionTestsPath: resolve(root, '.vscode-test/integration.cjs'),
  extensionTestsEnv: { RECENT_SWITCHER_TEST_DIR: temp },
  launchArgs: ['--user-data-dir=' + resolve(temp, 'profile'), '--extensions-dir=' + resolve(temp, 'extensions'), '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust'],
});
console.log('Isolated test profile:', temp);
