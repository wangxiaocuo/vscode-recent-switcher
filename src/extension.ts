import * as vscode from 'vscode';
import { join } from 'node:path';
import { OpenProjectsRegistry } from './openProjects';
import { currentProject, projectKey } from './project';

import { openProject, openRecent } from './openProject';
import { ProjectItem } from './projectsTree';
import { ProjectsView } from './projectsView';

let registry: OpenProjectsRegistry | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const provider = new ProjectsView(context.extensionUri);
  registry = new OpenProjectsRegistry(join(context.globalStorageUri.fsPath, 'open-windows'));
  let syncing = false;
  const sync = async () => {
    if (syncing) return;
    syncing = true;
    try {
      const project = currentProject();
      // A local workspace file on a remote window lacks a public full authority.
      const key = project && !(vscode.env.remoteName && project.uri.scheme === 'file') ? projectKey(project) : null;
      await provider.setOpenProjects(await registry!.update(key));
    } catch { /* Presence is best effort; recent history remains available. */ }
    finally { syncing = false; }
  };
  void registry.watch(keys => provider.setOpenProjects(keys)).catch(() => undefined);
  void sync();
  const timer = setInterval(() => { void sync(); }, 5000);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });
  const view = vscode.window.registerWebviewViewProvider('recentSwitcher.projects', provider);
  context.subscriptions.push(
    provider, view,
    vscode.commands.registerCommand('recentSwitcher.refresh', async () => { await sync(); await provider.refresh(true); }),
    vscode.commands.registerCommand('recentSwitcher.openRecent', openRecent),
    vscode.commands.registerCommand('recentSwitcher.open', (item: unknown) => item instanceof ProjectItem ? openProject(item.project) : undefined),
    vscode.commands.registerCommand('recentSwitcher.openCurrent', (item: unknown) => item instanceof ProjectItem ? openProject(item.project, false) : undefined),
    vscode.window.onDidChangeWindowState(event => { if (event.focused) void sync(); if (event.focused && provider.visible) void provider.refresh(); }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => { void sync(); if (provider.visible) void provider.refresh(true); }),
  );
}

export async function deactivate(): Promise<void> { await registry?.dispose(); }
