# Lab1 Phase 1：架构与开发报告

## 架构方案

### 模块划分

| 目录 | 职责 |
|---|---|
| `src/cli/parsing` | 识别引号和参数，整行注释，不截断十六进制颜色 |
| `src/cli/formatting` | 输出应用层提供的展示数据 |
| `src/application/commands` | 命令对象、业务用例与执行分类 |
| `src/application/history` | 编辑事务、文档快照、undo/redo |
| `src/application/ports` | 存储和 SVG 编解码端口 |
| `src/domain/shapes` | 封装几何行为的图形与容器类 |
| `src/domain/factories` | 唯一的图形类型分发位置 |
| `src/domain/errors` | 领域错误 |
| `src/infrastructure/filesystem` | 本地文件读写 |
| `src/infrastructure/svg` | XML 解析及 SVG 序列化 |
| `src/bootstrap` | 实例化、注入依赖、入口 |

![PlantUML 组件图](architecture.svg)

组件图源码：[architecture.puml](architecture.puml)。

### 设计模式

- **Command（必需）**：每条命令由命令类执行，编辑行为通过应用服务进入事务和历史。
- **Composite**：`Shape` 统一行为，六种内置图形实现多态，`Group` 递归操作孩子。
- **Memento**：编辑在文档副本中执行，成功后提交。命令保存前后状态，撤销与重做恢复完整树，避免逆运算误差。
- **Factory**：集中处理类型到构造行为的映射，CLI 和 SVG 导入复用。

按名称分发仅允许两处：命令注册表和图形工厂。它们是后续插件阶段的待重构点；本阶段不散布 `switch(tag)`，不实现动态插件系统。`box` 必须报未知类型。

### 依赖方向规则

1. Domain 不依赖其他业务模块、Node IO 或 XML 库。
2. Application 依赖 Domain，通过自身端口访问存储和编解码。
3. CLI 仅依赖 Application，不直接修改图形内部字段。
4. Infrastructure 依赖端口和 Domain，不能反向依赖 CLI。
5. Bootstrap 负责装配，可以依赖所有层；其他层不能依赖 Bootstrap。
6. 禁止循环依赖。一类一文件、字段封装、TypeScript 严格类型检查。

### 变化点假设与取舍

| 变化点 | 本阶段准备 / 不做的原因 |
|---|---|
| 新命令 | 命令对象与集中注册 |
| 新图形 | 多态图形和工厂；后续再引入 ShapeProvider |
| GUI / agent 输入 | 复用应用接口，不依赖终端 |
| 更换存储 | 注入存储端口 |
| 大文档历史 | 未来替换为差量记录；当前完整快照换取正确性 |
| SVG 变换 | 必做功能完成后单独实现 translate、正等比 scale 及嵌套组合 |

### 语义补充

- 同父分组占据最早选中位置；跨父分组放在根层最早受影响分支的位置，孩子按编辑前的先序遍历排序。
- 失败命令不改变文档、历史和文件路径。成功文档操作清空历史并禁用 undo/redo，直到下一条成功编辑。
- `canvas` 只读查询不影响历史。`front` 对应同级最后绘制，`back` 对应最先绘制。
- `scale` 只缩放位置与尺寸，不修改 stroke-width 或字号；文本仅缩放 x/y。
- 几何坐标有限，画布尺寸为正，尺寸、半径、线宽非负，factor 为正。
- 基础版明确拒绝带非空 transform 的输入；优化阶段扩展并增加回归测试。
- 导入只承诺约定子集，不静默丢弃不支持的绘制元素；导入时先收集显式 id，再补 id。

## 过程记录

### 2026-10-20：设计确认与工程建立

- 用户强调架构、恰当的设计模式、GitHub 分步推送、最终 `final` 标签和 Markdown 文档。
- 完整阅读任务书，确认 TypeScript OO、Command 为强制要求；`box` 为后续阶段内容。
- 讨论发现 transform 仅出现在背景示例，未列为本阶段明确必做项。用户同意先完成基本验收，再以独立功能提交实现增强。
- 当前远程仓库为空，先建立工程与报告，再按领域模型、基础命令、历史、树结构、文件读写、验收、变换优化逐步提交。
- 本机默认没有 Node.js，采用现有运行环境完成开发；项目本身使用标准 npm 命令与锁文件。
- Git 作者使用已认证 GitHub 资料及 GitHub noreply 地址，只设置在本仓库，不改动全局配置。

## 一致性自查

基础版本实际目录与规划一致。应用层追加 `Argument`、`TreeNode` 展示边界和 `CommandContext` / `ReversibleEdit` 接口，属于原模块内部细化。

依赖检查覆盖所有 src 文件的本地导入，包含 type import：

- Domain 仅依赖 Domain，无外部库或 Node API。
- Application 仅依赖 Application / Domain。
- CLI 依赖 Application；仅 REPL 使用终端 IO。
- Infrastructure 实现应用端口，并使用 Domain。
- Bootstrap 装配所有层，没有被反向导入。
- 无导入循环、无 switch 分派；导出类与文件名一致。

抽样：MoveCommand → SvgDocument；SvgCodec → DocumentCodec / ShapeFactory；LocalTextStorage → TextStorage；CliController → EditorSession / CommandFactory。`tests/architecture.test.ts` 将这些规则固化为自动检查。

## 质量保证手段

基础版本验收已执行 `npm run check`：严格类型检查、51 项测试和生产构建通过；`npm run test:coverage` 通过，行覆盖率 99.37%，分支覆盖率 86.62%。覆盖率排除纯装配入口，子进程 CLI 测试的执行不计入父进程覆盖率。

