# 商品类型升级：网络商品 + 实物商品 — 部署说明

> 上线时间：2026-11-01 | 前端 + 后端已部署，只需一次性执行数据库升级。

## 变更摘要

### 数据库（需手动执行）
新增文件 `database/migrations/09_item_types.sql`，作用于已在运行的 Supabase 数据库（增量升级，不删数据）：

1. **`items` 表新增字段**
   - `type text NOT NULL DEFAULT 'physical'`（`physical` 实物商品 / `digital` 网络商品）
   - `publish_date timestamptz`（网络商品发布日期）
   - `download_url text`（网络商品下载链接）
   - `download_limit integer NOT NULL DEFAULT 0`（下载次数限制，0=不限制）
   - 旧数据自动补全为 `physical`
2. **`redemptions` 表新增 `download_url`**（兑换时的下载链接快照）
3. **`redeem_item` 函数重写**：网络商品不扣库存，兑换后自动标记 `fulfilled` + 返回下载链接；实物商品保持原逻辑
4. **`update_redemption_status` 升级**：网络商品兑换记录禁止撤回为"待发放"

### 后端 API（已部署）
- `POST /api/items`：接收 `type`（物理/网络），网络商品强制要求 `download_url`
- `PUT /api/items/:id`：可修改类型、下载链接、下载次数限制
- `GET /api/redemptions`（教职工）：返回 `download_url`
- `translateDbError`：若误执行 SQL 升级前，提示 "请执行 migrations/09_item_types.sql"

### 前端（已部署）
- 管理员「商品管理」：添加/编辑商品时可选择 **实物商品 / 网络商品**；切换为网络商品后显示「下载链接」+「下载次数限制（0=不限制）」字段
- 学生「兑换商品」：网络商品卡片显示蓝色「网络商品」标签、不计库存，兑换成功提示"已关联下载链接，请到兑换记录查看"
- 学生「兑换记录」：表格新增「下载链接」列，点击直接跳转下载
- 教师「兑换发放」：带下载链接的兑换记录显示"系统已自动发放"，无操作按钮，防误撤回

## 必须执行的操作（1 分钟）

打开 Supabase 控制台 → SQL Editor → 粘贴 **`database/migrations/09_item_types.sql`** 全部内容 → 点击 **Run**。

> ⚠️ 如果零点升级时 Supabase 报错（如 `items.type` 列已存在或函数已存在），说明迁移已部分执行，请刷新页面后重新粘贴完整文件再次 Run。

执行后可在 **Management → Seed Data** 重新执行 `database/seed/03_create_items.sql` 或 `database/all-in-one/step2-seed.sql`，无需重新创建商品（`type`、`download_url` 字段已有默认值，但种子数据需要手动补全下载链接）。

## 种子数据
- `database/seed/03_create_items.sql` 和 `database/all-in-one/step2-seed.sql` 已各新增一个示例数字商品「答案解析网络版」，使用占位下载链接 `https://example.com/downloads/answers.zip`，上线后请替换为真实链接。
