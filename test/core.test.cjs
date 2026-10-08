const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

class Uri {
  constructor(value) { Object.assign(this, { authority: '', query: '', fragment: '' }, value); }
  static from(value) { return new Uri(Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined))); }
  get fsPath() { return this.path; }
  toString() { return `${this.scheme}://${this.authority}${this.path}`; }
}
class TreeItem { constructor(label) { this.label = label; } }
const calls = [];
const vscode = {
  Uri, TreeItem, TreeItemCollapsibleState: { None: 0 }, ThemeIcon: class { constructor(id) { this.id = id; } },
  workspace: {},
  EventEmitter: class {
    emitter = new EventEmitter();
    event = listener => { this.emitter.on('change', listener); return { dispose: () => this.emitter.off('change', listener) }; };
    fire() { this.emitter.emit('change'); }
    dispose() { this.emitter.removeAllListeners(); }
  },
  commands: { executeCommand: async (...args) => { calls.push(args); } },
  window: { showInformationMessage: async () => undefined, showErrorMessage: async () => undefined },
};
function load(file) {
  const code = buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], write: false }).outputFiles[0].text;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: id => id === 'vscode' ? vscode : require(id), setTimeout, clearTimeout, console });
  return module.exports;
}
const { parseRecentProjects } = load('src/recentProjects.ts');
const { ProjectsTree } = load('src/projectsTree.ts');
const { openProject } = load('src/openProject.ts');
const uri = (path, scheme = 'file') => ({ scheme, path });

test('parses native folders/workspaces in order, excluding files; preserves remote identity', () => {
  const projects = parseRecentProjects({ workspaces: [
    { folderUri: uri('/a/same') },
    { workspace: { id: 'test', configPath: uri('/b/team.code-workspace') } },
    { folderUri: { ...uri('/srv/same', 'vscode-remote'), authority: 'ssh-remote+host' }, remoteAuthority: 'ssh-remote+host' },
  ], files: [{ fileUri: uri('/a/file.txt') }] });
  assert.equal(projects.length, 3);
  assert.equal(projects[0].uri.path, '/a/same');
  assert.equal(projects[1].kind, 'workspace');
  assert.equal(projects[2].uri.authority, 'ssh-remote+host');
  assert.equal(projects[2].remoteAuthority, 'ssh-remote+host');
});

test('rejects changed contracts and malformed records instead of presenting empty history', () => {
  for (const raw of [undefined, {}, {workspaces: [], files: null}, {workspaces: [null], files: []},
    {workspaces: [{folderUri: uri('relative')}], files: []},
    {workspaces: [{folderUri: {...uri('/a'), authority: 1}}], files: []},
    {workspaces: [{workspace: { configPath: uri('/a') }}], files: []}]) {
    assert.throws(() => parseRecentProjects(raw));
  }
});

test('empty and failed history have distinct actionable states and recover on refresh', async () => {
  let fail = false;
  const tree = new ProjectsTree(async () => { if (fail) throw new Error('missing command'); return []; });
  let items = await tree.getChildren();
  assert.equal(items[0].label, 'No recent projects yet');
  fail = true;
  await tree.refresh(true);
  items = await tree.getChildren();
  assert.match(items[0].label, /unavailable/);
  assert.equal(items[0].command.command, 'recentSwitcher.openRecent');
  fail = false;
  await tree.refresh(true);
  assert.equal((await tree.getChildren())[0].label, 'No recent projects yet');
  tree.dispose();
});

test('coalesces concurrent requests, throttles automatic refresh and suppresses unchanged UI updates', async () => {
  let resolve;
  let count = 0;
  const tree = new ProjectsTree(() => { count++; return new Promise(done => { resolve = done; }); });
  let events = 0;
  tree.onDidChangeTreeData(() => events++);
  const first = tree.refresh();
  assert.equal(tree.refresh(true), first);
  resolve([]);
  await first;
  await tree.refresh();
  assert.equal(count, 1);
  const second = tree.refresh(true);
  resolve([]);
  await second;
  assert.equal(events, 1);
  tree.dispose();
});

