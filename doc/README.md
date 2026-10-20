# Lab1 Phase 1：SVG 编辑器架构与开发报告

任务书：[phase_cli_1.md](phase_cli_1.md)；运行入口：[工程 README](../README.md)。本项目使用 TypeScript 面向对象实现，源代码一类一文件、字段封装、行为通过多态执行。

## 架构方案

### 模块划分

| 目录 | 职责与代表类 |
|---|---|
| `src/cli` | CliController 协调输入与应用服务；Repl 管理提示符、逐行执行和 EOF |
| `src/cli/parsing` | Tokenizer 识别引号、转义、整行注释，不截断颜色中的 # |
| `src/cli/formatting` | OutputFormatter 统一单行 error 前缀 |
| `src/application` | EditorSession 管理当前文档、路径和用例；Argument / TreeNode 定义输入展示边界 |
| `src/application/commands` | Command 及每条命令的具体类，封装参数和行为 |
| `src/application/history` | HistoryManager 管理历史，DocumentMemento 封装文档快照 |
| `src/application/ports` | CommandContext / ReversibleEdit 解耦接收者与历史；TextStorage / DocumentCodec 隔离 IO |
| `src/domain` | SvgDocument 维护树和约束；Numeric / SvgValue 校验值；UniformTransform 封装变换组合 |
| `src/domain/shapes` | Shape / GeometryShape 和 Rect、Circle、Ellipse、Line、Text、Group |
| `src/domain/factories` | ShapeFactory 集中创建图形，CLI 和 SVG 导入复用 |
| `src/domain/errors` | EditorError 表达领域及用例错误 |
| `src/infrastructure/filesystem` | LocalTextStorage 读写文件，临时文件加替换保证保存完整性 |
| `src/infrastructure/svg` | SvgCodec 进行 XML 转换；TransformParser 和多态语法对象解析变换 |
| `src/bootstrap` | Main 装配实例和依赖，不包含图形业务 |

![PlantUML 组件图](architecture.svg)

可编辑的 PlantUML 源文件：[architecture.puml](architecture.puml)。

### 设计模式的选择及落地

**Command（任务书强制）**：每条命令有独立类。EditingCommand 定义 execute / apply / undo / redo，MoveCommand、GroupCommand 等实现具体用例。EditorSession 调用命令，HistoryManager 通过 ReversibleEdit 接口维护历史。CLI 不直接修改图形字段。

**Composite**：Shape 为统一抽象，Group 持有 Shape 子节点。move / scale 经由多态在叶子修改几何数据，在容器递归操作孩子。set 使用统一接口，g 允许公共样式，具体图形允许自身几何属性，Text 额外允许 text。删除容器删除整棵子树。

**Memento**：每次编辑在文档工作副本中执行；校验和修改全部成功才提交。命令保存前后快照，撤销、重做恢复完整状态。因此分组、跨父节点移动、删除子树和绘制顺序都可以一次准确恢复，也避免以浮点逆运算实现撤销的误差。快照不包含历史管理器自身。

代价是历史占用 O(文档大小 × 历史条数) 内存。对本 Lab 优先保证正确性，当前不设置历史上限；大文档场景再换差量记录。

**Factory**：ShapeFactory 是唯一的图形类型名分发点。几何与样式行为由图形对象实现，导入和命令代码不各写一套类型判断。

按名称分发只保留两处：`CommandFactory` 的命令注册表与 `ShapeFactory` 的图形定义表。**两处均标注为后续插件化阶段的待重构项**。其他代码不使用 switch 分派图形，transform 解析使用多态语法对象匹配，没有增加第三张名称到实现的分发表。

本阶段不实现 ShapeProvider 动态插件，也不实现 box。`create box` 必须报未知类型。带 `data-kind="box"` 的外部 g 作为普通容器读入并保留标记，符合未安装插件时的降级语义；因此本阶段不存在需要触发“不能解组插件复合图形”错误的对象。

