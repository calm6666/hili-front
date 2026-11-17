/**
 * @hili/vite-preset —— 父项目统一 Vite 配置（单一真源）。
 *
 * 所有子应用（apps/*）默认都从这里取：CDN 开关/域名、静态资源目录名（konoha）、端口、
 * 部署基础路径、/api 代理目标、环境变量默认值。子应用仍可覆盖普通配置（推荐在
 * `resolveHiliConfig()` 结果上做局部覆盖）。
 *
 * 环境变量优先级（低 → 高）：
 *   本文件 projectConfig.env.base / env[mode]
 *   → projectConfig.apps[app].env
 *   → 仓库根 .env / .env.[mode]（父项目 .env）
 *   → 子应用目录 .env / .env.[mode]
 *   → 进程环境变量（CI 注入，如 CDN_BASE / CDN_RELEASE / VITE_*）
 *
 * 注意：本文件被各应用 vite.config 直接 import，运行在 Node 里（不做打包），
 * 因此必须保持单文件、只依赖 'vite' 与 node 内置模块。
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadEnv, type Plugin, type UserConfig } from 'vite';

export type HiliAppName = 'web' | 'live' | 'member' | 'spa' | 'mobile' | 'admin';

export interface HiliAppProjectConfig {
  /** 开发端口（vite server.port；也可用 VITE_PORT 覆盖） */
  port: number;
  /** 构建产物部署的基础路径（CDN 开启时拼在 CDN 域名之后；默认 '/'） */
  basePath?: string;
  /** 开发态基础路径（默认 '/'，admin 这类带子路径部署的应用可单独配） */
  devBasePath?: string;
  /** 静态资源目录（默认 `<assetsDirName>/assets`），子应用可单独覆盖 */
  assetsDir?: string;
  /** /api 代理目标：'api' = 父项目 api.proxyTarget；'env' = env.VITE_API_URL */
  proxyTarget?: 'api' | 'env';
  /** 代理时是否去掉 /api 前缀（admin 现状） */
  proxyStripPrefix?: boolean;
  /** 应用级环境变量默认值（会被 .env / 进程环境覆盖） */
  env?: Record<string, string>;
}

export interface HiliProjectConfig {
  /** 静态资源目录名前缀（全站统一；替换 SolidStart 硬编码的 `_build`） */
  assetsDirName: string;
  cdn: {
    /** 构建时是否启用 CDN（仍可用 CDN_BASE 进程变量覆盖） */
    enabled: boolean;
    /** 默认 CDN：JS/CSS/入口等（同时作为 Vite base）。为空则由 CI 的 CDN_BASE 提供 */
    base: string;
    /** 版本前缀（git sha / 日期）；仅拼接在默认 CDN 上，为空由 CDN_RELEASE 提供 */
    release: string;
    /** 图片 CDN（为空 = 跟随默认 CDN；配置独立域名后图片走独立域名，不加 release） */
    image: string;
    /** 视频点播 CDN（mp4/m3u8/分片等；为空 = 跟随默认） */
    video: string;
    /** 字体 CDN（为空 = 跟随默认） */
    font: string;
    /** 音频/其他媒体 CDN（为空 = 跟随默认） */
    media: string;
    /** 分片上传/直传域名（只给运行时用，不参与构建；为空 = 跟随默认 CDN 域名） */
    upload: string;
  };
  api: {
    /** 本地后端目标（member 分片上传等） */
    proxyTarget: string;
  };
  env: {
    base: Record<string, string>;
    development?: Record<string, string>;
    production?: Record<string, string>;
  };
  apps: Record<HiliAppName, HiliAppProjectConfig>;
}