test('folder and workspace opening explicitly enforce new/reuse/local options using full URI', async () => {
  calls.length = 0;
  for (const kind of ['folder', 'workspace']) {
    const project = { kind, uri: Uri.from(uri(kind === 'folder' ? '/a/same' : '/b/same.code-workspace')) };
    await openProject(project, true);
    await openProject(project, false);
  }
  assert.equal(calls.length, 4);
  assert.equal(calls[0][0], 'vscode.openFolder');
  assert.equal(calls[0][2].forceNewWindow, true);
  assert.equal(calls[0][2].forceLocalWindow, true);
  assert.equal(calls[1][2].forceReuseWindow, true);
  assert.equal(calls[2][1].path, '/b/same.code-workspace');
});

test('remote URI and local workspace with remote metadata are never opened as local folders', async () => {
  calls.length = 0;
  await openProject({kind: 'folder', uri: Uri.from(uri('/srv/a', 'vscode-remote'))}, true);
  await openProject({kind: 'workspace', uri: Uri.from(uri('/a.code-workspace')), remoteAuthority: 'ssh-remote+host'}, true);
  assert.equal(calls.length, 0);
});

test('nonempty trees refresh without serializing circular command arguments', async () => {
  const tree = new ProjectsTree(async () => [{kind: 'folder', uri: Uri.from(uri('/a/project'))}]);
  const items = await tree.getChildren();
  assert.equal(items[0].label, 'project');
  assert.equal(items[0].command.arguments[0], items[0]);
  await tree.refresh(true);
  tree.dispose();
});

test('current project sorts first without changing other history order', async () => {
  const projects = ['newest', 'current', 'older'].map(name => ({ kind: 'folder', uri: Uri.from(uri('/a/' + name)) }));
  vscode.workspace.workspaceFolders = [{ uri: projects[1].uri }];
  const tree = new ProjectsTree(async () => projects);
  try {
    const items = await tree.getChildren();
    assert.equal(items.map(item => item.label).join(','), 'current,newest,older');
    assert.equal(items[0].current, true);
    vscode.workspace.workspaceFolders = [{ uri: projects[2].uri }];
    await tree.refresh(true);
    assert.equal((await tree.getChildren())[0].label, 'older');
  } finally { tree.dispose(); vscode.workspace.workspaceFolders = undefined; }
});

test('saved workspace identity takes precedence over its first folder', async () => {
  vscode.workspace.workspaceFile = Uri.from(uri('/a/team.code-workspace'));
  vscode.workspace.workspaceFolders = [{ uri: Uri.from(uri('/a/folder')) }];
  const tree = new ProjectsTree(async () => [
    { kind: 'folder', uri: vscode.workspace.workspaceFolders[0].uri },
    { kind: 'workspace', uri: vscode.workspace.workspaceFile },
  ]);
  try {
    const items = await tree.getChildren();
    assert.equal(items[0].label, 'team');
    assert.equal(items[1].current, false);
  } finally { tree.dispose(); vscode.workspace.workspaceFile = undefined; vscode.workspace.workspaceFolders = undefined; }
});

test('initials handle separators, camel case, Unicode and empty names', () => {
  const { projectInitials } = load('src/project.ts');
  for (const [name, expected] of [['web-ruoyi-plus', 'WP'], ['server_ruoyi_plus', 'SP'], ['admin-web', 'AW'], ['myProject', 'MP'], ['中文项目', '中文'], ['x', 'X'], ['', '?']]) {
    assert.equal(projectInitials(name), expected);
  }
});

test('default opening reuses empty windows but preserves existing folders and empty saved workspaces', async () => {
  const project = { kind: 'folder', uri: Uri.from(uri('/a/target')) };
  const states = [
    { folders: undefined, file: undefined, newWindow: false },
    { folders: [], file: undefined, newWindow: false },
    { folders: [{ uri: Uri.from(uri('/a/existing')) }], file: undefined, newWindow: true },
    { folders: [], file: Uri.from(uri('/a/empty.code-workspace')), newWindow: true },
    { folders: [], file: Uri.from(uri('/a/untitled', 'untitled')), newWindow: true },
  ];
  try {
    for (const state of states) {
      vscode.workspace.workspaceFolders = state.folders;
      vscode.workspace.workspaceFile = state.file;
      calls.length = 0;
      await openProject(project);
      assert.equal(calls.length, 1);
      assert.equal(calls[0][0], 'vscode.openFolder');
      assert.equal(calls[0][2].forceNewWindow, state.newWindow);
      assert.equal(calls[0][2].forceReuseWindow, !state.newWindow);
      assert.equal(calls[0][2].forceLocalWindow, true);
    }
  } finally { vscode.workspace.workspaceFolders = undefined; vscode.workspace.workspaceFile = undefined; }
});
