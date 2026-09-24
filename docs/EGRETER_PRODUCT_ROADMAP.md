# Egreter 产品与架构路线图（2026）

> 状态：Draft / Implementation Roadmap  
> 仓库：`egreter/egret`  
> 基线日期：2026-09-25  
> 产品 CLI：`egreter`

## 1. 产品定义

Egreter 是基于 Egret Engine 现有代码、公开 target 源码以及已保存的官方 support artifacts，重新建设的一套现代 Egret 开发 SDK。

它不是 Egret Launcher 的复刻，也不以兼容 legacy Egret 项目为产品目标。

Egreter 的目标是提供：

- 一个统一的 `egreter` CLI；
- 一套只面向 **modern Egreter project** 的项目模型；
- 从创建项目、开发服务器、编译、资源处理到 production build 的完整 Web 开发链路；
- 一套与 bundler 解耦的 Build Core；
- 一套可独立安装的平台 Target SDK 与 target packages；
- Web、小游戏、快游戏以及 Android/iOS Native Host 的发布能力；
- 可在 CI、离线环境和普通 Node.js 开发环境中运行，不依赖 EgretLauncher；
- 对历史 Egret runtime、target 与 support ZIP 进行代码/行为迁移，但不承担 legacy project compatibility。

旧的 `egret` 命令属于 legacy 产品。本仓库新的命令行入口统一为：

~~~bash
egreter
~~~

npm package 使用 `@egreter/*` scope。

---

## 2. 明确的产品边界

### 2.1 支持什么

Egreter 支持由 Egreter 创建或符合 Egreter Project Schema 的现代项目：

~~~bash
egreter create my-game
cd my-game
pnpm install
pnpm egreter dev
pnpm egreter build
~~~

现代项目使用：

- ESM；
- TypeScript；
- `egreter.config.ts`；
- npm/pnpm package dependencies；
- 明确的 assets/source/output 目录；
- Target SDK；
- 可复现构建。

### 2.2 不支持什么

以下能力不作为产品承诺：

- 直接打开并构建历史 Egret 5.x 项目；
- `egretProperties.json` 的完整兼容；
- legacy `egret build/run/publish` 命令兼容；
- Launcher 工程状态、下载目录或服务协议兼容；
- 为旧项目提供自动迁移保证；
- 为历史 TypeScript compiler 行为维持永久兼容层。

Legacy 仓库和 artifact 只承担三个角色：

1. runtime/API 行为参考；
2. platform adapter / packager 的恢复来源；
3. golden fixture / regression evidence。

这意味着 Egreter 可以从 legacy 中恢复能力，但不会让新架构被 legacy project model 反向约束。

---

## 3. 设计原则

### 3.1 CLI-first，Launcher-free

所有核心功能必须能够通过 CLI 和 Node.js API 完成。

EgretLauncher 不能成为：

- 构建依赖；
- 运行时依赖；
- target 下载器；
- 用户登录依赖；
- CI 必需组件。

### 3.2 Modern-only Project Model

只设计一个新的 Egreter Project Schema。

不在 Build Core 中放入 legacy project branching。

### 3.3 Compiler / Bundler / Target 分层

基本链路：

~~~text
Egreter Project
      |
      v
 Project Model
      |
      v
  Build Core
      |
      +-------------------+
      |                   |
      v                   v
 TypeScript            Assets/EUI
      |                   |
      +---------+---------+
                |
                v
         Build Artifact
                |
                v
          Target SDK
                |
       +--------+--------+----------------+
       |        |        |                |
       v        v        v                v
      Web     MiniGame  QuickGame      Native Host
~~~

Target 不允许直接依赖 Vite/Rolldown 的私有对象。

### 3.4 历史 support ZIP 是迁移输入，不是线上依赖

`EgretLauncher/EgretServer/static/downloads` 中的 support ZIP 用于：

- inventory；
- source recovery；
- template recovery；
- runtime adapter recovery；
- 行为对照；
- golden output。

最终 target package 必须可以脱离 EgretLauncher 独立安装和运行。

### 3.5 技术栈“受维护优先”，不是“最新优先”

