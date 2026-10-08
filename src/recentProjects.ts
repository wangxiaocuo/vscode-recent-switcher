import * as vscode from 'vscode';
import type { RecentProject } from './project';

// Private workbench contract. Keep it here; never expose it to the tree or opener.
interface NativeRecentFolder {
  folderUri: vscode.Uri;
  remoteAuthority?: string;
}
interface NativeRecentWorkspace {
  workspace: { id: string; configPath: vscode.Uri };
  remoteAuthority?: string;
}
interface NativeRecentlyOpened {
  workspaces: (NativeRecentFolder | NativeRecentWorkspace)[];
  files: unknown[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function uri(value: unknown): vscode.Uri {
  if (!record(value) || typeof value.scheme !== 'string' || !/^[a-z][a-z\d+.-]*$/i.test(value.scheme)
    || typeof value.path !== 'string' || !value.path.startsWith('/')
    || ['authority', 'query', 'fragment'].some(key => value[key] !== undefined && typeof value[key] !== 'string')) {
    throw new Error('Unsupported URI in VS Code recent history.');
  }
  // Accept both revived Uri instances and serialized URI components.
  return vscode.Uri.from({
    scheme: value.scheme, path: value.path,
    authority: typeof value.authority === 'string' ? value.authority : undefined,
    query: typeof value.query === 'string' ? value.query : undefined,
    fragment: typeof value.fragment === 'string' ? value.fragment : undefined,
  });
}
function parseNative(value: unknown): NativeRecentlyOpened {
  if (!record(value) || !Array.isArray(value.workspaces) || !Array.isArray(value.files)) {
    throw new Error('VS Code returned an unsupported recent-history format.');
  }
  const workspaces = value.workspaces.map((entry: unknown): NativeRecentFolder | NativeRecentWorkspace => {
    if (!record(entry) || (entry.remoteAuthority !== undefined && typeof entry.remoteAuthority !== 'string')) {
      throw new Error('VS Code returned an invalid recent project.');
    }
    const remoteAuthority = entry.remoteAuthority as string | undefined;
    if ('folderUri' in entry && !('workspace' in entry)) return { folderUri: uri(entry.folderUri), remoteAuthority };
    if (!('folderUri' in entry) && record(entry.workspace) && typeof entry.workspace.id === 'string') {
      return { workspace: { id: entry.workspace.id, configPath: uri(entry.workspace.configPath) }, remoteAuthority };
    }
    throw new Error('VS Code returned an unsupported recent project.');
  });
  return { workspaces, files: value.files };
}

export function parseRecentProjects(value: unknown): RecentProject[] {
  return parseNative(value).workspaces.map(entry => 'folderUri' in entry
    ? { kind: 'folder', uri: entry.folderUri, remoteAuthority: entry.remoteAuthority }
    : { kind: 'workspace', uri: entry.workspace.configPath, remoteAuthority: entry.remoteAuthority });
}

export async function loadRecentProjects(): Promise<RecentProject[]> {
  const raw: unknown = await vscode.commands.executeCommand('_workbench.getRecentlyOpened');
  return parseRecentProjects(raw);
}
