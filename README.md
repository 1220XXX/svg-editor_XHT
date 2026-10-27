# SVG 编辑器 · Lab1 Phase 1

使用 TypeScript 面向对象实现的 SVG 命令行编辑器，采用 **Command + Composite + Memento**。提供六种图形、分组、绘制顺序、撤销重做和 SVG 文件读写；另含背景示例 transform 导入增强。

正式提交报告：**[doc/README.md](doc/README.md)** · [原始任务书](doc/phase_cli_1.md) · [架构图](doc/architecture.svg)

**详细使用手册：[doc/USER_GUIDE.md](doc/USER_GUIDE.md)**，在一个文件中集中说明环境准备、全部命令、参数、操作回显、图形效果、脚本及常见问题。

## 安装与运行

运行兼容范围为 Node.js 22 或以上；开发环境通过根目录的 `.nvmrc` 固定为 **Node.js v24.22.1**。依赖版本由 `package-lock.json` 锁定。

已安装 nvm 时，从项目根目录首次配置：

```sh
nvm install
nvm use
npm ci
npm run cli
```

`nvm install` 和 `nvm use` 不带版本号时会读取 `.nvmrc`，分别安装、选择指定版本。该文件是版本声明，不包含运行时；进入目录不会自动切换版本。

以后在新终端进入项目后执行：

```sh
nvm use
npm run cli
```

