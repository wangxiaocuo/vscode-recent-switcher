import * as vscode from 'vscode';
import { openProject, openRecent } from './openProject';
import { ProjectItem, ProjectsTree } from './projectsTree';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new ProjectsTree();
  const view = vscode.window.createTreeView('recentSwitcher.projects', { treeDataProvider: provider, showCollapseAll: false });
  context.subscriptions.push(
    provider, view,
    vscode.commands.registerCommand('recentSwitcher.refresh', () => provider.refresh(true)),
    vscode.commands.registerCommand('recentSwitcher.openRecent', openRecent),
    vscode.commands.registerCommand('recentSwitcher.open', (item: unknown) => item instanceof ProjectItem ? openProject(item.project, true) : undefined),
    vscode.commands.registerCommand('recentSwitcher.openCurrent', (item: unknown) => item instanceof ProjectItem ? openProject(item.project, false) : undefined),
    view.onDidChangeVisibility(event => { if (event.visible) void provider.refresh(); }),
    vscode.window.onDidChangeWindowState(event => { if (event.focused && view.visible) void provider.refresh(); }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => { if (view.visible) void provider.refresh(true); }),
  );
}
