<p align="center">
  <b>简体中文</b> | <a href="./CONTRIBUTING.en.md">English</a>
</p>

# 贡献指南

感谢你愿意花时间改进这个项目。本文档说明如何搭建环境、提交改动，以及什么样的 Issue 适合第一次参与。

## 目录

- [第一次参与？从这些开始](#第一次参与从这些开始)
- [开发环境](#开发环境)
- [分支与提交规范](#分支与提交规范)
- [数据库变更规则](#数据库变更规则)
- [提交前检查](#提交前检查)
- [Pull Request 流程](#pull-request-流程)
- [代码风格](#代码风格)

---

## 第一次参与？从这些开始

不用一上来就啃核心逻辑，下面这些改动小、边界清晰、不需要数据库权限，非常适合作为第一个 PR：

| 类型 | 具体例子 | 涉及文件 |
| --- | --- | --- |
| 📝 文档 | 补充某条报错的排查步骤、修正错别字、把命令换成 Windows 写法 | `README.md`、`README.en.md` |
| 🎨 文案 | 让提示语更清楚（例如把「操作失败」换成具体原因） | `src/components/**` |
| ♿ 可用性 | 给按钮补 `aria-label`、改善键盘 Tab 顺序 | `src/components/common/**` |
| 🧪 测试 | 给 `src/lib/` 下的纯函数补边界用例 | `src/lib/*.test.ts` |
| 🌐 国际化 | 帮忙校对 `README.en.md` 的措辞 | `README.en.md` |
| 🐛 小修复 | 空状态文案、移动端换行、图标对齐 | 见 Issue 列表 |

> 带 [`good first issue`](https://github.com/GB233-grt/class-app/labels/good%20first%20issue) 标签的 Issue 是在等你的。
> 想认领某个 Issue，直接在下面回一句「我来试试」即可，不需要等批准。

**不建议**第一次就动的部分：`database/migrations/` 里的数据库函数（涉及积分与库存的原子性，改错会影响真实数据）。

---

## 开发环境

```bash
git clone https://github.com/GB233-grt/class-app.git
cd class-app
npm install

cp .env.example .env
cp .dev.vars.example .dev.vars
```

两份变量文件的填写方式见 [README 的配置说明](README.md#配置说明)。数据库初始化见 [README 的快速开始](README.md#快速开始)。

启动：

```bash
npm run pages:dev     # 前端 + 本地 API（:8788）
npm run dev           # 仅前端热更新（:5173，需另开 pages:dev）
```

---

## 分支与提交规范

分支命名：

```
feat/短描述        新功能
fix/短描述         缺陷修复
docs/短描述        文档
refactor/短描述    重构
```

提交信息采用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat: 商品支持按到期时间自动下架
fix: 网络商品兑换后未扣减库存
docs: 补充 Windows 下的环境变量复制命令
refactor: 抽出日期时间转换工具函数
```

一条提交只做一件事；格式化导致的无关改动请单独提交。

---

## 数据库变更规则

1. **只增不改**：已发布的 `database/migrations/NN_xxx.sql` 不要修改，新增 `NN+1_xxx.sql`
2. 脚本必须可重复执行（用 `IF NOT EXISTS` / `DROP POLICY IF EXISTS` / `CREATE OR REPLACE`）
3. 涉及函数重写时，在脚本头部注释说明「本脚本是否已包含之前脚本的修复」
4. 同步更新 `database/all-in-one/step1-schema.sql`，保证全新部署与增量升级结果一致
5. 发 PR 前请在空库上从头跑一遍 `all-in-one`，确认没有顺序依赖问题

> 兑换与积分相关的改动，请同时补充 `database/tests/redeem_item.test.sql` 中的场景，并在 Supabase SQL Editor 里跑通（脚本自带事务与 ROLLBACK，不会污染数据）。

---

## 提交前检查

```bash
npm run typecheck   # TypeScript（前端 + Functions）
npm test            # 单元测试
npm run build       # 生产构建
```

三项都通过再提交。CI 会重复执行同样的检查，本地通过可以省一轮等待。

---

## Pull Request 流程

1. Fork 仓库，从 `main` 切出分支
2. 完成改动并自测
3. 发起 PR，填写模板里的信息：
   - 解决了什么问题（关联 Issue）
   - 影响范围（学生端 / 教师端 / 管理端 / 数据库）
   - 怎么验证的（尤其是权限相关改动）
4. 涉及 UI 的改动请附上改动前后的截图
5. Review 通过后由维护者合并

PR 不需要写得完美，**说明清楚动机和验证方式**比代码量更重要。

---

## 代码风格

- TypeScript 严格模式，避免 `any`
- 函数组件 + Hooks，业务逻辑抽到 `src/hooks/`
- 样式统一用 Tailwind 原子类，不写额外 CSS 文件
- 注释与界面文案使用中文（与现有代码一致）
- 组件按 `common`（通用）/ `layout`（布局）/ `feature`（业务）三层放置

提交前不需要手动格式化，保持与周围代码风格一致即可。
