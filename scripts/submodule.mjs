#!/usr/bin/env node
// 子模块管理：pnpm up:sub / st:sub / check:sub
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const cmd = (args, opts = {}) => execFileSync('git', args, { encoding: 'utf8', ... opts }).trim();

function listSubmodules() {
  // `git config -f .gitmodules --get-regexp '^submodule\..*\.path$'` → submodule.<name>.path <path>
  try {
    const out = cmd(['config', '-f', '.gitmodules', '--get-regexp', '^submodule\\..*\\.path$']);
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split(' ')[1]);
  } catch {
    return [];
  }
}

function update() {
  cmd(['submodule', 'update', '--init', '--recursive']);
  console.log('submodules updated (init + recursive)');
}

function status() {
  const paths = listSubmodules();
  if (paths.length === 0) return console.log('no submodules registered');
  // `git submodule status` 前缀：' ' 一致，'+' 指针超前（子仓有新 commit 未在主仓记录），'-' 未初始化
  console.log(cmd(['submodule', 'status']));
  console.log('\n提示：+ 前缀表示子仓 HEAD 领先主仓记录的指针，记得回主仓提交一次。');
}

function check() {
  // CI 校验：不允许存在未初始化或指针漂移（+/-前缀）的子模块
  const out = cmd(['submodule', 'status']);
  const bad = out
    .split('\n')
    .filter(Boolean)
    .filter((line) => line.startsWith('+') || line.startsWith('-'));
  if (bad.length > 0) {
    console.error('submodule 指针不一致，请先 pnpm up:sub 并在主仓提交：');
    console.error(bad.join('\n'));
    process.exit(1);
  }
  console.log('submodules OK:', listSubmodules().length, 'modules in sync');
}

const action = process.argv[2];
if (action === 'update') update();
else if (action === 'status') status();
else if (action === 'check') check();
else {
  console.error('usage: node scripts/submodule.mjs <update|status|check>');
  process.exit(1);
}
