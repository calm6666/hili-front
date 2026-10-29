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

## 子模块（重要）

7 个业务域均为独立 git 仓库，主仓通过 git submodule 关联。

```bash
# 新机器首次拉取
git clone <主仓地址> && cd hili-front
pnpm up:sub           # = git submodule update --init --recursive

# 日常更新
pnpm st:sub           # 查看各子仓指针与远端差异
pnpm check:sub        # CI 用：校验指针一致性
```

当前阶段子模块 url 指向本地相对路径（见 .gitmodules），推远程仓库后按 docs/submodule-guide.md 替换为真实地址。

## 常用约定

- 包名统一 `@hili/` scope，公共包入口开发期直指 `src/index.ts`，发布期由 tsup 产 `dist` + d.ts。
- 应用不对外发布（private: true），公共包走 changesets 独立版本。
- core 层禁止框架依赖、必须 SSR-safe（禁止顶层访问 window/localStorage）。
- 依赖方向：apps → ui → core；plugins → core。CI 用依赖规则校验把守。
