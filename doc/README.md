# Lab1 ：SVG 编辑器架构与开发报告

学生：许海天　　学号：26213050419

本项目使用 TypeScript 以面向对象方式实现 SVG 命令行编辑器。本报告围绕架构设计、开发迭代、一致性自查和质量验证四个方面展开，介绍主要设计决策、实现过程及验收结果。

- Git 仓库：[1220XXX/svg-editor_XHT](https://github.com/1220XXX/svg-editor_XHT)。
- 开发分支：[main](https://github.com/1220XXX/svg-editor_XHT/tree/main)；已标记交付版本：[final](https://github.com/1220XXX/svg-editor_XHT/tree/final)。
- 阅读入口：[任务书](phase_cli_1.md)、[工程运行说明](../README.md)、[使用手册](USER_GUIDE.md)、[功能测试与结果记录](acceptance/功能测试与结果记录.md)。

版本说明：本报告以 `9d7fd25` 为基础修订，并于 2026-10-28 完成隔离环境中的完整复验。本次文档定稿和复验记录纳入 `final` 标记的交付提交，远端 `main` 与 `final` 对应同一提交；具体提交编号通过标签查询，避免在提交内部循环填写自身编号。配套图示和验收材料可通过相对链接或文中的 GitHub 入口查看，私有仓库的在线访问需要相应权限。

**目录**

- [1. 项目完成情况](#1-项目完成情况)
- [2. 架构方案](#2-架构方案)
- [3. 过程记录](#3-过程记录)
- [4. 一致性自查](#4-一致性自查)
- [5. 质量保证手段](#5-质量保证手段)
- [6. 附录](#6-附录)

## 1. 项目完成情况

项目已实现 `rect`、`circle`、`ellipse`、`line`、`text`、`g` 六种内置图形，以及创建、编辑、分组、绘制顺序调整、SVG 读写和撤销重做等 19 条命令。图形数据与行为由领域对象封装，命令执行采用 Command 模式，容器操作和历史恢复分别由 Composite 与 Memento 模式支持。功能核查、架构检查和实际 CLI 验证覆盖了主要操作及其边界情况。

在基本编辑功能之外，项目还支持 translate / 正等比 scale 导入，以及可选的基础继承样式保留模式。前者在导入时归一化坐标，后者在调整父子关系时保留受支持的基础样式。两项增强均有独立测试和使用说明，具体支持范围见后文。

`box` 留待插件化扩展时实现，目前仅保留相关设计预案，尚未实现 Provider 接口或动态插件加载。因此，当前执行 `create box` 会返回未知类型错误。完整 SVG/CSS 引擎也不在当前支持范围内；编辑器按已声明的 SVG 子集处理输入，并对不支持的内容明确报错。

2026-10-27 的原始验收以业务代码提交 `94acc74` 为基线，材料收录于 `9d7fd25`；2026-10-28 又以 `9d7fd25` 为代码基线，叠加本地验收生成器的链接修正后完整复跑。三者的业务源码与测试内容一致，未以未提交的业务代码冒充提交基线。类型检查、构建及 16 个测试文件中的 202 项测试均已通过；40 个主用例、55 个子场景完成了 1674 条功能断言和 40 条终端交互断言。运行环境与统计口径见[原始验收汇总](acceptance/summary.json)及[本次交付复验汇总](acceptance/validation/delivery-review-2026-10-28/summary.json)。各项功能的详细核查见质量保证部分。

## 2. 架构方案

### 2.1 模块划分

项目按输入交互、应用协调、领域模型、基础设施和启动装配划分模块。各模块围绕明确职责组织，内部再按命令、历史、图形和样式等功能细分目录。下表中，父目录行说明直属文件的职责，子目录的职责另行列出。

| 所属模块 | 目录 | 主要职责 | 代表类、接口或入口 |
|---|---|---|---|
| 输入交互（CLI） | `src/cli` | 接收终端输入并协调命令处理，将执行结果写回终端；管理提示符、逐行串行执行和输入结束状态 | `CliController`、`Repl` |
| 输入交互（CLI） | `src/cli/parsing` | 将输入文本解析为参数，识别引号、转义和整行注释，保留颜色值中的 # | `Tokenizer` |
| 输入交互（CLI） | `src/cli/formatting` | 将异常转换为带有 error 前缀的单行提示，统一错误输出格式 | `OutputFormatter` |
| 应用协调（Application） | `src/application` | 维护编辑会话、当前文档及读写路径，协调命令执行、工作副本提交和历史操作；封装输入参数信息与只读树形展示结构 | `EditorSession`、`Argument`；`TreeNode` 接口 |
| 应用协调（Application） | `src/application/commands` | 集中注册和创建命令，校验命令参数；由具体命令封装操作，编辑命令基类提供执行、快照记录及撤销重做的公共流程 | `CommandFactory`、`CommandArguments`、`Command`、`EditingCommand`、`MoveCommand`、`GroupCommand` |
| 应用协调（Application） | `src/application/history` | 维护撤销与重做记录及历史屏障，通过文档快照恢复完整编辑状态 | `HistoryManager`、`DocumentMemento` |
| 应用协调（Application） | `src/application/ports` | 定义命令接收者与可撤销编辑的能力约定，降低命令、会话和历史的耦合；定义文本存储与文档编解码接口，使应用流程独立于具体读写实现 | `CommandContext`、`ReversibleEdit`、`TextStorage`、`DocumentCodec` 接口 |
| 领域模型（Domain） | `src/domain` | 维护文档树、画布、根节点 id 及全局唯一性约束，执行跨节点结构操作；提供数值、字符串和 id 校验，以及平移与等比缩放的组合运算 | `SvgDocument`、`Numeric`、`SvgValue`、`SvgId`、`UniformTransform` |
| 领域模型（Domain） | `src/domain/shapes` | 定义图形的统一行为与公共属性，封装通用几何操作和具体图形行为；由容器管理子节点并递归完成移动、缩放与克隆 | `Shape`、`GeometryShape`、`Rect`、`Text`、`Group` |
| 领域模型（Domain） | `src/domain/styles` | 定义结构调整时的样式处理策略，解析祖先继承的有效值；在增强模式下计算必要的基础样式补写，并检查颜色及上下文是否受支持 | `ReparentingStylePolicy` 接口；`FollowParentStyles`、`PreserveBasicStyles`、`StyleResolver`、`BasicPaint` |
| 领域模型（Domain） | `src/domain/factories` | 集中登记六种内置图形的创建规则，供 CLI 创建和 SVG 导入复用，统一处理未知类型 | `ShapeFactory` |
| 领域模型（Domain） | `src/domain/errors` | 提供领域与应用流程使用的编辑器错误类型，由交互边界转换为用户提示 | `EditorError` |
| 基础设施（Infrastructure） | `src/infrastructure/filesystem` | 实现文本文件读取与写入，写入时先生成同目录临时文件，再替换目标文件，降低保存中断造成文件不完整的风险 | `LocalTextStorage` |
| 基础设施（Infrastructure） | `src/infrastructure/svg` | 实现 SVG 解析与序列化，校验输入结构和命名空间，分配缺失 id，并在导入时解析、累计和归一化受支持的变换 | `SvgCodec`、`TransformParser`、`TransformSyntax`、`TranslationSyntax`、`ScaleSyntax` |
| 启动装配（Bootstrap） | `src/bootstrap` | 校验启动参数，选择样式策略并装配各层依赖；校验通过后启动 REPL，参数错误时输出提示并退出 | `StartupOptions`；`Main.ts` 入口 |

源码之外，`tests/` 保存自动化测试与架构约束检查，`scripts/acceptance/` 提供隔离运行真实 CLI 的验收工具，`doc/` 保存报告、手册和验收证据，`examples/` 保存示例 SVG 与预览图片。这些目录为开发、验证和交付提供配套支持，不参与业务模块的运行时依赖关系。

![PlantUML 组件图](architecture.svg)

图中展示了各模块之间的依赖方向。可编辑源文件为 [architecture.puml](architecture.puml)；也可在 GitHub 查看 [组件图](https://github.com/1220XXX/svg-editor_XHT/blob/main/doc/architecture.svg) 和 [PlantUML 源文件](https://github.com/1220XXX/svg-editor_XHT/blob/main/doc/architecture.puml)。

### 2.2 设计模式的选择及落地

**Command（命令模式）**：编辑器包含多种编辑、查询和文件操作，采用命令对象封装参数与行为，使输入处理与具体操作保持独立。每条命令对应一个类，EditorSession 通过 Command 约定的 execute 方法统一执行。MoveCommand、GroupCommand 等编辑命令继承 EditingCommand，由具体类实现修改及恢复后的反馈。编辑时，EditorSession 在工作副本上执行修改，成功后提交文档并登记历史；EditingCommand 保存恢复所需的信息，HistoryManager 通过 ReversibleEdit 管理撤销与重做顺序。查询命令不进入编辑历史，初始化、读写及画布尺寸修改则遵循历史屏障规则。

**Composite（组合模式）**：文档由单个图形和可嵌套的容器组成，两者需要以一致的方式参与编辑。Shape 定义统一的图形行为，具体叶子图形负责自身几何变化，Group 持有 Shape 子节点，并递归完成移动、缩放和克隆。因此，操作嵌套容器时，调用方可以通过统一接口处理整棵子树，无需逐一识别其中的具体图形类型。属性修改也通过统一接口完成，但组的公共样式设置只修改组自身属性，孩子是否受到影响由继承规则决定，不会直接覆盖已有的显式属性。

**Memento（备忘录模式）**：分组、重新归属和子树删除会同时影响多个节点，依靠逐项逆操作恢复容易遗漏层级或顺序，也可能引入浮点误差，因此采用文档快照保存编辑前后的状态。SvgDocument 通过 clone 提供文档复制，DocumentMemento 封装快照并在恢复时返回独立副本。EditorSession 创建前后快照，只有工作副本上的操作全部成功后才替换当前文档；EditingCommand 保存快照，HistoryManager 调用命令完成恢复，再由会话接收恢复后的文档。这使失败的编辑不会留下部分修改，撤销和重做能够恢复文档的几何、属性、层级及节点顺序。快照不包含读写路径或历史管理器自身。

全文档快照优先保证恢复的完整性，代价是历史内存占用约为 O(文档大小 × 历史条数)。当前实现未设置历史容量上限；若后续需要支持更大的文档和更长的编辑历史，可进一步评估差量记录或容量限制。

**工厂封装（Factory）**：命令和图形都需要根据名称创建对象，将创建规则集中管理，可以减少调用方对具体类及参数构造方式的依赖。CommandFactory 注册命令名称与创建函数，供 CLI 将解析后的输入转换为命令；ShapeFactory 注册六种内置图形的创建规则，供 create 命令和 SVG 导入共同使用。两者采用注册表式的集中创建方式，分别作为命令名称和图形类型名称的分发入口。创建后的几何修改、样式处理与容器递归仍由对象自身实现。

**Strategy（策略模式，可选增强）**：结构调整既可以遵循新父级的样式继承，也可以保留对象原先的基础样式。为使这两种行为能够替换，ReparentingStylePolicy 定义统一的样式处理约定，FollowParentStyles 保留普通模式行为，PreserveBasicStyles 提供基础样式保留。启动入口根据 --preserve-style 选择策略，经 CommandFactory 注入 GroupCommand、UngroupCommand 和 AddToCommand，三条命令共用同一套处理规则。

增强策略通过 StyleResolver 解析受支持的继承值，并用 BasicPaint 检查颜色；仅在 fill、stroke、stroke-width 的有效值发生变化时计算补写。全部补写计划通过校验后，再与结构修改一并提交；若颜色或继承上下文的变化超出支持范围，则整次操作失败，原文档和历史保持不变。结构与样式的撤销重做沿用 Command 和 Memento 的协作流程，无需另设历史机制。

当前按名称分发仅保留 CommandFactory 与 ShapeFactory 两处，两处均标记为后续插件化阶段的待重构点。transform 解析使用多态语法对象匹配，没有另建按变换名称分发实现的注册表。当前 ShapeFactory 仅注册六种内置图形；Provider、box 与动态加载的设计预案见[附录](#62-插件化扩展设计预案未实施)。

### 2.3 依赖方向规则

模块依赖以源码中的静态导入关系为准，包括类型导入。各模块允许依赖的范围及设计理由如下：

| 模块 | 允许依赖的内部模块 | 设计理由 |
|---|---|---|
| 领域模型（Domain） | `Domain` | 保持图形行为、文档结构和数值约束独立，使领域规则能够脱离终端、文件系统和 XML 库进行验证与复用 |
| 应用协调（Application） | `Application`、`Domain` | 组织命令执行与编辑流程，通过自身定义的端口使用存储和编解码能力，避免绑定具体基础设施 |
| 输入交互（CLI） | `CLI`、`Application` | 负责输入解析和结果展示，通过应用层执行操作，避免绕过统一编辑流程直接修改领域状态 |
| 基础设施（Infrastructure） | `Infrastructure`、`Application`、`Domain` | 实现应用层端口，完成文件、XML 与领域对象之间的转换，使外部技术的变化集中在适配实现中 |
| 启动装配（Bootstrap） | `Bootstrap`、`CLI`、`Application`、`Domain`、`Infrastructure` | 集中创建对象、选择策略并注入依赖，使其他模块无需承担装配职责 |

未列入允许范围的跨模块依赖均禁止，其他模块不得反向依赖 Bootstrap。模块内部可以相互引用，但文件之间不得形成循环，类型导入同样受此约束。Domain 和 Application 不直接导入 Node.js 内置模块或第三方库，文件系统与 XML 处理由基础设施实现。

应用层通过 TextStorage、DocumentCodec 等接口使用外部能力，具体实现由启动入口注入。因此，EditorSession 在运行时调用存储或编解码对象，不需要在源码中导入 LocalTextStorage 或 SvgCodec。这样的依赖方向使编辑流程能够复用于其他交互入口，也便于独立替换存储方式和 XML 库。

运行期间的终端输入、提示符和结果输出集中在 Repl，启动参数错误由 Main 输出并设置退出码。领域层和应用层不直接进行终端 IO，边界交互采用只读展示数据，领域行为由对象封装。

架构检查负责发现受检查范围内的依赖问题。发现超出允许范围或形成循环的依赖时，应在一致性自查中记为待处理项，记录涉及文件、违反的规则及处理方式；修正后重新检查并更新状态。若确有调整架构边界的需要，应同步修订依赖规则、架构图和检查代码，保持设计与实现一致。当前检查结果与依赖抽查记录见一致性自查部分。

**代码组织约定**：生产源码中的类按一类一文件组织，导出类名与文件名保持一致。这些约定与依赖方向分别检查，共同保证代码结构清晰、职责便于定位。

### 2.4 变化点假设

未来变化主要来自编辑能力扩充、SVG 文件兼容、交互入口替换，以及文档规模增长。当前设计优先隔离职责明确的部分，对尚不确定的能力保留集中调整位置，避免提前引入复杂机制。以下分别说明可能的变化、已有准备及当前取舍。

| 可能变化及原因 | 已有结构准备 | 当前取舍与扩展边界 |
|---|---|---|
| **新增命令**：编辑需求增加后，可能需要新的查询或修改操作 | Command 统一执行约定，EditingCommand 提供编辑与历史恢复的公共流程，CommandFactory 集中管理命令创建规则 | 当前新增命令仍需增加实现类并修改工厂注册表。命令集合明确，暂不建设动态注册接口，以减少配置和生命周期管理的复杂度；确需外部扩展时再调整注册机制 |
| **新增图形与 box 插件化**：更丰富的图形和带有专门行为的组合对象，需要扩展现有类型集合 | Shape 定义统一行为，Group 提供容器结构，ShapeFactory 集中创建图形，为类型扩展保留明确入口 | 当前仅支持六种内置图形。Provider、动态加载和插件语义恢复尚未实现，后续仍需改造注册、容器权限、克隆及读写恢复约定；暂不提前固定完整插件接口，待具体行为与验收范围明确后再实施 |
| **GUI 或 agent 输入**：相同编辑能力可能需要由图形界面或自动化调用入口使用 | CommandContext 与 EditorSession 提供应用操作，领域行为独立于终端读写；TreeNode 提供只读树形展示结构 | 当前只实现 CLI。其他入口可复用应用与领域行为，但仍需新增输入适配，并按需要调整结构化结果与展示接口；现有部分结果以文本返回，不视为已经完成 GUI 或 agent 接口 |
| **更换存储方式或 XML 库**：文件来源、保存位置或解析工具可能随运行环境变化 | TextStorage 隔离文本存储，DocumentCodec 隔离文档编解码；LocalTextStorage 与 SvgCodec 分别实现接口，由启动入口装配 | 当前需求为本地 SVG 文件读写，暂不增加其他存储或编解码实现。后续优先通过替换接口实现适配；若新需求改变数据格式或操作语义，再评估接口是否需要扩展 |
| **文档与历史规模增长**：节点增多、编辑历史变长后，遍历查找与全文档快照可能增加时间和内存开销 | SvgDocument 封装节点查找与结构操作，DocumentMemento 封装快照，HistoryManager 集中维护历史记录 | 当前采用树遍历和完整快照，避免额外索引与文档树之间的一致性维护，优先保证恢复正确。尚未给出大文档性能或容量保证；出现明确规模目标后，依据测量结果评估 id 索引、历史容量限制或差量记录 |
| **扩展 SVG 兼容范围**：外部文件可能包含更多元素、样式或变换 | SvgCodec 集中处理 SVG 转换，TransformSyntax 分离变换语法匹配，UniformTransform 表达平移与正等比缩放 | 当前按已声明的子集读取，对不支持的内容明确报错。旋转、非等比缩放、path 或复杂 CSS 可能同时涉及变换表示、图形模型及编辑语义，不能仅靠增加解析分支完成；暂不建设完整引擎，按具体文件需求逐项设计和验证 |
| **扩展结构操作中的样式规则**：调整父子关系时，可能需要保留更多样式或提供其他处理方式 | ReparentingStylePolicy 定义可替换策略，StyleResolver 解析继承值，现有两种策略由启动入口选择并供结构命令复用 | 当前增强模式只保留受支持的 fill、stroke、stroke-width，并拒绝超出支持范围的情况。复杂 CSS 和透明度保真涉及层叠与合成语义，暂不以属性复制替代完整处理，后续需独立设计支持范围与验证案例 |

上述准备提供了后续调整的基础，不代表相关扩展已经实现。插件接口、box 与本地模块加载的详细预案见[插件化扩展设计](#62-插件化扩展设计预案未实施)。

### 2.5 具体行为与实现约定

结构调整、属性修改和文件操作遵循以下规则，使节点顺序、保存目标及历史状态在不同操作之间保持一致。

| 约定类别 | 具体规则 | 设计考虑 |
|---|---|---|
| **结构与绘制顺序** | 同父分组占据最早被选节点的位置，跨父分组放在根层最早受影响顶层分支的位置。被选成员按原文档的先序遍历顺序进入新组，各成员内部的子树结构保持不变。addto 将对象追加为目标容器的最后一个孩子，禁止自包含和祖先移入后代。front / back 分别调整到同级最后 / 最先绘制的位置。根级 g 不允许解组 | 明确结构操作后的位置与相对顺序，避免命令参数顺序意外改变排列，并防止形成循环结构 |
| **属性继承与缩放** | set g fill 等操作修改组自身属性，孩子按继承规则获得有效值，已有显式样式不被直接覆盖。CLI scale 只缩放位置与几何尺寸，不改变线宽或字号；text 的几何属性为 x、y | 保持公共属性、图形几何与继承效果的职责清楚，并区分 CLI 缩放与 SVG 导入变换的处理语义 |
| **数值与初始化** | 数值必须有限，画布尺寸为正，图形尺寸、半径和线宽非负，缩放因子为正。init 默认创建 800×600 画布，只给宽度时高度使用 600 | 在输入和领域边界拒绝非法数值，避免无效状态进入模型；默认参数保持确定、可重复 |
| **保存路径与历史管理** | 新建文档首次保存必须指定路径，随后无参数 save 使用最近成功保存路径；read 建立的读入路径优先作为默认目标，另存副本不改变该关联，init 清空两类路径。成功 init / read / save 或修改画布尺寸后，清空历史并阻止撤销重做；下一条成功编辑重新建立可撤销历史。只读 canvas 不影响历史，失败命令不改变文档、路径、历史和禁用状态 | 明确无参数保存的目标，区分可撤销编辑与历史屏障，并保证失败操作不留下部分状态变化 |
| **id 与文档根** | 导入先预留全部显式 id，再为缺失 id 的图形按标签和序号补全，避开已用名称；全部成功后才输出补全警告，显式重名则整次读取失败。SVG 根 id 为可选文档信息，通过 SvgId 与图形共用校验并参与全局唯一性检查；缺失时不自动补全，不计入图形数量，也不作为普通编辑目标，init 清除旧根 id | 保证对象可寻址且名称唯一，同时区分文档信息和可编辑图形，使导入、初始化与状态恢复采用一致规则 |

### 2.6 SVG 支持边界与变换归一化

#### 2.6.1 输入与属性支持范围

SVG 读写围绕现有图形模型提供明确的支持范围，导入与保存支持的呈现属性多于 CLI set 的可修改属性。

| 类别 | 支持范围与限制 |
|---|---|
| 图形与文本 | 支持 rect、circle、ellipse、line、text、g 及容器嵌套；text 仅支持纯文本，不支持 path、tspan 或 defs 等其他元素 |
| 长度与画布 | 几何长度支持纯数字和 px，不支持百分比或相对长度。viewBox 可以省略；存在时仅接受与画布一致的 `0 0 width height` |
| 呈现属性 | 除基本几何与绘制属性外，导入和保存还支持 font-size、text-anchor、font-family、font-weight、opacity、fill-opacity、stroke-opacity，属性值需满足相应校验；不支持 style 属性或 CSS 样式表 |
| 元数据与编辑范围 | 保留 data-* 元数据；CLI set 仍使用约定的可修改属性白名单，不因导入保留了某项属性而自动增加修改能力 |
| XML 处理 | 使用 @xmldom/xmldom 解析和序列化，通过严格错误回调拒绝畸形 XML，并拒绝 DOCTYPE；对不支持的元素、属性和命名空间明确报错 |

XML 解析与序列化集中在 SvgCodec，图形及属性规则由领域对象和工厂校验，相关库的接口说明见 [xmldom 官方文档](https://github.com/xmldom/xmldom)。

#### 2.6.2 变换解析与归一化流程

当前支持 `translate(tx[,ty])`、`scale(s)` 和 `scale(s,s)`，缩放比例必须为正且有限。变换参数支持浮点数、科学计数法，以及空格或逗号分隔；允许同一节点上的组合与父子节点嵌套。不支持 rotate、skew、非等比 scale 或任意 matrix。

导入采用归一化处理，将受支持的变换转换为图形的实际几何值：

1. TransformParser 解析各节点的 transform，UniformTransform 按 `parent(local(p))` 合成父子变换。
2. SvgCodec 从根向叶传递累计变换，容器负责传递，累计结果只对叶子图形应用一次，避免重复缩放或平移。
3. 对当前支持范围内的数值线宽和文字字号，结合继承值按累计缩放进行归一化处理。保存时输出调整后的几何与属性值，保留分组结构，省去原始 transform 属性。

#### 2.6.3 设计收益与限制

归一化后，move、scale、group 和 addto 可以继续基于统一的几何坐标工作，无需在每条编辑命令中处理局部坐标转换或计算逆矩阵。CLI scale 保持仅缩放位置与几何尺寸的约定，导入变换引起的线宽和字号缩放则由独立方法处理。

这一选择的代价是无法保留原始 transform 写法，保存时也可能增加显式线宽和字号。归一化保证的是当前支持范围内的几何与相关呈现属性处理，不等同于完整 SVG/CSS 解释或任意输入的逐像素外观保真。对应功能的测试与图形检查见质量保证部分。

## 3. 过程记录

本项目采用 AI 辅助开发。我在开发过程中持续提出复核要求、审阅方案和运行结果，并确认功能范围与修正方向；AI 辅助完成分析、实现、测试和文档整理。以下结合已有讨论、Git 改动与验收记录，选取影响架构、功能正确性和交付可信度的代表性迭代，说明问题如何确认、方案如何取舍，以及修改后如何验证。

### 3.1 开发路径与迭代记录

| 日期 | 开发环节 | 主要工作与检查重点 | 对应提交 |
|---|---|---|---|
| 2026-10-20 | 架构与工程建立 | 确定分层职责、依赖方向及 TypeScript 技术路线，建立工程配置与锁文件 | [8a4f6e8](https://github.com/1220XXX/svg-editor_XHT/commit/8a4f6e820a8000e7f4de8dcf553178268bcd965f) |
| 2026-10-20 | 领域模型 | 封装六种图形、文档树和唯一 id 约束，检查嵌套操作、克隆独立性与属性校验 | [b66caf8](https://github.com/1220XXX/svg-editor_XHT/commit/b66caf85d50104726915e107f224e9f3876bfdac) |
| 2026-10-20 | 命令与历史 | 将 CLI 和事务历史一并接入，检查编辑失败保护、历史屏障及 redo 清空 | [4d40a03](https://github.com/1220XXX/svg-editor_XHT/commit/4d40a03ea9fa982de7056206822b35edf9793e74) |
| 2026-10-20 | 结构操作 | 实现分组、解组、重新归属和绘制顺序，检查撤销后父级与节点次序是否恢复 | [a136a93](https://github.com/1220XXX/svg-editor_XHT/commit/a136a935e051df4d1901683b90d481c46c5a0957) |
| 2026-10-20 | SVG 与文件读写 | 接入存储和编解码端口，检查往返、补 id、坏 XML 与失败 IO，修正类型检查发现的 localName 可空问题 | [bc8db78](https://github.com/1220XXX/svg-editor_XHT/commit/bc8db78b6480fe761ac07e1357a9de18c85a8d3d) |
| 2026-10-20 | 基础验收与架构修订 | 回放任务书示例，新增依赖检查并消除类型导入循环，完成构建和交互检查 | [1e72db5](https://github.com/1220XXX/svg-editor_XHT/commit/1e72db57220f325e3e85105c52b267dfc0b514ae) |
| 2026-10-20 | 导入增强与值校验 | 独立实现 transform 归一化，并修正非法 XML 字符导致保存结果无法读回的问题 | [6ea667a](https://github.com/1220XXX/svg-editor_XHT/commit/6ea667aafad38c26779973cd5c794091901f1171)、[ef90a19](https://github.com/1220XXX/svg-editor_XHT/commit/ef90a1913d1ed2f2e5fe2234ebe324d8da9e7911) |
| 2026-10-24 | 环境与使用说明 | 固定运行环境版本，通过实际会话回放核对手册步骤与输出 | [3dc0967](https://github.com/1220XXX/svg-editor_XHT/commit/3dc09679ef8f4f13f079720d12c33bb509480758)、[03d36a4](https://github.com/1220XXX/svg-editor_XHT/commit/03d36a4fca73cc91ace243f4a3e124eb54e608f4) |
| 2026-10-24 | 命令逐项复核 | 分别修正创建参数、show、保存路径、分组成员下限、操作反馈与 tree 排版 | [162f2cd](https://github.com/1220XXX/svg-editor_XHT/commit/162f2cd934233004937866830517d4a962622ed8)、[51dd644](https://github.com/1220XXX/svg-editor_XHT/commit/51dd6440608184b2fa8f86787769447d3e6b6a02)、[607f255](https://github.com/1220XXX/svg-editor_XHT/commit/607f2557f8e8ba605c49955b2b00d925d2d15bdc)、[7b69483](https://github.com/1220XXX/svg-editor_XHT/commit/7b69483e07db811e2a6a3549497f25a1ad8d26ec)、[0a6606f](https://github.com/1220XXX/svg-editor_XHT/commit/0a6606f059b3d245e3ae2d3602c7709ee8efe3b7)、[92c7ce7](https://github.com/1220XXX/svg-editor_XHT/commit/92c7ce797a0dd91297bc275f44fb7765207eaea1) |
| 2026-10-24 | 根 id 与样式处理 | 补齐根 id 兼容和全局唯一性检查，增加可选基础样式保留并说明固化代价 | [91837f9](https://github.com/1220XXX/svg-editor_XHT/commit/91837f9b76ebfdcfbaafcfbb9ec001295e502f8e)、[70d4ba1](https://github.com/1220XXX/svg-editor_XHT/commit/70d4ba12640831c9a6e061fda1f6d3a6e5387659)、[59d0d7a](https://github.com/1220XXX/svg-editor_XHT/commit/59d0d7a2652cbc537c41861909c7ad7765c3b575) |
| 2026-10-26 | 可重复功能验收 | 将命令、预期、实际输出、SVG 和终端证据对应整理，独立提交验收工具与材料 | [0b62616](https://github.com/1220XXX/svg-editor_XHT/commit/0b6261643870d35af2a1cbf106e52e6bf877d76a) |
| 2026-10-27 | 启动修复与证据更新 | 拒绝错误启动参数，以修复后的代码重新采集验收材料并完成干净副本复跑 | [94acc74](https://github.com/1220XXX/svg-editor_XHT/commit/94acc74dc2a59c1c6cfa29474a9218548b0ca7d2)、[9d7fd25](https://github.com/1220XXX/svg-editor_XHT/commit/9d7fd25e2736118ab5c100ea2e7c5f07c5d5cd5e) |
| 2026-10-28 | 文档定稿与交付复验 | 重组报告，明确两处分派待重构点，修正报告锚点；完整复验并逐文件比较原有证据，按用户确认更新交付标签 | [本次复验记录](acceptance/validation/delivery-review-2026-10-28/summary.json) |

表中概括开发路径，以下重点记录具体问题与处理依据；各版本的完整测试统计保留在质量保证与历史验收部分。

### 3.2 通过接口消除依赖循环

命令与历史最初在 [4d40a03](https://github.com/1220XXX/svg-editor_XHT/commit/4d40a03ea9fa982de7056206822b35edf9793e74) 接入，当时 Command 直接以 EditorSession 作为接收者。基础验收中增加架构检查后，发现会话依赖命令，而命令又通过 type import 依赖具体会话类，形成了与设计规则不符的循环。程序能够执行，并不足以说明模块关系符合既定方案。

因此，修正的重点是拆开具体类之间的依赖，而不是放宽无循环规则。在 [1e72db5](https://github.com/1220XXX/svg-editor_XHT/commit/1e72db57220f325e3e85105c52b267dfc0b514ae) 中，将命令需要的接收者能力抽为 CommandContext，将历史需要的可撤销能力抽为 ReversibleEdit。命令和历史分别依赖接口，EditorSession 承担具体实现与协调。该提交同时新增架构测试，检查模块方向及包含类型导入的循环关系，修正后检查通过。

这次迭代表明，AI 生成的分层结构仍需要通过实际导入关系检验。后续由 [tests/architecture.test.ts](../tests/architecture.test.ts) 持续检查，避免接口调整后重新引入同类问题。

### 3.3 逐条复核命令语义与显示结果

初步实现和使用说明完成后，我要求继续对照任务书核查实际功能与展示，而不只依据测试通过作出完成判断。复核将命令语法、连续操作后的状态及实际输出一并比较，发现了以下差异，并按问题分别修正和提交。

#### 3.3.1 创建参数与失败后的历史保护

`create g in scene` 缺少独立 id，旧实现却会将 in 误作图形 id 并创建对象。这不仅接受了错误语法，还会将其记为成功编辑，清空原有 redo。确认问题时，将错误命令放在一次 undo 之后执行，再检查图形树和 redo 是否仍然可用。

修正不能简单禁止 in 作为 id，因为它在提供了完整参数的情况下可以是合法名称。[162f2cd](https://github.com/1220XXX/svg-editor_XHT/commit/162f2cd934233004937866830517d4a962622ed8) 在识别末尾 in 子句后，单独检查类型与 id 是否齐全。新增测试同时覆盖缺少 id 的拒绝、失败后树结构与 redo 不变，以及六种类型合法使用 in 作为显式 id 的情况，使语法修正与兼容性检查同时成立。

#### 3.3.2 通过连续操作确认默认保存路径

保存行为的复核围绕以下序列展开：原文件 source.svg 中矩形 r 的初始 x 为 1，读入后先保存副本，再继续编辑并无参数保存。

```text
read source.svg
save copy.svg
move r 10 0
save
```

旧实现只记录最近一次保存路径，因此最后一步会写入 copy.svg。复核确认的目标是：读入文档后，无参数 save 应回到 source.svg；副本保留另存时的状态。单独检查“保存成功”无法区分这两种行为，必须核对两个文件的实际内容。

[607f255](https://github.com/1220XXX/svg-editor_XHT/commit/607f2557f8e8ba605c49955b2b00d925d2d15bdc) 将读入路径与最近保存路径分别记录，默认目标优先使用读入路径。回归测试检查 source.svg 中 r 的 x 变为 11，copy.svg 仍为 1，并覆盖成功读取后替换关联、init 清理路径及失败读写保留路径和 redo。这次修正的关键是明确路径语义，再通过连续操作验证，而不是只调整成功提示。

#### 3.3.3 其他命令与展示修正

| 复核发现 | 修正与确认方式 | 对应提交 |
|---|---|---|
| show 的几何与样式排列不符合示例，信息不易逐项比较 | 几何属性集中在一行，样式逐行列出；精确比较各图形输出，并检查组不产生空白几何行、查询不改变历史 | [51dd644](https://github.com/1220XXX/svg-editor_XHT/commit/51dd6440608184b2fa8f86787769447d3e6b6a02) |
| 单成员 group 被接受，与至少两个成员的语法约定不符 | 在领域层统一拒绝成员不足；检查原树与 redo 保留，并确认拒绝后新组 id 仍可正常使用 | [7b69483](https://github.com/1220XXX/svg-editor_XHT/commit/7b69483e07db811e2a6a3549497f25a1ad8d26ec) |
| 编辑、撤销与重做的提示未充分反映实际结果 | 由具体命令提供结果和恢复摘要，redo 重用原成功摘要；同时检查坐标、属性省略状态和拓扑恢复，避免只改文字而未核对状态 | [0a6606f](https://github.com/1220XXX/svg-editor_XHT/commit/0a6606f059b3d245e3ae2d3602c7709ee8efe3b7) |
| tree 在不同层级、长 id 和中文等内容下属性列不齐 | 以包含层级前缀的显示宽度计算列位置，检查树枝、顺序、Unicode、空树及删除恢复后的重新对齐 | [92c7ce7](https://github.com/1220XXX/svg-editor_XHT/commit/92c7ce797a0dd91297bc275f44fb7765207eaea1) |

上述六项修正分别完成类型检查、测试和构建，并回放任务书会话及 transform 往返。使用手册同步采用实际输出，保持命令实现、操作步骤和展示结果一致。

### 3.4 区分功能范围并独立实现 transform 增强

在讨论扩展方案时，我曾进一步追问 box 和动态插件是否属于当前必须完成的内容。重新核对后，确认 box 留待插件化实现，因此将相关实现留待后续扩展，并保留设计预案。当前 `create box` 返回未知类型，也继续按这一范围检查。相关范围复核及预案记录在 [59d0d7a](https://github.com/1220XXX/svg-editor_XHT/commit/59d0d7a2652cbc537c41861909c7ad7765c3b575)、[ecb85a8](https://github.com/1220XXX/svg-editor_XHT/commit/ecb85a82f5cb63dc553e5a4322eea269ccb38cb4) 等文档提交中。

transform 则是在基础功能完成后独立处理的导入增强。初版不能直接读取背景示例中的变换，已有迭代记录显示：新增的 20 项增强测试中，9 项有效变换用例在基础版本失败，确认了原有能力边界。讨论后选择在导入时归一化，而不让每条编辑命令都处理局部坐标和逆矩阵，以保持后续编辑逻辑集中。

实现中还需要防止重复应用变换：如果导入递归和组的递归缩放同时作用于孩子，同一图形可能被处理多次。因此只累计父子变换，并对叶子应用一次。[6ea667a](https://github.com/1220XXX/svg-editor_XHT/commit/6ea667aafad38c26779973cd5c794091901f1171) 的测试覆盖组合顺序、嵌套、抵消缩放、线宽和字号，以及导入后的编辑、撤销重做和保存读回；新增测试通过，原有功能回归通过。保存不再保留原始 transform 写法的代价，也随实现一并记录。

### 3.5 补齐 SVG 值与根 id 的合法性

基础验收后的审查发现，部分字符串虽能进入模型，却会使保存的 XML 无法重新读取。这提示仅检查内存中的编辑结果还不够，还要检查结果能否合法序列化并再次导入。[ef90a19](https://github.com/1220XXX/svg-editor_XHT/commit/ef90a1913d1ed2f2e5fe2234ebe324d8da9e7911) 通过 SvgValue 统一拒绝非法 XML 字符，并加入合法中文和 Unicode 补充平面字符的往返测试，避免扩大拒绝范围而损失合法文本。

后续复核又发现，合法 svg 根节点带 id 时会被当作样式拒绝。确认时不仅检查“能否读入”，还检查根 id 是否参与全局唯一性、自动 id 是否避让，以及克隆和快照是否保留它。当时验证记录显示，新增 22 项用例中有 21 项在旧实现上失败，问题涉及多个相关路径。

[91837f9](https://github.com/1220XXX/svg-editor_XHT/commit/91837f9b76ebfdcfbaafcfbb9ec001295e502f8e) 将共用规则提取为 SvgId，由根节点与图形复用；SvgDocument 封装可选根 id，SvgCodec 独立读写，导入先预留全部显式 id 再补全缺失项。根节点保持为文档信息，不计入图形数量，也不作为普通编辑目标。修正后对应测试、真实 CLI 和原有回归通过，手册中的支持范围与示例同步更新。

### 3.6 保留继承样式，同时说明固化的代价

结构操作的实际案例表明：孩子继承组的红色后，解组或移入其他组可能改变颜色。我在阅读初步评估后，继续要求确认这一现象的原因及改进价值。讨论确认它符合继承规则，不能仅凭颜色变化就认定基本编辑功能错误；需要解决的是是否提供保留原样式的操作选择。

因此保留普通启动行为，并以 `--preserve-style` 显式开启增强。[70d4ba1](https://github.com/1220XXX/svg-editor_XHT/commit/70d4ba12640831c9a6e061fda1f6d3a6e5387659) 引入统一策略，供 group、ungroup、addto 使用：先比较结构变化前后的有效样式，再计算必要补写，全部检查通过后与结构一起提交。验证同时覆盖根与祖先继承、默认值、显式覆盖、深层嵌套，以及失败后文档和历史不变，避免只验证一个红色矩形的正向案例。

方案讨论还明确了固化的代价：补成显式属性后，对象不再随新父级改变对应样式。[59d0d7a](https://github.com/1220XXX/svg-editor_XHT/commit/59d0d7a2652cbc537c41861909c7ad7765c3b575) 将这一效果、颜色范围及拒绝条件写入手册；后续 F39 验收检查固化对象、未固化对照，以及 `set fill inherit` 恢复联动。对于字体继承或组透明度等超出支持范围的变化，策略原子拒绝。最终选择保留三项基础属性的明确边界，而没有将其扩大描述为所有场景的外观保真。

### 3.7 拒绝错误启动参数，避免静默进入错误模式

2026-10-27 的复核发现，旧入口用 includes 判断模式，未校验其余启动参数。实际复现中，`--preserve-stlye`、`--unknown` 及合法参数混入未知参数的情况仍以退出码 0 启动，并执行输入中的保存命令。问题不仅是提示不明确，还会让使用者误以为所选模式生效，因此需要检查真实进程和文件副作用。

讨论后的修正是先校验全部参数，再创建编辑器，而不是启动后才报告错误。[94acc74](https://github.com/1220XXX/svg-editor_XHT/commit/94acc74dc2a59c1c6cfa29474a9218548b0ca7d2) 新增 StartupOptions，只接受精确的 `--preserve-style`，重复合法参数保持幂等。Main 在参数错误时输出单行 stderr、设置退出码 2，并跳过编辑器装配和 REPL；正常启动后的命令错误仍由原有交互流程处理。

| 检查对象 | 修复前的实际复现 | 修复后的验证结果 |
|---|---|---|
| 未知或拼错的启动参数 | 被忽略，退出码为 0，继续执行输入 | 退出码为 2，stderr 明确报告未知参数，stdout 为空 |
| 输入中的保存命令 | 被执行并在临时目录生成文件 | 不执行输入，不生成目标文件 |

该提交增加 37 项测试，分别覆盖解析配置及源码、新构建入口的实际行为。随后又核对实际 npm 启动与错误启动 PTY，检查退出码、输出和无保存副作用；这些专项执行单独记录。修复前后证据见[旧入口复现](acceptance/validation/startup-before-fix.json)、[启动矩阵](acceptance/validation/startup-launch-matrix.json)和[专项检查日志](acceptance/validation/startup-check.txt)。

### 3.8 环境、交互与可重复验收的完善

入口可用性也通过实际运行逐步修正。受限环境下 tsx 启动器建立 IPC 失败，改用 `node --import tsx`，保持 `npm run cli` 的入口不变；输入关闭后继续请求提示符会抛错，REPL 增加 close 状态检查并继续串行处理已读命令。这些修改随 [1e72db5](https://github.com/1220XXX/svg-editor_XHT/commit/1e72db57220f325e3e85105c52b267dfc0b514ae) 收录，并由 REPL 测试及后续真实 PTY 检查持续验证。

在能够运行项目后，我进一步要求补齐环境和使用说明。2026-10-24，[3dc0967](https://github.com/1220XXX/svg-editor_XHT/commit/3dc09679ef8f4f13f079720d12c33bb509480758) 在 `.nvmrc` 中固定 Node.js 版本为 v24.22.1，[03d36a4](https://github.com/1220XXX/svg-editor_XHT/commit/03d36a4fca73cc91ace243f4a3e124eb54e608f4) 补充手册。手册初次通过 18 组会话、156 条输入回放，后续随实现同步维护，使说明中的操作和回显有实际运行依据。

随后，我提出将各项功能测试的步骤、结果和生成材料集中整理，以便交付时逐项核查。[0b62616](https://github.com/1220XXX/svg-editor_XHT/commit/0b6261643870d35af2a1cbf106e52e6bf877d76a) 以 [2f5ef47](https://github.com/1220XXX/svg-editor_XHT/commit/2f5ef475a2e9d24bd2ece7944b63fc07ac036749) 为基线，独立提交验收脚本、预先定义的用例与预期、实际输出及 SVG / PNG。采集使用隔离副本，避免覆盖个人练习文件；中间状态通过独立重放保存，防止为了留存 SVG 而改变原会话的撤销重做序列。

验收工具本身也需要复核。编写时发现流程图列宽预期和脚本单文件类型检查参数需要调整，依据任务书与工具实际行为修正预期和检查方式，业务代码未为迎合预期而修改。启动参数修复后，旧材料也未直接作为新代码已通过的证明：[9d7fd25](https://github.com/1220XXX/svg-editor_XHT/commit/9d7fd25e2736118ab5c100ea2e7c5f07c5d5cd5e) 重新收录针对 [94acc74](https://github.com/1220XXX/svg-editor_XHT/commit/94acc74dc2a59c1c6cfa29474a9218548b0ca7d2) 的结果，测试数量改为从真实日志读取，避免沿用写死的旧统计。

最后，从不含个人文件、依赖及构建产物的干净临时副本重新安装并执行默认验收，确认流程可重复执行，且已保存证据的前后哈希一致。证明见[复跑记录](acceptance/validation/reproducibility.json)。这一过程使开发记录、代码基线和验收材料能够相互对应，也将对 AI 产出的复核延伸到文档和测试工具本身。

## 4. 一致性自查

### 4.1 实际模块是否与方案一致

实际实现保持了输入交互、应用协调、领域模型、基础设施和启动装配五个主要模块，目录归属与架构图一致。开发过程中，根据架构检查和功能扩展，对模块内部的接口、辅助类型及子目录进行了细化；这些调整已同步纳入[模块划分表](#21-模块划分)，具体修订依据如下。

| 实现调整 | 实际归属 | 调整性质 | 修订依据 |
|---|---|---|---|
| 引入 Argument、TreeNode | `src/application` | 细化输入参数与只读展示边界，保持 CLI 与领域内部状态分离 | 3.1 命令与历史接入，[4d40a03](https://github.com/1220XXX/svg-editor_XHT/commit/4d40a03ea9fa982de7056206822b35edf9793e74)；后续树形展示调整见 3.3 |
| 抽出 CommandContext、ReversibleEdit | `src/application/ports` | 用接口解除命令、会话与历史之间的具体类依赖，修正类型导入循环 | [3.2 依赖循环修正](#32-通过接口消除依赖循环)，[1e72db5](https://github.com/1220XXX/svg-editor_XHT/commit/1e72db57220f325e3e85105c52b267dfc0b514ae) |
| 增加 UniformTransform | `src/domain` | 封装平移与正等比缩放的组合运算，SVG 语法解析仍留在基础设施层 | [3.4 transform 增强](#34-区分功能范围并独立实现-transform-增强)，[6ea667a](https://github.com/1220XXX/svg-editor_XHT/commit/6ea667aafad38c26779973cd5c794091901f1171) |
| 增加 SvgValue | `src/domain` | 集中处理 XML 字符合法性约束，供图形文本、属性及元数据复用 | [3.5 SVG 合法性修正](#35-补齐-svg-值与根-id-的合法性)，[ef90a19](https://github.com/1220XXX/svg-editor_XHT/commit/ef90a1913d1ed2f2e5fe2234ebe324d8da9e7911) |
| 提取 SvgId 并补齐根 id | `src/domain`，读写适配位于 `src/infrastructure/svg` | 共用 id 校验，根 id 随文档克隆与恢复；保持领域约束与 XML 转换的职责分离 | [3.5 根 id 修正](#35-补齐-svg-值与根-id-的合法性)，[91837f9](https://github.com/1220XXX/svg-editor_XHT/commit/91837f9b76ebfdcfbaafcfbb9ec001295e502f8e) |
| 增加 styles 子目录 | `src/domain/styles` | 在领域层内部细分样式策略、继承解析和颜色检查，不引入文件或终端依赖 | [3.6 基础样式保留](#36-保留继承样式同时说明固化的代价)，[70d4ba1](https://github.com/1220XXX/svg-editor_XHT/commit/70d4ba12640831c9a6e061fda1f6d3a6e5387659) |
| 增加 StartupOptions | `src/bootstrap` | 独立封装启动参数校验，在装配编辑器前完成配置检查 | [3.7 启动参数修正](#37-拒绝错误启动参数避免静默进入错误模式)，[94acc74](https://github.com/1220XXX/svg-editor_XHT/commit/94acc74dc2a59c1c6cfa29474a9218548b0ca7d2) |

这些变化完善了原有模块内部的职责，没有新增未说明的业务层，也没有将文件 IO、XML 库或终端读写移入领域层。`scripts/acceptance` 是生产源码之外的验收工具，其新增及证据维护见 3.8，不属于业务模块之间的运行时依赖图。附录中的 Provider、box 和插件加载仍为预案，不计入现有目录或已完成实现。

### 4.2 实际依赖是否遵循方案

当前检查未发现违反既定方向或形成循环的静态导入。检查以 [tests/architecture.test.ts](../tests/architecture.test.ts) 中的允许依赖矩阵为依据，对 src 文件中的静态 from 导入建立文件依赖图，包括 type import；同时检查 Domain 和 Application 是否导入 Node.js 内置模块或第三方库。已保存的[检查日志](acceptance/validation/check.txt)记录了架构测试随完整回归通过的结果。

以下抽查列出文件的直接导入或接口实现关系，并与允许方向逐项对应：

| 抽查文件 | 实际导入或实现关系 | 对应规则与结论 |
|---|---|---|
| [MoveCommand](../src/application/commands/MoveCommand.ts) | 直接导入 SvgDocument、Numeric、EditingCommand；CommandContext 由编辑命令基类使用 | Application → Application / Domain，符合规则；区分直接导入与基类协作关系 |
| [HistoryManager](../src/application/history/HistoryManager.ts) | 导入 ReversibleEdit、SvgDocument、EditorError，通过接口维护历史，不导入具体命令类 | Application → Application / Domain，符合规则 |
| [Group](../src/domain/shapes/Group.ts) | 导入 Shape、Numeric、EditorError，均位于领域层 | Domain → Domain，符合规则，无应用层、终端或文件系统导入 |
| [SvgCodec](../src/infrastructure/svg/SvgCodec.ts) | 实现 DocumentCodec，导入领域文档、图形工厂及变换对象，并使用 XML 库 | Infrastructure → Application / Domain，内部辅助类型归于 Infrastructure；XML 依赖位于允许的适配层 |
| [LocalTextStorage](../src/infrastructure/filesystem/LocalTextStorage.ts) | 实现 TextStorage，导入 EditorError，并调用 Node.js 文件、路径和随机标识接口 | Infrastructure → Application / Domain，文件系统实现保持在基础设施层 |
| [CliController](../src/cli/CliController.ts) | 导入 EditorSession、CommandFactory，以及本模块的 Tokenizer、OutputFormatter | CLI → CLI / Application，符合规则，没有直接导入 Domain |
| [Main](../src/bootstrap/Main.ts) | 导入启动配置、应用会话、CLI、领域工厂与样式策略，以及基础设施实现，完成对象装配 | Bootstrap 可依赖全部模块，符合装配入口的职责 |

对源码导入关系的整体检查还确认，其他模块没有反向导入 Bootstrap。上述结论限定于当前静态导入检查和代码抽查范围；一类一文件、类名及 switch 等代码组织检查仍由架构测试执行，相关约定见依赖方向规则。

开发中曾发现并修正一项循环依赖，处理记录如下：

| 历史问题 | 修正方式 | 修订依据与状态 |
|---|---|---|
| EditorSession 与命令之间形成类型导入循环，历史管理也依赖具体编辑命令 | 抽出 CommandContext、ReversibleEdit，调整命令接收者与历史条目的依赖，并加入循环检查 | [1e72db5](https://github.com/1220XXX/svg-editor_XHT/commit/1e72db57220f325e3e85105c52b267dfc0b514ae)，已修复，后续检查通过；过程见 [3.2](#32-通过接口消除依赖循环) |

当前未发现待处理的依赖违规。后续如出现新的越界依赖或循环，将记录涉及文件、违反规则和处理方式，修正后复查并更新状态。工厂注册机制的插件化改造属于未来扩展，不列为当前依赖错误。

## 5. 质量保证手段

功能完整性通过逐项需求核查确认，操作正确性通过自动化测试、真实 CLI 和文件状态检查验证，交付可重复性通过隔离环境复跑确认。类型检查、架构检查与覆盖率提供补充依据，分别检查接口约束、模块关系及测试执行中的遗漏。以下将验证方法、通过判据与实际证据对应说明。

### 5.1 当前验收结果与证据基线

以下结果采集于 2026-10-27，被测代码为 `94acc74dc2a59c1c6cfa29474a9218548b0ca7d2`，材料在 `9d7fd25` 收录。采集环境为 macOS arm64、Node.js v24.22.1、npm 11.19.1；浏览器检查使用记录中的 Chrome。源码树与测试树的标识保存在 summary.json，可用来判断后续文档提交是否改变被测代码。

2026-10-28 交付复验以 `9d7fd25e2736118ab5c100ea2e7c5f07c5d5cd5e` 为代码基线，临时副本叠加当前验收生成器，重新安装依赖并运行完整验收。源码树、测试树和锁文件与原始验收一致，生成器的当次哈希单独记录；本次没有业务源码、测试、依赖或 CI 修改。结果仍为 202 项测试、1674 条功能断言与 40 条终端断言全部通过，覆盖率与下表一致。432 份已跟踪的功能与终端证据逐文件比较均与本次运行结果相同，因此保留原始 SVG、PNG 和结果文件，不重复提交。新日志与汇总独立保存在 [delivery-review-2026-10-28](acceptance/validation/delivery-review-2026-10-28/)，其中 [summary.json](acceptance/validation/delivery-review-2026-10-28/summary.json) 保存实际基线和检查结果，[review.json](acceptance/validation/delivery-review-2026-10-28/review.json) 保存文档、文件范围及证据比对结果。下面的原始采集记录保持其历史含义。

| 检查项目 | 已记录结果 | 证据 |
|---|---|---|
| 类型检查、自动化测试、生产构建 | 全部通过；16 个测试文件、202 项测试 | [check 日志](acceptance/validation/check.txt) |
| 验收工具独立类型检查 | 通过 | [runner-typecheck 日志](acceptance/validation/runner-typecheck.txt) |
| 功能验收 | 40 个主用例、55 个定义子场景、650 条定义输入；1674 条功能断言通过 | [summary.json](acceptance/summary.json)、[逐步记录](acceptance/功能测试与结果记录.md) |
| 真实终端交互 | 4 次 PTY 执行、40 条交互断言通过 | [终端证据目录](acceptance/terminal) |
| 覆盖率 | 行 99.68%、分支 91.60%、函数 100%、语句 97.47% | [coverage 日志](acceptance/validation/coverage.txt) |
| 干净副本复跑 | 重新安装与默认验收通过，已保存证据哈希保持一致 | [reproducibility.json](acceptance/validation/reproducibility.json) |

40 个主用例按源码 / 构建入口及适用模式组合执行，共形成 90 次用例执行、128 次子场景执行与 1508 条实际输入，另有 48 次独立状态重放；常规验收合计启动 180 个 CLI 进程。上述数字分别描述用例覆盖范围和实际执行规模。启动参数专项结果单独记录，也不增加 40 个主用例的统计。

覆盖率按项目配置排除纯装配入口 `src/bootstrap/Main.ts`，子进程执行不计入父进程覆盖率。入口路径由真实源码和构建进程测试补充验证；覆盖率用于发现遗漏，功能完整性仍需结合任务书、断言内容和失败场景判断。

### 5.2 验证方法与重新执行

验证按对象和运行层次组织，不同检查相互补充：

| 验证层次 | 检查方法与判定内容 |
|---|---|
| 领域与应用测试 | 检查图形数值、属性与结构约束，以及命令执行、历史屏障和失败保护；将操作后的模型状态与明确预期比较 |
| 真实 CLI 验收 | 分别启动源码和构建入口，比较 stdout、stderr、退出码及实际保存文件；SVG 检查属性、文本、父级、绘制顺序和应省略的属性 |
| 终端与视觉检查 | 通过真实 PTY 检查提示符、EOF 和串行交互；对精选场景由浏览器渲染 SVG 并核对像素，用于验证绘制顺序与样式效果 |
| 工程与复现检查 | 执行类型检查、测试、构建及架构约束检查；按锁文件安装依赖，并从干净副本重新运行验收，核对被测基线和证据是否保持一致 |

预期输出在执行前定义，实际输出仅统一 CRLF 后精确比较，不过滤错误、数值或节点顺序。普通模式和增强模式按用例适用范围执行，源码与构建入口分别验证。为避免保存证据改变原有 undo / redo 序列，中间状态在新目录重放命令前缀后另行保存；结构与属性由 XML 断言检查，精选视觉效果由浏览器检查。

在项目根目录可按需执行以下命令，nvm 读取 .nvmrc 选择运行时，npm ci 按锁文件安装依赖：

```sh
nvm use
npm ci
npm run check
npm run test:coverage
npm run test:acceptance
```

其中 check 包含类型检查、测试与构建；完整功能验收使用提交快照在隔离临时目录安装、构建和运行，默认不覆盖仓库内已有证据。验收还需要 git、tar、Python 3，以及 Chrome / Chromium；可通过 ACCEPTANCE_CHROME 指定浏览器路径。缺少浏览器会明确失败，不将未执行的视觉检查记为通过。详细步骤见[验收报告](acceptance/功能测试与结果记录.md)。

重新采集证据使用 `npm run test:acceptance -- --record`。采集后应核对输出变化与被测基线，确保结果与对应代码一致。

GitHub Actions 已配置 push / pull_request 时安装依赖并运行 `npm run check`，配置见 [ci.yml](../.github/workflows/ci.yml)。完整功能验收和浏览器证据未纳入该工作流；本报告记录的通过结果来自本地实际运行日志，远端 Actions 的执行状态需另行查看。

### 5.3 需求与验证对应

自动化测试依据具体状态和行为判定通过，以下列出主要判据及对应文件，避免只依据成功提示或测试数量判断正确性。

| 质量关注点 | 主要验证判据 | 对应测试 |
|---|---|---|
| 图形与领域约束 | 六类图形按各自几何规则移动和缩放，克隆相互独立；非法尺寸、数值和属性被拒绝 | [tests/domain.test.ts](../tests/domain.test.ts) |
| 输入解析与基础交互 | 引号、转义、颜色和注释按规则解析；无文档时拒绝编辑，缺少独立 id 的创建失败且不破坏 redo | [tests/cli.test.ts](../tests/cli.test.ts) |
| 撤销重做与历史屏障 | 撤销恢复编辑前状态，重做恢复编辑结果；新成功编辑清空 redo，失败或查询不消耗历史，文档操作遵循屏障 | [tests/history.test.ts](../tests/history.test.ts) |
| 容器结构与顺序 | 分组和重新归属保持约定顺序，拒绝循环与非法成员；结构操作一次撤销恢复父级、次序及完整子树 | [tests/topology.test.ts](../tests/topology.test.ts) |
| 文件读写与 SVG 往返 | 保存再读取后结构、属性及文本一致；补 id 避让显式名称，坏 XML 与 IO 失败不改变文档、路径和历史；检查真实文件替换及临时文件清理 | [tests/persistence.test.ts](../tests/persistence.test.ts) |
| 文档根 id | 根 id 可往返并随快照恢复，参与全局唯一性及自动 id 避让；初始化清理旧根，失败读取保留原状态 | [tests/root-id.test.ts](../tests/root-id.test.ts) |
| 基础样式保留 | 普通与增强模式分别符合声明行为；增强模式保留受支持属性，超出范围时整次拒绝，原结构、样式及历史不变 | [tests/preserve-style.test.ts](../tests/preserve-style.test.ts) |
| 综合会话与必要错误 | 回放任务书完整会话及两节点流程图，检查关键状态、保存结果和指定错误；真实 CLI 在错误后继续处理并于 EOF 退出 | [tests/acceptance.test.ts](../tests/acceptance.test.ts) |
| 终端循环 | 提示符与交互状态一致，输入逐行串行处理；关闭输入后正常结束，已读命令不丢失 | [tests/repl.test.ts](../tests/repl.test.ts) |
| 启动配置与入口 | 合法参数选择正确模式，重复参数幂等；非法参数在两个入口均以退出码 2 拒绝，stdout 为空且不执行保存输入 | [tests/startup-options.test.ts](../tests/startup-options.test.ts) |
| 架构与代码组织 | 静态导入符合允许矩阵，无包含类型导入的循环；类文件命名与数量符合约定，并检查 switch 语句 | [tests/architecture.test.ts](../tests/architecture.test.ts) |
| 变换导入 | 父子及同节点变换按约定组合，几何、线宽和字号只归一化一次；非法变换被拒绝，编辑与读写往返保持稳定 | [tests/transform.test.ts](../tests/transform.test.ts) |
| XML 字符合法性 | 非法 XML 字符在进入相关值时被拒绝，合法中文及 Unicode 字符能够保存并读回 | [tests/xml-values.test.ts](../tests/xml-values.test.ts) |
| 属性展示 | show 的几何、样式和文本排列符合约定，组不产生多余几何行，查询不改变历史 | [tests/show-format.test.ts](../tests/show-format.test.ts) |
| 操作反馈 | 成功、撤销和重做的反馈与实际坐标、属性省略状态、父级及拓扑结果一致 | [tests/feedback.test.ts](../tests/feedback.test.ts) |
| 树形展示 | 层级、顺序和属性列对齐正确，覆盖子树、空树、长 id 及 Unicode，并在删除或恢复后重新计算布局 | [tests/tree-format.test.ts](../tests/tree-format.test.ts) |

### 5.4 功能逐项核查

当前结论依据 5.1 所列代码基线下的完整回归与功能验收。下表关联主要黑盒用例，其适用模式执行记录均已通过；精确输出、Unicode 和溢出等细节由 5.3 所列自动化测试补充。历史复核数据保留在附录，尚未实施的扩展不计入已完成成果。

**命令功能**

| 功能 | 主要核查内容 | 对应用例（通过） |
|---|---|---|
| init | 默认与显式画布尺寸、非法尺寸拒绝，替换文档并清空路径和历史 | [F02](acceptance/results/F02-init)、[F28](acceptance/results/F28-barriers) |
| read | 六类图形及嵌套读取、补 id 与重名处理，失败保留当前状态，成功设置历史屏障 | [F31](acceptance/results/F31-roundtrip)、[F32](acceptance/results/F32-ids)、[F34](acceptance/results/F34-io-failure)、[F28](acceptance/results/F28-barriers) |
| save | 标准 SVG、文本转义及省略属性，默认目标与另存副本，写入失败保护和成功屏障 | [F30](acceptance/results/F30-save)、[F33](acceptance/results/F33-save-path)、[F34](acceptance/results/F34-io-failure)、[F28](acceptance/results/F28-barriers) |
| canvas | 查询不影响历史，尺寸修改不缩放内容；非法尺寸拒绝，成功修改设置屏障 | [F03](acceptance/results/F03-canvas)、[F28](acceptance/results/F28-barriers) |
| create | 六类图形的参数、独立 id、可选颜色、属性省略及目标容器检查 | [F04](acceptance/results/F04-rect)～[F09](acceptance/results/F09-group-create) |
| delete | 删除叶子或整棵子树，撤销恢复子孙、原父级及可寻址性 | [F17](acceptance/results/F17-delete-leaf)、[F18](acceptance/results/F18-delete-container) |
| move | 五类叶子的坐标与线段两端更新，嵌套组递归移动，撤销恢复原几何 | [F10](acceptance/results/F10-move-leaves)、[F11](acceptance/results/F11-move-container) |
| scale | 位置与几何尺寸同乘，容器递归，非正或非法因子拒绝，不改变 CLI 线宽及字号约定 | [F12](acceptance/results/F12-scale-leaves)、[F13](acceptance/results/F13-scale-container) |
| set | 几何白名单、公共样式和文本修改，含空文本与转义；未知属性及非法值拒绝 | [F14](acceptance/results/F14-set-geometry)、[F15](acceptance/results/F15-set-style)、[F16](acceptance/results/F16-set-text) |
| group | 至少两个不同成员，同父与跨父分组保持原顺序；冲突拒绝，撤销恢复原结构 | [F19](acceptance/results/F19-group-same)、[F20](acceptance/results/F20-group-cross) |
| ungroup | 嵌套普通组的孩子提升至原位置，根级组拒绝，失败后 redo 保留 | [F21](acceptance/results/F21-ungroup) |
| addto | 移入目标末尾，检查容器、自包含与循环，撤销回到原父级 | [F22](acceptance/results/F22-addto) |
| front | 移至同级最后绘制，保持其他节点相对顺序，撤销重做及交叠像素符合预期 | [F23](acceptance/results/F23-front) |
| back | 移至同级最先绘制，保持其他节点相对顺序，撤销重做及交叠像素符合预期 | [F24](acceptance/results/F24-back) |
| tree | 全文档与子树展示，几何、样式和层级符合约定，查询不消耗历史 | [F27](acceptance/results/F27-display-history)、[F36](acceptance/results/F36-task-book) |
| show | 类型、id、父级、几何与样式展示正确，查询不影响 undo / redo | [F27](acceptance/results/F27-display-history)、[F36](acceptance/results/F36-task-book) |
| help | 无文档时可用，包含 19 条命令及六类创建语法 | [F01](acceptance/results/F01-help) |
| undo | 每条成功编辑对应一个单元，恢复几何、结构、样式及属性省略状态，耗尽时明确报错 | [F25](acceptance/results/F25-undo)、[F28](acceptance/results/F28-barriers)、[F29](acceptance/results/F29-atomicity) |
| redo | 恢复撤销的编辑；新成功编辑清空 redo，查询及失败操作保留 redo，遵循屏障规则 | [F26](acceptance/results/F26-redo)、[F27](acceptance/results/F27-display-history)、[F28](acceptance/results/F28-barriers)、[F29](acceptance/results/F29-atomicity) |

**跨命令约束、增强功能与交付检查**

| 检查对象 | 核查内容 | 验证依据 |
|---|---|---|
| 通用输入与终端交互 | 空行、整行注释、颜色、引号与错误后继续执行；交互提示符、串行输入和 EOF | [F01](acceptance/results/F01-help)、[F35](acceptance/results/F35-input)；[PTY 记录](acceptance/terminal) |
| 失败保护与历史屏障 | 非法操作和失败读写不改变原状态或消耗历史；成功文档操作设置屏障 | [F28](acceptance/results/F28-barriers)、[F29](acceptance/results/F29-atomicity)、[F34](acceptance/results/F34-io-failure) |
| 综合会话 | 完整回放代表性命令会话及两节点流程图，核对关键输出、状态和保存结果 | [F36](acceptance/results/F36-task-book) |
| transform 增强 | 组合、嵌套及线宽字号归一化，非法变换拒绝，导入后编辑与往返 | [F37](acceptance/results/F37-transform) |
| 基础样式保留 | 结构操作保留受支持属性；固化后停止联动、inherit 恢复联动；超出范围时原子拒绝 | [F38](acceptance/results/F38-preserve-style)、[F39](acceptance/results/F39-color-link)、[F40](acceptance/results/F40-enhanced-reject) |
| 启动参数 | 两个实际入口接受合法配置，拒绝未知参数，不执行输入或产生保存副作用 | [启动测试](../tests/startup-options.test.ts)；[专项矩阵](acceptance/validation/startup-launch-matrix.json) |
| OO 与架构 | 命令和图形按职责封装，行为通过多态组织；类型与模块依赖、文件组织符合约定 | [设计模式](#22-设计模式的选择及落地)、[一致性自查](#4-一致性自查)及[架构测试](../tests/architecture.test.ts) |
| 文档与过程 | 报告覆盖架构、修订、自查和质量依据，手册会话经过实际回放核对 | [过程记录](#3-过程记录)、[使用手册](USER_GUIDE.md) |
| Git 交付 | 分步提交保留开发轨迹，验收结果能够对应到被测代码及材料版本 | [版本追溯](#57-git-交付与版本追溯) |

### 5.5 图形检查

图形检查结合示例预览、SVG 结构与数值断言，以及精选场景的像素检查，分别验证布局、保存内容和实际呈现效果。示例文件为 [flowchart.svg](../examples/flowchart.svg)、[transform-original.svg](../examples/transform-original.svg) 和 [transform-normalized.svg](../examples/transform-normalized.svg)。

流程图展示嵌套组中的两个节点、文字和连线，以及文本修改后的最终保存结果。检查时核对节点与连线的布局；移动后撤销是否恢复原状态，则由操作序列和状态断言确认，示例输入见 [flowchart.cli](../examples/flowchart.cli)。

![两节点流程图](../examples/flowchart.png)

变换归一化预览用于查看平移与等比缩放导入后的布局及文字呈现。具体几何坐标、尺寸、线宽和字号由数值断言核对，再结合原图与归一化图的比较结果检查呈现差异。

![变换归一化预览](../examples/transform-normalized.png)

背景原图与归一化图使用同一本地渲染器比较，尺寸均为 400×200 像素。共比较 320000 个 RGBA 通道值，其中 44 个通道值不同；通道值范围为 0～255，最大绝对差为 2，平均绝对差为 0.000140625。差异数量按通道统计，比较结果存在微小的光栅化差异。数据见[原始比较记录](transform-render-check.json)。

上述示例比较与后续 Chrome 验收分别留存证据。Chrome 验收从实际保存的 SVG 渲染 PNG，并对指定位置的像素颜色作断言。图形相关的结构、数值与视觉证据对应如下：

| 检查对象 | 验证内容 | 现有依据 |
|---|---|---|
| 两节点流程图 | 核对节点、文字、连线及保存结构，并检查渲染图中指定节点位置的颜色 | [F36 结构与像素断言](acceptance/results/F36-task-book/build-default/result.json) |
| transform 归一化 | 检查组合与嵌套变换、几何及线宽字号归一化、编辑与读写往返；示例呈现差异由前述图像比较补充 | [F37 数值与结构断言](acceptance/results/F37-transform/build-default/result.json)、[示例图比较](transform-render-check.json) |
| 绘制顺序 | front / back 后 SVG 同级顺序及交叠位置的颜色与预期一致，检查前后像素均有记录 | [F23 front](acceptance/results/F23-front/build-default/result.json)、[F24 back](acceptance/results/F24-back/build-default/result.json) |
| 样式联动 | 固化对象保持红色，未固化对照随父级变为绿色；恢复 inherit 后，两者均呈绿色，并核对实际属性 | [F39 显式颜色联动](acceptance/results/F39-color-link/build-preserve-style/result.json) |

图像检查用于发现布局、绘制顺序和颜色呈现方面的问题，具体几何、属性、层级及历史恢复由对应断言验证。比较结论适用于记录中的输入与渲染条件，精选位置的像素检查范围也以用例定义为准。也可在 GitHub 查看 [流程图预览](https://github.com/1220XXX/svg-editor_XHT/blob/main/examples/flowchart.png) 和 [变换归一化预览](https://github.com/1220XXX/svg-editor_XHT/blob/main/examples/transform-normalized.png)。

### 5.6 质量判断与已知边界

功能完整性的判断来自逐项核查及对应结果，而不只取决于测试数量。类型检查与构建验证接口约束和产物生成，架构检查与代码抽查验证模块关系及职责分工；状态断言检查实际编辑结果、失败保护和撤销恢复，真实进程与文件检查覆盖实际入口及读写行为，干净副本复跑验证环境与流程的可重复性。这些证据相互补充，构成对当前交付质量的信心。

覆盖率用于识别尚未充分执行的代码路径，不能单独证明任意输入下都正确。判断范围以当前支持的功能、用例和环境为限，以下边界继续保留：

- 普通模式遵循 SVG 继承规则，结构调整可能改变有效样式；增强模式只保证受支持的三项基础属性，补成显式属性后相应联动会停止。
- SVG 仅支持已声明的子集，完整 CSS、任意路径及其他变换不在当前能力范围内。
- 全文档快照使历史内存随文档大小和历史条数增长，尚未针对大型文档给出容量或性能保证。
- 完整验收已覆盖记录中的 macOS / Node 组合，其他操作系统和运行时版本尚需进一步验证。
- PNG 和像素检查用于验证精选场景，其他场景仍需结合结构断言、回归测试和实际使用持续检查。

### 5.7 Git 交付与版本追溯

仓库地址为 [https://github.com/1220XXX/svg-editor_XHT](https://github.com/1220XXX/svg-editor_XHT)。提交历史体现了架构、领域、命令、IO、验收和后续修正的分步推进。本次用户确认文档定稿及完整复验后，将修订文档、验收生成器的链接修正与 2026-10-28 复验记录作为独立提交交付；`final` 与远端 `main` 指向该提交。业务源码与测试仍与 `94acc74`、`9d7fd25` 一致，原始验收材料中的旧标签字段保留采集时状态。最终提交编号及标签时间以以下 Git 查询结果为准。

| 时间 | 交付记录 |
|---|---|
| 2026-10-20 | 在 `ef90a19` 建立首次附注 final，代码、报告及基础验收分别提交。 |
| 2026-10-24 | 完成命令复核、根 id 与样式增强后，以 `41f00cc` 记录阶段确认；文档补全后更新至 `2f5ef47`。 |
| 2026-10-26 | `0b62616` 独立补充以 `2f5ef47` 为基线的材料，再于 `c9425dc` 收束交付说明。 |
| 2026-10-27 | `94acc74` 独立修复启动参数，`9d7fd25` 收录刷新后的验收材料，final 更新到后者。旧验收基线与当时标签状态仍在历史和证据中保留。 |
| 2026-10-28 | 报告定稿、文档链接修正及完整交付复验独立提交，按本次用户授权将 final 更新到包含上述材料的交付提交；保留真实提交与标签时间。 |

提交与标签均保留真实操作时间，可用于追溯各阶段成果。课程提交时限以正式教学安排为准，版本记录本身仅反映实际开发和发布的时间。

本地可使用以下命令检查提交与标签；远端查询直接使用改名后的地址，不依赖本地 origin 是否已同步改名：

```sh
git log --oneline --decorate
git show --no-patch final
git ls-remote https://github.com/1220XXX/svg-editor_XHT.git refs/heads/main refs/tags/final 'refs/tags/final^{}'
```

## 6. 附录

### 6.1 历史验收结果

以下记录保留各次验收的实际口径，并区分被测代码与材料版本。当前结果以 [5.1 验收基线与结果](#51-当前验收结果与证据基线)为准，历史数字不作为当前测试数量使用。

| 日期与检查批次 | 对应代码或材料版本 | 当时结果 |
|---|---|---|
| 2026-10-20，首次交付 | 交付点 [ef90a19](https://github.com/1220XXX/svg-editor_XHT/commit/ef90a1913d1ed2f2e5fe2234ebe324d8da9e7911)，当时报告随提交保留 | npm ci 成功，当时依赖审计为 0 漏洞；10 个测试文件、76 项测试、类型检查和构建通过；行覆盖率 99.43%、分支 88.20%、函数 100% |
| 2026-10-24，项目功能复核 | 功能交付点 [41f00cc](https://github.com/1220XXX/svg-editor_XHT/commit/41f00cce8341e7f11782601f62add7c3531df2dd)，复核说明收录于 [ecb85a8](https://github.com/1220XXX/svg-editor_XHT/commit/ecb85a82f5cb63dc553e5a4322eea269ccb38cb4) | 15 个测试文件、165 项测试、类型检查与构建通过；行覆盖率 99.68%、分支 91.56%、函数 100%、语句 97.45% |
| 2026-10-26，补充黑盒验收 | 被测基线 [2f5ef47](https://github.com/1220XXX/svg-editor_XHT/commit/2f5ef475a2e9d24bd2ece7944b63fc07ac036749)，材料收录于 [0b62616](https://github.com/1220XXX/svg-editor_XHT/commit/0b6261643870d35af2a1cbf106e52e6bf877d76a) | 165 项测试、1674 条功能断言与 40 条终端断言通过；旧材料保留在对应提交中 |
| 2026-10-27，启动参数修复后 | 被测基线 [94acc74](https://github.com/1220XXX/svg-editor_XHT/commit/94acc74dc2a59c1c6cfa29474a9218548b0ca7d2)，新材料收录于 [9d7fd25](https://github.com/1220XXX/svg-editor_XHT/commit/9d7fd25e2736118ab5c100ea2e7c5f07c5d5cd5e) | 16 个测试文件、202 项测试通过，完整验收重新采集；详细结果及覆盖率见第五章 |

首次图形检查中，流程图保存为 8 个元素，背景变换图为 6 个元素。初期因浏览器工具不支持本地 file 协议，采用本地渲染器生成 PNG；后续完整验收补充了真实 Chrome 渲染与像素断言，证据用途见 [5.5 图形检查](#55-图形检查)。

2026-10-24 还通过生产 CLI 补充回放任务书会话、手册、根 id、transform 及增强模式，覆盖正常操作与预期错误。各批输入存在重叠，不累加为独立功能数量；详细批次与数量见[历史报告](https://github.com/1220XXX/svg-editor_XHT/blob/ecb85a82f5cb63dc553e5a4322eea269ccb38cb4/doc/README.md)。当前可重复检查以已提交的用例、预期和实际日志为依据。

### 6.2 插件化扩展设计（预案，未实施）

#### 6.2.1 范围、启动条件与版本隔离

现有程序已支持普通 g 容器及 `data-*` 元数据读写，带 `data-kind="box"` 的外部组仍按普通 g 处理。Provider 接口、box 语义对象与动态加载尚未实现；以下内容是基于现有结构的扩展预案。

拟先建立 Provider 扩展接口，再实现 box、标准 SVG 往返和显式本地模块加载。具体接口及验收范围需在实施前确认；完整 SVG/CSS、GUI、远程插件市场和运行时热卸载不纳入这一候选范围。扩展开发拟使用独立分支和工作目录，经审查后决定合并，现有 final 保留为本次作业的交付标记。

#### 6.2.2 架构与 Provider 合约

首次建立扩展接口仍需改造核心代码；接口稳定后，目标是通过增加插件及注册配置接入新类型。拟按以下边界组织，具体字段与方法签名在实施前确定。

| 设计位置 | 拟承担的职责与约束 |
|---|---|
| 公开插件 API | 提供版本约定、Provider 合约、必要的基类和只读视图，保持会话文档与历史记录的封装 |
| ShapeFactory | 保留类型名注册与查找入口，将内置类型迁移为 Provider，集中校验重复注册及创建、SVG 恢复规则 |
| CommandFactory | 保留命令名分发入口；create/help 使用注册描述，其他命令通过图形能力执行操作 |
| 图形对象 | 通过多态提供几何操作、属性语义、克隆、展示、容器权限及序列化视图 |
| SVG 基础设施 | 沿用 XML、id 和变换处理职责，通过通用合约完成序列化与语义恢复 |
| 插件加载基础设施 | 导入显式本地模块，校验版本与清单，暂存注册结果；动态导入和文件 IO 保持在领域层之外 |
| Bootstrap | 解析启动配置，协调内置类型与插件注册，装配并启动会话 |

Provider 描述拟包含类型名、创建参数 schema、创建入口、SVG 标记及结构版本、已有子树恢复入口和帮助信息。set、clone 等行为由对象实现，类型分发仍集中于工厂。插件拟仅依赖公开 API；新增 API 边界与插件目录时，同步修订架构图、依赖规则和检查代码。

#### 6.2.3 box 的领域行为与内部结构

任务书已明确 box 的创建、派生 id、属性传播、容器操作及解组限制。结合现有编辑规则，后续拟实现以下行为；对应的内部实现方式仍可调整。

创建语法为 `create box <id> <x> <y> <w> <h> "<标题>" [in <containerId>]`，组合根包含矩形与标题文本。

| 行为 | 行为目标 | 候选实现或兼容约束 |
|---|---|---|
| 创建与 id | 根使用用户 id，内部部件采用 `<id>-rect`、`<id>-label` | 一次校验根及全部派生 id，失败不留下部分子树 |
| move / scale | 统一操作整棵子树，包含额外嵌套对象 | 沿用几何缩放规则，不额外改变 CLI 线宽或字号 |
| set fill / label | fill 修改内部矩形，label 修改标题 | 其他属性的传播与白名单在插件中明确 |
| group / addto / in | 可被收编、重新归属，并嵌套普通图形或其他 box | 继续检查循环与祖先、后代同时分组的冲突 |
| delete / undo / redo | 整体删除对应一个撤销单元 | 克隆与快照恢复后保留 box 类型、部件及行为 |
| ungroup | 拒绝并返回 `error: cannot ungroup composite shape: <id>` | 由多态容器权限表达，普通 g 保持原有解组规则 |
| tree / show | 展示组合语义与关键几何信息 | 派生展示信息与实际 SVG 属性分开，文件继续使用标准元素 |

以下细则属于候选设计，实施前需结合需求确认：

- **模板布局**：参考示例采用矩形填充 #4a90d9、标题位置 x+20 与 y+h/2+5，排版参数封装于插件；居中和自动测量规则另行确定。
- **必需部件保护**：拟拒绝破坏必需矩形、标题的单独删除或移出操作；是否支持替换部件、额外用户子节点如何管理，需明确约定后再实现。
- **基础样式保留集成**：区分用户 set fill 的传播语义与结构操作内部的样式补写，拟通过多态能力适配，避免补写误改已有显式颜色，并验证与 `--preserve-style` 的组合。

#### 6.2.4 SVG 往返与无插件降级

现有普通 g 和元数据读写提供了文件兼容基础；后续新增的是对 box 结构的校验与语义恢复。box 拟保存为 `<g id="..." data-kind="box">`，内部使用标准 rect、text 和 g，按实际元素计数，浏览器可按普通 SVG 显示。

读取拟先完成普通树解码、显式 id 预留及变换归一化，再通过工厂恢复入口自底向上调用 Provider。恢复采用已有子节点与实际坐标，不重新运行创建模板，避免重复生成部件、id 冲突和重复变换，并保留文件中的实际排版。

| 读取条件 | 目标行为 |
|---|---|
| Provider 已注册，结构版本与必需部件合法 | 恢复 box 类型，后续属性传播、克隆及撤销行为继续有效 |
| 未注册对应 Provider | 按普通 g 保留子树、样式、坐标及 data-*；延续现有普通图形读写能力 |
| Provider 已注册，但结构损坏或版本不支持 | 拒绝整次读取，保留当前文档、默认路径与历史 |
| 出现重复 id、非法 XML 或超出支持范围的内容 | 沿用既有错误处理及读取原子性规则 |

若在普通 g 状态下破坏必需部件，重新安装插件后是否能够恢复语义，需由结构校验决定；这一边界拟通过损坏输入与无插件往返用例验证。

#### 6.2.5 本地动态加载与生命周期

候选启动参数为 `--plugin <本地 ESM 模块路径>`，拟支持多个插件并与 `--preserve-style` 组合。**当前程序尚未实现 --plugin**；后续加载仅在启动时进行，不涉及运行中的热卸载。

拟采用“解析参数 → 暂存内置注册 → 导入显式模块 → 校验清单及版本 → 检查全部注册冲突 → 提交注册结果 → 启动 REPL”的流程。清单拟包含插件 id、插件版本、API 版本和注册入口，最终字段及兼容策略在实现前确认。

模块不存在、导入失败、清单非法、版本不兼容或重复注册时，应明确报错并以失败状态退出，避免半注册会话或覆盖内置类型。注册事务只约束宿主注册表，本地模块仍在当前进程执行。源码与构建入口需分别验证，并确保插件使用同一份公开核心类型，避免 src/dist 类型实例不一致影响容器识别和克隆。

#### 6.2.6 分批实施与完成门槛

以下是候选实施顺序，表中的条件是未来验收目标：

| 批次 | 拟交付内容 | 验收门槛 |
|---|---|---|
| A：扩展合约 | 公开 API、Provider 注册与内置类型迁移 | 不加载插件时，届时全部既有测试与任务书会话通过，输出保持兼容，架构说明同步更新 |
| B：box 行为 | 模板、派生 id、属性传播、容器权限和克隆 | 各项行为、嵌套、重名、必需部件保护及失败历史通过验证 |
| C：持久化 | 标准 SVG、语义恢复、版本校验及普通 g 降级 | 有无插件往返、根 id、变换、嵌套和恢复后编辑通过验证 |
| D：动态加载 | 本地路径、版本与冲突检查、原子注册 | 两个入口、多个插件、带空格路径和失败场景通过；用额外测试插件检验接口建立后可独立扩展 |
| E：整体验收 | box 流程图、样式策略组合及文档 | 完整回归、类型检查、构建、实际 CLI、SVG 显示和架构检查通过，结果对应真实代码基线 |

各批独立验证并提交，发生回归时先修复，再推进后续工作；合并前统一审查。验收沿用第五章的证据组织方式，为扩展代码记录独立的基线、日志和结果。

#### 6.2.7 更远期的可选主题

更广 SVG/CSS、复杂透明度、相对长度、其他变换及大文档性能，作为独立扩展方向保留，具体准备与取舍见 [2.4 变化点假设](#24-变化点假设)，当前验证边界见 [5.6](#56-质量判断与已知边界)。后续按明确需求确定支持矩阵、模型调整和验收方式。