| 要求 | 验证位置 |
|---|---|
| 六种图形、几何行为、字段封装 | `tests/domain.test.ts` |
| 引号、颜色、注释、显示与无文档错误 | `tests/cli.test.ts` |
| 撤销重做、历史屏障、失败原子性 | `tests/history.test.ts` |
| 分组、解组、顺序、循环防护 | `tests/topology.test.ts` |
| SVG 往返、缺 id、重复 id、失败 IO | `tests/persistence.test.ts` |
| 任务书完整会话、两节点流程图、指定错误和真实 CLI | `tests/acceptance.test.ts` |
| 模块依赖、一类一文件、循环依赖 | `tests/architecture.test.ts` |

任务书的典型会话及 6.1 流程图均回放成功，保存的文件有 8 个图形元素。示例位于 `examples/`。

浏览器工具因本地 file 协议策略拒绝预览，未绕过该限制；改用本地 SVG 渲染器生成 PNG 并检查。浏览器人工预览可由用户将 SVG 拖入浏览器完成。

截止时间尚未提供，不能证明标签早于课程截止时间；最终记录真实标签时间与提交。

### 领域模型阶段

- 建立 Shape / GeometryShape / 六种内置类型和 SvgDocument，字段封装，样式快照和子节点数组均不暴露可变集合。
- 领域层预先实现树操作约束；对应命令和拓扑测试在后续阶段接入。
- 基础图形、嵌套移动、快照独立性、唯一 id、白名单和非法尺寸共 8 个测试通过，严格类型检查通过。
- XML 库最终选择 `@xmldom/xmldom`，在基础设施层使用 DOM API，依据官方项目文档：https://github.com/xmldom/xmldom。

### CLI 与历史阶段

- 接入引号词法分析、命令工厂、REPL、基础编辑和 tree/show/help。
- Command 与历史在本阶段一并接入：EditingCommand 的 execute/apply/undo/redo 与前后 Memento 相互配合，避免先实现一条绕过事务的临时编辑路径。
- 失败编辑在独立文档副本中丢弃；测试覆盖递归缩放溢出、redo 保留/清空以及文档操作后的历史屏障。
- `npm run check` 通过：15 项测试、严格类型检查、生产构建。
- 文件端口已定义，实际 SVG IO 在后续阶段注入；基础版暂不配置持久化。

### 树结构命令阶段

- 接入 group / ungroup / addto / front / back，原有领域约束由各命令复用。
- 测试确认 group 采用文档原顺序而非参数顺序；跨父分组和解组均能一次撤销恢复父容器及节点位置。
- 验证禁止祖先与后代同时分组、自包含及循环归属、根级解组；删除子树后 id 不可寻址，撤销后恢复。
- `npm run check` 通过，累计 21 项测试。

### SVG 文件阶段

- 通过 DocumentCodec / TextStorage 端口接入真实 SVG 和文件系统，不让应用层依赖 XML 或文件 API。
- 导入先保留所有显式 id，再以标签序号补 id；警告只在整次导入成功后输出。XML 使用严格错误回调，文本交给 DOM API 转义。
- 扩展导入样式以保留背景示例中的字号、字体和文字对齐；命令 set 仍严格使用任务书白名单。未知 data-* 作为元数据保留，data-kind="box" 降级为普通 g。
- 保存写入同目录临时文件后替换，失败清理临时文件，不改变当前路径或历史。
- 初次检查发现 DOM 类型允许 localName 为 null，改为使用合法标签名回退，随后严格类型检查通过。
- `npm run check` 通过，累计 34 项测试，涵盖往返、补 id、重名、坏 XML、失败 IO 和真实文件写入。


### 基础版本验收与架构修订

- 新增架构检查后，发现 EditorSession 与命令类之间存在 type import 循环。虽然不形成运行时调用循环，仍违反方案的无循环规则。
- 将命令所需接收者能力抽为 CommandContext，将历史条目能力抽为 ReversibleEdit；命令和历史面向接口，循环检查通过。这是一次由自动化证据驱动的 AI 方案修正。
- 实际回放发现 tsx CLI 在受限环境创建 IPC 通道失败，改用 `node --import tsx`，保持 npm run cli 的用户入口不变，回放成功。
- 领域模型的查找采用封装的树遍历，没有维护第二份可变 id 索引；对 Lab 规模优先减少一致性风险，后续性能需要时再增加索引。
- 新增 GitHub Actions 配置，推送时运行相同检查。

## 当前支持边界（基础版）

- 支持 rect/circle/ellipse/line/text/g，纯文字 text，不支持 path、tspan、defs、CSS style 或完整 SVG 标准。
- 几何长度支持纯数字及导入的 px；不支持百分比和相对单位。
- viewBox 仅支持与画布一致的 `0 0 width height`，避免静默改变坐标。
- 可保留 font-size、text-anchor、font-family、font-weight、opacity、fill-opacity、stroke-opacity 和 data-*；set 仍使用任务书白名单。
- 本阶段没有 box 插件，复合图形专属 ungroup 错误没有可触发对象；带 data-kind 的 g 作为普通 g 处理，符合未安装插件时的降级语义。
- 完整快照需要 O(文档大小 × 历史条数) 内存；本阶段不设历史上限。
- transform 增强在基础版本验收提交后另行实现，最终报告将更新支持范围。

- 补充交互 EOF 测试时发现输入已关闭后仍输出提示符会抛错；增加 close 状态检查，51 项测试全部通过。