export const projectConfig: HiliProjectConfig = {
  // 静态资源目录名：konoha（木叶，动漫《火影忍者》中的村落）；可在此改全局名字
  assetsDirName: 'konoha',
  cdn: {
    enabled: true,
    // 留空：默认本地构建（base 用 basePath）；CI 里用 CDN_BASE=//cdn.example.com 注入。
    // 默认同一个 CDN；需要按资源类型拆分时填 image/video/font/media（可被 CDN_*_BASE 进程变量覆盖）
    // 本地 MinIO 模拟参考（hosts + nginx）：
    //   base:   //cdn.hilihili.com.cn    （JS/CSS/入口，bucket: konoha）
    //   image:  //pic.hilihili.com.cn    （图片，bucket: pic）
    //   video:  //vod.hilihili.com.cn    （视频/HLS 分片，bucket: vod）
    //   upload: //upload.hilihili.com.cn （分片直传，bucket: upload）
    base: '',
    release: '',
    image: '',
    video: '',
    font: '',
    media: '',
    upload: '',
  },
  api: {
    proxyTarget: 'http://127.0.0.1:8081',
  },
  env: {
    base: {
      VITE_VERSION: '1.4.1',
      VITE_API_URL: 'https://xxxx.com',
      VITE_OPEN_ROUTE_INFO: 'false',
      VITE_LOCK_ENCRYPT_KEY: 'jfsfjk1938jfj',
      VITE_DROP_CONSOLE: 'true',
    },
    development: {
      VITE_API_URL: 'http://localhost:3003',
      VITE_DROP_CONSOLE: 'false',
    },
    production: {},
  },
  apps: {
    web: { port: 3000 },
    live: { port: 3001 },
    member: { port: 3002, proxyTarget: 'api' },
    spa: { port: 3003 },
    mobile: { port: 3004 },
    admin: {
      port: 3005,
      basePath: '/hili-admin/',
      devBasePath: '/',
      proxyTarget: 'env',
      proxyStripPrefix: true,
    },
  },
};

/** 从起始目录向上找 pnpm workspace 根（含 pnpm-workspace.yaml 的目录） */
export function findWorkspaceRoot(start: string): string {
  let current = start;
  for (;;) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}

/** 只保留会参与构建的变量，避免把整份进程环境塞进 define */
const isRelevantKey = (key: string): boolean =>
  key.startsWith('VITE_') || key.startsWith('CDN_');

function pickRelevant(source: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).filter(
      ([key, value]) => isRelevantKey(key) && value !== undefined
    ) as Array<[string, string]>
  );
}

export interface HiliEnvResult {
  /** 合并后的环境变量（含 VITE_* / CDN_*） */
  env: Record<string, string>;
  workspaceRoot: string;
  appRoot: string;
}

/** 合并父项目 env（配置 + 仓库根 .env）与子应用 .env；进程环境优先级最高 */
export function loadHiliEnv(
  app: HiliAppName,
  mode: string,
  appRoot: string = process.cwd()
): HiliEnvResult {
  const workspaceRoot = findWorkspaceRoot(appRoot);
  const modeEnv = projectConfig.env[mode as 'development' | 'production'] ?? {};
  const rootEnv = pickRelevant(loadEnv(mode, workspaceRoot, ''));
  const appEnv = pickRelevant(loadEnv(mode, appRoot, ''));
  const processEnv = pickRelevant(process.env);

  const env: Record<string, string> = {
    ...projectConfig.env.base,
    ...modeEnv,
    ...(projectConfig.apps[app].env ?? {}),
    ...rootEnv,
    ...appEnv,
    ...processEnv,
  };
  return { env, workspaceRoot, appRoot };
}

/** 去掉末尾斜杠（用于拼接） */
function stripSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** 按 URL 语义拼接，保证末尾一个斜杠 */
function joinUrl(...parts: string[]): string {
  const merged = parts.map(stripSlash).filter(part => part !== '');
  return `${merged.join('/')}/`;
}

