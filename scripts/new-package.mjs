#!/usr/bin/env node
// 包脚手架：node scripts/new-package.mjs <domain> <name> [description]
// 例：node scripts/new-package.mjs core player-danmaku "弹幕引擎"
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
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
const tsconfigExt = domain === 'ui' ? (name.includes('vue') ? '@hili/tsconfig/vue.json' : '@hili/tsconfig/solid.json') : '@hili/tsconfig/base.json';

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
        typecheck: 'tsc --noEmit'
      }
    },
    null,
    2
  ) + '\n'
);

writeFileSync(
  join(pkgDir, 'tsconfig.json'),
  JSON.stringify({ extends: tsconfigExt, include: ['src'] }, null, 2) + '\n'
);

writeFileSync(join(pkgDir, 'src/index.ts'), `export const PKG_NAME = '${pkgName}';\n`);

writeFileSync(join(pkgDir, 'README.md'), `# ${pkgName}\n\n${description || 'TODO'}\n`);

console.log(`created ${pkgDir} (${pkgName}, tsconfig: ${tsconfigExt})`);
