import type { UserConfig } from 'vite';

// 预留：统一 resolve.alias 的 workspace 源码直引、define 全局量、构建目标。
// 各应用 vite.config 里 `mergeConfig(hiliPreset, defineConfig({...}))` 使用。
export const hiliPreset: UserConfig = {
  build: {
    target: 'es2022',
    sourcemap: true
  }
};
