# Recent Switcher

English | [简体中文](README.zh-CN.md)

Recent Switcher lists your recently opened VS Code folders and workspaces in the sidebar, including projects opened before you installed it. You can switch projects without configuring the extension, signing in, scanning folders or saving a separate project list.

## Layout example

```text
┌──────────────────────────────────────────────┐
│ RECENT PROJECTS                  History  ↻  │
├──────────────────────────────────────────────┤
│ [RS]  recent-switcher                     ✓  │
│       ~/projects/recent-switcher             │
│                                              │
│ [WA]  web-app                             ●  │
│       ~/projects/web-app                     │
│                                              │
│ [DS]  design-system                          │
│       ~/projects/design-system               │
│                                              │
│ [D]   docs                                   │
│       ~/projects/docs.code-workspace         │
└──────────────────────────────────────────────┘
```

Illustrative layout with sample projects. `✓` marks the current project; `●` marks a project detected in another window. Unmarked projects are not detected as open. Names and paths occupy separate lines; actual colors and icons follow your VS Code theme.

## Features

- A Recent Switcher Activity Bar entry with a Recent Projects list.
- The current project appears first with a theme-colored checkmark, followed by projects detected in other windows, then projects not detected as open. Each group keeps native recent-history order. Individual files are excluded.
- Two-line project names and paths, initial avatars, and full-path tooltips. Current-project avatars use a solid accent; other open projects use an accent outline and dot; remaining projects use neutral colors. Local home paths are abbreviated to `~`.
- Single-click a local folder or saved `.code-workspace` to open it in the current window when empty, or a new window when a folder or workspace is already open.
- Refresh on first display, when the view becomes visible, and when its visible window regains focus. After an open attempt, the list reloads native history and briefly rechecks for delayed changes, including removal of missing paths. While visible, the panel also checks history every five seconds. A toolbar refresh button is available.
- Opening or closing a window updates project status through file notifications, with a periodic heartbeat as a fallback. A new window appears as open once its extension instance registers.
- Distinct empty and failure states, with a native Open Recent fallback.

## Install and use

Requires VS Code Desktop. See `engines.vscode` in `package.json` for the supported version range. This project is not yet published to the Marketplace.

Build a VSIX using the instructions below, then run Extensions: Install from VSIX... in VS Code. Select the Recent Switcher Activity Bar icon and click a project. The history toolbar button opens VS Code's native Open Recent picker.

Remote and unsupported workspace entries remain visible with an Open Recent tooltip. Clicking one explains the limitation and offers the native picker; select the project there. The picker controls its own window behavior.

## Development

Use Node.js and pnpm. The Node.js requirement and pinned pnpm version are defined by `engines.node` and `packageManager` in `package.json`.

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

This runs type checking, linting and the production build, then creates `recent-switcher-<version>.vsix` in the project root, using the version from `package.json`. There are no runtime dependencies; the package includes the bundle, sidebar assets, icons, manifest and documentation.

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
  openProjects.ts    Window sessions, file notifications and liveness checks
media/               Activity Bar icon, extension logo and sidebar CSS/JavaScript
scripts/             esbuild and isolated Extension Host runner
test/                Node unit tests and real Extension Host integration test
.vscode/             F5 launch and build task
```

The extension activates after window startup, or when its view or a command is opened. The sidebar uses `window.registerWebviewViewProvider`; project state and refresh coordination stay in `projectsTree.ts`. Arrow keys, Home and End navigate the list.

Window focus and view visibility events trigger refreshes. Concurrent requests are merged, automatic refreshes are limited to once per second, and unchanged history does not trigger an update. Window presence updates when session files change in extension global storage; a five-second heartbeat also checks state if a file notification is missed. Normal shutdown removes the session; dead processes and sessions older than 30 seconds are ignored. Event subscriptions are disposed with the extension.

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

- Open-window detection covers windows sharing the extension storage where the extension is active. Reload existing windows after updating. Different profiles or installations may not share state. Disabled extensions and remote windows represented by a local workspace file cannot be detected reliably. A suspended extension host may temporarily appear closed.
- Desktop extension only; VS Code for the Web and virtual workspaces are not supported.
- Remote SSH, WSL and Dev Containers records are displayed but opened through native Open Recent. The public folder command cannot forward a separate `remoteAuthority` for a local workspace file. Remote connections have not been tested end to end.
- Untitled or otherwise unsupported workspace URIs also use the native fallback.
- No public event exposes native recent-history changes. History is refreshed on view/focus changes, manual refresh, or a detected change in the set of open projects. Open attempts also trigger a refresh and short follow-up checks. While the panel is visible, a five-second check catches other native-history changes.
- Names and paths use separate lines. Narrow sidebars truncate each line; tooltips show full paths.
- Renamed/deleted projects are not proactively scanned or removed. VS Code handles their opening errors.
- Current-project marking uses exact URI equality. Differently cased paths or symlink aliases may not receive the marker.
- Availability and history scope depend on VS Code's own storage/environment. The minimum version is declared against the API type version; older releases are not supported.

## Validation

TypeScript checks, Oxlint, esbuild, automated tests and VSIX packaging pass on macOS arm64.

The unit tests cover history parsing and recovery, refresh coalescing, current-project ordering, initials, and window-opening options. They also cover shared window sessions, duplicate projects across windows, expired or invalid records, and file notifications when windows open or close. Empty windows reuse the current window; an existing folder or workspace, including a workspace with no folders, causes the default action to open a new window.

Isolated Extension Host tests passed with the locally installed VS Code Desktop. They check native folder/workspace history, extension activation, view focus and refresh.

The latest sidebar styling has not completed a visual acceptance pass. Windows, Linux, the minimum supported VS Code release, light/high-contrast themes and live remote connections have not been manually tested. Window-opening options are covered by unit tests; reuse of a live empty window has not been manually verified.

## Privacy

The extension makes no network requests, collects no telemetry, and stores no project history. It writes local session files containing the current project URI, remote authority when available, process ID and heartbeat time to detect other open windows. Normal shutdown deletes the file; crash leftovers are ignored once dead or expired. Development dependency installation, VS Code itself, and the test runner's optional VS Code download are separate from extension runtime behavior.

## License

MIT. See the included LICENSE file.