### 依赖方向规则

1. Domain 只能依赖 Domain，不依赖应用层、CLI、Node IO 或第三方 XML 库。
2. Application 可以依赖 Application / Domain，持久化通过自身接口表达。
3. CLI 可以依赖 CLI / Application，不直接访问领域内部状态；终端 IO 只在 REPL 边界发生。
4. Infrastructure 可以依赖 Infrastructure / Application / Domain，用于实现端口和数据转换，不能依赖 CLI。
5. Bootstrap 可以依赖所有层；其他层不得依赖 Bootstrap。
6. 包含 type import 在内禁止循环依赖。一类一文件，导出类名与文件名一致。

这些规则使编辑用例能够复用于 GUI / agent 输入，XML 库和存储方式能够独立替换。接口与领域对象之间仅在边界使用只读展示数据，不以公共数据袋代替领域行为。

### 变化点假设

| 可能变化 | 留下的结构 / 当前取舍 |
|---|---|
| 新增命令 | 命令对象和集中注册，后续引入注册接口 |
| 新增图形及 box | 统一图形抽象与工厂；后续建立 ShapeProvider，不提前实现插件加载器 |
| GUI / agent 输入 | 复用 CommandContext 和应用层，不绑定终端 |
| 更换存储或 XML 库 | 通过 TextStorage / DocumentCodec 隔离 |
| 大文档 | 当前封装树遍历查找，避免维护第二份可变 id 索引；需要时再增加索引和差量历史 |
| 更广泛 SVG | 独立转换层；当前不建设完整 SVG/CSS 渲染引擎 |

### 对任务书未明确处的补充决策

- 同父分组占据最早被选节点的位置；跨父分组放在根层最早受影响顶层分支的位置。孩子保持编辑前全树先序遍历顺序，不按命令参数顺序重排。
- `addto` 将节点作为目标容器最后一个孩子；禁止自包含和祖先移入后代。
- `front` 为同级最后绘制，`back` 为最先绘制。严格禁止解组根级 g。
- `set g fill` 等设置 g 自身属性，效果遵循 SVG 样式继承；不强行覆盖孩子已有的显式样式。
- CLI `scale` 只乘位置与尺寸，不改变线宽或字号；text 的几何属性仅 x/y。
- 数值必须有限；画布尺寸为正；图形尺寸、半径、线宽非负；缩放因子为正。
- init 的默认尺寸为 800×600；只给宽度时高度使用 600。
- 首次保存新建文档必须给路径，成功保存后记住该路径；init 清空原路径。
- 成功 init/read/save 或 canvas 修改尺寸后清空历史并设置禁用标记；下一条成功编辑解禁。失败命令不改变文档、路径、历史和禁用状态。只读 canvas 不影响历史。
- 缺 id 时先保留全部显式 id，再按标签序号补全；整次导入成功后才输出警告。显式重名导致整次读取失败。

### SVG 支持范围与 transform 优化方案

支持六种图形及约定的几何与样式。纯文字 text，不支持 path、tspan、defs、CSS style、百分比或相对长度。几何长度可导入纯数字及 px。viewBox 仅接受与画布一致的 `0 0 width height`。对不支持的结构明确报错，避免静默丢图。

