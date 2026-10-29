# hili-front 架构设计

> 2026-10-29 定稿。方案：pnpm workspace + Turborepo 主仓骨架，业务域按域聚合成 7 个独立 git 仓库，经 git submodule 挂载。

## 一、方案选型结论

对比过四种主流形态：

1. 纯单仓 monorepo：联调体验最好，但无独立仓库与权限隔离。
2. meta 仓 + 全量 submodule（每包一仓）：边界最硬，但 submodule 数量爆炸、管理成本极高。
3. 多仓 + 私有 npm registry：版本治理规范，但联调要发版，迭代慢。
4. 单仓骨架 + 按域聚合 submodule（采用）：submodule 收敛到 7 个，域内多包共享 workspace 联调体验，域间独立 git、独立权限、独立版本、可单独 CI。

采用方案 4。若团队规模小且无权限隔离诉求，可退化成方案 1（删 .gitmodules 改单仓）。

## 二、仓库与子模块清单

| 子模块路径 | 内容 | 说明 |
|---|---|---|
| apps/web | @hili/web | PC 主站，SolidStart SSR（www 域） |
| apps/mobile | @hili/mobile | 移动端，SolidStart 混合渲染（m 域） |
| apps/spa | @hili/spa | PC CSR，Solid + Vite（live / activity 域） |
| apps/admin | @hili/admin | 后台管理，Vue 3.6 + Vue 组件库（admin 域） |
| packages/core | 11 个纯 TS SDK 包 | utils、request、websocket、crypto、storage、shared-worker、toast、markdown-core、markdown-editor-core、player-core、theme-tokens |
| packages/ui | 7 个组件包 | ui-solid、ui-mobile-solid、ui-vue、biz-solid、biz-mobile-solid、biz-vue、comment（Lit） |
| packages/plugins | 3 个插件包 | tracker、error-monitor、perf-monitor |

主仓自有的部分：configs（tsconfig / eslint-config / commitlint / vite-preset 预设）、scripts（submodule 管理、包脚手架）、docs、CI 编排。

## 三、workspace 挂载方式（关键实现）

子仓目录直接作为 pnpm workspace 成员，pnpm-workspace.yaml：

```yaml
packages:
  - apps/*              # 每个 app 子仓根 = 一个 workspace 包
  - packages/core/*     # core 子仓内每个目录 = 一个包
  - packages/ui/*
  - packages/plugins/*
  - configs/*
```

注意：域子仓内部不放独立的 workspace 文件，全仓只有一个 pnpm workspace，避免双重 workspace 冲突。子仓边界是 git 边界，不是 workspace 边界。

## 四、分层依赖规则（CI 强制）

```
apps/*  →  ui/*  →  core/*
   │                    ↑
   └→ plugins/*  ───────┘（plugins 只依赖 core）
```

- core/*：禁止任何框架 import；必须 SSR-safe（禁止顶层访问 window / localStorage / document，统一 isBrowser() guard）；只允许依赖 utils。
- ui/*：允许依赖 core；禁止依赖 frameworks（本方案无框架绑定层）与应用。
- comment（Lit WC）：零框架依赖，Solid / Vue / 原生三端通用；Vue 侧用 compilerOptions.isCustomElement 注册 hili- 前缀。
- 依赖方向用 dependency-cruiser 或 eslint-plugin-boundaries 校验，进 CI。

## 五、SDK API 设计准则（无绑定包的前提）

不设 player-solid / player-vue 之类的框架绑定包。core 层 SDK 必须满足：

1. 命令式实例：createXxx(el, options) 返回实例。
2. options 可热更新：instance.update(options)（换源、切清晰度、改主题不销毁重建）。
3. 事件订阅：on / off，返回取消函数。

满足以上三点则任何框架接入只需生命周期胶水（Solid onMount + onCleanup / Vue onMounted + onUnmounted，5 行内）。响应式同步（如 Solid 信号变化触发 update）由使用方手动桥接，或在 ui 层业务组件里统一桥一次。

## 六、移动端混合渲染

apps/mobile 用 SolidStart 单应用承载 SSR 与 CSR 两种形态：

- 内容页（专栏、资讯等需要 SEO 与首屏的）默认 SSR。
- 重交互页（播放器、个人中心等）路由级声明 `export const route = { renderMode: 'spa' }`。
- 一套路由、一处部署（m 域 Node 服务），SDK 全量复用。

## 七、子域名部署

| 子域名 | 应用 | 产物形态 |
|---|---|---|
| www.example.com | apps/web | SolidStart Node 服务（adapter-node） |
| m.example.com | apps/mobile | SolidStart Node 服务（SSR 直出 + SPA 路由客户端渲染） |
| live / activity | apps/spa | 静态资源上 CDN |
| admin.example.com | apps/admin | 静态资源（内网网关） |
| cdn.example.com | 公共包产物 | ES module + 版本号缓存 |

- 网关（Nginx / APISIX）按 server_name 分发。
- 登录态走主域 cookie（.example.com），core/request 统一注入签名（core/crypto）。
- storage 命名空间按子域前缀隔离；SharedWorker 仅同源可用，跨子域场景用 postMessage 桥。

## 八、版本与发布

- 公共包：changesets 独立版本号 + changelog；包 build 产出 dist + d.ts（tsup），publish 时 workspace:* 自动替换为真实版本。
- 应用：private: true 不发版，各自 CI 独立部署，互不阻塞。
- 提交规范：commitlint（conventional commits，@hili/commitlint-config）。

## 九、TypeScript 策略

- 全部包 tsconfig extends @hili/tsconfig 预设：solid（jsxImportSource solid-js）、vue（vue-tsc 校验）、lit、node。
- 预设间唯一易冲突点就是 JSX：solid 与 vue 的预设绝不互相引用，类型检查各包独立跑（turbo typecheck），从根上避免互染。
- 开发期包入口直指 src/index.ts（源码直引，改码即生效）；发布期 dist。

## 十、CI 要点

- ci.yml：install → turbo lint → turbo typecheck → turbo build（依赖图增量）。
- submodule-check：pnpm check:sub（指针漂移即失败），防止忘 update。
- 依赖规则校验（第四节的 boundary 规则）进 lint 阶段。

## 十一、后续路线

1. apps/web 初始化（SolidStart），迁移现有 hilihili-components demo 里的 PassportDemo / AccountDemo。
2. core 先行包：utils → crypto → request → storage（request 依赖 crypto 做签名注入）。
3. ui-solid：迁移 aether-ui（现 hilihili-components/src/components 的 ae- 前缀组件库）。
4. player-core 内核 + 弹幕引擎接口；comment(Lit) 评论组件。
5. apps/mobile 混合渲染骨架；apps/admin Vue 骨架。
6. CI 补全：boundary 依赖校验、changesets 自动发布、子域名部署流水线。
