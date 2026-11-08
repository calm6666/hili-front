# hili-front

hilihili 前端 monorepo（pnpm workspace + Turborepo + git submodule 按域聚合）。

架构设计见 [docs/architecture.md](docs/architecture.md)，子模块工作流见 [docs/submodule-guide.md](docs/submodule-guide.md)。

## 仓库结构

```
hili-front/                 主仓（聚合、编排、工程预设）
├── apps/
│   ├── web/                PC 主站，SolidStart SSR            [子仓]
│   ├── mobile/             移动端，SolidStart 混合渲染         [子仓]
│   ├── spa/                PC CSR，Solid + Vite              [子仓]
│   └── admin/              后台管理，Vue 3                    [子仓]
├── packages/
│   ├── core/               纯 TS SDK（request/crypto/player 等 11 包） [子仓]
│   ├── ui/                 组件库（solid/vue 基础 + 业务 + lit 评论）  [子仓]
│   │   ├── aether-ui/      SolidJS 组件库                        [内嵌独立仓]
│   │   └── aether-icons/   aether 图标库                         [内嵌独立仓]
│   ├── libs/               领域工具库（img-fade/player-bridge 等）  [子仓]
│   ├── comment/            Lit 评论 Web Component（三端通用）      [子仓·已发布]
│   ├── hermes/             引导巡览引擎（driver.js 1.4.0 fork）    [子仓·已发布]
│   ├── kalamos/            富文本编辑器库（Tiptap 3 + ProseMirror）[子仓·已发布]
│   ├── nova-player/        视频播放器 monorepo（Lumina + Nova）    [子仓·已发布]
│   └── plugins/            埋点、监控插件                       [子仓]
├── configs/                tsconfig / eslint / commitlint / vite 预设（主仓自有）
├── scripts/                submodule 管理、包脚手架
└── docs/                   架构与协作文档
```

## 快速开始

```bash
pnpm install          # 安装并链接 workspace
pnpm build            # turbo 构建全部包
pnpm typecheck        # 全量类型检查
pnpm dev              # 开发模式（按 turbo filter 选应用）
```

## 子模块（重要）/ Submodules

已发布的独立子仓（gitee 与 github 双远程，主仓 submodule 关联 github 地址）：

| 子仓 | gitee | github |
| --- | --- | --- |
| packages/comment | https://gitee.com/danding0000001/comment.git | https://github.com/calm6666/comment.git |
| packages/hermes | https://gitee.com/danding0000001/hermes.git | https://github.com/calm6666/hermes.git |
| packages/kalamos | https://gitee.com/danding0000001/kalamos.git | https://github.com/calm6666/kalamos.git |
| packages/nova-player | https://gitee.com/danding0000001/nova-player.git | https://github.com/calm6666/nova-player.git |
| packages/ui/aether-ui（内嵌于 ui 子仓） | https://gitee.com/danding0000001/aether-ui.git | https://github.com/calm6666/aether-ui.git |
| packages/ui/aether-icons（内嵌于 ui 子仓） | https://gitee.com/danding0000001/aether-icons.git | https://github.com/calm6666/aether-icons.git |

### 中文：如何同步拉取子仓源码

```bash
# 新机器首次克隆（一次性带出全部子仓）
git clone --recurse-submodules <主仓地址> && cd hili-front
# 已克隆但没带子仓时补齐（= pnpm up:sub）
git submodule update --init --recursive

# 日常更新：把主仓指针与所有子仓拉到远端最新
git pull --recurse-submodules && git submodule update

# 进入某个子仓开发后，推送子仓自身（以 kalamos 为例）
cd packages/kalamos
git push origin main        # gitee
git push github main        # github

# 子仓有新提交后，回主仓更新指针并提交
cd ../..
git add packages/kalamos
git commit -m "chore: bump packages/kalamos pointer"

# aether-ui / aether-icons 内嵌在 packages/ui 子仓内部，同样两级进入
cd packages/ui/aether-ui && git pull origin main
```

子仓内部统一命名：`origin` 指向 gitee，`github` 指向 github；主仓 `.gitmodules` 中的 url 关联 github 仓库。apps/*、core、ui、plugins、libs 目前仍指向本地相对路径（未建远程仓库）。

### English: How to sync and pull submodule sources

```bash
# First clone on a new machine (brings in all submodules at once)
git clone --recurse-submodules <repo-url> && cd hili-front
# Or fill them in after a plain clone (= pnpm up:sub)
git submodule update --init --recursive

# Daily update: pull the parent pointer and every submodule to the latest remote state
git pull --recurse-submodules && git submodule update

# After working inside a submodule, push the child repo itself (kalamos as an example)
cd packages/kalamos
git push origin main        # gitee
git push github main        # github

# When the child repo has new commits, bump the pointer in the parent repo
cd ../..
git add packages/kalamos
git commit -m "chore: bump packages/kalamos pointer"

# aether-ui / aether-icons are nested standalone repos inside the packages/ui submodule
cd packages/ui/aether-ui && git pull origin main
```

Inside every child repo: `origin` points to gitee, `github` points to github; the parent `.gitmodules` urls reference the github repositories. apps/*, core, ui, plugins and libs still use local relative paths (no remote repositories yet).

## 常用约定

- 包名统一 `@hili/` scope，公共包入口开发期直指 `src/index.ts`，发布期由 tsup 产 `dist` + d.ts。
- 应用不对外发布（private: true），公共包走 changesets 独立版本。
- core 层禁止框架依赖、必须 SSR-safe（禁止顶层访问 window/localStorage）。
- 依赖方向：apps → ui → core；plugins → core。CI 用依赖规则校验把守。