除任务书属性外，导入保留 font-size、text-anchor、font-family、font-weight、opacity、fill-opacity、stroke-opacity 和 data-*；CLI set 仍使用原任务书白名单。XML 由 `@xmldom/xmldom` 解析和转义，使用严格错误回调，拒绝 DOCTYPE。[官方 API 依据](https://github.com/xmldom/xmldom)。

transform 在基础功能验收后独立增强，支持：

- `translate(tx[,ty])`；`scale(s)` 和 `scale(s,s)`，比例必须为正且有限。
- 浮点、科学计数法、空格或逗号分隔、同节点组合、父子嵌套。
- 不支持 rotate、skew、非等比 scale 或任意 matrix。

选择**导入时归一化**：UniformTransform 以 `parent(local(p))` 合成变换，SvgCodec 从根向叶传递累计值，只对叶子应用一次。归一化同时处理继承线宽和文字字号，保存为普通 SVG 并保留分组。

这样现有 move / scale / group / addto 可以继续使用统一几何坐标，无需每条命令计算逆矩阵。代价是保存不能保留原始 transform 写法，可能增加显式线宽和字号。CLI scale 与导入变换的排版缩放使用独立方法，避免改变任务书命令语义。

## 过程记录

以下记录均来自本次真实讨论、实现和验证，没有虚构人工审查或测试结果。

| 阶段 / 提交 | 讨论、实现与证据 |
|---|---|
| 设计 `8a4f6e8` | 完整阅读任务书，用户确认技术路线。区分背景 transform 与明确必做命令；用户批准完成基础版本后再独立增强。建立工程、文档、锁文件并推送空仓库。 |
| 领域 `b66caf8` | 封装六种图形和文档树，验证嵌套移动、复制独立性、唯一 id、白名单及尺寸约束，8 项测试通过。 |
| 命令与历史 `4d40a03` | CLI 和事务历史一并接入，避免建立绕过事务的临时编辑路径。测试溢出失败、历史屏障及 redo 清空，累计 15 项。 |
| 树操作 `a136a93` | 接入分组、解组、重新归属和绘制顺序，验证父容器及节点顺序精确恢复，累计 21 项。 |
| 文件 `bc8db78` | 接入存储和编解码端口，验证读写往返、补 id、重复 id、坏 XML、失败 IO，累计 34 项。DOM localName 的可空类型问题由类型检查发现并修复。 |
| 基础验收 `1e72db5` | 任务书会话和流程图回放、架构检查、生产构建、报告和架构图完成，51 项测试通过。 |
| 优化 `6ea667a` | 先增加 transform 用例，基础版 9 项有效变换用例失败，确认限制；实现后全部通过，累计 71 项。该功能使用独立提交并推送。 |
| 最终修复 | 审查发现非法 XML 字符可使保存文件无法读回，新增测试复现，再通过 SvgValue 校验修复。补充合法中文及 supplementary Unicode 往返测试，累计 76 项通过。 |

关键修订依据：

1. **依赖循环修正**：架构测试发现 EditorSession 和命令之间存在 type import 循环。即使没有运行时循环，也违反设计规则，因此抽出 CommandContext / ReversibleEdit，重新检查通过。
2. **启动方式修正**：实际回放发现 tsx 启动器在受限环境建立 IPC 失败，改为 `node --import tsx`，保持 `npm run cli` 不变。随后脚本回放成功。
3. **交互 EOF 修正**：终端测试发现输入关闭后仍请求提示符会抛错，增加 close 状态检查，保留已读命令的串行执行。
4. **变换重复处理防护**：累计变换只作用于叶子，避免 Group.scale 递归与导入递归叠加造成重复缩放；专项测试覆盖抵消缩放和样式继承。
5. **预览方式修订**：浏览器工具禁止 file 协议，未绕过；使用本地 SVG 渲染器生成 PNG 并视觉检查，报告不声称已完成浏览器人工预览。

本机默认无 Node.js，开发时使用已有运行环境和标准 npm。Git 作者使用已认证 GitHub 资料与 noreply 地址，仅设置在本仓库；代理也只设置在本仓库，未修改全局设置。

## 一致性自查

**模块划分是否一致？** 一致。Argument、TreeNode、命令接收者接口和 transform 语法对象是原模块内部细化；领域层增加 UniformTransform / SvgValue。没有新增未说明的业务层或将 IO 放进领域模型。命令与历史合并为一个开发阶段的理由已记入过程记录。

**依赖规则是否违反？** 最终检查未发现违反。`tests/architecture.test.ts` 遍历全部源文件的本地导入，包括类型导入，验证允许的模块方向、外部依赖隔离、一类一文件、无循环依赖和无 switch 分派。

抽样关系：

- MoveCommand → SvgDocument / EditingCommand / CommandContext。
- HistoryManager → ReversibleEdit → DocumentMemento → SvgDocument。
- SvgCodec → DocumentCodec / ShapeFactory / UniformTransform。
- LocalTextStorage → TextStorage，文件系统只在其实现中访问。
- CliController → EditorSession / CommandFactory，无 Domain 导入。
- Main 装配各层，没有被其他模块引用。

代码内按名称分发仍只有命令工厂和图形工厂两处。没有公共几何数据袋，没有散落的图形类型 switch。当前没有待处理的依赖违规。

## 质量保证手段

### 需求与验证对应

| 要求 | 验证位置 |
|---|---|
| 六种图形、多态几何行为、封装 | `tests/domain.test.ts` |
| 引号、颜色、注释、显示、无文档错误 | `tests/cli.test.ts` |
| 撤销重做、屏障、失败原子性 | `tests/history.test.ts` |
| 分组、解组、顺序、循环防护、子树删除 | `tests/topology.test.ts` |
| SVG 往返、补 id、重名、失败 IO、真实文件替换 | `tests/persistence.test.ts` |
| 任务书完整会话、两节点流程图、指定错误、真实 CLI | `tests/acceptance.test.ts` |
| 交互提示符、EOF、串行输入、转义 | `tests/repl.test.ts` |
| 模块边界、类文件名、循环依赖 | `tests/architecture.test.ts` |
| 背景变换、顺序、排版、编辑、往返、非法变换 | `tests/transform.test.ts` |
| 非法 XML 字符拒绝、合法 Unicode 往返 | `tests/xml-values.test.ts` |

### 最终执行结果

2026-10-20（Asia/Shanghai）完成：

- 从锁文件重新执行 `npm ci`，安装成功，依赖审计 0 漏洞。
- `npm run check` 通过：严格类型检查、**10 个测试文件 / 76 项测试**、生产构建。
- `npm run test:coverage` 通过：行 **99.43%**、分支 **88.20%**、函数 **100%**。覆盖率排除纯装配入口，子进程执行不计入父进程统计。
- `npm run cli` 与构建后的 `npm start` 均完成流程图和 transform 脚本回放。
- 任务书流程图保存为 8 个元素；背景变换图保存为 6 个元素，补 id 警告正确。
- Git diff 空白检查通过。GitHub Actions 已配置 push / pull_request 时运行同一套检查；本报告的通过结论依据本地实际运行，不冒充远程工作流结果。

### 图形检查

示例：[flowchart.svg](../examples/flowchart.svg)、[transform-original.svg](../examples/transform-original.svg)、[transform-normalized.svg](../examples/transform-normalized.svg)。

![两节点流程图](../examples/flowchart.png)

![变换归一化预览](../examples/transform-normalized.png)

背景原图与归一化图使用同一本地渲染器比较：400×200 像素、320000 个 RGBA 通道值中，44 个不同，最大差 2/255，平均绝对差 0.000140625/255。存在微小光栅化差异，不宣称逐像素完全一致。[原始比较数据](transform-render-check.json)。

用户可将 SVG 直接拖入浏览器进一步检查，无需安装编辑器插件。

### GitHub 交付

代码按上述阶段真实提交并推送至用户指定的私有仓库。transform 优化是基础验收后的独立变更。最终代码和报告提交后，在最终提交创建附注标签 **`final`**，随后推送并核验远程 main 与标签指向。

最终提交与标签的真实时间可通过以下命令查验：

```sh
git log --oneline --decorate
git show --no-patch final
git ls-remote origin refs/heads/main refs/tags/final 'refs/tags/final^{}'
```

**用户尚未提供课程截止时间，因此不能证明 final 早于课程截止时间。** 标签记录真实创建时间，不回填或修改时间。
