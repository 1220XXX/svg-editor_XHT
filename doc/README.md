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

实施完成后填写实际目录、模块依赖检查及方案修订；当前不宣称已通过。

## 质量保证手段

随功能加入自动化测试，最终运行类型检查、测试、构建、CLI 脚本、SVG 往返及浏览器预览。结果在实际执行后记录。

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
