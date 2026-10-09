# Recent Switcher

[English](README.md) | 简体中文

Recent Switcher 在侧边栏列出最近打开的 VS Code 文件夹和工作区，点击即可切换。安装前的历史记录也会显示，无需配置、登录、扫描目录或另存项目列表。

## 核心功能

- 在 Activity Bar（活动栏）中提供 Recent Switcher 入口，侧边栏视图为 Recent Projects。
- 读取 VS Code 原生最近历史，包括安装插件之前的记录；当前项目置顶并显示主题色小勾，其后是其他窗口已打开的项目，最后是未检测到打开的项目；每组保留原有顺序，不展示单个文件。
- 名称和路径分两行展示，保留完整路径提示；使用项目名称的首字母缩略图。当前项目采用实心主题色，其他已打开项目采用主题色描边和圆点，其余采用中性色。本地主目录可缩写为 `~`。
- 单击本地文件夹或已保存的 `.code-workspace`：空窗口直接在当前窗口打开；已打开文件夹或工作区时，在新窗口打开。
- 首次展示、重新显示侧边栏、侧边栏可见时窗口重新获得焦点，都会触发刷新；打开操作结束后会重新读取历史并短暂复查，包括不存在路径被原生历史移除的情况。面板可见时也会每五秒核对历史，或点击顶部按钮手动刷新。
- 窗口打开或关闭后，通过文件通知更新项目状态，定期心跳作为兜底。新窗口中的插件完成登记后，项目才会显示为已打开。
- 区分空列表和读取失败状态，提供原生 Open Recent 打开入口。

## 安装与使用

要求使用 VS Code 桌面版，支持的版本范围见 `package.json` 中的 `engines.vscode`。当前尚未发布到 Marketplace。

按照下方说明构建 VSIX，然后在 VS Code 中执行 Extensions: Install from VSIX...（扩展：从 VSIX 安装……），选择生成的安装包。点击活动栏中的 Recent Switcher 图标，再点击项目即可打开。顶部历史按钮可打开 VS Code 原生 Open Recent 列表。

远程记录及暂不支持直接打开的工作区仍会显示，并带有 Open Recent 提示。点击后会说明限制并提供原生列表入口，请在该列表中选择项目；此时窗口打开行为由原生列表控制。

## 本地开发

使用 Node.js 和 pnpm。Node.js 版本要求及固定的 pnpm 版本分别见 `package.json` 中的 `engines.node` 和 `packageManager`。

```sh
git clone git@github.com:wangxiaocuo/vscode-recent-switcher.git
cd vscode-recent-switcher
pnpm install
pnpm check
pnpm lint
pnpm test
pnpm build
```

在 VS Code 中打开项目，按 F5，使用 Run Recent Switcher 调试配置。启动前会自动构建插件。进入 Extension Development Host（扩展开发宿主）后，点击插件的活动栏图标。

开发时可运行 `pnpm watch` 自动重新构建；代码修改后，重新加载扩展开发宿主以加载新版本。

运行真实 Extension Host 集成测试：

```sh
pnpm test:integration
```

测试运行器默认通过 `@vscode/test-electron` 下载 VS Code。如需使用本机已安装版本，可通过 `VSCODE_EXECUTABLE_PATH` 指定可执行文件，例如：

```sh
VSCODE_EXECUTABLE_PATH='/Applications/Visual Studio Code.app/Contents/MacOS/Code' pnpm test:integration
```

自动集成测试使用独立的临时用户配置和扩展目录，在激活插件前向原生历史写入临时文件夹、工作区记录，不修改个人最近历史。测试配置保留在系统临时目录，便于排查问题。

## 构建与打包

```sh
pnpm package
```

该命令执行类型检查、代码检查和构建，然后在项目根目录生成 `recent-switcher-<version>.vsix`，版本号取自 `package.json`。插件没有运行时依赖，安装包包含构建产物、侧边栏资源、图标、扩展清单和文档。

`package.json` 中的 Marketplace publisher 已配置为 wangxiaocuo。仓库地址已配置为 `wangxiaocuo/vscode-recent-switcher`。上述脚本只进行本地开发和打包，不会自动发布到 Marketplace。

## 技术实现

```text
src/
  extension.ts       插件激活、命令注册、可见性和焦点事件订阅
  recentProjects.ts  内部命令调用、运行时校验和数据转换
  project.ts         项目类型、名称/路径展示、直接打开条件
  projectsTree.ts    项目状态、当前项目排序和刷新协调
  projectsView.ts    双行侧边栏 Webview 和消息处理
  openProject.ts     公开打开命令和原生打开入口
  openProjects.ts    窗口会话、文件通知和存活检查
media/               活动栏图标、扩展 logo 和侧边栏 CSS/JavaScript
scripts/             esbuild 构建和隔离 Extension Host 测试运行器
test/                Node 自动测试及真实 Extension Host 集成测试
.vscode/             F5 调试配置和构建任务
```