Egreter 不追求每个依赖的最新 minor，但不采用已经停止维护的基础设施作为新架构基线。

2026 首选基线：

| 层 | 基线 |
| --- | --- |
| Node.js | Node 24 LTS |
| Package Manager | pnpm 12 |
| TypeScript | TypeScript 6 |
| Web Dev / Build | Vite 8 / Rolldown |
| Unit / Integration Test | Vitest 5 |
| CI | GitHub Actions |
| Module | ESM-first |

所有版本在仓库中锁定到 CI 验证过的具体范围，不使用浮动 latest 作为 release 构建依据。

---

## 4. Modern Project 规范

### 4.1 默认项目结构

`egreter create my-game` 生成：

~~~text
my-game/
├── src/
│   └── main.ts
├── assets/
├── public/
├── index.html
├── egreter.config.ts
├── tsconfig.json
├── package.json
└── .gitignore
~~~

后续模板可以增加：

~~~text
src/ui/
src/scenes/
assets/resource/
~~~

但 V0.1 的 basic template 必须保持最小。

### 4.2 egreter.config.ts

配置从第一版开始使用 typed config：

~~~ts
import { defineConfig } from "@egreter/build";

export default defineConfig({
  entry: "./src/main.ts",
  assets: "./assets",
  outDir: "./dist",
  target: "web",
  stage: {
    width: 750,
    height: 1334,
    frameRate: 60
  }
});
~~~

配置对象应是 Build Core 的公共 API，不绑定 Vite config。

需要高级 bundler 配置时，通过明确的 adapter hook 暴露，而不是把整个产品 API 变成 Vite wrapper。

### 4.3 package.json

默认生成的项目以 npm package 依赖 runtime：

~~~json
{
  "scripts": {
    "dev": "egreter dev",
    "build": "egreter build"
  },
  "dependencies": {
    "@egreter/engine": "workspace-or-release"
  },
  "devDependencies": {
    "@egreter/cli": "workspace-or-release"
  }
}
~~~

最终发布时替换为实际 semver。

---

## 5. CLI 设计

公开 CLI package：

~~~text
@egreter/cli
~~~

binary：

~~~text
egreter
~~~

### 5.1 V0.1 必须实现

~~~text
egreter create <name>
egreter dev [project]
egreter build [project]
egreter clean [project]
egreter doctor
egreter --version
egreter --help
~~~

### 5.2 create

V0.1 必须包含项目创建能力，不能把脚手架延后。

~~~bash
egreter create hello-egreter
egreter create hello-egreter --template basic
~~~

V0.1 只需要一个正式模板：

~~~text
basic
~~~

要求：

- 生成合法 modern project；
- 默认 ESM；
- 默认 TypeScript；
- 写入 `egreter.config.ts`；
- 写入 dev/build scripts；
- 创建最小可运行 Egret Stage；
- 支持 `--no-install`；
- 默认使用当前 package manager；
- 非交互模式可用于 CI。

### 5.3 dev

~~~bash
egreter dev
~~~

职责：

- 解析 project config；
- 启动 Vite dev server；
- 编译 Egreter runtime/application；
- 处理 assets；
- 提供 source map；
- 文件变化后更新；
- 编译/配置错误以统一 diagnostics 输出。

V0.1 不要求所有 runtime 状态都支持无刷新 HMR；允许刷新页面，但不得要求重启 CLI。

### 5.4 build

~~~bash
egreter build
~~~

职责：

- TypeScript compile/type check；
- engine/application bundle；
- assets copy/transform；
- production optimization；
- 生成 Web target；
- 输出稳定的 `dist/`；
- 错误返回非零 exit code。

### 5.5 后续命令

~~~text
egreter publish --target <target>
egreter target list
egreter target add <target>
egreter target info <target>
egreter package --target android
egreter package --target ios
egreter open --target <target>
~~~

不提供新的 `egret` binary。

---

## 6. Package 架构

### 6.1 第一阶段核心 packages

~~~text
packages/
├── cli/
├── config/
├── project/
├── build-core/
├── diagnostics/
├── resource-pipeline/
├── engine/
├── eui/
├── assetsmanager/
├── audio/
├── tween/
├── target-sdk/
└── target-web/
~~~

