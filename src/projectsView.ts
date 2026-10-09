import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { ProjectItem, ProjectsTree } from './projectsTree';
import { projectInitials, projectName, projectPath } from './project';
import { openProject, openRecent } from './openProject';

export class ProjectsView implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;
  private readonly subscriptions: vscode.Disposable[] = [];
  private projects: ProjectItem[] = [];
  private revision = 0;
  private disposed = false;
  private readonly rechecks = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly extensionUri: vscode.Uri, private readonly model = new ProjectsTree()) {
    this.subscriptions.push(model.onDidChangeTreeData(() => { void this.render(); }));
  }
  setOpenProjects(opened: ReadonlySet<string>): Promise<void> { return this.model.setOpenProjects(opened); }
  get visible(): boolean { return this.view?.visible ?? false; }
  refresh(force = false): Promise<void> { return this.model.refresh(force); }

  async afterOpen(action: () => Promise<void>): Promise<void> {
    try { await action(); }
    finally {
      if (!this.disposed) {
        await this.model.refreshLatest();
        // Native dialogs/history updates may finish after the command resolves.
        for (const delay of this.disposed ? [] : [250, 1000, 3000]) {
          const timer = setTimeout(() => {
            this.rechecks.delete(timer);
            if (!this.disposed) void this.model.refreshLatest();
          }, delay);
          this.rechecks.add(timer);
        }
      }
    }
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')] };
    const nonce = randomBytes(16).toString('hex');
    const resource = (name: string) => view.webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', name));
    view.webview.html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${view.webview.cspSource}; script-src 'nonce-${nonce}';">
      <link rel="stylesheet" href="${resource('projects.css')}"></head>
      <body><main id="projects" aria-label="Recent projects"></main><script nonce="${nonce}" src="${resource('projects.js')}"></script></body></html>`;
    this.subscriptions.push(
      view.webview.onDidReceiveMessage((message: unknown) => {
        if (!message || typeof message !== 'object') return;
        const data = message as Record<string, unknown>;
        if (data.type === 'ready') { void this.render(); return; }
        if (data.type === 'recent') { void this.afterOpen(openRecent); return; }
        if (data.type !== 'open' || data.revision !== this.revision || !Number.isInteger(data.index)) return;
        const item = this.projects[data.index as number];
        if (item) void this.afterOpen(() => openProject(item.project));
      }),
      view.onDidChangeVisibility(() => { if (view.visible) void this.refresh(); }),
      view.onDidDispose(() => { if (this.view === view) this.view = undefined; }),
    );
  }

  private async render(): Promise<void> {
    const items = await this.model.getChildren();
    if (!this.view) return;
    this.projects = items.filter((item): item is ProjectItem => item instanceof ProjectItem);
    await this.view.webview.postMessage({
      type: 'projects', revision: ++this.revision,
      projects: this.projects.map(item => ({
        name: projectName(item.project), path: projectPath(item.project, true),
        initials: projectInitials(projectName(item.project)), current: item.current, state: item.state,
        tooltip: item.tooltip,
      })),
      status: this.projects.length ? undefined : { label: items[0]?.label, tooltip: items[0]?.tooltip },
    });
  }
  dispose(): void { this.disposed = true; this.rechecks.forEach(clearTimeout); this.rechecks.clear(); this.model.dispose(); this.subscriptions.forEach(subscription => subscription.dispose()); }
}