插件在窗口启动后激活，也可通过打开视图或执行命令激活。侧边栏使用 `window.registerWebviewViewProvider`，项目状态和刷新逻辑保留在 `projectsTree.ts` 中。方向键、Home 和 End 可用于浏览列表。

窗口焦点和视图可见性变化会触发刷新。并发请求会合并，自动刷新间隔至少为一秒；历史数据没有变化时不触发更新。插件监听扩展全局存储中的会话文件变化，收到通知后立即更新窗口状态；每五秒一次的心跳检查用于补偿遗漏的文件通知。正常退出时删除会话，已结束进程或超过 30 秒未更新的记录会被忽略。事件订阅随插件一起释放。

读取原生历史使用非公开内部命令 `_workbench.getRecentlyOpened`。它不属于稳定的 Extension API，未来 VS Code 更新可能导致不兼容。内部命令和运行时校验集中封装在 `recentProjects.ts`，已观察到的返回结构如下：

```ts
{
  workspaces: Array<
    { folderUri: URI; label?: string; remoteAuthority?: string } |
    { workspace: { id: string; configPath: URI }; label?: string; remoteAuthority?: string }
  >;
  files: unknown[];
}
```

插件只转换 `workspaces` 数组，同时接受 URI 实例和 URI 组件对象。遇到未知或无效格式时，显示历史记录不可用的提示。插件不维护独立历史，也不改写原生历史。

打开本地文件夹和已保存工作区时，使用公开的 `vscode.openFolder` 命令，显式指定 `forceNewWindow` / `forceReuseWindow` 和 `forceLocalWindow`。打开目标始终使用原始 URI，不依赖显示名称；远程 URI 不会被转换为本地路径。

开发时核对的源码与文档：

- [VS Code 工作区命令实现](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/browser/actions/workspaceCommands.ts)
- [VS Code 原生最近历史类型](https://github.com/microsoft/vscode/blob/main/src/vs/platform/workspaces/common/workspaces.ts)
- [VS Code 内置命令文档](https://code.visualstudio.com/api/references/commands)

## 已知限制

- 已打开状态仅覆盖共享扩展存储、且已激活插件的窗口。更新后需重新加载已有窗口；不同配置文件或安装实例可能不共享状态。未启用插件的窗口，以及用本地工作区文件表示的远程窗口，无法可靠识别。扩展宿主暂停时可能暂时被视为已关闭。
- 仅支持桌面版，不支持 VS Code for the Web 和虚拟工作区。
- Remote SSH、WSL 和 Dev Containers 记录会展示，但通过原生 Open Recent 打开。公开的文件夹打开命令无法为本地工作区文件单独传递 `remoteAuthority`；远程连接尚未进行端到端实测。
- 未保存的工作区及其他不支持的工作区 URI 同样使用原生打开入口。
- 没有公开事件可直接监听原生最近历史变化。视图切换、焦点恢复、手动刷新或检测到已打开项目集合变化时，会重新读取历史。打开操作结束后也会刷新并短暂复查。面板可见时每五秒核对一次，以同步其他原生历史变更。
- 名称和路径分两行显示。侧边栏较窄时文字会截断，可悬停查看完整路径。
- 不主动扫描或移除已经删除、移动的项目，由 VS Code 处理打开错误。
- 当前项目标记使用精确 URI 比较；路径大小写或符号链接别名不同可能导致无法标记。
- 历史范围与可用性取决于 VS Code 自身的存储和运行环境。最低版本根据所用 API 类型版本声明，不支持更早版本。

## 验证情况

macOS arm64 下的 TypeScript 类型检查、Oxlint、esbuild 构建、自动测试和 VSIX 打包均通过。

单元测试覆盖历史解析与失败恢复、并发刷新合并、当前项目排序、首字母提取和窗口打开参数，也覆盖窗口会话共享、同一项目的多个窗口、过期及无效记录，以及窗口开关时的文件通知。空窗口会被复用；已打开文件夹或工作区时，默认在新窗口打开，包括没有文件夹的工作区。

本机 VS Code 桌面版下的隔离 Extension Host 测试已通过，覆盖原生文件夹和工作区记录读取、插件激活、视图聚焦及刷新。

最新侧边栏样式尚未完成视觉验收。Windows、Linux、最低支持版本的 VS Code、浅色及高对比主题、真实远程连接尚未人工测试。窗口打开参数已有单元测试覆盖，实际空窗口复用尚未人工验证。

## 隐私

插件运行时不发起网络请求、不收集遥测、不存储项目历史。为识别其他窗口，会在本地会话文件中保存当前项目 URI、可用的远程标识、进程 ID 和心跳时间。正常退出时删除文件；异常退出留下的记录在进程结束或过期后被忽略。开发依赖安装、VS Code 自身行为以及测试运行器可选的 VS Code 下载，不属于插件运行时行为。

## 许可证

[MIT](LICENSE)。
