import * as vscode from 'vscode';
import { homedir } from 'node:os';
import { basename, sep } from 'node:path';

export interface RecentProject {
  readonly kind: 'folder' | 'workspace';
  readonly uri: vscode.Uri;
  readonly remoteAuthority?: string;
}

export function projectName(project: RecentProject): string {
  const name = project.uri.scheme === 'file'
    ? basename(project.uri.fsPath)
    : project.uri.path.split('/').filter(Boolean).at(-1);
  return (project.kind === 'workspace' ? name?.replace(/\.code-workspace$/i, '') : name)
    || project.uri.authority || project.uri.path;
}

export function projectPath(project: RecentProject, abbreviated = false): string {
  if (project.uri.scheme !== 'file') return project.uri.toString(true);
  const path = project.uri.fsPath;
  const home = homedir();
  return abbreviated && (path === home || path.startsWith(home + sep))
    ? '~' + path.slice(home.length) : path;
}

export function canOpenDirectly(project: RecentProject): boolean {
  // The public command cannot carry a separate remoteAuthority. Delegate all
  // remote/virtual records to native Open Recent instead of guessing a route.
  return project.uri.scheme === 'file' && !project.remoteAuthority
    && (project.kind === 'folder' || /\.code-workspace$/i.test(project.uri.path));
}
