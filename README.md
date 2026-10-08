# Recent Switcher

English | [简体中文](README.zh-CN.md)

Recent Switcher lists your recently opened VS Code folders and workspaces in the sidebar, including projects opened before you installed it. You can switch projects without configuring the extension, signing in, scanning folders or saving a separate project list.

## Features

- A Recent Switcher Activity Bar entry with a Recent Projects list.
- Current project pinned first with a theme-colored checkmark; remaining entries keep native recent-history order. Individual files are excluded.
- Two-line project names and paths, initial avatars, and full-path tooltips. Local home paths are abbreviated to `~`.
- Single-click a local folder or saved `.code-workspace` to open it in the current window when empty, or a new window when a folder or workspace is already open.
- Refresh on first display, when the view becomes visible, and when its visible window regains focus. A toolbar refresh button is also available.
- Distinct empty and failure states, with a native Open Recent fallback.

## Install and use

Requires VS Code Desktop 1.140 or newer. This project is not yet published to the Marketplace.

Build a VSIX using the instructions below, then run Extensions: Install from VSIX... in VS Code. Select the Recent Switcher Activity Bar icon and click a project. The history toolbar button opens VS Code's native Open Recent picker.

Remote and unsupported workspace entries remain visible with an Open Recent tooltip. Clicking one explains the limitation and offers the native picker; select the project there. The picker controls its own window behavior.

## Development

Use Node.js 22+ and pnpm (the pinned version is in `package.json`).

```sh
pnpm install
pnpm check
pnpm lint
pnpm test
pnpm build
```

Open this folder in VS Code and press F5 using Run Recent Switcher. The pre-launch task builds the extension. Select its Activity Bar icon in the Extension Development Host. Use `pnpm watch` for rebuilding while editing, then reload the Development Host to load changes.

```sh
pnpm test:integration
```

The integration runner downloads VS Code through `@vscode/test-electron` by default. To use an existing installation, set `VSCODE_EXECUTABLE_PATH` to its executable, for example:

```sh
VSCODE_EXECUTABLE_PATH='/Applications/Visual Studio Code.app/Contents/MacOS/Code' pnpm test:integration
```

Tests use a temporary, isolated user profile and extension directory. They seed native history with a temporary folder and workspace before activating the extension. They do not edit your personal recent history. Temporary test profiles remain in the system temporary directory for inspection.

## Package

```sh
pnpm package
```

This runs type checking, linting and the production build, then creates `recent-switcher-0.2.0.vsix`. There are no runtime dependencies; only the bundle, icon, manifest and documentation are packaged.

The Marketplace publisher in `package.json` is configured as wangxiaocuo. The repository is configured as `wangxiaocuo/vscode-recent-switcher`. These scripts build and package locally; they do not publish to the Marketplace.

## Implementation

```text
src/
  extension.ts       Activation, commands, visibility/focus subscriptions
  recentProjects.ts  Private workbench command and validated normalization
  project.ts         Small project model, labels and opening eligibility
  projectsTree.ts    Project state, current-project ordering, refresh coordination
  projectsView.ts    Theme-aware two-line sidebar webview
  openProject.ts     Public folder-opening command and native fallback
media/               Activity Bar icon, extension logo and sidebar CSS/JavaScript
scripts/             esbuild and isolated Extension Host runner
test/                Node unit tests and real Extension Host integration test
.vscode/             F5 launch and build task
```

The extension activates when its view or a command is opened. The sidebar uses `window.registerWebviewViewProvider`; project state and refresh coordination stay in `projectsTree.ts`. Arrow keys, Home and End navigate the list.

Window focus and view visibility events trigger refreshes. Concurrent requests are merged, automatic refreshes are limited to once per second, and unchanged history does not trigger an update. There is no polling. Event subscriptions are disposed with the extension.

Reading history uses the non-public `_workbench.getRecentlyOpened` command. It is not a stable Extension API and may break in a future VS Code release. All access and runtime validation are isolated in `recentProjects.ts`. The observed contract is:

```ts
{
  workspaces: Array<
    { folderUri: URI; label?: string; remoteAuthority?: string } |
    { workspace: { id: string; configPath: URI }; label?: string; remoteAuthority?: string }
  >;
  files: unknown[];
}
```

Only `workspaces` is normalized. URI instances and URI component objects are accepted; unknown or malformed records display a history-unavailable message. No independent history is stored, and native history is never rewritten by the extension.

Local folders and saved workspaces use the documented `vscode.openFolder` command with explicit `forceNewWindow` / `forceReuseWindow` and `forceLocalWindow` options. The original URI is used, never the displayed name. Remote URIs are never converted to local paths.

Source references checked during development:

- [VS Code workspace command implementation](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/browser/actions/workspaceCommands.ts)
- [VS Code native recent-history types](https://github.com/microsoft/vscode/blob/main/src/vs/platform/workspaces/common/workspaces.ts)
- [Documented built-in commands](https://code.visualstudio.com/api/references/commands)

## Known limitations

- Desktop extension only; VS Code for the Web and virtual workspaces are not supported.
- Remote SSH, WSL and Dev Containers records are displayed but opened through native Open Recent. The public folder command cannot forward a separate `remoteAuthority` for a local workspace file. Remote connections have not been tested end to end.
- Untitled or otherwise unsupported workspace URIs also use the native fallback.
- No public event exposes native recent-history changes. Changes made elsewhere appear on view/focus refresh or manual refresh, not continuously while the view remains focused.
- Names and paths use separate lines. Narrow sidebars truncate each line; tooltips show full paths.
- Renamed/deleted projects are not proactively scanned or removed. VS Code handles their opening errors.
- Current-project marking uses exact URI equality. Differently cased paths or symlink aliases may not receive the marker.
- Availability and history scope depend on VS Code's own storage/environment. The minimum version is declared against the API type version; older releases are not supported.

## Validation

TypeScript checks, Oxlint, esbuild, 11 automated tests and VSIX packaging pass on macOS arm64.

The unit tests cover history parsing and recovery, refresh coalescing, current-project ordering, initials, and window-opening options. Empty windows reuse the current window; an existing folder or workspace, including a workspace with no folders, causes the default action to open a new window.

Isolated Extension Host tests passed with VS Code 1.141.0. They check native folder/workspace history, extension activation, view focus and refresh.

The latest sidebar styling has not completed a visual acceptance pass. Windows, Linux, VS Code 1.140, light/high-contrast themes and live remote connections have not been manually tested. Window-opening options are covered by unit tests; reuse of a live empty window has not been manually verified.

## Privacy

The extension makes no network requests, collects no telemetry, and stores no project history. Development dependency installation, VS Code itself, and the test runner's optional VS Code download are separate from extension runtime behavior.

## License

MIT. See the included LICENSE file.
