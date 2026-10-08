import * as vscode from 'vscode';
import { canOpenDirectly, type RecentProject } from './project';

export async function openRecent(): Promise<void> {
  try {
    await vscode.commands.executeCommand('workbench.action.openRecent');
  } catch {
    await vscode.window.showErrorMessage('Could not open VS Code Open Recent. Please use File > Open Recent.');
  }
}

export async function openProject(project: RecentProject, newWindow: boolean): Promise<void> {
  if (!canOpenDirectly(project)) {
    const action = await vscode.window.showInformationMessage(
      'This project needs VS Code’s native Open Recent to preserve its remote or workspace context. Select it there to continue.',
      'Open Recent',
    );
    if (action) await openRecent();
    return;
  }
  try {
    await vscode.commands.executeCommand('vscode.openFolder', project.uri, {
      forceNewWindow: newWindow, forceReuseWindow: !newWindow, forceLocalWindow: true,
    });
  } catch {
    const action = await vscode.window.showErrorMessage('Could not open this project. It may have moved or become unavailable.', 'Open Recent');
    if (action) await openRecent();
  }
}
