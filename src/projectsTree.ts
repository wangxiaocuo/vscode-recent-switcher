import * as vscode from 'vscode';
import { canOpenDirectly, projectKey, projectName, projectPath, type RecentProject } from './project';
import { loadRecentProjects } from './recentProjects';

export class ProjectItem extends vscode.TreeItem {
  readonly current: boolean;
  readonly state: 'current' | 'open' | 'closed';
  constructor(readonly project: RecentProject, opened: ReadonlySet<string> = new Set()) {
    super(projectName(project), vscode.TreeItemCollapsibleState.None);
    const currentUri = vscode.workspace.workspaceFile ?? vscode.workspace.workspaceFolders?.[0]?.uri;
    const current = currentUri?.toString() === project.uri.toString()
      && (!project.remoteAuthority || project.remoteAuthority === currentUri?.authority);
    this.current = current;
    this.state = current ? 'current' : opened.has(projectKey(project)) ? 'open' : 'closed';
    const direct = canOpenDirectly(project);
    this.description = `${projectPath(project, true)}${current ? ' • Current' : ''}${direct ? '' : ' • Open Recent'}`;
    this.tooltip = `${project.kind === 'folder' ? 'Folder' : 'Workspace'}${current ? ' (current window)' : this.state === 'open' ? ' (open in another window)' : ''}\n${projectPath(project)}${project.remoteAuthority ? `\nRemote: ${project.remoteAuthority}` : ''}${direct ? '' : '\nOpen through VS Code Open Recent'}`;
    this.iconPath = new vscode.ThemeIcon(project.kind === 'folder' ? 'folder' : 'root-folder');
    this.contextValue = direct ? 'recentProject' : 'recentProjectFallback';
    this.command = { command: 'recentSwitcher.open', title: 'Open Project', arguments: [this] };
  }
}

export class ProjectsTree implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  private items: vscode.TreeItem[] = [];
  private pending: Promise<void> | undefined;
  private lastRefresh = 0;
  private fingerprint = '';
  private disposed = false;
  private opened: ReadonlySet<string> = new Set();

  constructor(private readonly load: () => Promise<RecentProject[]> = loadRecentProjects) {}

  async setOpenProjects(opened: ReadonlySet<string>): Promise<void> {
    if (opened.size === this.opened.size && [...opened].every(key => this.opened.has(key))) return;
    this.opened = new Set(opened);
    // Do not lose a presence change while a history refresh is in flight.
    if (this.pending) await this.pending;
    await this.refresh(true);
  }

  getTreeItem(item: vscode.TreeItem): vscode.TreeItem { return item; }
  async getChildren(parent?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (parent) return [];
    if (!this.fingerprint) await this.refresh();
    return this.items;
  }

  async refreshLatest(): Promise<void> {
    // A pre-existing request may have captured history before the open attempt.
    if (this.pending) await this.pending;
    await this.refresh(true);
  }

  refresh(force = false): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.pending) return this.pending;
    if (!force && this.fingerprint && Date.now() - this.lastRefresh < 1000) return Promise.resolve();
    this.pending = this.update().finally(() => { this.pending = undefined; });
    return this.pending;
  }

  private async update(): Promise<void> {
    let items: vscode.TreeItem[];
    try {
      const projects = await this.load();
      items = projects.length ? projects.map(project => new ProjectItem(project, this.opened)).sort((a, b) =>
          ({ current: 0, open: 1, closed: 2 }[a.state] - { current: 0, open: 1, closed: 2 }[b.state]))
        : [this.status('No recent projects yet', 'Open a folder or workspace in VS Code to get started.', 'info')];
    } catch {
      items = [this.status('Recent history unavailable — Open Recent',
        'VS Code’s internal history command failed or returned an unsupported format. Click to open native Open Recent, or use Refresh to retry.', 'warning')];
    }
    if (this.disposed) return;
    this.lastRefresh = Date.now();
    const fingerprint = JSON.stringify(items.map(item => ({
      label: item.label, description: item.description, tooltip: item.tooltip,
      project: item instanceof ProjectItem
        ? [item.project.kind, item.project.uri.toString(), item.project.remoteAuthority] : undefined,
    })));
    if (fingerprint !== this.fingerprint) {
      this.items = items;
      this.fingerprint = fingerprint;
      this.changed.fire();
    }
  }

  private status(label: string, tooltip: string, icon: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label);
    item.tooltip = tooltip;
    item.iconPath = new vscode.ThemeIcon(icon);
    item.command = { command: 'recentSwitcher.openRecent', title: 'Open Recent' };
    return item;
  }

  dispose(): void { this.disposed = true; this.changed.dispose(); }
}
