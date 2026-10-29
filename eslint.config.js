// 根仓 ESLint：校验 configs/、scripts/ 与根级 js 文件
// apps/* 与 packages/* 均为 submodule 挂载点，各自有自己的 eslint 预设与 lint 脚本，不参与本仓 lint
import base from './configs/eslint-config/src/index.js'

export default [
  { ignores: ['apps/**', 'packages/**'] },
  ...base
]
