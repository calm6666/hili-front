# submodule 工作流指南

7 个业务域是独立 git 仓库，主仓通过 git submodule 关联。日常操作全部有 npm scripts 封装。

## 仓库角色

- 主仓（hili-front）：只记录每个子仓被「锁定在哪个 commit」，外加 configs / scripts / docs / CI。
- 子仓：真正的业务代码，有自己的分支、标签、提交历史。

## 新机器初始化

```bash
git clone <主仓地址>
cd hili-front
pnpm up:sub          # 等价 git submodule update --init --recursive
pnpm install
```

## 日常命令（npm scripts 封装）

| 命令 | 作用 |
|---|---|
| pnpm up:sub | 拉取/初始化全部子模块到主仓记录的指针 |
| pnpm st:sub | 查看每个子仓状态（+ 前缀 = 子仓 HEAD 领先主仓记录） |
| pnpm check:sub | CI 用：指针漂移或未初始化则退出码 1 |
| pnpm new:package <domain> <name> | 在域子仓内生成新包骨架 |

## 在子仓里开发（高频流程）

```bash
# 1. 子仓内正常开发、提交、推送
cd packages/core
git checkout -b feat/request-retry
git commit -am "feat(request): add retry"
git push origin feat/request-retry

# 2. 回主仓，把子模块指针推进到新 commit
cd ..
git add packages/core
git commit -m "chore(submodule): bump core"
git push
```

主仓的「提交子模块指针」这一步最容易忘。忘了的后果是：同事拉主仓后 pnpm up:sub 拿到的还是旧代码。防线：CI 的 submodule-check + 提交前 pnpm st:sub 看一眼有无 + 前缀。

## 当前阶段：本地路径关联

.gitmodules 里的 url 目前是本地相对路径（如 ./packages/core），用于未建远程仓库前本地跑通。正式化步骤：

```bash
# 1. Git 平台上创建 7 个空远程仓库（不要初始化 README）
# 2. 各子仓推送
cd packages/core
git remote add origin git@<host>:<org>/hili-core.git
git push -u origin main

# 3. 主仓替换 submodule url
cd ..
git submodule set-url packages/core git@<host>:<org>/hili-core.git
# 对 7 个子仓逐一执行后提交主仓
```

git submodule set-url 会同步更新 .gitmodules 与 git config，不要手改 .gitmodules。

## 建议的远程仓库命名

| 子仓 | 建议仓库名 |
|---|---|
| apps/web | hili-web |
| apps/mobile | hili-mobile |
| apps/spa | hili-spa |
| apps/admin | hili-admin |
| packages/core | hili-core |
| packages/ui | hili-ui |
| packages/plugins | hili-plugins |

## 陷阱备忘

1. clone 主仓后必须 pnpm up:sub，否则子目录是空的。
2. 切换主仓分支后同样要 pnpm up:sub（指针随分支走）。
3. 子仓里开发忘 push 就回主仓 bump 指针，同事会拉到不存在的 commit：先 push 子仓再 bump 主仓。
4. 删除子模块三步走：git rm <path>、清理 .gitmodules 对应段、清理 .git/modules/<path>。
