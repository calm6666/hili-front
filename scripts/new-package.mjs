#!/usr/bin/env node
// 包脚手架：node scripts/new-package.mjs <domain> <name> [description]
// 例：node scripts/new-package.mjs core player-danmaku "弹幕引擎"
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [domain, name, description = ''] = process.argv.slice(2);
if (!domain || !name) {
  console.error('usage: node scripts/new-package.mjs <core|ui|plugins> <name> [description]');
  process.exit(1);
}
const root = process.cwd();
const pkgDir = join(root, 'packages', domain, name);
if (existsSync(pkgDir)) {
  console.error(`已存在：${pkgDir}`);
  process.exit(1);
}

const pkgName = `@hili/${name}`;
const isVue = domain === 'ui' && name.includes('vue');
const tsconfigExt = domain === 'ui' ? (isVue ? '@hili/tsconfig/vue.json' : '@hili/tsconfig/solid.json') : '@hili/tsconfig/base.json';
// solid 预设带 DOM lib；ui 下非 vue 的包名未含 solid 也按 solid 处理（tsconfig 与 eslint 同步）
const eslintImport = domain === 'ui' && !isVue
  ? "import solid from '@hili/eslint-config/solid';\n\nexport default solid\n"
  : "import base from '@hili/eslint-config';\n\nexport default base\n";

mkdirSync(join(pkgDir, 'src'), { recursive: true });

writeFileSync(
  join(pkgDir, 'package.json'),
  JSON.stringify(
    {
      name: pkgName,
      version: '0.0.1',
      private: false,
      description,
      type: 'module',
      main: './src/index.ts',
      types: './src/index.ts',
      exports: { '.': './src/index.ts' },
      scripts: {
        build: 'tsup src/index.ts --format esm --dts --clean',
        typecheck: 'tsc --noEmit',
        lint: 'eslint .',
        'lint:fix': 'eslint . --fix'
      }
    },
    null,
    2
  ) + '\n'
);

writeFileSync(
  join(pkgDir, 'package.json'),
  (json => {
    const pkg = JSON.parse(json);
    pkg.devDependencies = { '@hili/tsconfig': 'workspace:*', '@hili/eslint-config': 'workspace:*' };
    return JSON.stringify(pkg, null, 2) + '\n';
  })(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
);

writeFileSync(
  join(pkgDir, 'tsconfig.json'),
  JSON.stringify({ extends: tsconfigExt, include: ['src'] }, null, 2) + '\n'
);

writeFileSync(join(pkgDir, 'eslint.config.js'), eslintImport);

writeFileSync(join(pkgDir, 'src/index.ts'), `export const PKG_NAME = '${pkgName}';\n`);

writeFileSync(join(pkgDir, 'README.md'), `# ${pkgName}\n\n${description || 'TODO'}\n`);

console.log(`created ${pkgDir} (${pkgName}, tsconfig: ${tsconfigExt})`);
