# hili-front 架构设计

> 2026-10-29 定稿（v3）。方案：pnpm workspace + Turborepo 主仓骨架，业务域按域聚合成 9 个独立 git 仓库，经 git submodule 挂载；播放器整包 nova-player 同样以域 submodule 挂载并注册进外层 workspace，由 turbo 拓扑统一构建。

## 一、方案选型结论

对比过四种主流形态：

1. 纯单仓 monorepo：联调体验最好，但无独立仓库与权限隔离。
2. meta 仓 + 全量 submodule（每包一仓）：边界最硬，但 submodule 数量爆炸、管理成本极高。
3. 多仓 + 私有 npm registry：版本治理规范，但联调要发版，迭代慢。
4. 单仓骨架 + 按域聚合 submodule（采用）：submodule 收敛到 9 个，域内多包共享 workspace 联调体验，域间独立 git、独立权限、独立版本、可单独 CI。

采用方案 4。若团队规模小且无权限隔离诉求，可退化成方案 1（删 .gitmodules 改单仓）。

## 二、仓库与子模块清单

| 子模块路径 | 内容 | 说明 |
|---|---|---|
| apps/web | @hili/web | PC 主站，SolidStart SSR（www 域） |
| apps/mobile | @hili/mobile | 移动端，SolidStart 混合渲染（m 域） |
| apps/spa | @hili/spa | PC CSR，Solid + Vite（live / activity 域） |
| apps/admin | @hili/admin | 后台管理，Vue 3.6 + Vue 组件库（admin 域） |
| apps/live | hili-live | 直播间，Solid CSR（消费 @lumina 播放器） |
| apps/member | hili-member | 个人中心，Solid CSR |
| packages/core | 4 个原语包 | utils、crypto、storage、shared-worker（零业务约定、近零第三方运行时） |
| packages/libs | 2 个能力库包 | request、websocket（带第三方运行时或重 IO 的能力放这里） |
| packages/ui | 9 个组件包 | ui-solid、ui-mobile-solid、ui-vue、biz-solid、biz-mobile-solid、biz-vue、comment（Lit）、theme-tokens、toast |
| packages/plugins | 3 个插件包 | tracker、error-monitor、perf-monitor |
| packages/nova-player | 播放器整包 | gitee 外部仓 submodule，内含 @lumina/nova、@lumina/plugins、@lumina/live-player 三包（见第十二节） |

域划分三原则（core 判定）：零业务约定、近零第三方运行时依赖、长期稳定。带第三方运行时（axios）或重 IO 的进 libs；带 UI 的进 ui；可插拔增强进 plugins；播放器这类自带构建体系的外部项目整包挂载，不拆不改。

主仓自有的部分：configs（tsconfig / eslint-config / commitlint / vite-preset 预设）、scripts（submodule 管理、包脚手架）、docs、CI 编排。

## 三、workspace 挂载方式（关键实现）

子仓目录直接作为 pnpm workspace 成员，pnpm-workspace.yaml：

```yaml
packages:
  - apps/*                        # 每个 app 子仓根 = 一个 workspace 包
  - packages/core/*               # core 子仓内每个目录 = 一个包
  - packages/libs/*
  - packages/ui/*
  - packages/plugins/*
  - packages/nova-player          # nova-player 仓根（lumina）也是 workspace 包
  - packages/nova-player/packages/*  # @lumina/nova / @lumina/plugins / @lumina/live-player
  - configs/*
```

注意：域子仓内部不放独立的 workspace 文件（nova-player 自身的 pnpm-workspace.yaml 与 pnpm-lock.yaml 已删除），全仓只有一个 pnpm workspace，避免双重 workspace 冲突。子仓边界是 git 边界，不是 workspace 边界。

## 四、分层依赖规则（CI 强制）

```
apps/*  →  ui/*  →  libs/*  →  core/*
   │                    ↑          ↑
   └→ plugins/*  ───────┴──────────┘（plugins 只依赖 core）
apps/live → nova-player（@lumina/*，独立构建体系，经 workspace:* 消费）
```

