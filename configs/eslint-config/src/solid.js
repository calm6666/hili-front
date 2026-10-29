// 使用方：solid 项目的 eslint.config.js 里 `import solid from '@hili/eslint-config/solid'; export default solid`
import solid from 'eslint-plugin-solid'
import base from './index.js'

export default [
  ...base,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      solid
    },
    rules: {
      ...solid.configs.recommended.rules,

      // Solid JSX 约束：ref 必须使用函数式写法 ref={(el) => xxx = el}，
      // 禁止 ref={变量} 简写，保证源码里存在显式赋值语句
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='ref'][value.type='JSXIdentifier']",
          message: 'ref 必须使用函数式写法 ref={(el) => xxx = el}，禁止 ref={变量} 简写'
        }
      ]
    }
  }
]