现有源码可以阶段性保留原目录，在 package 边界稳定后再移动，避免 V0.1 变成“大搬家 PR”。

### 6.2 后续 target packages

~~~text
@egreter/target-web
@egreter/target-wxgame
@egreter/target-qqgame
@egreter/target-baidugame
@egreter/target-ttgame
@egreter/target-mygame
@egreter/target-tbgame
@egreter/target-tbwidget
@egreter/target-qgame
@egreter/target-qhgame
@egreter/target-oppogame
@egreter/target-vivogame
@egreter/target-fastgame
@egreter/target-android
@egreter/target-ios
~~~

是否正式发布某个平台，取决于 2026 年该平台是否仍有可验证的运行环境和官方工具链。

---

## 7. Build Artifact

从 V0.2 开始将内部 build result 固化为公共 Target SDK 边界。

推荐模型：

~~~ts
export interface EgreterBuildArtifact {
  project: ProjectMetadata;
  mode: "development" | "production";

  scripts: OutputFile[];
  assets: OutputFile[];

  entry: {
    file: string;
  };

  stage: {
    width?: number;
    height?: number;
    frameRate?: number;
    scaleMode?: string;
    orientation?: string;
  };

  resources?: ResourceManifest;
  diagnostics: Diagnostic[];
}
~~~

目标：

- Vite 只负责构建，不定义产品数据结构；
- Target 只消费 Build Artifact；
- 将来更换 bundler 不影响 target；
- 同一个 build 可被多个 target consume。

---

## 8. Target SDK

推荐 v1 API：

~~~ts
export interface EgreterTarget {
  readonly name: string;
  readonly apiVersion: 1;

  validate(ctx: TargetContext): Promise<Diagnostic[]>;

  transform?(
    artifact: EgreterBuildArtifact,
    ctx: TargetContext
  ): Promise<EgreterBuildArtifact>;

  emit(
    artifact: EgreterBuildArtifact,
    ctx: TargetContext
  ): Promise<void>;

  finalize?(ctx: TargetContext): Promise<void>;
}
~~~

package metadata：

~~~json
{
  "name": "@egreter/target-wxgame",
  "egreter": {
    "kind": "target",
    "target": "wxgame",
    "apiVersion": 1
  }
}
~~~

Target capability 后续统一描述：

- http；
- socket；
- storage；
- filesystem；
- audio；
- video；
- lifecycle；
- subpackages；
- open-data-context；
- native-signing；
- external-devtool。

---

## 9. Support ZIP 迁移策略

当前保存的官方 artifacts 是平台恢复的重要依据，包括 compiler/support/native/toolkit ZIP。

新仓库增加：

~~~text
scripts/legacy/
├── inventory-supports.ts
├── import-support.ts
└── compare-support-output.ts
~~~

其中“legacy”仅表示历史资料，不表示支持 legacy project。

### 9.1 Inventory

扫描 ZIP 后生成机器可读清单：

~~~json
{
  "package": "egret-wxgame-support",
  "version": "1.3.7",
  "sourceFile": "egret-wxgame-support-1.3.7.zip",
  "sha256": "...",
  "files": [],
  "sourceRepository": "egreter/egret-target-wxgame"
}
~~~

### 9.2 Source-first

如果存在公开源码：

~~~text
公开 target 源码
       +
官方 ZIP artifact
       |
       v
恢复 modern package
       |
       v
ZIP/golden 对照
~~~

ZIP 不作为最终 runtime dependency。

### 9.3 Artifact-first

如果找不到源码，可以先把原始 runtime/template 作为受控 artifact 放入 target package，并用新的 TypeScript Target SDK glue 驱动。

随后再 source-ify。

迁移成熟度：

| Level | 状态 |
| --- | --- |
| L0 | 原始 ZIP / 资料归档 |
| L1 | modern target wrapper 可生成工程 |
| L2 | 已恢复源码 |
| L3 | 已迁移到 Target SDK |
| L4 | 已更新当前平台 API |
| L5 | 已通过目标平台验证 |