/** 各类资源的 CDN 端点（解析后，均带末尾斜杠；未启用 CDN 时为空串） */
export interface HiliCdnEndpoints {
  /** 默认 CDN（含 release）：JS/CSS/入口/其他未分类资产，同时作为 Vite base */
  default: string;
  /** 图片 CDN（未单独配置时 = default） */
  image: string;
  /** 视频点播 CDN（未单独配置时 = default） */
  video: string;
  /** 字体 CDN（未单独配置时 = default） */
  font: string;
  /** 音频/其他媒体 CDN（未单独配置时 = default） */
  media: string;
  /** 分片上传/直传域名（未单独配置时 = 默认 CDN 域名，不含 release） */
  upload: string;
}

/** 与 Vite `experimental.renderBuiltUrl` 签名一致（Vite 官方 experimental 能力） */
export type HiliRenderBuiltAssetUrl = (
  filename: string,
  context: {
    type: 'asset' | 'public';
    hostId: string;
    hostType: 'js' | 'css' | 'html';
    ssr: boolean;
  }
) => string | undefined;

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv', 'mkv', 'm3u8', 'ts']);
const FONT_EXTENSIONS = new Set(['woff', 'woff2', 'ttf', 'otf', 'eot']);
const MEDIA_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']);

function extensionOf(filename: string): string {
  const clean = filename.split('?')[0] ?? '';
  const index = clean.lastIndexOf('.');
  return index === -1 ? '' : clean.slice(index + 1).toLowerCase();
}

/**
 * 构建期按扩展名把资源分到不同 CDN（图片/视频/字体/音频），
 * 用于 Vite `experimental.renderBuiltUrl`：
 * - 未启用 CDN 或该类端点与默认 CDN 相同 → 返回 undefined，交给 Vite 默认 base 处理；
 * - 否则返回 `<该类 CDN>/<文件名>`（文件名保持 `konoha/assets/...` 结构，各 bucket 镜像同一路径）。
 */
function createCdnRenderBuiltUrl(
  endpoints: HiliCdnEndpoints,
  defaultCdn: string
): HiliRenderBuiltAssetUrl {
  return (filename, context) => {
    // public/ 目录的绝对路径引用不在构建期重写（避免和运行时字符串引用不一致），只处理打包资产
    if (context.type !== 'asset') return undefined;
    const ext = extensionOf(filename);
    const target = IMAGE_EXTENSIONS.has(ext)
      ? endpoints.image
      : VIDEO_EXTENSIONS.has(ext)
        ? endpoints.video
        : FONT_EXTENSIONS.has(ext)
          ? endpoints.font
          : MEDIA_EXTENSIONS.has(ext)
            ? endpoints.media
            : endpoints.default;
    // 该类别没有独立 CDN（跟随默认）→ 交给 Vite 默认 base 处理
    if (!target || target === defaultCdn) return undefined;
    return `${stripSlash(target)}/${filename.replace(/^\/+/, '')}`;
  };
}

export interface HiliResolvedConfig {
  app: HiliAppName;
  /** 构建/开发用的 Vite base（CDN 构建时是完整 URL） */
  base: string;
  /** 静态资源目录（默认 konoha/assets） */
  assetsDir: string;
  /** 注入到 import.meta.env 的 define 表 */
  define: Record<string, string>;
  /** 合并后的环境变量（配置 + 父仓 .env + 子应用 .env + 进程环境） */
  env: Record<string, string>;
  /** 开发端口（VITE_PORT 可覆盖） */
  port: number;
  /** /api 代理目标（未配置代理时为空串） */
  apiTarget: string;
  /** 代理是否去掉 /api 前缀 */
  proxyStripPrefix: boolean;
  /** 默认 CDN（含 release；未启用时为空串） */
  cdnBase: string;
  /** 各类资源的 CDN 端点（图片/视频/字体/音频/上传可各自独立，未配置则跟随默认） */
  cdn: HiliCdnEndpoints;
  /** 构建期资源分流函数：交给 Vite `experimental.renderBuiltUrl` */
  renderBuiltUrl: HiliRenderBuiltAssetUrl;
}

