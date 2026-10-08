import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import { join } from 'node:path';
import { loadRecentProjects } from '../src/recentProjects';
import { ProjectsTree, ProjectItem } from '../src/projectsTree';

export async function run(): Promise<void> {
  const root = process.env.RECENT_SWITCHER_TEST_DIR;
  assert.ok(root);
  const folder = vscode.Uri.file(join(root, 'folder'));
  const workspace = vscode.Uri.file(join(root, 'sample.code-workspace'));
  // Test-only seeding via VS Code itself; production never writes history.
  await vscode.commands.executeCommand('_workbench.addToRecentlyOpened', { uri: folder, type: 'folder' });
  await vscode.commands.executeCommand('_workbench.addToRecentlyOpened', { uri: workspace, type: 'workspace' });
  const raw: unknown = await vscode.commands.executeCommand('_workbench.getRecentlyOpened');
  assert.ok(raw && typeof raw === 'object' && 'workspaces' in raw);
  const projects = await loadRecentProjects();
  assert.ok(projects.some(p => p.kind === 'folder' && p.uri.toString() === folder.toString()));
  assert.ok(projects.some(p => p.kind === 'workspace' && p.uri.toString() === workspace.toString()));
  const extension = vscode.extensions.all.find(e => e.packageJSON.name === 'recent-switcher');
  assert.ok(extension);
  await extension.activate();
  assert.ok(extension.isActive);
  await vscode.commands.executeCommand('recentSwitcher.projects.focus');
  await vscode.commands.executeCommand('recentSwitcher.refresh');
  const tree = new ProjectsTree();
  const items = await tree.getChildren();
  assert.ok(items.some(i => i instanceof ProjectItem && i.project.uri.toString() === workspace.toString()));
  tree.dispose();
  console.log(`PASS: VS Code ${vscode.version}; native folder/workspace history, activation, view focus and refresh (${projects.length} projects).`);
}
