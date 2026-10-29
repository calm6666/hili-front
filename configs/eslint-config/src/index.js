// 使用方：各包 eslint.config.js 里 `import base from '@hili/eslint-config'; export default base`
// 规则集对齐 hilihili-components/eslint.config.js
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  // 忽略的文件和目录
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'build/**',
      'coverage/**',
      '.output/**',
      '.nitro/**',
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
      '.turbo/**',
      '.vite/**'
    ]
  },

  // JavaScript 和 TypeScript 文件的基础配置
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // 自定义规则
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    rules: {
      // TypeScript 相关
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-as-const': 'error',

      // JavaScript 相关
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',

      // 代码风格
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'multi-line', 'consistent'],
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',

      // 导入/导出
      'no-duplicate-imports': 'error',

      // 注释
      'spaced-comment': ['warn', 'always', { markers: ['/'] }]
    }
  },

  // Node 环境脚本（构建/生成脚本）使用 Node 全局变量。
  // 显式内联声明，避免额外依赖 `globals` 包。
  {
    files: ['**/*.{mjs,cjs}', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        // Node 核心
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        module: 'writable',
        require: 'readonly',
        exports: 'writable',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        queueMicrotask: 'readonly',
        // Node 18+ 内置的 Web 标准全局
        fetch: 'readonly',
        WebSocket: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        AbortController: 'readonly',
        performance: 'readonly',
        structuredClone: 'readonly'
      }
    },
    rules: {
      // Node 脚本用 console 输出日志是预期行为
      'no-console': 'off',
      // CommonJS 脚本使用 require() 是其模块系统本身的写法
      '@typescript-eslint/no-require-imports': 'off'
    }
  },

  // Prettier 配置（放在最后以关闭格式类规则）
  prettier
)