/**
 * 解析某个子应用的实际 Vite 配置片段。
 *
 * @param app 应用名（web/mobile/spa/live/member/admin）
 * @param options.command Vite 的 command（build/serve）
 * @param options.mode Vite 的 mode（development/production/...）
 * @param options.appRoot 子应用根目录，默认 process.cwd()（vite 在子应用目录执行）
 */
export function resolveHiliConfig(
  app: HiliAppName,
  options: { command: string; mode: string; appRoot?: string }
): HiliResolvedConfig {
  const appRoot = options.appRoot ?? process.cwd();
  const appCfg = projectConfig.apps[app];
  const { env } = loadHiliEnv(app, options.mode, appRoot);

  const assetsDir = appCfg.assetsDir ?? `${projectConfig.assetsDirName}/assets`;
  const basePath = appCfg.basePath ?? '/';
  const devBase = appCfg.devBasePath ?? '/';

  // CDN：优先级 进程/文件 env（CI）> 父项目配置；空则退回本地 base
  const rawDefault = env.CDN_BASE || (projectConfig.cdn.enabled ? projectConfig.cdn.base : '');
  const release = env.CDN_RELEASE || projectConfig.cdn.release;
  const defaultCdn = rawDefault ? joinUrl(rawDefault, release) : '';
  const withDefault = (value: string | undefined, fallback: string): string =>
    value ? joinUrl(value) : fallback;

  const endpoints: HiliCdnEndpoints = {
    default: defaultCdn,
    image: withDefault(env.CDN_IMAGE_BASE || projectConfig.cdn.image, defaultCdn),
    video: withDefault(env.CDN_VIDEO_BASE || projectConfig.cdn.video, defaultCdn),
    font: withDefault(env.CDN_FONT_BASE || projectConfig.cdn.font, defaultCdn),
    media: withDefault(env.CDN_MEDIA_BASE || projectConfig.cdn.media, defaultCdn),
    // 上传域名：不拼 release（直传地址与版本无关）
    upload: (() => {
      const uploadRaw = env.CDN_UPLOAD_BASE || projectConfig.cdn.upload;
      if (uploadRaw) return joinUrl(uploadRaw);
      return rawDefault ? joinUrl(rawDefault) : '';
    })(),
  };

  const base =
    options.command === 'build'
      ? (defaultCdn ? joinUrl(defaultCdn, basePath) : basePath)
      : devBase;

  // 只把 VITE_* 暴露给 import.meta.env（CDN_* 等构建内部变量不进浏览器产物）
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('VITE_')) continue;
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }
  // 运行时需要的 CDN 端点（封面上传、视频分片、播放地址拼接等）
  define['import.meta.env.VITE_CDN_STATIC'] = JSON.stringify(endpoints.default);
  define['import.meta.env.VITE_CDN_IMAGE'] = JSON.stringify(endpoints.image);
  define['import.meta.env.VITE_CDN_VIDEO'] = JSON.stringify(endpoints.video);
  define['import.meta.env.VITE_CDN_FONT'] = JSON.stringify(endpoints.font);
  define['import.meta.env.VITE_CDN_MEDIA'] = JSON.stringify(endpoints.media);
  define['import.meta.env.VITE_CDN_UPLOAD'] = JSON.stringify(endpoints.upload);

  const port = Number(env.VITE_PORT ?? appCfg.port);
  const apiTarget =
    appCfg.proxyTarget === 'env'
      ? (env.VITE_API_URL ?? projectConfig.api.proxyTarget)
      : appCfg.proxyTarget === 'api'
        ? projectConfig.api.proxyTarget
        : '';

  return {
    app,
    base: base.endsWith('/') ? base : `${base}/`,
    assetsDir,
    define,
    env,
    port,
    apiTarget,
    proxyStripPrefix: appCfg.proxyStripPrefix ?? false,
    cdnBase: defaultCdn,
    cdn: endpoints,
    renderBuiltUrl: createCdnRenderBuiltUrl(endpoints, defaultCdn),
  };
}

