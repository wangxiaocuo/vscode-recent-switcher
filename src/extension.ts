import * as vscode from 'vscode';
import { openProject, openRecent } from './openProject';
import { ProjectItem } from './projectsTree';
import { ProjectsView } from './projectsView';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new ProjectsView(context.extensionUri);
  const view = vscode.window.registerWebviewViewProvider('recentSwitcher.projects', provider);
  context.subscriptions.push(
    provider, view,
    vscode.commands.registerCommand('recentSwitcher.refresh', () => provider.refresh(true)),
    vscode.commands.registerCommand('recentSwitcher.openRecent', openRecent),
    vscode.commands.registerCommand('recentSwitcher.open', (item: unknown) => item instanceof ProjectItem ? openProject(item.project) : undefined),
    vscode.commands.registerCommand('recentSwitcher.openCurrent', (item: unknown) => item instanceof ProjectItem ? openProject(item.project, false) : undefined),
    vscode.window.onDidChangeWindowState(event => { if (event.focused && provider.visible) void provider.refresh(); }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => { if (provider.visible) void provider.refresh(true); }),
  );
}