### 9.4 Toolkit

平台 toolkit/IDE ZIP 不放进 target npm package。

Egreter 可以检测并调用外部厂商工具，例如：

~~~bash
egreter open --target vivogame
~~~

但不会把大型厂商二进制软件作为 Node dependency 发布。

---

# 10. 多版本改造计划

## V0.1 — Modern Web MVP

### 目标

完成第一条真正可用的：

~~~text
create -> dev -> build
~~~

开发闭环。

### 必须完成

- 新 pnpm workspace；
- Node 24 LTS 开发/CI 基线；
- TypeScript 6；
- Vite 8 / Rolldown；
- `@egreter/cli` 与 `egreter` binary；
- `@egreter/config`；
- `@egreter/project`；
- `@egreter/build-core`；
- `@egreter/target-web`；
- runtime 以现代 package 形式可被应用引用；
- `egreter create`；
- `egreter dev`；
- `egreter build`；
- `egreter clean`；
- `egreter doctor`；
- basic starter template；
- assets 基础复制/URL 处理；
- production build；
- sourcemap；
- diagnostics；
- GitHub Actions；
- 至少一个从 create 生成的 fixture 进入端到端 CI。

### V0.1 不要求

- legacy project；
- EUI/EXML；
- RES 完整兼容；
- TextureMerger；
- 小游戏；
- Android/iOS；
- GUI；
- 所有 engine module 一次完成现代化。

### V0.1 Definition of Done

以下流程必须在 clean checkout 和 CI 中通过：

~~~bash
pnpm install
pnpm build

pnpm egreter create .tmp/hello --template basic --no-install
cd .tmp/hello
pnpm install
pnpm egreter build
~~~

开发环境验收：

~~~bash
pnpm egreter dev
~~~

浏览器必须能够：

- 启动 engine；
- 创建 Stage；
- 渲染一个可验证对象；
- 响应一次输入事件；
- 加载至少一个 asset；
- 修改应用源码后自动更新或刷新；
- production `dist/` 在静态服务器下可启动。

V0.1 完成即意味着 Egreter 已经是“可创建、可开发、可构建”的独立产品，而不是仓库源码集合。

---

## V0.2 — Runtime & Resource SDK

### 目标

让 modern Web 项目具备实际游戏开发所需的主要 Egret 能力。

### 范围

- 整理 engine exports；
- EUI package modern 化；
- EXML compiler 接入现代 Build Core；
- Resource/RES 新接口；
- audio/tween/assetsmanager；
- texture atlas pipeline；
- preload/resource manifest；
- build cache；
- 更完整的 source map；
- Web production optimization；
- runtime/browser integration tests。

### 项目模板

增加：

~~~text
basic
eui
~~~

仍然只支持 modern project。

---

## V0.3 — Build Artifact & Target SDK

### 目标

把平台发布能力从 bundler 中完全拆出。

### 范围

- Build Artifact v1；
- Target SDK v1；
- target package discovery；
- `egreter target list`；
- `egreter target add`；
- `egreter publish --target web`；
- support ZIP inventory；
- target golden fixtures；
- target capability metadata。

完成后，新增平台不允许直接修改 Build Core 的平台分支。

---

## V0.4 — WeChat Reference Target

### 目标

用微信小游戏证明 Target SDK 可以承载真实非浏览器平台。

### 范围

- 恢复 `@egreter/target-wxgame`；
- 对照公开 target source 与官方 support ZIP；
- runtime adapter；
- game.js；
- game.json；
- project config；
- assets/resource mapping；
- lifecycle/input/network/storage/audio 基础适配；
- subpackage/open-data capability 按当前平台规则实现；
- `egreter publish --target wxgame`；
- 输出可由当前微信开发者工具打开的项目。

WeChat 是 reference target；其实现用于验证 SDK，而不是把微信逻辑写进 Build Core。

---

## V0.5 — Mini-game Targets

### 候选范围

- QQ Game；
- Baidu Game；
- TT Game；
- MY Game；
- Taobao Game；
- Taobao Widget；
- 其它仍可验证的小游戏平台。

### 要求