- core/*：原语域。禁止任何框架 import；必须 SSR-safe（禁止顶层访问 window / localStorage / document，统一 isBrowser() guard）；只允许依赖 utils。
- libs/*：能力库域。允许携带第三方运行时依赖（axios、websocket 等），必须 SSR-safe；可依赖 core。
- ui/*：允许依赖 core 与 libs；禁止依赖应用。
- nova-player：自带构建体系的外部项目，保持其内部结构（框架、播放器、插件、直播播放器），仅约定「包间依赖必须走 @lumina/nova 公开出口」，不并入分层规则。
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

- 全部包 tsconfig extends @hili/tsconfig 预设：base、dom（DOM lib，request/utils/websocket 等浏览器 API 包用）、solid（jsxImportSource solid-js）、vue（vue-tsc 校验）、lit、node。
- 预设间唯一易冲突点就是 JSX：solid 与 vue 的预设绝不互相引用，类型检查各包独立跑（turbo typecheck），从根上避免互染。
- 开发期包入口直指 src/index.ts（源码直引，改码即生效）；发布期 dist。

## 十、ESLint 体系

- 预设包 @hili/eslint-config：默认导出 base（js.recommended + tseslint.recommended + 自定义规则，对齐 hilihili-components/eslint.config.js），`@hili/eslint-config/solid` 导出 base + eslint-plugin-solid（含 ref 必须函数式写法的约束）。
- 每个包根放 eslint.config.js 两行引用对应预设，package.json 挂 lint / lint:fix；依赖全部收敛在预设包与根仓，包内零 eslint 依赖。
- 根仓 lint = `turbo run lint && eslint .`（turbo 分发各包 + 根级校验 scripts/*.mjs）。
- 新包用 `pnpm new:package` 生成，模板自带 eslint.config.js 与 lint 脚本。

## 十一、libs 请求与长连接包（已移植）

- @hili/utils（core）：caseConverter（toCamelCase / toSnakeCase / KeyConverter，深度键名转换 + 完整泛型映射）。
- @hili/request（libs）：axios ^1.21 基座。
  - 适配器顺序默认 `['fetch', 'xhr', 'http']`（axios 出厂是 `['xhr','http','fetch']`，显式反转）：现代浏览器与 Node 18+ SSR 走全局 fetch，无 fetch 的老浏览器回退 xhr，无全局 fetch 的旧 Node 回退 http。实例级 adapter 可覆盖。
  - 统一响应 ApiResponse<T>（code/message/data）+ HttpError（HTTP 错误统一转换，401 提示防抖 3s）+ shouldRetry 重试（maxRetries 默认 0）。
  - 驼峰转换：请求体/查询参数出站转 snake，响应转 camel；`convertCase`（实例级 + 请求级，boolean 或 {request, response}）可按方向关闭；`raw.get/post/...` 方法集整体关闭。
  - UI 反馈解耦：notifier 回调（onError/onSuccess）替代框架组件，core 层零框架依赖。
  - API 统一响应类型的定义位置：传输层类型（ApiResponse、ApiStatus、HttpError、RequestConfig 等）随 @hili/request 导出，与请求库同源演进；业务数据结构类型放各应用的 API 模块（泛型 T 注入），业务类型体量大后再拆独立 @hili/api-types 包。
  - SSR 注意：Node fetch 无 cookie jar，服务端请求需经 headers 显式转发客户端 Cookie。
- @hili/websocket（libs）：原 websocket.ts 移植，加 SSR 守卫（window/navigator/WebSocket 缺失时跳过对应逻辑），Node 22+（自带 WebSocket 全局）可直接实例化。

播放器（@lumina/*）类型不经 libs：各包 dist d.ts 已自包含（见第十二节），workspace 软链 + package.json types 直连，消费方零配置。

## 十二、播放器域（packages/nova-player）

gitee 外部仓（danding0000001/nova-player）以 submodule 挂载在 packages/nova-player，url 指向 gitee 远端；仓内三包注册进外层 workspace：

| 包 | 形态 | 产物 |
|---|---|---|
| @lumina/nova | 播放器内核 + Lumina 框架 | dist/index.js、lumina.js（框架运行时）、index.umd.js（CDN 单文件）、style.css |
| @lumina/plugins | 12 个插件，多入口 + preserveModules | 依赖方提供 @lumina/nova、dashjs、flv.js（external） |
| @lumina/live-player | 直播间 Web Component（自包含） | dist/index.js 单文件 |

关键约定与已落地的上游修正（本地 commit 86444d1，推送 gitee 前需确认）：

1. 删除 nova-player 自身 pnpm-workspace.yaml 与 pnpm-lock.yaml，依赖安装由外层 workspace 统一承担。
2. 仓根 build 更名 build:all：turbo 只认各包自身 build，拓扑排序由 turbo 依据 workspace 依赖图驱动，CI 一条 `turbo build` 完成第三方与播放器再构建应用。
3. 插件构建 external 补漏：插件源码此前用相对路径引 player 内部模块（PlayerStateKeyEnum、BrowserCapabilityDetector、detectManifestProtocol），导致 4 个 player 内部模块被打进插件 dist；现改为从 @lumina/nova 公开出口引用（nova 侧补了对应导出），dist/packages 泄漏清零。
4. 三包 devDeps 显式补 typescript（^6.0.3）与 @types/node：内部 workspace 根删除后包必须自持工具链。

已识别待上游确认的两项（暂不动）：

- live-player 去 self-contained：其源码引用框架内部符号（_reactiveText、createTypedStateManager、PluginManager、locale JSON 等），去内嵌需要把这些内部 API 提升为 nova 公开导出，属上游 API 面设计决策，确认后再实施。

d.ts 自包含已落地（本地 commit，推送 gitee 前需确认）：构建链新增「框架声明 emit + 引用改写」两步（根 tsconfig.framework.json + scripts/patch-dts.mjs，接入三包 build）。框架根目录（core / types / error / events / utils）声明统一 emit 到各包 dist/framework/；dist 内逃出包边界的引用改写为包内相对路径（框架域）或 @lumina/nova 公开出口（player 源码域，nova index 相应补了 RuntimeStateManager、PluginManager、PlayerEventBus 三个类型导出）。patch 对无法闭合的引用报错退出，防止新泄漏溜过构建。

apps/live 消费方式：package.json 声明 "@lumina/nova": "workspace:*" 等，运行时与类型均直接 import 包本体（软链 + package.json types 直连），消费方零配置。

## 十三、CI 要点

- ci.yml：install → turbo lint → turbo typecheck → turbo build（依赖图增量，含 @lumina 三包与应用的拓扑构建）。
- submodule-check：pnpm check:sub（指针漂移即失败），防止忘 update。
- 依赖规则校验（第四节 boundary 规则）进 lint 阶段。

## 十四、后续路线

1. core 包补齐：crypto（request 依赖其做签名注入）→ storage → shared-worker。
2. ui-solid：迁移 aether-ui（现 hilihili-components/src/components 的 ae- 前缀组件库）。
3. apps/web 已由官方 create-solid 模板初始化（SolidStart v2 + nitro v3，硬性要求 Node >=24，nvm 已切 24.16.0）；apps/live（端口 3001）/apps/member（端口 3002）由官方 Solid+Vite CSR 模板初始化；apps/mobile、apps/admin 仍为占位。
4. packages/plugins/tracker 已移植 spm 埋点（曝光/点击/停留/自动拦截）。
5. 播放器域已整包挂载（见第十二节）；富文本编辑器未来独立建仓后照同一模式接入（域 submodule + 外层 workspace + turbo 统一构建）。
6. nova-player 上游一项待确认：live-player 去 self-contained（需扩 nova 公开 API 面）。d.ts 自包含已落地（框架声明 emit + 引用改写，见第十二节）。
7. CI 补全：boundary 依赖校验、changesets 自动发布、子域名部署流水线。