依赖没有变化且 `node_modules` 完整时，无需重复执行 `npm ci`。尚未安装 nvm 的用户可参考 [nvm 官方安装说明](https://github.com/nvm-sh/nvm#installing-and-updating)。

交互提示符为 `svg>`。使用 Ctrl+D 结束；整行 `#` 注释可以放入脚本。无需浏览器或图形界面即可编辑。

```text
init 800 600
create g scene
create rect r1 10 20 100 50 #4a90d9 in scene
create text title 20 50 "Hello SVG" in scene
move scene 30 10
undo
redo
tree
save demo.svg
```

`demo.svg` 可以直接拖入浏览器查看。相对文件路径以启动命令时的工作目录为基准。

## 脚本与生产构建

从项目根目录执行：

```sh
npm run cli < examples/flowchart.cli
npm run build
npm start < examples/flowchart.cli
```

脚本模式按顺序执行，在 EOF 退出，不输出提示符。单条命令失败输出一行 `error:`，随后继续下一条命令。

启动参数只支持精确的 `--preserve-style`；不带参数使用默认模式，重复该参数仍使用增强模式。拼错、未知参数、位置参数及 `--preserve-style=true` 等写法会令整次启动失败：编辑器向 stderr 输出一行 `error: unknown option: …`，退出码为 2，不进入 REPL，也不执行输入命令。例如 `npm run cli -- --preserve-stlye`。构建入口 `npm start -- …` 使用相同规则。进入 `svg>` 后的编辑命令错误仍输出错误并继续执行。

示例产物：[flowchart.svg](examples/flowchart.svg)

![两节点流程图](examples/flowchart.png)

## 命令

| 类别 | 命令 |
|---|---|
| 文档 | `init [w] [h]`、`read <file.svg>`、`save [file.svg]`、`canvas [w] [h]` |
| 编辑 | `create`、`delete`、`move`、`scale`、`set` |
| 树结构 | `group`、`ungroup`、`addto`、`front`、`back` |
| 显示 | `tree [id]`、`show <id>`、`help` |
| 历史 | `undo`、`redo` |

图形创建语法：

```text
create rect <id> <x> <y> <w> <h> [fill] [in <gid>]
create circle <id> <cx> <cy> <r> [fill] [in <gid>]
create ellipse <id> <cx> <cy> <rx> <ry> [fill] [in <gid>]
create line <id> <x1> <y1> <x2> <y2> [stroke] [in <gid>]
create text <id> <x> <y> "content" [in <gid>]
create g <id> [in <gid>]
```

执行 `help` 查看全部命令参数。id 大小写敏感、全文档唯一。带空格参数使用双引号，文字内的双引号和反斜杠分别写为 `\"` 和 `\\`。

`set` 仅允许公共 `fill` / `stroke` / `stroke-width`、当前图形自身的几何属性以及文字的 `text`；不能用 `set` 修改 id。

编辑按一条命令撤销；成功执行 init/read/save 或修改画布尺寸后清空并禁用历史，直到下一次成功编辑。只读 canvas 不影响历史。根级 g 按任务书规定不能 ungroup。

## 可选基础样式保留

```sh
npm run cli -- --preserve-style
```

构建后也可执行 `npm start -- --preserve-style`。开启后，group / ungroup / addto 在必要时补写 fill、stroke、stroke-width，保留结构调整前的基础属性有效值；原有命令语法不变。普通启动继续按新父级继承样式。

首批支持命名色、transparent、none 与十六进制颜色；无法解析的原颜色、字体等额外继承值变化或组透明度上下文变化会明确报错，保持文档和历史不变。该模式不保证任意场景像素完全一致。效果、代价和完整示例见 [使用手册](doc/USER_GUIDE.md#96-可选基础样式保留模式)。

## 验证

```sh
npm run check
npm run test:coverage
npm run test:acceptance
```

`check` 包含严格类型检查、自动化测试和生产构建，测试同时约束模块依赖方向、一类一文件与无循环依赖。GitHub Actions 会在 push 和 pull request 时执行相同检查。

支持范围、设计取舍、真实迭代过程和验收结果均记录在 [正式报告](doc/README.md) 中。

可重复的黑盒功能验收见 [功能测试与结果记录](doc/acceptance/功能测试与结果记录.md)：覆盖 40 个主用例、源码与构建入口、普通与增强模式，以及真实交互终端。`test:acceptance` 在临时目录安装依赖、检查、构建、运行及生成覆盖率，不覆盖已提交证据；加 `-- --record` 才更新 `doc/acceptance/` 的记录。需要 Python 3 和 Chrome/Chromium，详见报告。该命令不修改业务代码或 CI。


## transform 优化

```sh
npm run cli < examples/transform.cli
```

支持 translate、正等比 scale 和嵌套组合。导入时将变换归一化为几何坐标，同时处理字号和线宽，保存后的 SVG 保留显示效果与分组，省去原始 transform 属性。

![背景示例归一化效果](examples/transform-normalized.png)

不支持 rotate / skew / 非等比 scale / 任意 matrix。遇到超出范围的结构会报错，保持当前文档不变。完整范围和验证数据见正式报告。

## 本阶段交付与后续设计

任务书第 3 节、第 4.4 节及第 6.1 节版本 B 明确：box 属于后续插件化阶段，当前未实现 box 或动态插件符合 Phase 1 边界。当前六种图形、19 条命令及规定的架构/文档要求已经实现；重新核查未发现阻塞本阶段交付的实现缺口。逐项结果见 [Phase 1 核查记录](doc/README.md#2026-10-24phase-1-逐项复核结果)。

完整的 [后续阶段开发设计](doc/README.md#后续阶段开发设计预案未实施) 已记录 Provider 合约、box 行为、SVG 往返与降级、动态加载、分批验收及版本隔离。目前仅为设计预案，未实施后续功能，实施前需结合正式后续任务书另行确认。

课程最终交付由 `final` 标记，指向包含本说明的最终收束提交，与远端 `main` 一致，涵盖业务代码、环境配置、使用手册、需求复核、完整后续设计预案，以及可重复验收脚本、用例和 SVG/PNG 等证据。用户已在 2026-10-26 确认尚未超过提交截止时间，并批准完成本次文档收束及标签更新；标签记录真实操作时间。

历史验收材料以 `2f5ef47` 为基线，在 `0b62616` 独立提交，随后由 `c9425dc` 收束交付。2026-10-27 新增启动参数校验后，原基线仅代表历史版本；本次按“功能修复提交 → 对该真实提交重新采集证据”的顺序更新材料，最新被测 SHA、源码树和测试树见 [验收汇总](doc/acceptance/summary.json)。用户已明确授权修复完成后更新 final，标签仍使用真实操作时间。

历史首次交付通过 76 项自动化测试，2026-10-26 交付版通过 165 项。启动参数修复新增 37 项测试，当前共 16 个文件 / 202 项，严格类型检查和构建通过。原有 40 个主用例 / 55 个子场景保持不变；验收报告中的实际数量从当次 check 输出采集，覆盖率和功能回归结果以新基线日志为准。后续插件阶段仍仅保留设计预案。过程与限制详见正式报告。