每个平台：

- 独立 package；
- 独立 platform config schema；
- 共用 Target SDK；
- 不复制 compiler；
- 不依赖 Launcher；
- 有 output fixture；
- 有 runtime smoke test；
- 能进入对应官方开发者工具或有清晰的 unsupported 标记。

---

## V0.6 — QuickGame Targets

### 候选范围

- OPPO；
- vivo；
- Xiaomi/QGame；
- QHGame；
- FastGame；
- 其它仍存在的 QuickGame 系平台。

### 架构

抽出共用基础包，例如：

~~~text
@egreter/target-quickgame-core
~~~

厂商 target 只维护：

- manifest differences；
- API bridge differences；
- packaging differences；
- tooling integration。

旧 toolkit 只作为研究资料或外部工具发现依据。

---

## V0.7 — Native Android / iOS

### Android

- 新建现代 Android Studio / Gradle host；
- 从历史 support/template 恢复 Egret bridge 语义；
- 不复刻旧 Eclipse 工程；
- 支持 debug build；
- release signing 外部配置；
- `egreter publish --target android` 生成 host project；
- `egreter package --target android` 调用 Gradle。

### iOS

- 新建当前 Xcode 可维护 host；
- 从历史 iOS support/template 恢复 bridge；
- 清除不必要的过时依赖；
- 支持 simulator/device；
- archive/export 与 signing 解耦；
- `egreter publish --target ios`；
- `egreter package --target ios`。

---

## V0.8 — Developer Experience & Distribution

### 范围

- 完整 npm release 流程；
- changesets/release automation；
- target API semver；
- package provenance；
- SBOM；
- target compatibility matrix；
- `egreter create` 模板 registry；
- package cache/offline strategy；
- CLI shell completion；
- structured JSON output for CI；
- 文档站；
- API docs；
- target authoring guide；
- npm clean-install smoke tests；
- Windows/macOS/Linux release matrix。

---

## V0.9 — Hardening

### 范围

- 大型项目性能；
- incremental graph；
- deterministic build；
- build profile；
- target failure diagnostics；
- dependency security review；
- cross-platform path/encoding；
- fixture matrix；
- platform-specific regression suite；
- release candidate policy；
- public compatibility policy。

V0.9 不再新增大范围架构，主要解决 V1.0 blocker。

---

## V1.0 — Stable Egreter SDK

V1.0 的最终产品定义：

### Project

- 只支持 modern Egreter Project Schema；
- `egreter create` 是标准项目入口；
- ESM-first；
- typed configuration；
- package-based runtime。

### CLI

~~~text
egreter create
egreter dev
egreter build
egreter clean
egreter doctor
egreter publish
egreter target
egreter package
egreter open
~~~

### Web

- 开发服务器稳定；
- production 构建稳定；
- runtime/EUI/resource pipeline 完整；
- 可复现 CI build。

### Platform

- Target SDK 稳定；
- target packages 独立升级；
- 已支持平台有 capability matrix；
- 已停止或无法验证的平台不会伪装成 supported。

### Native

- Android/iOS 使用现代 host；
- publish 与 signing/package 分层。

### Architecture

- 不依赖 Launcher；
- 不依赖历史在线服务；
- 不依赖 support ZIP 在线下载；
- 不提供 legacy project compatibility layer；
- Build Core 不包含按平台堆叠的特殊分支；
- bundler 与 Target SDK 解耦；
- GUI 如未来存在，只能作为 CLI/API 上层可选产品。

---

## 11. 第一轮实施计划

第一轮只做 V0.1，不同时开始平台迁移。

### Phase A — Workspace baseline

1. 增加 pnpm workspace；
2. 固定 Node/pnpm；
3. 新增根 build/test/lint/typecheck scripts；
4. 新增 GitHub Actions；
5. 现有代码暂不大规模移动。

### Phase B — Runtime package entry

1. 为最小 engine runtime 建立现代 ESM entry；
2. 明确哪些现有 source 可以直接编译；
3. 修复只阻塞 modern basic sample 的问题；
4. 暂不要求 EUI/RES 全部完成。

### Phase C — New build system

