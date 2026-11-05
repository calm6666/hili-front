# packages 接入规范

本文档记录 monorepo 内各包的接入模式、版本控制形态与构建顺序，是新增/调整包时的对照表。当前清单核对于 2026-11-05。

## 接入模式

- **dist 引入（打包后引入）**：消费方只拿构建产物。适合独立仓库、复用面宽、依赖重的库。要求：应用构建前先构建各 dist 包；`files` 只携带 `dist`；源码不入消费方 bundle。
- **src 引入（源码引入）**：消费方直接引 `src`（vite/tsc 现场编译）。适合紧贴本仓演进、无独立版本诉求的内部包。

## 清单

| 位置 | 包名 | 接入模式 | 版本控制 | 产物入口 | 消费方 |
| --- | --- | --- | --- | --- | --- |
| `packages/nova-player` | `@lumina/nova`、`@lumina/plugins`、`@lumina/live-player` | dist | 外部 submodule（gitee） | `packages/player` 的 `dist/index.js`、`style.css` 等 | apps/web、apps/spa |
| `packages/kalamos` | `kalamos` | dist | 独立仓库 gitlink | `dist/{core,server,client}/index.js` + `dist/styles/*.css` | 暂无 |
| `packages/hermes` | `hermes` | dist | 独立仓库 gitlink | `dist/hermes.{mjs,cjs}` + `dist/hermes.css` | 暂无 |
| `packages/comment` | `@hili/comment` | dist | 独立仓库 gitlink | `dist/index.js` | apps/web |
| `packages/core/*` | `@hili/crypto`、`@hili/shared-worker`、`@hili/storage`、`@hili/utils` | src | submodule（`packages/core`） | `src/index.ts` | 各应用 |
| `packages/libs/*` | `@hili/player-bridge`、`@hili/request`、`@hili/websocket` | src | submodule（`packages/libs`） | `src/index.ts` | 各应用 |
| `packages/ui/*` | `@hili/ui-solid`、`@hili/ui-vue`、`@hili/biz-solid`、`@hili/biz-vue`、`@hili/biz-mobile-solid`、`@hili/ui-mobile-solid`、`@hili/theme-tokens`、`@hili/toast`、`@hili/styles`、`aether-ui`、`aether-icons`、`aether-iconfont` | src（`@hili/ui-solid` 混合：`solid` 条件走 src，`import` 走 dist） | submodule（`packages/ui`） | `src/index.ts` / `src/*.css` | 各应用 |
| `packages/plugins` | error-monitor、perf-monitor、tracker（无根 package.json） | src | submodule（`packages/plugins`） | 各子目录 | 各应用 |
| `configs/*` | `@hili/tsconfig`、`@hili/eslint-config` | 配置直引 | 根仓库普通目录 | - | 各包 devDependencies |

apps 侧（`apps/web`、`apps/mobile`、`apps/spa`、`apps/admin`、`apps/live`、`apps/member`）均为相对 url 的 submodule。

## 构建顺序

```sh
# dist 包（被消费前）
pnpm --filter @lumina/nova build:player && pnpm --filter @lumina/plugins build   # 或 nova-player 内 build:all
pnpm --filter kalamos build:lib
pnpm --filter hermes build
pnpm --filter @hili/comment build
# 之后才是应用
pnpm --filter web build
```

## 已知坑

1. **kalamos 的两个 build 同名不同物**：`build` 是演示站 vite 构建（产出 `index.html` + `assets`），`build:lib` 才是库构建；`build:lib` 首入口 clean 会清掉演示站残留，但直接跑 `build` 会把库产物覆盖成演示站。
2. **@hili/comment 禁止 SSR 导入**：Lit 的 `customElements.define` 在模块导入时立即执行，服务端没有该 API；必须在客户端回调（onMount / useEffect）里动态 `import('@hili/comment')`。
3. **nova-player 指针更新前先在子仓库内提交**：该仓库是外部独立仓库（gitee），根仓库只记录 commit 指针；子仓库内有未提交改动时（2026-11-05 记录：mount/ssr/播放器组件若干），根仓库的指针更新会失真。
4. **gitlink 与 submodule 的差别**：kalamos/hermes/comment 目前以 gitlink（mode 160000）挂在根仓库，无 `.gitmodules` 条目，`git submodule update` 不会克隆它们；三个仓库推到远程后，用 `git submodule add <url> packages/<name>`（必要时 `git submodule absorbgitdirs`）正式化。
