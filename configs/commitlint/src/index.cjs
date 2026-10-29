// 使用方：主仓 commitlint.config.cjs 里 `module.exports = { extends: ['@hili/commitlint-config'] };`
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [0],
    'subject-case': [0]
  }
};