创建：

~~~text
packages/config
packages/project
packages/build-core
packages/diagnostics
packages/target-web
packages/cli
~~~

Vite 通过 adapter 接入 Build Core。

### Phase D — Project create

实现：

~~~bash
egreter create hello
~~~

并把生成项目本身作为测试 fixture。

禁止维护一份“测试模板”和另一份“实际模板”；CI 必须直接调用 create。

### Phase E — End-to-end build

CI 执行：

~~~text
build Egreter
    |
    v
egreter create
    |
    v
install generated project
    |
    v
egreter build
    |
    v
serve dist
    |
    v
browser smoke
~~~

只有这条链路通过，V0.1 才算完成。

---

## 12. V0.1 建议代码目录

~~~text
packages/
├── cli/
│   └── src/
│       ├── commands/create.ts
│       ├── commands/dev.ts
│       ├── commands/build.ts
│       ├── commands/clean.ts
│       └── commands/doctor.ts
├── config/
├── project/
├── build-core/
├── diagnostics/
├── target-web/
└── engine/

templates/
└── basic/

fixtures/
└── generated/

docs/
└── EGRETER_PRODUCT_ROADMAP.md
~~~

---

## 13. V0.1 架构验收规则

以下规则用于避免首版在实现过程中重新滑回 legacy：

1. CLI binary 必须叫 `egreter`；
2. create 生成的新项目不得包含 `egretProperties.json`；
3. create 生成的新项目不得依赖 EgretLauncher；
4. Build Core 不读取 Launcher 配置目录；
5. Build Core 不下载历史 support ZIP；
6. modern project 不依赖 legacy `egret` CLI；
7. Vite config 不是 Egreter public project config；
8. target-web 必须经过 Target/Build 边界，而不是永远硬编码进 CLI；
9. package API 使用 `@egreter/*`；
10. CI 必须从 `egreter create` 生成项目再执行 build；
11. V0.1 遇到 legacy project 应给出明确的 unsupported diagnostic，而不是尝试猜测兼容；
12. 历史代码可以被重用，但进入新主线前必须有明确 package owner 和测试。

---

## 14. 历史代码与 artifacts 的处理原则

以下仓库/资料继续保留高价值：

- `egreter/egret-core`：命令、资源、平台发布行为参考；
- `egreter/EgretLauncher`：原始 support ZIP、native ZIP、compiler artifact、Launcher 工作流参考；
- `egreter/egret-target-*`：平台 target 源代码恢复来源；
- Android/iOS support/template：Native bridge 行为参考。

但它们不会定义 Egreter Project Schema。

新代码应回答：

> 这个行为在现代 Egreter 中应如何设计？

而不是：

> 怎样才能让旧 Launcher 认为这是一个合法项目？

---

## 15. 近期决策记录

### ADR-001 — CLI 名称

**Decision:** 新 CLI 为 `egreter`。

**Reason:** `egret` 属于 legacy CLI；新产品使用独立名称可以避免语义和全局 binary 冲突。

### ADR-002 — Project compatibility

**Decision:** 只支持 modern project，不提供 legacy Egret project compatibility。

**Reason:** 允许 Project Model、ESM、TypeScript、bundler、resource pipeline 和 target system 按现代约束设计，而不把历史目录/编译器行为固化为新架构债务。

### ADR-003 — V0.1 scope

**Decision:** V0.1 必须完成 create/dev/build 闭环。

**Reason:** 第一版本必须是可以真正开始开发的产品，而不是仅有 monorepo/tooling skeleton。

### ADR-004 — Platform artifacts

**Decision:** support ZIP 用于迁移和验证，最终转换为 `@egreter/target-*` packages。

**Reason:** 保留官方实现证据，同时消除 Launcher 下载模型和停止服务的依赖。

### ADR-005 — Web toolchain

**Decision:** modern Web 主线采用 Vite/Rolldown，并通过 Build Core adapter 隔离。

**Reason:** Egreter 不承担 legacy Webpack project compatibility，因而没有必要把旧 webpack pipeline 作为新项目默认架构；adapter 边界仍保留未来替换空间。
