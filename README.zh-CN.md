# Recent Switcher

[English](README.md) | 简体中文

Recent Switcher 在侧边栏列出最近打开的 VS Code 文件夹和工作区，点击即可切换。安装前的历史记录也会显示，无需配置、登录、扫描目录或另存项目列表。

## 核心功能

- 在 Activity Bar（活动栏）中提供 Recent Switcher 入口，侧边栏视图为 Recent Projects。
- 读取 VS Code 原生最近历史，包括安装插件之前的记录；当前项目置顶并显示主题色小勾，其余保留原有顺序，不展示单个文件。
- 名称和路径分两行展示，保留完整路径提示；使用项目名称的首字母缩略图。本地主目录可缩写为 `~`。
- 单击本地文件夹或已保存的 `.code-workspace`：空窗口直接在当前窗口打开；已打开文件夹或工作区时，在新窗口打开。
- 首次展示、重新显示侧边栏、侧边栏可见时窗口重新获得焦点，都会触发刷新；也可点击顶部刷新按钮。
- 区分空列表和读取失败状态，提供原生 Open Recent 打开入口。

## 安装与使用

要求使用 VS Code 桌面版 1.140 或更新版本。当前尚未发布到 Marketplace。

按照下方说明构建 VSIX，然后在 VS Code 中执行 Extensions: Install from VSIX...（扩展：从 VSIX 安装……），选择生成的安装包。点击活动栏中的 Recent Switcher 图标，再点击项目即可打开。顶部历史按钮可打开 VS Code 原生 Open Recent 列表。

远程记录及暂不支持直接打开的工作区仍会显示，并带有 Open Recent 提示。点击后会说明限制并提供原生列表入口，请在该列表中选择项目；此时窗口打开行为由原生列表控制。

## 本地开发

使用 Node.js 22+ 和 pnpm，固定的 pnpm 版本见 `package.json`。

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

该命令执行类型检查、代码检查和构建，然后生成 `recent-switcher-0.2.0.vsix`。插件没有运行时依赖，安装包包含构建产物、图标、扩展清单和文档。

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
media/               活动栏图标、扩展 logo 和侧边栏 CSS/JavaScript
scripts/             esbuild 构建和隔离 Extension Host 测试运行器
test/                Node 自动测试及真实 Extension Host 集成测试
.vscode/             F5 调试配置和构建任务
```

插件在打开视图或执行命令时激活。侧边栏使用 `window.registerWebviewViewProvider`，项目状态和刷新逻辑保留在 `projectsTree.ts` 中。方向键、Home 和 End 可用于浏览列表。

窗口焦点和视图可见性变化会触发刷新。并发请求会合并，自动刷新间隔至少为一秒；历史数据没有变化时不触发更新。插件不轮询，事件订阅随插件一起释放。

读取原生历史使用非公开内部命令 `_workbench.getRecentlyOpened`。它不属于稳定的 Extension API，未来 VS Code 更新可能导致不兼容。 内部命令和运行时校验集中封装在 `recentProjects.ts`，已观察到的返回结构如下：

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

- 仅支持桌面版，不支持 VS Code for the Web 和虚拟工作区。
- Remote SSH、WSL 和 Dev Containers 记录会展示，但通过原生 Open Recent 打开。公开的文件夹打开命令无法为本地工作区文件单独传递 `remoteAuthority`；远程连接尚未进行端到端实测。
- 未保存的工作区及其他不支持的工作区 URI 同样使用原生打开入口。
- 没有公开事件可直接监听原生最近历史变化。在其他窗口发生的变化会在视图切换、焦点恢复或手动刷新后显示，不会在持续聚焦时实时更新。
- 名称和路径分两行显示。侧边栏较窄时文字会截断，可悬停查看完整路径。
- 不主动扫描或移除已经删除、移动的项目，由 VS Code 处理打开错误。
- 当前项目标记使用精确 URI 比较；路径大小写或符号链接别名不同可能导致无法标记。
- 历史范围与可用性取决于 VS Code 自身的存储和运行环境。最低版本根据所用 API 类型版本声明，不支持更早版本。

## 验证情况

macOS arm64 下的 TypeScript 类型检查、Oxlint、esbuild 构建、11 项自动测试和 VSIX 打包均通过。

单元测试覆盖历史解析与失败恢复、并发刷新合并、当前项目排序、首字母提取和窗口打开参数。空窗口会被复用；已打开文件夹或工作区时，默认在新窗口打开，包括没有文件夹的工作区。

VS Code 1.141.0 下的隔离 Extension Host 测试已通过，覆盖原生文件夹和工作区记录读取、插件激活、视图聚焦及刷新。

最新侧边栏样式尚未完成视觉验收。Windows、Linux、VS Code 1.140、浅色及高对比主题、真实远程连接尚未人工测试。窗口打开参数已有单元测试覆盖，实际空窗口复用尚未人工验证。

## 隐私

插件运行时不发起网络请求、不收集遥测、不存储项目历史。开发依赖安装、VS Code 自身行为以及测试运行器可选的 VS Code 下载，不属于插件运行时行为。

## 许可证

[MIT](LICENSE)。
