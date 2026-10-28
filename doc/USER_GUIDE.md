# SVG 编辑器详细使用手册

适用项目：SVG 编辑器 Lab1 Phase 1，应用版本 0.1.0。本文对应包含 `.nvmrc` 和 transform 增强的当前 `main`，编写日期为 2026-10-24。

2026-10-27 更新启动参数校验说明；当前支持范围及测试数量以本次修复后的验收记录为准。

本文件集中说明环境准备、全部功能、命令参数、可复现操作、终端回显、图形效果和常见问题。无需在多份文档之间查找命令含义。

本手册对应 Phase 1 已实现功能；box 与动态插件不属于本阶段缺项。阶段完成核查与完整的后续设计预案见 [架构报告](README.md#1-项目完成情况)。后续路线仅记录设计，当前不支持 --plugin，也未开始相应功能开发。

> 所有带 `svg>` 的完整示例均已通过当前命令处理器回放核验。阅读时可以看完整会话；自己输入时只输入提示符后面的命令。每个示例会话独立执行，不要求先运行上一节。

## 目录

1. [项目能做什么](#1-项目能做什么)
2. [环境准备与首次启动](#2-环境准备与首次启动)
3. [终端使用与输入规则](#3-终端使用与输入规则)
4. [第一次完整操作](#4-第一次完整操作)
5. [全部命令速查](#5-全部命令速查)
6. [画布与文件操作](#6-画布与文件操作)
7. [创建六种图形](#7-创建六种图形)
8. [移动缩放属性修改与删除](#8-移动缩放属性修改与删除)
9. [分组归属和绘制顺序](#9-分组归属和绘制顺序)
10. [查看结构与撤销重做](#10-查看结构与撤销重做)
11. [SVG 导入与 transform 增强](#11-svg-导入与-transform-增强)
12. [完整案例两节点流程图](#12-完整案例两节点流程图)
13. [命令脚本与构建版运行](#13-命令脚本与构建版运行)
14. [验证与调试](#14-验证与调试)
15. [常见错误与当前限制](#15-常见错误与当前限制)
16. [日常使用清单](#16-日常使用清单)

## 1. 项目能做什么

本项目是一个命令行 SVG 编辑器。你通过文字命令创建和修改矢量图形，保存为浏览器可以查看的 `.svg` 文件。

| 功能 | 可以完成的操作 | 用户看到的效果 |
|---|---|---|
| 画布 | 新建、查询尺寸、修改尺寸 | 改变 SVG 的宽高和坐标范围 |
| 基本图形 | 创建矩形、圆、椭圆、直线、文字 | 形成实际 SVG 图形 |
| 容器 | 建立 g、嵌套、分组、解组、重新归属 | 用一棵结构树组织图形 |
| 编辑 | 平移、等比缩放、改颜色、改几何属性、改文字、删除 | 改变图形内容和位置 |
| 绘制顺序 | front / back | 改变同级图形重叠时谁盖住谁 |
| 结构查看 | tree / show | 不打开浏览器也能检查层级和数值 |
| 历史 | undo / redo | 撤销或重做一次编辑命令 |
| 文件 | read / save | 导入和输出受支持的 SVG |
| 变换增强 | 导入 translate、正等比 scale 与嵌套组合 | 读取背景示例，并转为可继续编辑的几何坐标 |
| 脚本 | 逐行回放命令文件 | 批量构建图形，便于演示和复现 |

它没有拖拽画布或自动打开的网页界面。输入命令后先得到终端摘要，保存文件后可在浏览器查看图形。当前没有自动保存，退出前需要主动 `save`。

## 2. 环境准备与首次启动

### 2.1 在 VS Code 打开工程目录

选择“文件 → 打开文件夹”，打开：

```text
/Users/xht/Documents/课程资料/高级软件开发/svg-editor
```

确认左侧能看到 `package.json`、`.nvmrc`、`src`、`tests`、`examples`、`doc`。`.nvmrc` 是隐藏的纯文本文件，不是文件夹。

打开“终端 → 新建终端”，执行：

```sh
cd "/Users/xht/Documents/课程资料/高级软件开发/svg-editor"
```

以下 Shell 命令都默认从该工程目录执行。

### 2.2 Node.js、npm、nvm 分别是什么

| 工具或文件 | 作用 |
|---|---|
| nvm | 安装、选择 Node.js 版本，选择作用于当前终端 |
| Node.js / node | 实际执行项目程序 |
| npm | 安装依赖、运行 package.json 中定义的脚本 |
| `.nvmrc` | 声明本项目的精确开发版本 `v24.22.1` |
| `package-lock.json` | 锁定项目依赖版本 |
| `node_modules/` | 安装在本项目中的依赖 |

项目声明的运行兼容范围是 Node.js 22 以上，当前开发环境固定为 v24.22.1。不需要 Python venv，也不需要额外全局安装 TypeScript 或测试框架。

### 2.3 已安装 nvm：首次配置

```sh
nvm install
nvm use
node -v
npm -v
npm ci
```

效果：

1. `nvm install` 读取 `.nvmrc`，安装指定版本；已安装时复用。
2. `nvm use` 为当前终端选择该版本。
3. `node -v` 应输出 `v24.22.1`。
4. `npm -v` 应输出可用 npm 的版本。npm 版本不由 `.nvmrc` 单独锁定；本次核验使用 npm 11.19.1。
5. `npm ci` 按锁文件重新安装依赖。已有 `node_modules` 会重建，源代码不会被修改。

进入文件夹本身不会自动切换 Node.js。新开终端后，应在项目目录执行 `nvm use`。

### 2.4 还没有安装 nvm

先检查：

```sh
command -v nvm
```

没有输出时，可以按以下步骤安装。下面使用 nvm 官方仓库的固定版本安装脚本，安装位置为用户目录，不需要 sudo。

```sh
curl -fL --retry 3 \
  https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh \
  -o /tmp/nvm-install-v0.40.8.sh
```

下载成功后执行：

```sh
touch "$HOME/.zshrc"
export NVM_DIR="$HOME/.nvm"
PROFILE="$HOME/.zshrc" bash /tmp/nvm-install-v0.40.8.sh
source "$HOME/.zshrc"
command -v nvm
nvm --version
```

如果新终端尚未加载 nvm，可手动加载：

```sh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

安装成功后，返回本节 2.3。官方来源：[nvm 官方安装说明](https://github.com/nvm-sh/nvm#installing-and-updating)。这些安装步骤用于尚未配置环境的机器，不需要每次运行都执行。

### 2.5 网络下载超时

如果你提供的 VPN 正在本机 `7897` 端口运行，可在当前终端临时设置：

```sh
export http_proxy="http://127.0.0.1:7897"
export https_proxy="http://127.0.0.1:7897"
```

然后重试下载或安装。npm 安装也可以仅为一次命令指定代理：

```sh
npm ci --proxy=http://127.0.0.1:7897 --https-proxy=http://127.0.0.1:7897
```

VPN 未运行时不要启用该代理。取消当前终端的代理设置：

```sh
unset http_proxy https_proxy
```

代理设置只影响网络连接，不切换 Node.js、不删除依赖。正常本地编辑不需要访问 GitHub。

### 2.6 启动和退出

```sh
nvm use
npm run cli
```

预期看到：

```text
svg-editor 0.1 — type 'help' for commands
svg>
```

此时输入编辑器命令。输入 `help` 获取语法。

按 **Control+D** 结束输入并退出；按 **Control+C** 可中断。它们不是文字命令，当前没有 `exit` 或 `quit` 命令。退出后回到普通终端提示符。

### 2.7 启动参数与错误退出

源码入口和构建入口只接受精确的 `--preserve-style`：

```sh
npm run cli
npm run cli -- --preserve-style
npm run cli -- --preserve-style --preserve-style
npm start -- --preserve-style
```

无参数进入默认模式；合法参数及其重复形式进入增强模式。重复参数保持兼容，不会叠加样式操作。

例如拼错参数：

```sh
npm run cli -- --preserve-stlye
echo $?
```

编辑器向标准错误输出一行（npm 自身可能另打印脚本启动信息）：

```text
error: unknown option: --preserve-stlye
```

退出码为 `2`；没有欢迎语或 `svg>` 提示符，不执行 stdin 中的编辑命令。`--unknown`、`--plugin`、位置参数 `drawing.svg`、`--preserve-style=true` 及额外的 `--` 也会被拒绝。合法与未知参数混合时，整个启动失败；第一个未知参数出现在错误信息中。

注意 `npm run cli -- --preserve-style` 中第一个 `--` 是 npm 的转发分隔符，不是传给编辑器的新选项。构建版 `npm start -- …` 的行为一致。

这与进入编辑器后输入错误命令不同：在 `svg>` 输入 `unknown`，会输出 `error: unknown command: unknown`，随后继续接收下一条命令；这种命令错误不会触发启动退出码 `2`。脚本中的编辑错误仍需检查具体输出，不能只看退出码。

## 3. 终端使用与输入规则

### 3.1 两类命令输入位置

| 你看到的位置 | 可以输入的例子 |
|---|---|
| 普通终端，例如 `xht@… svg-editor %` | `cd …`、`nvm use`、`npm run cli`、`npm run check` |
| 程序提示符 `svg>` | `init`、`create …`、`tree`、`save …`、`undo` |

在 `svg>` 中输入 `npm run cli` 会得到未知命令错误。需要执行 npm 命令时，先按 Control+D 退出程序，或新建另一个终端。

### 3.2 语法符号

- `<id>` 等尖括号表示必须填写的参数，不需要把尖括号输入进去。
- `[fill]` 等方括号表示可选参数，不输入方括号。
- `<id1> <id2>…` 表示可以提供多个参数。
- 命令和类型名使用示例中的小写拼写；id 大小写敏感，`r1` 与 `R1` 是不同对象。
- 所有图形和 g 必须有全文档唯一的 id。创建时手工指定，导入缺失时自动补全。
- `in` 归属子句不能代替 id。例如 `create g in scene` 会报缺少 id；合法写法是 `create g child in scene`。若确实希望 id 为 in，可写 `create g in` 或 `create g in in scene`。
- 推荐使用 `node1`、`start-label` 等不含空格的 id；不要使用引号、尖括号、斜杠或等号作为 id 字符。

### 3.3 坐标和数值

原点在画布左上角，x 向右，y 向下。坐标以 px 理解，输入命令时使用纯数字，例如 `10`、`-5`、`12.5`、`1e2`，不要输入 `10px`。

位置允许负值；图形宽高、半径和线宽非负；画布宽高及缩放因子必须为正。数值不能为 NaN、Infinity 或溢出为无穷大。

### 3.4 注释、颜色和引号

空行忽略；第一个非空白字符为 `#` 的整行作为注释：

```text
# 先创建画布，再创建图形
init 800 600
create rect r1 10 20 100 50 #4a90d9
```

这里 `#4a90d9` 是颜色值，不会被截断。当前不支持行尾注释，请把注释放在单独一行。

带空格的文字、颜色表达式或路径用英文双引号包裹。文字内的双引号写为 `\"`，反斜杠写为 `\\`。空字符串 `""` 合法。以下为完整回显：

```text
svg> init
canvas 800x600 created
svg> create text title 20 40 "say \"hi\" at C:\\tmp"
text#title created
svg> show title
text#title  parent=svg
  x=20 y=40
  text="say \"hi\" at C:\\tmp"
svg> set title text ""
text#title updated: text=""
svg> show title
text#title  parent=svg
  x=20 y=40
  text=""
```

`show` 使用 JSON 风格展示文字，因此屏幕上的 `\"` / `\\` 是转义后的显示形式，实际文本内容仍是双引号和反斜杠。

## 4. 第一次完整操作

启动后运行以下会话。此处生成一个蓝色矩形及文字，将整个分组右移 30、下移 20，再演示撤销和重做。

```text
svg> init 400 220
canvas 400x220 created
svg> create g scene
g#scene created
svg> create rect r1 30 50 140 60 #4a90d9 in scene
rect#r1 created in g#scene
svg> create text title 50 85 "Hello SVG" in scene
text#title created in g#scene
svg> move scene 30 20
g#scene moved by (30,20)
svg> undo
g#scene moved back by (-30,-20)
svg> redo
g#scene moved by (30,20)
svg> tree
svg (400x220)
└── g#scene
    ├── rect#r1     x=60 y=70 w=140 h=60 fill=#4a90d9
    └── text#title  (80,105) "Hello SVG"
svg> save tutorial.svg
saved to tutorial.svg (3 elements)
```

**实际图形效果：**矩形最初左上角为 `(30,50)`，尺寸 `140×60`；重做移动后左上角为 `(60,70)`，文字位置变成 `(80,105)`。尺寸和文字内容保持不变。`scene` 本身不可见，用于组织两个孩子。

**文件效果：**在启动工作目录保存 `tutorial.svg`，包含 3 个元素（g、rect、text，根 svg 不计入数量）。将它拖进浏览器即可查看。继续编辑后需再次保存，再刷新浏览器。

文件已存在时 `save` 会覆盖它。当前不会在覆盖前询问；请为希望保留的版本使用不同文件名。

## 5. 全部命令速查

下表包含当前全部 19 个命令。初始没有文档时，可以使用 init、read、help；其他已知命令需要先建立当前文档。

| 分类 | 完整语法 | 功能与效果 | 对历史的影响 |
|---|---|---|---|
| 文档 | `init [w] [h]` | 新建并切换到空画布 | 成功后清空并禁用 |
| 文档 | `read <file.svg>` | 读取 SVG 替换当前文档 | 成功后清空并禁用 |
| 文档 | `save [file.svg]` | 写出当前 SVG | 成功后清空并禁用 |
| 文档 | `canvas [w] [h]` | 查询或修改尺寸 | 查询不变；修改成功后清空并禁用 |
| 编辑 | `create <type> <id> [params…] [in <containerId>]` | 创建图形或空容器 | 一个撤销单元 |
| 编辑 | `delete <id>` | 删除图形或整棵容器子树 | 一个撤销单元 |
| 编辑 | `move <id> <dx> <dy>` | 平移，容器递归作用于孩子 | 一个撤销单元 |
| 编辑 | `scale <id> <factor>` | 以原点为基准乘位置及尺寸 | 一个撤销单元 |
| 编辑 | `set <id> <attr> <value>` | 修改白名单属性 | 一个撤销单元 |
| 编辑 | `group <newGid> <id1> <id2>…` | 收编已有图形到新容器 | 一个撤销单元 |
| 编辑 | `ungroup <gid>` | 解散嵌套容器并提升孩子 | 一个撤销单元 |
| 编辑 | `addto <gid> <id>` | 把已有图形移入指定容器末尾 | 一个撤销单元 |
| 编辑 | `front <id>` | 移至同级最后绘制，覆盖在上层 | 一个撤销单元 |
| 编辑 | `back <id>` | 移至同级最先绘制，位于下层 | 一个撤销单元 |
| 显示 | `tree [id]` | 查看全文档或一棵子树 | 不变 |
| 显示 | `show <id>` | 查看类型、父级和显式属性 | 不变 |
| 显示 | `help` | 查看命令和创建语法 | 不变 |
| 历史 | `undo` | 撤销上一次编辑 | 移入 redo 历史 |
| 历史 | `redo` | 重做最近一次撤销 | 移回 undo 历史 |

任意失败命令不修改当前文档、文件路径或历史。程序打印错误后继续接收下一条命令。

## 6. 画布与文件操作

### 6.1 init：新建空画布

```text
init
init 400
init 640 360
```

- 无参数使用 `800×600`。
- 只给宽度时，高度使用 `600`。
- 两个参数分别为宽、高，必须大于 0。
- 每次成功 init 都清空原图形、原文件路径和编辑历史。

完整示例：

```text
svg> init
canvas 800x600 created
svg> canvas
canvas 800x600
svg> init 400
canvas 400x600 created
svg> canvas
canvas 400x600
svg> init 640 360
canvas 640x360 created
svg> canvas
canvas 640x360
```

init 不会自动保存旧文档，也不能通过 undo 恢复旧文档。切换前先保存希望保留的内容。

### 6.2 canvas：查询或修改画布

```text
canvas
canvas 200 150
```

无参数只查询；修改时必须同时给宽、高。修改尺寸不会自动缩放图形或把画布外图形移回来：

```text
svg> init 400 300
canvas 400x300 created
svg> create rect r1 150 100 100 50 red
rect#r1 created
svg> canvas
canvas 400x300
svg> canvas 200 150
canvas resized to 200x150
svg> show r1
rect#r1  parent=svg
  x=150 y=100 width=100 height=50
  fill=red
svg> undo
error: undo not allowed after io command
```

这里 r1 的 x/y/width/height 保持原值。矩形右边缘超过新画布宽度，超出区域在常规浏览器预览中可能被裁剪。最后的 undo 被拒绝，因为 canvas 修改尺寸属于文档操作。

### 6.3 read：读入文件

```text
read examples/other.svg
read "my diagram.svg"
read "/Users/xht/Desktop/my diagram.svg"
```

- 路径相对于启动程序的工作目录；带空格时加双引号。
- CLI 内的 `~` 不经过 Shell 展开，建议使用完整绝对路径或项目相对路径。
- 成功读取替换当前文档，并记住读取路径；此后可以直接 `save`。
- 外部图形缺 id 时补上标签名和序号，打印 warning；显式 id 重复会拒绝整次读取。
- svg 根节点的可选 id 会保留并写回文件，与全部子图形共同遵守唯一性规则。自动补图形 id 时也会避开根节点 id；空根 id 或不符合现有 id 校验规则的值会报错。
- 读取失败保留当前图形和历史；成功读取不能撤销回原文档。

### 6.4 save：保存和另存

```text
save tutorial.svg
save "my diagram.svg"
save
```

对于 read 读入的文档，无参数 save 始终使用最近一次成功读入的路径；另存副本不会改变这个默认目标。对于 init 创建的文档，第一次保存必须给路径，此后无参数 save 使用最近一次成功指定的保存路径。再次 init 会清除这些关联。

save 不会自动新建父文件夹。如果准备保存 `output/result.svg`，应在普通终端先执行 `mkdir -p output`，或先在 VS Code 中创建目录。

文件操作完整示例：

```text
svg> read examples/other.svg
warning: assigned id rect1 to unnamed <rect>
read examples/other.svg (7 elements)
svg> tree
svg (400x300)
├── rect#rect1     x=0 y=0 w=400 h=300 fill=#ffffff
├── text#t1        (10,290) "imported"
├── circle#c1      cx=50 cy=50 r=10
├── g#g1
│   ├── rect#r2    x=0 y=0 w=10 h=10
│   └── circle#c2  cx=5 cy=5 r=2
└── ellipse#e1     cx=1 cy=2 rx=3 ry=4
svg> save "my diagram.svg"
saved to my diagram.svg (7 elements)
svg> move c1 10 0
circle#c1 moved to (60,50)
svg> save
saved to examples/other.svg (7 elements)
svg> init
canvas 800x600 created
svg> save
error: no file path. use save <file.svg>
```

效果：other.svg 缺 id 的矩形得到 rect1；另存到 `my diagram.svg` 后，c1 被移动，后续无参数 save 更新读入时的 other.svg，副本保留移动前状态。再次 init 清除了关联路径，所以最后的 save 要求指定文件名。

保存文件后可将 SVG 拖入浏览器查看；VS Code 默认也能打开 XML 源码。浏览器不会随命令自动刷新，需要保存并手动刷新。

## 7. 创建六种图形

### 7.1 类型与参数

所有创建语法均可追加 `[in <gid>]`；省略时挂到画布根下。CLI 的图形类型只有下列六种。

| 类型 | 语法（不含可选 in） | 参数解释 | 图形效果 |
|---|---|---|---|
| 矩形 | `create rect <id> <x> <y> <w> <h> [fill]` | 左上角位置、宽、高 | 矩形填充区域 |
| 圆 | `create circle <id> <cx> <cy> <r> [fill]` | 圆心和半径 | 圆形填充区域 |
| 椭圆 | `create ellipse <id> <cx> <cy> <rx> <ry> [fill]` | 中心、水平半径、垂直半径 | 椭圆填充区域 |
| 直线 | `create line <id> <x1> <y1> <x2> <y2> [stroke]` | 起点和终点 | 两点之间的线段，无箭头标记 |
| 文字 | `create text <id> <x> <y> "content"` | 文字基准位置及内容 | 显示文字；y 对应文字基线而非文字框顶边 |
| 容器 | `create g <id>` | 只需 id | 空分组，自身没有可见边框 |

rect 的命令参数 w/h 最终保存为 SVG 的 width/height。数值宽高或半径为 0 时可以创建，但图形可能不可见。

### 7.2 样式默认值

省略 fill / stroke 时，文件中不主动写入该属性：有父级样式则继承，否则按 SVG 默认呈现，填充通常为黑色，描边为 none。

因此直线建议显式写 stroke，例如 `black`；只创建一条没有 stroke 的 line，通常看不到线。可使用颜色名、`#rrggbb`、`none` 等浏览器理解的值。编辑器不会替浏览器完整校验所有 CSS 颜色拼写。

### 7.3 in：创建时确定归属

```text
create g scene
create g node1 in scene
create rect start 120 100 160 60 #4a90d9 in node1
```

目标容器必须已经存在并且是 g。`in` 必须位于命令尾部。它只表达父子关系，不会自动移动孩子到某个“容器原点”；容器没有独立的 x/y 几何属性。

六种创建方式的完整演示：

```text
svg> init 800 600
canvas 800x600 created
svg> create rect r1 10 20 100 50 #4a90d9
rect#r1 created
svg> create circle c1 200 100 30 red
circle#c1 created
svg> create ellipse e1 300 100 50 25 green
ellipse#e1 created
svg> create line l1 10 200 300 200 black
line#l1 created
svg> create text t1 20 250 "Hello SVG"
text#t1 created
svg> create g scene
g#scene created
svg> create rect child 10 10 40 20 orange in scene
rect#child created in g#scene
svg> tree
svg (800x600)
├── rect#r1         x=10 y=20 w=100 h=50 fill=#4a90d9
├── circle#c1       cx=200 cy=100 r=30 fill=red
├── ellipse#e1      cx=300 cy=100 rx=50 ry=25 fill=green
├── line#l1         (10,200) -> (300,200) stroke=black
├── text#t1         (20,250) "Hello SVG"
└── g#scene
    └── rect#child  x=10 y=10 w=40 h=20 fill=orange
```

tree 按创建及后续排序后的绘制顺序显示。根下 r1、c1、e1、l1、t1 与 g#scene 同级，child 是 scene 的孩子。

## 8. 移动缩放属性修改与删除

### 8.1 move：按增量平移

```text
move <id> <dx> <dy>
```

dx 正值向右、负值向左；dy 正值向下、负值向上。它使用增量，不是将图形直接设置到指定坐标。尺寸、颜色和文本内容保持不变。

```text
svg> init
canvas 800x600 created
svg> create rect r1 10 20 100 50 red
rect#r1 created
svg> move r1 30 -5
rect#r1 moved to (40,15)
svg> show r1
rect#r1  parent=svg
  x=40 y=15 width=100 height=50
  fill=red
svg> create g node
g#node created
svg> create text label 50 60 "开始" in node
text#label created in g#node
svg> move node -5 10
g#node moved by (-5,10)
svg> show label
text#label  parent=g#node
  x=45 y=70
  text="开始"
```

r1 从 `(10,20)` 移到 `(40,15)`；文字 label 随 node 从 `(50,60)` 移到 `(45,70)`。叶图元回显 moved to 最终坐标：rect/text 使用 x/y，circle/ellipse 使用 cx/cy，line 使用起点 x1/y1（两个端点都会移动）。组回显 moved by 平移增量；孩子的具体位置可通过 show 或 tree 查看。

### 8.2 scale：以画布原点为基准等比缩放

```text
scale <id> <factor>
```

factor 必须大于 0。位置和尺寸全部相乘，例如矩形 `(x=10,y=20,w=100,h=50)` 乘 2 后得到 `(20,40,200,100)`。不是围绕图形中心缩放。

| 类型 | 会乘以 factor 的属性 |
|---|---|
| rect | x、y、width、height |
| circle | cx、cy、r |
| ellipse | cx、cy、rx、ry |
| line | x1、y1、x2、y2 |
| text | x、y |
| g | 递归对全部子孙执行以上操作 |

CLI scale 不改变 stroke-width 或文字字号。容器的移动和缩放直接递归到孩子，不生成新的 transform 属性。

```text
svg> init
canvas 800x600 created
svg> create rect r1 10 20 100 50 red
rect#r1 created
svg> set r1 stroke black
rect#r1 updated: stroke="black"
svg> set r1 stroke-width 2
rect#r1 updated: stroke-width="2"
svg> scale r1 2
rect#r1 scaled by 2
svg> show r1
rect#r1  parent=svg
  x=20 y=40 width=200 height=100
  fill=red
  stroke=black
  stroke-width=2
svg> create g node
g#node created
svg> create circle c1 100 80 20 blue in node
circle#c1 created in g#node
svg> create text t1 100 80 "Label" in node
text#t1 created in g#node
svg> scale node 0.5
g#node scaled by 0.5
svg> tree node
g#node
├── circle#c1  cx=50 cy=40 r=10 fill=blue
└── text#t1    (50,40) "Label"
svg> scale r1 0
error: scale factor must be positive
```

这里 r1 的描边宽度仍为 2；node 下圆的位置和半径减半，文字位置减半，文字字号保持原状。最后的非法缩放不改变文档。

### 8.3 set：修改属性

```text
set <id> <attr> <value>
```

允许属性如下：

| 对象 | 可设置的属性 |
|---|---|
| 全部六种类型 | fill、stroke、stroke-width |
| rect 额外 | x、y、width、height |
| circle 额外 | cx、cy、r |
| ellipse 额外 | cx、cy、rx、ry |
| line 额外 | x1、y1、x2、y2 |
| text 额外 | x、y、text |
| g 额外 | 无额外几何属性 |

示例：

```text
svg> init
canvas 800x600 created
svg> create text title 20 40 "开始"
text#title created
svg> set title text "开始 处理"
text#title updated: text="开始 处理"
svg> set title fill white
text#title updated: fill="white"
svg> set title stroke black
text#title updated: stroke="black"
svg> set title stroke-width 1
text#title updated: stroke-width="1"
svg> create rect r1 10 20 100 50 red
rect#r1 created
svg> set r1 width 160
rect#r1 updated: width="160"
svg> show r1
rect#r1  parent=svg
  x=10 y=20 width=160 height=50
  fill=red
svg> show title
text#title  parent=svg
  x=20 y=40
  fill=white
  stroke=black
  stroke-width=1
  text="开始 处理"
svg> set title font-size 20
error: unknown attribute: font-size
```

- `set r1 width 160` 是把宽度直接改为 160，不是增加 160。
- `set title text "开始 处理"` 修改文字，空字符串也合法。
- `set … fill none` 可取消填充，配合 stroke 显示轮廓。
- `set g1 fill red` 设置 g 自身的继承样式；已有显式 fill 的孩子不会被强制覆盖。
- 当前不能 set id、font-size、transform、label 或其他白名单外属性，即使某些属性可以从外部 SVG 导入。

### 8.4 delete：删除单个对象或子树

```text
delete <id>
```

删除容器时全部子孙一起删除；孩子 id 也随之不可寻址。一次 undo 恢复完整子树。

```text
svg> init
canvas 800x600 created
svg> create g node
g#node created
svg> create rect r1 10 20 100 50 red in node
rect#r1 created in g#node
svg> delete node
g#node deleted
svg> show r1
error: no such shape: r1
svg> undo
g#node restored into svg
svg> tree
svg (800x600)
└── g#node
    └── rect#r1  x=10 y=20 w=100 h=50 fill=red
```

## 9. 分组归属和绘制顺序

三种组织方式分别对应：创建时追加 `in`、已有图形使用 `group` 收编、已有图形使用 `addto` 改变父级。

### 9.1 group：将已有对象收编到新容器

```text
group <newGid> <id1> <id2>…
```

- newGid 必须是全新 id，必须提供至少两个不同成员；零个或一个成员会报错，不改变图形和历史。若只需空容器，可使用 create g。
- 成员从各自原父容器摘出，进入新容器。
- 子节点保持编辑前全树先序遍历的相对顺序，不按参数顺序重新排序。
- 同父成员的新容器放在最早被选节点位置；跨父成员的新容器放到画布根下、最早受影响顶层分支的位置。
- 禁止重复列出成员，以及同时列出某容器和它的子孙。

```text
svg> init
canvas 800x600 created
svg> create g scene
g#scene created
svg> create rect a 10 20 100 50 red in scene
rect#a created in g#scene
svg> create circle b 200 100 20 blue in scene
circle#b created in g#scene
svg> create text title 10 150 "Title" in scene
text#title created in g#scene
svg> group pair b a
g#pair created with 2 children
svg> tree
svg (800x600)
└── g#scene
    ├── g#pair
    │   ├── rect#a    x=10 y=20 w=100 h=50 fill=red
    │   └── circle#b  cx=200 cy=100 r=20 fill=blue
    └── text#title    (10,150) "Title"
svg> undo
g#pair ungrouped (2 children restored)
svg> redo
g#pair created with 2 children
svg> tree pair
g#pair
├── rect#a    x=10 y=20 w=100 h=50 fill=red
└── circle#b  cx=200 cy=100 r=20 fill=blue
```

命令虽然写 `group pair b a`，结果仍是 a 在 b 前。这是保持原顺序的设计。一条 group 是一个 undo 单元。

### 9.2 ungroup：解散嵌套容器

```text
ungroup <gid>
```

把孩子提升到该容器的父级，占据原容器所在位置；容器 id 被删除，孩子 id 保留。

**本阶段按任务书要求禁止解组根级 g。**要演示成功解组，必须先创建外层容器：

```text
svg> init
canvas 800x600 created
svg> create g scene
g#scene created
svg> create g pair in scene
g#pair created in g#scene
svg> create rect a 10 20 100 50 red in pair
rect#a created in g#pair
svg> create text title 20 40 "Title" in pair
text#title created in g#pair
svg> ungroup pair
g#pair ungrouped (2 children promoted)
svg> tree
svg (800x600)
└── g#scene
    ├── rect#a      x=10 y=20 w=100 h=50 fill=red
    └── text#title  (20,40) "Title"
svg> undo
g#pair restored with 2 children
svg> tree
svg (800x600)
└── g#scene
    └── g#pair
        ├── rect#a      x=10 y=20 w=100 h=50 fill=red
        └── text#title  (20,40) "Title"
svg> ungroup scene
error: cannot ungroup top-level container: scene
```

pair 在 scene 内，因此可以解组；scene 直接挂在根 svg 下，所以最后一条失败。可以通过 undo 恢复刚被解散的 pair。

### 9.3 addto：把已有对象移入容器

```text
addto <gid> <id>
```

第一个参数是目标容器，第二个是要移动的对象，进入后作为最后一个孩子。对象原来在哪个父容器都可以，但不能把容器放入自身或其后代。

```text
svg> init
canvas 800x600 created
svg> create g left
g#left created
svg> create g right
g#right created
svg> create g child in left
g#child created in g#left
svg> create rect r1 10 20 100 50 red in child
rect#r1 created in g#child
svg> addto right child
g#child moved into g#right
svg> show child
g#child  parent=g#right
svg> tree
svg (800x600)
├── g#left
└── g#right
    └── g#child
        └── rect#r1  x=10 y=20 w=100 h=50 fill=red
svg> addto child right
error: cannot move a container into its own descendant: right
```

child 带着 r1 一起进入 right。原始几何坐标保持不变；最后的反向归属会构成循环，因此被拒绝。

### 9.4 front / back：调整同级覆盖关系

```text
front <id>
back <id>
```

SVG 后绘制的对象覆盖先绘制的对象。front 把对象移到同级末尾，back 移到同级开头，不更换父级，不修改坐标。

```text
svg> init 300 200
canvas 300x200 created
svg> create rect blue 30 30 140 100 blue
rect#blue created
svg> create rect orange 80 60 140 100 orange
rect#orange created
svg> tree
svg (300x200)
├── rect#blue    x=30 y=30 w=140 h=100 fill=blue
└── rect#orange  x=80 y=60 w=140 h=100 fill=orange
svg> front blue
rect#blue brought to front
svg> tree
svg (300x200)
├── rect#orange  x=80 y=60 w=140 h=100 fill=orange
└── rect#blue    x=30 y=30 w=140 h=100 fill=blue
svg> back blue
rect#blue sent to back
svg> tree
svg (300x200)
├── rect#blue    x=30 y=30 w=140 h=100 fill=blue
└── rect#orange  x=80 y=60 w=140 h=100 fill=orange
```

| 时刻 | 蓝橙矩形重叠区域的可见颜色 |
|---|---|
| 创建 blue 后再创建 orange | 橙色盖在上面 |
| 执行 front blue | 蓝色盖在上面 |
| 执行 back blue | 橙色重新盖在上面 |

调整一个容器会整体调整它的子树层次，但仍只在该容器的同级之间排序。

### 9.5 当前重新归属的样式边界

普通启动时，group / ungroup / addto 保留几何数据，但不会完整固化从旧父级继承的视觉样式。例如孩子未显式设置 fill，原父级 fill=red，解组或移动到其他父级后，颜色可能改变。

如果希望这类操作后保持颜色，可在操作前对关键孩子显式设置 fill / stroke。涉及透明度等复杂组合时，当前版本不保证重新归属前后像素完全一致。

也可使用 `npm run cli -- --preserve-style` 开启可选的基础样式保留模式，作用于 group / ungroup / addto，覆盖 fill、stroke、stroke-width。复杂颜色、额外继承属性变化和组透明度上下文变化可能被明确拒绝；普通启动的原有行为保持不变。

### 9.6 可选基础样式保留模式

在普通终端启动增强模式：

```sh
npm run cli -- --preserve-style
```

已经构建时，也可执行 `npm start -- --preserve-style`。开关属于启动参数，不是在 svg> 中输入的新命令；每次启动重新选择模式。init 和 read 不会取消当前进程的模式。

| 操作 | 增强模式的效果 |
|---|---|
| ungroup | 孩子离开旧容器时，在必要处补写原先的基础样式 |
| addto | 保留被移动对象及子树原先的基础属性有效值 |
| group | 跨父级收编时分别保留每个成员的基础样式，继续保持原相对顺序 |
| undo / redo | 结构和补写的样式同属一个撤销单元，撤销也恢复属性原先是否省略 |
| save / read | 补写值作为普通 SVG 属性保存；以后使用普通模式也能读回 |

仅当属性有效值将改变时补写；原有显式颜色保留，创建图形时仍不主动写入省略的 fill/stroke。paint 值中的 inherit、unset、initial 会按当前模型的继承与默认值解析。新父级样式相同时不增加多余属性。

以下是增强模式的完整示例。解组前 r 没有显式 fill；解组后得到 fill=red。undo 恢复其省略状态，redo 再补回。随后移入蓝色组仍保持红色，而原先使用默认填充的 plain 得到显式 black。

<!-- cli-mode: preserve-style -->
```text
svg> init 200 100
canvas 200x100 created
svg> create g outer
g#outer created
svg> create g inner in outer
g#inner created in g#outer
svg> set inner fill red
g#inner updated: fill="red"
svg> create rect r 10 20 30 40 in inner
rect#r created in g#inner
svg> show r
rect#r  parent=g#inner
  x=10 y=20 width=30 height=40
svg> ungroup inner
g#inner ungrouped (1 children promoted)
svg> show r
rect#r  parent=g#outer
  x=10 y=20 width=30 height=40
  fill=red
svg> undo
g#inner restored with 1 children
svg> show r
rect#r  parent=g#inner
  x=10 y=20 width=30 height=40
svg> redo
g#inner ungrouped (1 children promoted)
svg> create g target
g#target created
svg> set target fill blue
g#target updated: fill="blue"
svg> addto target r
rect#r moved into g#target
svg> show r
rect#r  parent=g#target
  x=10 y=20 width=30 height=40
  fill=red
svg> create rect plain 60 20 30 40
rect#plain created
svg> addto target plain
rect#plain moved into g#target
svg> show plain
rect#plain  parent=g#target
  x=60 y=20 width=30 height=40
  fill=black
```

补写的属性会固定下来：例如 r 已有 fill=red，之后设置 target 的 fill 不会覆盖 r 的显式红色。若希望它重新跟随父级，fill/stroke 可通过 set 设置为 inherit；这不扩大其他属性的 set 白名单。

增强模式只承诺受支持的基础属性有效值，不承诺整张图像像素不变。层级与绘制顺序仍按任务书调整，尤其是跨父分组可能改变与未选对象的遮挡关系。

| 范围 | 当前处理 |
|---|---|
| fill / stroke 的可解析值 | CSS 命名色、transparent、none、3/4/6/8 位十六进制颜色 |
| stroke-width | 当前模型支持的有限、非负数值 |
| 原有效 paint 为 currentColor、url(...)、var(...)、RGB/HSL 函数等 | 增强模式暂不解析，明确拒绝受影响的结构操作；普通模式行为不变 |
| font-size / font-family / font-weight / text-anchor / fill-opacity / stroke-opacity | 有效值不变可继续；有效值将改变则明确拒绝 |
| 祖先组的非 1 opacity 上下文发生变化 | 明确拒绝；即使旧、新祖先数值相同，也不直接视作等价 |
| 在同一透明度上下文内移动，或子树自身 opacity 原样保留 | 可继续，仍检查其他样式条件 |

这些拒绝都发生在提交修改前，不改变当前文档、默认保存路径或历史。下面示例中的 addto 被拒绝，但之前保留的 redo 仍然有效：

<!-- cli-mode: preserve-style -->
```text
svg> init
canvas 800x600 created
svg> create g target
g#target created
svg> create rect r 1 2 3 4 currentColor
rect#r created
svg> move r 10 0
rect#r moved to (11,2)
svg> undo
rect#r moved back to (1,2)
svg> addto target r
error: cannot preserve style: unsupported fill paint on rect#r
svg> redo
rect#r moved to (11,2)
svg> show r
rect#r  parent=svg
  x=11 y=2 width=3 height=4
  fill=currentColor
```

## 10. 查看结构与撤销重做

### 10.1 tree：显示层级和关键属性

```text
tree
tree node1
```

无参数从根 svg 开始；指定 id 时只显示该节点及其子孙。叶子也可以作为 tree 的起点。

```text
svg (800x600)
└── g#node1
    ├── rect#r1     x=10 y=20 w=100 h=50 fill=red
    └── text#title  (20,40) "Title"
```

- `g#node1` 表示类型是 g、id 为 node1。
- 树中的 w/h 是 width/height 的简写。
- 出现的颜色是显式样式；没有显示 fill 不代表浏览器一定不填充，还可能使用继承或默认值。
- 当前树或子树内的属性按同一显示列对齐，标签与属性之间至少两个空格；长 id 和层级缩进会自动扩大列宽，中文及 emoji 按常见终端显示宽度处理。没有属性的组不补尾部空格。
- 节点顺序反映同级绘制顺序。

### 10.2 show：显示单个对象明细

```text
show r1
```

显示对象标签、父级，以及已存储的属性。几何属性集中在下一行，随后逐行显示样式属性，文本内容放在最后；组没有几何属性，不输出空白几何行。parent=svg 表示直接位于根下，parent=g#scene 表示位于 scene 中。

show 不展开孩子，也不计算浏览器最终继承后的完整样式。text 另有 text 行展示内容。原点、移动和分组示例中的 show 输出均为实际回显。

### 10.3 help：不需要文档即可查看帮助

```text
help
```

会列出全部命令语法，并列出六种 create 的参数形式。当前没有 `help move` 等子命令帮助；请使用无参数 help。

### 10.4 undo / redo：一条编辑命令一个单元

```text
undo
redo
```

完整示例：

```text
svg> init
canvas 800x600 created
svg> undo
error: undo not allowed after io command
svg> create rect r1 10 20 100 50 red
rect#r1 created
svg> move r1 20 0
rect#r1 moved to (30,20)
svg> tree
svg (800x600)
└── rect#r1  x=30 y=20 w=100 h=50 fill=red
svg> show r1
rect#r1  parent=svg
  x=30 y=20 width=100 height=50
  fill=red
svg> canvas
canvas 800x600
svg> undo
rect#r1 moved back to (10,20)
svg> show r1
rect#r1  parent=svg
  x=10 y=20 width=100 height=50
  fill=red
svg> redo
rect#r1 moved to (30,20)
svg> undo
rect#r1 moved back to (10,20)
svg> set r1 fill blue
rect#r1 updated: fill="blue"
svg> redo
error: nothing to redo
svg> save history.svg
saved to history.svg (1 elements)
svg> undo
error: undo not allowed after io command
svg> move r1 1 0
rect#r1 moved to (11,20)
svg> undo
rect#r1 moved back to (10,20)
```

关键规则：

1. 成功 create/delete/move/scale/set/group/ungroup/addto/front/back 各占一个撤销单元。
2. 删除整组或一次分组，仍只需要 undo 一次。
3. tree/show/help/只读 canvas 不占历史，也不清空历史。
4. undo 后执行新的成功编辑会清空 redo。示例中 set fill 后再 redo，得到 nothing to redo。
5. 失败编辑不清空 redo，也不改变当前状态。
6. 成功 init/read/save/canvas 修改尺寸会清空旧历史并禁用 undo 和 redo，错误统一为 `undo not allowed after io command`。
7. 下一次成功编辑会解禁；之后只能撤销这个新阶段的编辑，不能跨越前面的保存或读取恢复旧历史。
8. 没有可撤销或可重做项时，分别为 `nothing to undo` / `nothing to redo`。

撤销反馈描述恢复后的状态：叶图元移动显示 moved back to 原坐标，组移动显示 moved back by 反向增量；set 显示恢复值，原来省略的样式显示 `<unset>`；删除撤销显示 restored into 原父容器。其他编辑分别描述恢复的分组、归属、绘制顺序或缩放状态。redo 直接输出该编辑原先的成功摘要。状态由快照精确恢复，浮点移动或缩放不会通过反向计算来撤销；完整属性可通过 show/tree 查询。

## 11. SVG 导入与 transform 增强

### 11.1 支持的文件内容

| 内容 | 当前行为 |
|---|---|
| rect/circle/ellipse/line/text/g | 可以导入和保存 |
| 唯一、大小写敏感 id | 保留；重复则拒绝 |
| svg 根节点的可选 id | 保留并写回；不计入图形数量，未提供时不自动补 id |
| 缺 id 的图形 | 自动按标签名加序号补全，先避开根节点及全部显式图形 id |
| fill/stroke/stroke-width | 保留 |
| font-size/text-anchor/font-family/font-weight | 可导入保留；不加入 CLI set 白名单 |
| opacity/fill-opacity/stroke-opacity | 可导入，数值范围 0～1 |
| 图形上的 data-* | 作为元数据保留；不自动激活插件 |
| 几何长度 | 支持纯数值或 px；不支持百分比、em 等 |
| viewBox | 仅支持 `0 0 width height` 且与画布尺寸一致 |
| XML 文本与特殊字符 | 正确转义；非法 XML 字符拒绝 |
| path/tspan/defs/CSS style/DOCTYPE | 当前拒绝 |

导入不是通用 SVG 清洗或完整 SVG 标准实现。遇到其他设计软件导出的复杂文件，可能需要先简化到上述子集。

根节点 id 属于文档信息，tree 的画布标题仍为 svg (宽x高)，parent=svg 的显示不变。move / scale / set / delete / show / tree <id> 等按 id 操作的目标仍为六种图形；根节点不作为普通图形操作，也不能作为 create 的 in 目标。init 创建新文档时清除原根节点 id。

### 11.2 自动补 id 的效果

例如外部文件包含：

```xml
<svg xmlns="http://www.w3.org/2000/svg" id="rect1" width="100" height="100" viewBox="0 0 100 100">
  <rect x="0" y="0" width="50" height="20"/>
  <rect id="rect2" x="60" y="0" width="20" height="20"/>
</svg>
```

第一个矩形会得到 rect3，同时避开根节点的 rect1 和后面矩形的 rect2。警告格式为：

```text
warning: assigned id rect3 to unnamed <rect>
```

补 id 警告不表示读取失败；之后可以按新 id 继续操作。若整次读取失败，当前文档保持原状。

### 11.3 transform 支持范围

支持：

```xml
<g transform="translate(60,40)">
  <g transform="translate(200,0) scale(0.8)">
    <rect id="r1" x="0" y="0" width="120" height="60"/>
  </g>
</g>
```

- `translate(tx)` / `translate(tx,ty)`：平移；只给一个参数时 ty=0。
- `scale(s)` / `scale(s,s)`：正等比缩放。
- 同节点多个变换、嵌套父子变换、空格或逗号分隔参数、浮点和科学计数法。
- 不支持 rotate、skew、任意 matrix、非等比缩放、0 或负缩放。

上例 r1 导入后得到 x=260、y=40、width=96、height=48。外层平移和内层平移叠加，内层尺寸乘 0.8。

变换顺序有意义：对点 `(1,2)`，`translate(10,20) scale(2)` 得到 `(12,24)`；`scale(2) translate(10,20)` 得到 `(22,44)`。

### 11.4 使用仓库中的背景示例

```text
svg> read examples/transform-original.svg
warning: assigned id rect1 to unnamed <rect>
warning: assigned id text1 to unnamed <text>
read examples/transform-original.svg (6 elements)
svg> show a
rect#a  parent=g#diagram
  x=60 y=40 width=120 height=60
  fill=#4a90d9
svg> show rect1
rect#rect1  parent=g#nodeB
  x=260 y=40 width=96 height=48
  fill=#f5a623
  stroke-width=0.8
svg> show text1
text#text1  parent=g#nodeB
  x=308 y=70.4
  text-anchor=middle
  font-size=12.8
  fill=white
  stroke-width=0.8
  text="End"
svg> move nodeB 10 20
g#nodeB moved by (10,20)
svg> undo
g#nodeB moved back by (-10,-20)
svg> save transform-normalized.svg
saved to transform-normalized.svg (6 elements)
```

效果：

- a 左上角变为 `(60,40)`。
- 内层矩形自动补 id 为 rect1，位置 `(260,40)`，尺寸 `96×48`。
- 文字自动补 id 为 text1，位置 `(308,70.4)`，字号从 16 变为 12.8。
- 移动 nodeB 后可以撤销，保存为 transform-normalized.svg。

导入时会把支持的变换归一化为几何值，同时处理字号和线宽。保存文件保留 g 层级，但不保留原始 transform 属性表达。

这与 CLI 的 scale 不同：**导入变换要还原原图显示效果，因此会处理字号和线宽；CLI scale 按任务书只缩放几何属性。**

可在普通终端一次回放仓库示例：

```sh
npm run cli < examples/transform.cli
```

该脚本会更新 `examples/transform-normalized.svg`，原始输入 `examples/transform-original.svg` 保留。

## 12. 完整案例两节点流程图

下面是任务书场景的完整会话，可以从新启动的程序逐行输入。每个节点用一个 g 管理矩形和文字，连线属于外层流程图。

```text
svg> init 800 600
canvas 800x600 created
svg> create g flowchart
g#flowchart created
svg> create g node1 in flowchart
g#node1 created in g#flowchart
svg> create rect start 120 100 160 60 #4a90d9 in node1
rect#start created in g#node1
svg> create text start-label 155 135 "开始" in node1
text#start-label created in g#node1
svg> create g node2 in flowchart
g#node2 created in g#flowchart
svg> create rect process 520 100 160 60 #f5a623 in node2
rect#process created in g#node2
svg> create text process-label 545 135 "处理数据" in node2
text#process-label created in g#node2
svg> create line arrow1 280 130 520 130 black in flowchart
line#arrow1 created in g#flowchart
svg> move node2 0 100
g#node2 moved by (0,100)
svg> undo
g#node2 moved back by (0,-100)
svg> set process-label text "处理数据 v2"
text#process-label updated: text="处理数据 v2"
svg> tree
svg (800x600)
└── g#flowchart
    ├── g#node1
    │   ├── rect#start          x=120 y=100 w=160 h=60 fill=#4a90d9
    │   └── text#start-label    (155,135) "开始"
    ├── g#node2
    │   ├── rect#process        x=520 y=100 w=160 h=60 fill=#f5a623
    │   └── text#process-label  (545,135) "处理数据 v2"
    └── line#arrow1             (280,130) -> (520,130) stroke=black
svg> save examples/flowchart.svg
saved to examples/flowchart.svg (8 elements)
```

最终结构为：

```text
flowchart
├── node1
│   ├── start
│   └── start-label
├── node2
│   ├── process
│   └── process-label
└── arrow1
```

图形效果：

- 左侧蓝色节点，矩形从 `(120,100)` 开始，宽 160、高 60，文字为“开始”。
- 右侧橙色节点，矩形从 `(520,100)` 开始，宽 160、高 60，文字改为“处理数据 v2”。
- 水平黑线从 `(280,130)` 连接到 `(520,130)`，不带箭头头部。
- node2 曾下移 100，但 undo 后回到原位。
- 保存元素数为 8，包含 3 个 g、2 个 rect、2 个 text、1 个 line，不计根 svg。

也可以在普通终端执行：

```sh
npm run cli < examples/flowchart.cli
```

它会更新 `examples/flowchart.svg`。将文件拖入浏览器查看，继续修改后保存并刷新浏览器。

## 13. 命令脚本与构建版运行

### 13.1 编写自己的脚本

在 VS Code 中新建 UTF-8 文本文件，例如 `my-drawing.cli`，内容只放命令和整行注释：

```text
# my-drawing.cli：一个带标题的矩形
init 400 200
create g node
create rect frame 60 60 200 80 #4a90d9 in node
create text label 90 105 "我的图形" in node
tree
save output/my-drawing.svg
```

不要复制 `svg>` 提示符、程序回显、Markdown 代码围栏或终端欢迎语。然后在普通终端执行：

```sh
mkdir -p output
npm run cli < my-drawing.cli
```

结果：创建一个蓝色矩形和文字，保存为 output/my-drawing.svg（3 个元素）。执行完遇到 EOF 自动退出，脚本模式没有 svg> 提示符。

当前脚本中有命令错误时，程序仍会继续执行后续命令，且退出状态不保证反映命令失败。请检查输出中的 `error:`；不能仅凭进程退出状态判断绘图脚本全部成功。

### 13.2 源码运行与构建运行

| 方式 | 命令 | 使用场景 |
|---|---|---|
| 源码运行 | `npm run cli` | 日常使用、修改源码后重新启动 |
| 编译 | `npm run build` | 将 TypeScript 编译到 dist |
| 构建运行 | `npm start` | 执行已编译的 dist/bootstrap/Main.js |

```sh
npm run build
npm start
```

生产构建也支持脚本：

```sh
npm start < examples/flowchart.cli
```

修改源码后需要重新 build 才会影响 npm start；npm run cli 直接加载当前源码，但没有自动热重载，需要重启程序。

### 13.3 输出文件位置

相对路径总是以启动进程时的工作目录为基准，不以脚本文件所在目录为基准。

例如从项目根目录运行 `npm run cli < examples/flowchart.cli`，脚本中的 `save examples/flowchart.svg` 指向工程的 examples 目录。

若保存 `output/…`，需先创建该目录。当前 `.gitignore` 忽略 output、node_modules、dist、coverage；直接保存到根目录的 demo.svg/tutorial.svg 不会自动忽略，可能在 Git 中显示为未跟踪文件。

## 14. 验证与调试

### 14.1 npm 命令与效果

下面均在普通终端执行，不是在 svg> 中执行。

| 命令 | 效果 |
|---|---|
| `nvm use` | 读取 .nvmrc 选择当前终端的 Node.js |
| `npm ci` | 按锁文件安装全部项目依赖 |
| `npm run cli` | 启动源码版交互编辑器 |
| `npm run typecheck` | 严格类型检查，不生成业务输出文件 |
| `npm test` | 运行自动化测试 |
| `npm run test:coverage` | 测试并生成覆盖率报告到 coverage |
| `npm run build` | 生成 dist 构建产物 |
| `npm start` | 运行已构建程序 |
| `npm run check` | 依次类型检查、自动化测试、生产构建 |

启动参数修复后的自动化测试有 16 个测试文件、202 项测试，其中新增 37 项覆盖参数解析、源码入口和在临时目录从当前代码重新构建的入口。最新基线、实际测试数量与功能回归结果见 [验收记录](acceptance/功能测试与结果记录.md)；这些数量不表示任意 SVG 都受到支持。

本手册的 20 组示例会话另行回放核验，共 182 条输入：原有普通模式会话加 help 共 18 组 / 156 条输入，新增增强模式会话 2 组 / 26 条输入，覆盖当前全部 19 个 CLI 命令。回放使用临时文件，不覆盖用户生成的 demo.svg。

### 14.2 VS Code 断点调试

1. 打开 `src/application/commands/MoveCommand.ts`，在 apply 方法中设置断点。
2. 按 Command+Shift+P，搜索并打开 JavaScript Debug Terminal。
3. 在该终端进入项目，执行 nvm use，然后 npm run cli。
4. 输入 init、创建一个图形，再输入 move 命令。
5. 程序停在断点后，可查看参数和文档对象，使用调试工具逐步执行。

这种方式不要求新增 launch.json。只想使用编辑器时，不需要设置断点或开启调试。

### 14.3 阅读手册

在 VS Code 打开本 Markdown 文件后，可按 Command+Shift+V 查看排版预览。原始文件也包含全部文字、表格、命令和会话，不依赖单独的图片附件才能理解操作效果。

## 15. 常见错误与当前限制

### 15.1 环境问题

| 现象 | 原因或处理 |
|---|---|
| `zsh: command not found: nvm` | 安装尚未完成或当前终端没加载 nvm；按 2.4 加载 |
| `zsh: command not found: node` / npm | 当前终端未选择可用运行时；先加载 nvm，再 nvm install / nvm use |
| `nvm use` 提示没有 .nvmrc | 检查当前目录是否是项目根目录；2026-10-24 更新后的 final 已包含 .nvmrc，较早的 ef90a19 不包含 |
| nvm 提示指定版本尚未安装 | 在项目根目录执行 nvm install，再 nvm use |
| npm 提示找不到 package.json | 用 cd 进入 svg-editor，不能只停在父目录“高级软件开发” |
| 找不到 tsx 或其他依赖 | 在项目根目录执行 npm ci |
| npm start 找不到 dist | 先 npm run build |
| 安装连接 127.0.0.1:7897 失败 | VPN 未运行或端口不同；检查 VPN 或取消临时代理 |
| 下载或安装超时 | 在 VPN 可用时按 2.5 设置代理后重试 |

### 15.2 编辑器错误

| 输出或前缀 | 含义及处理 |
|---|---|
| `error: no document. use 'init' or 'read' first` | 先 init 或 read；help 可以直接使用 |
| `error: unknown command: …` | 检查命令名和输入位置；help 查看支持的语法 |
| `error: invalid arguments. use help for syntax` | 参数个数错误；例如 canvas 只能无参数或两个参数 |
| `error: group requires at least two shapes` | group 需要至少两个不同成员；只有一个成员时不会创建组 |
| `error: invalid arguments for create rect` | 该类型参数不足或过多，按 7.1 检查 |
| `error: missing id before 'in' clause` | in 子句前缺少独立 id，例如 create g in scene；应补上孩子 id |
| `error: unterminated double quote` | 双引号未闭合；使用英文双引号 |
| `error: id already exists: r1` | 换新 id；文档内同名对象不能重复 |
| `error: invalid id: …` | id 为空或含不支持字符，使用 node1/start-label 等 |
| `error: no such shape: r9` | id 不存在，检查大小写或先 tree |
| `error: no such container: node9` | in/addto 目标容器不存在，先 create g |
| `error: not a container: r1` | 目标是叶子图形，不能容纳孩子或被解组 |
| `error: unknown shape type: box (is the plugin loaded?)` | 当前没有 box 插件；用 g+rect+text 手工组合 |
| `error: unknown attribute: font-size` | 不能用 set 修改该属性，见白名单 |
| `error: invalid x: …` 等 | 输入非数值、带单位或溢出，CLI 数值使用纯数字 |
| `error: width must be nonnegative` / r 等 | 宽高或半径不能为负 |
| `error: scale factor must be positive` | factor 必须大于 0 |
| `error: cannot group a container into its own descendant: …` | group 同时选中了祖先与后代 |
| `error: duplicate group member` | group 中同一 id 出现多次 |
| `error: cannot preserve style: unsupported … paint on …` | 增强模式无法解析受影响对象的原有效颜色，见 9.6 |
| `error: cannot preserve style: inherited … would change on …` | 增强模式暂不固化该项额外继承属性 |
| `error: cannot preserve style: group opacity context would change` | 祖先组透明度上下文变化，不能按普通继承属性复制 |
| `error: cannot move a container into its own descendant: …` | addto 构成自包含或循环 |
| `error: cannot ungroup top-level container: scene` | 根级 g 按任务书不能解组，参见 9.2 |
| `error: undo not allowed after io command` | 最近成功文档操作禁用了历史；新编辑后才能撤销新编辑 |
| `error: nothing to undo` / `nothing to redo` | 当前对应历史为空 |
| `error: no file path. use save <file.svg>` | 新文档未关联路径，第一次保存需给文件名 |
| `error: cannot read file: …` | 检查路径、文件是否存在及权限 |
| `error: cannot write file: …` | 检查父目录是否存在、写权限及可用空间 |
| `error: invalid SVG: malformed XML` | XML 不合法，检查标签闭合和转义 |
| `error: unsupported SVG viewBox: expected 0 0 width height` | viewBox 与支持范围不符 |
| `error: unsupported SVG attribute: …` | 包含暂不支持的属性，例如 style |
| `error: unsupported or invalid SVG transform: …` | 变换类型或语法不受支持 |
| `error: unsupported SVG transform: nonuniform scale` | 两轴缩放比例不同 |
| `error: invalid XML character in text` 等 | 内容中含不能写入 XML 的字符 |

错误行不会改变当前文档和历史。修正参数后可继续输入，不需要重启编辑器。

### 15.3 图形与预览问题

| 现象 | 检查方法 |
|---|---|
| 看不到新建直线 | line 是否设置 stroke？默认 none 通常不可见 |
| 看不到图形 | 用 show 检查位置、宽高或半径是否为 0、是否在画布外、fill/stroke 是否为 none |
| 修改后浏览器没变化 | 是否再次 save、是否打开同一路径、是否刷新浏览器 |
| 文字位置与预想不同 | text 的 y 是基线；不会自动水平或垂直居中 |
| 移动节点后连接线没跟着更新 | line 只是独立图形，没有与节点绑定的自动连接关系 |
| 命名为 arrow 的 line 没有箭头 | id 不决定外观，当前 line 不提供 marker 箭头功能 |
| scale 后位置也变了 | 按原点缩放全部几何属性，属于当前定义 |
| scale 后字号或线宽没变 | CLI scale 只作用于几何，见 8.2 |
| 解组后颜色变化 | 普通模式的继承来源改变；可选择基础样式保留模式，见 9.5、9.6 |
| 导入后 transform 不见了 | 已归一化到坐标，属于增强功能的保存方式 |

### 15.4 当前版本边界

- 单文档、单次会话内编辑，没有自动保存、崩溃恢复或退出前未保存提醒。
- init、read 和退出可能丢失尚未保存的内容；需要保留时主动另存。
- 文件存在时 save 会覆盖；没有文件冲突检测或自动版本备份。
- 不支持完整 SVG 标准、动态插件或 box 语义，没有鼠标拖拽 GUI。
- undo 历史保存在内存中，无容量上限，大文档和长期编辑可能占用较多资源。
- 目前没有承诺超大文件或极深嵌套的性能指标。
- 启动参数错误向 stderr 输出并以 2 退出；进入编辑器后的命令错误会继续处理后续输入，批处理不能只凭退出码判断全部编辑命令成功。
- 本次用户明确授权启动参数修复、重新验收后更新 final；最终标签包含完整业务代码、环境配置、本手册、需求复核及新验收证据。后续 box 和动态插件尚未实施，未来开发仍需另行确认。

## 16. 日常使用清单

**启动：普通终端**

```sh
cd "/Users/xht/Documents/课程资料/高级软件开发/svg-editor"
nvm use
npm run cli
```

**编辑：svg> 中输入**

```text
init 800 600
create g scene
create rect r1 100 100 160 60 #4a90d9 in scene
create text label 120 135 "我的节点" in scene
tree
move scene 20 30
undo
redo
save output.svg
```

**查看与退出**

1. 把 output.svg 拖入浏览器查看。
2. 继续编辑时，修改后再次 save 并刷新浏览器。
3. 不确定某对象状态时 show，不确定层级时 tree，不确定语法时 help。
4. 操作结束先保存，再按 Control+D 退出。

**修改源码后：普通终端**

```sh
npm run check
```

首次在另一台已配置 nvm 的电脑上恢复环境，则先执行 nvm install、nvm use、npm ci，再启动项目。