/**
 * 所有子项目共享的产物输出配置（`build.rollupOptions.output`）：
 * - 文件名统一为 `name.hash`（点分隔）；
 * - 播放器 core/ui 与各插件独立分包（rolldown `codeSplitting`，与 `manualChunks` 互斥）；
 * - 其它 workspace 预构建 `dist` 包按目录/包名命名，避免出现 `dist.<hash>.js`。
 *
 * 用法：`rollupOptions: { output: resolveHiliBuildOutput(shared.assetsDir) }`
 */
export function resolveHiliBuildOutput(
  assetsDir: string = `${projectConfig.assetsDirName}/assets`
) {
  return {
    chunkFileNames: `${assetsDir}/[name].[hash].js`,
    codeSplitting: {
      groups: [
        { name: 'nova-ui-panels', test: /player[\\/]dist[\\/]chunks[\\/]ui-panels/, priority: 25 },
        { name: 'nova-ui', test: /player[\\/]dist[\\/]chunks[\\/]ui/, priority: 20 },
        { name: 'nova-core', test: /player[\\/]dist[\\/]chunks[\\/]core/, priority: 20 },
        { name: 'nova-plugin-audioeffect', test: /plugins[\\/]dist[\\/]audioeffect/ },
        { name: 'nova-plugin-danmaku', test: /plugins[\\/]dist[\\/]danmaku/ },
        { name: 'nova-plugin-dash', test: /plugins[\\/]dist[\\/]dash/ },
        { name: 'nova-plugin-ending', test: /plugins[\\/]dist[\\/]ending/ },
        { name: 'nova-plugin-interaction', test: /plugins[\\/]dist[\\/]interaction/ },
        { name: 'nova-plugin-interactive-video', test: /plugins[\\/]dist[\\/]interactive-video/ },
        { name: 'nova-plugin-music', test: /plugins[\\/]dist[\\/]music/ },
        { name: 'nova-plugin-subtitle', test: /plugins[\\/]dist[\\/]subtitle/ },
        { name: 'nova-plugin-top', test: /plugins[\\/]dist[\\/]top/ },
        { name: 'nova-plugins', test: /plugins[\\/]dist[\\/]index/ },
        { name: 'nova-plugin-hls', test: /packages[\\/]plugins[\\/]hls/ },
        { name: 'nova', test: /player[\\/]dist/, priority: 10 },
        { name: 'lottie', test: /lottie-web|icon-animations/ },
        { name: 'hili', test: /@hili[\\/]/ },
        { name: 'lib-vendor', test: /[\\/]dist[\\/]/ },
      ],
    },
  };
}

/**
 * SolidStart 专用：@solidjs/start 在其 plugin 的 config/configEnvironment 里把静态目录写死成
 * `_build/assets`（client 环境 + 根 build），并且配置钩子晚于用户配置执行。
 * 这里在 solidStart() 之后（plugins 数组顺序）再覆盖一次根 `build.assetsDir`，
 * 让现代 chunk 与 plugin-legacy 生成的 legacy chunk 都落到 `konoha/assets`。
 */
export function staticDirPlugin(
  assetsDir: string = `${projectConfig.assetsDirName}/assets`
): Plugin {
  return {
    name: 'hili:static-dir',
    config(_config, env) {
      if (env.command !== 'build') return;
      return { build: { assetsDir } };
    },
    configEnvironment(name, options) {
      if (name !== 'client') return;
      const build = (options.build ?? {}) as Record<string, unknown>;
      build.assetsDir = assetsDir;
      options.build = build;
    },
  } as Plugin;
}

/** 预留：统一构建约定的基础预设（子应用可用 mergeConfig 叠加） */
export const hiliPreset: UserConfig = {
  build: {
    sourcemap: true,
  },
};

export * from './solid-start-legacy.ts';

