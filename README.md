# 积分商城 · 学生积分奖励平台

一个面向学校/教育场景的学生积分奖励平台：学生通过良好表现获得积分，并用积分兑换学校商店中的奖励**物品**；管理员可以管理商品、学生和积分发放。

> 全部界面文案为中文；数据库使用 Supabase（PostgreSQL）；部署目标为 Cloudflare（Pages + Pages Functions）。

---

## 功能特性

### 学生端

- **积分余额卡片**：深色渐变背景、大字号积分、姓名问候语
- **统计数据**：已兑换商品数量、累计消耗积分
- **兑换商品**：卡片网格展示上架商品（名称、描述、积分价格、库存）；库存为 0 时按钮显示"已售罄"，积分不足时显示"积分不足"
  - 商品类型：`physical`（实物商品）/ `digital`（网络商品）
  - 网络商品不扣库存，兑换后自动标记"已发放"，学生在兑换记录中直接下载
- **兑换记录**：历史兑换表格（商品名、消耗积分、兑换时间、下载链接）
- **积分明细**：积分变动流水（原因、变动值、变动后余额、时间）

### 管理员端

- **统计概览**：商品目录数量、总库存单位数、发放给学生总积分
- **商品管理**：商品列表 + 添加商品（名称、描述、积分价格、库存、图片URL、**商品类型**、**网络商品下载链接**）+ 删除商品（软删除下架）
- 添加商品时可切换「实物商品」/「网络商品」：网络商品禁库存字段，需填写下载链接
- **学生管理**：学生列表 + 给指定学生增加/扣减积分（需填写原因，支持原因联想）
- **新建学生**：创建学生账号（同步创建 Supabase Auth 登录账号，可设初始积分）

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18 + Vite 5、Tailwind CSS、Lucide React、React Hook Form + Zod |
| 后端 | Cloudflare Pages Functions（Workers 运行时） |
| 数据库 | Supabase（托管 PostgreSQL） |
| 认证 | Supabase Auth（邮箱密码登录） |
| 部署 | Cloudflare Pages（静态站点 + Functions） |

---

## 项目结构

```
├── database/
│   ├── migrations/           # 建表 SQL（按序号在 Supabase SQL Editor 依次执行）
│   │   ├── 01_create_students.sql
│   │   ├── 02_create_items.sql
│   │   ├── 03_create_redemptions.sql
│   │   ├── 04_create_points_ledger.sql
│   │   ├── 05_create_functions.sql     # 积分调整/物品兑换原子函数 + updated_at 触发器
│   │   ├── 06_enable_rls.sql           # 行级安全（RLS）策略
│   │   ├── 07_teacher_and_fulfillment.sql  # 教师角色/数量兑换/发放状态
│   │   ├── 08_batch_points_adjust.sql  # 批量积分调整
│   │   └── 09_item_types.sql           # 商品类型（实物/网络）+ 下载链接
│   └── all-in-one/
│       ├── step1-schema.sql            # 一键建表（含全部表/函数/RLS）
│       └── step2-seed.sql              # 一键种子数据
│   └── seed/                 # 种子数据 SQL 模板（不自动执行，按需修改后手动执行）
│       ├── 01_create_admin.sql
│       ├── 02_create_students.sql
│       └── 03_create_items.sql
├── functions/                # Cloudflare Pages Functions（API 路由）
│   ├── api/
│   │   ├── _middleware.ts    # 统一 CORS 与异常兜底
│   │   ├── auth/             # login / me
│   │   ├── items/            # 列表 / 添加 / 删除
│   │   ├── students/         # 列表 / 创建 / 积分增减
│   │   ├── redemptions/      # 兑换 / 兑换记录
│   │   ├── ledger/           # 积分明细
│   │   └── stats.ts          # 管理员统计概览
│   └── lib/                  # 中间件（认证/权限）、HTTP 工具、Supabase 客户端工厂
├── src/                      # 前端源码
│   ├── api/                  # Fetch 客户端与接口定义
│   ├── components/           # common（通用 UI）、layout（导航栏）、feature（业务组件）
│   ├── hooks/                # useAuth / useToast / useItems / useStudents / ...
│   ├── lib/                  # supabase 客户端、工具函数、积分原因枚举、表单校验
│   ├── pages/                # LoginPage / StudentDashboard / AdminDashboard
│   └── types/                # TypeScript 类型定义
├── index.html
├── wrangler.toml             # Cloudflare Pages 配置
├── .env.example              # 前端环境变量模板
└── .dev.vars.example         # 本地 Functions 环境变量模板
```

---

## 快速开始

### 0. 环境准备

- Node.js ≥ 18
- 一个 [Supabase](https://supabase.com) 项目（免费版即可）
- （部署时）一个 [Cloudflare](https://dash.cloudflare.com) 账号

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
# 前端（Vite 注入，浏览器使用）
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

编辑 `.env`，填写：

| 变量 | 说明 | 获取位置 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase 项目 URL | Supabase 控制台 → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | 同上（anon public） |

再为本地后端准备变量（Cloudflare Pages Functions 使用）：

```bash
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars`，填写：

| 变量 | 说明 |
| --- | --- |
| `SUPABASE_URL` | 同 `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | 同 `VITE_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **服务角色密钥**（service_role，仅后端使用，切勿泄露/提交） |

> 两个文件均已被 `.gitignore` 忽略，不会进入版本库。

### 3. 数据库初始化（Supabase 控制台手动执行）

**① 执行建表脚本**

**全新库**：进入 Supabase 控制台 → **SQL Editor**，按文件名顺序依次粘贴执行 `database/all-in-one/step1-schema.sql` 和 `database/all-in-one/step2-seed.sql`。

**已有库升级**：按文件名顺序执行 `database/migrations/` 下未执行过的增量脚本（`07~09`）：

1. `07_teacher_and_fulfillment.sql` —— 教师角色 + 按数量兑换 + 发放状态流转
2. `08_batch_points_adjust.sql` —— 批量积分调整（Excel）
3. `09_item_types.sql` —— 商品类型（实物商品/网络商品）+ 网络商品自动发卡下载链接

> 每次升级后请重新部署（`npm run deploy`），使后端 API 与数据库结构匹配。

**② 创建登录账号（Authentication）**

进入 **Authentication → Users → Add user**，逐个手动创建账号并设置密码：

- 管理员：`admin@school.edu`（对应 seed 模板中的邮箱）
- 学生：`student@school.edu`、`student2@school.edu`

> 创建时建议勾选 **Auto Confirm User**（自动确认邮箱），否则登录会提示"邮箱尚未验证"。
> 邮箱必须与 seed 模板中的一致，或同步修改模板后再执行。

**③ 插入种子数据（可选）**

按顺序执行 `database/seed/` 下的 3 个模板：

1. `01_create_admin.sql` —— 插入管理员记录（通过邮箱自动关联 Auth 用户 ID）
2. `02_create_students.sql` —— 插入示例学生记录
3. `03_create_items.sql` —— 插入示例商品数据

> 这些文件只是**参考模板**，你可以自由增删改内容后再执行；
> 管理员/学生的 `students.id` 会自动对齐 `auth.users.id`（脚本通过邮箱子查询关联）。
> 如果执行后提示 0 rows affected，请确认已先创建对应邮箱的 Auth 用户。

### 4. 本地开发

```bash
# 方式一：前端热更新 + 本地 API（推荐）
npm run pages:dev     # 构建并在 http://localhost:8788 启动 Pages + Functions

# 方式二：双终端
npm run pages:dev     # 终端 1：本地 Functions（:8788）
npm run dev           # 终端 2：Vite 开发服务器（:5173，/api 自动代理到 8788）
```

打开 <http://localhost:5173>（方式二）或 <http://localhost:8788>（方式一），用步骤 3-② 创建的账号登录。

### 5. 构建

```bash
npm run build         # 产物输出到 dist/
npm run typecheck     # TypeScript 类型检查（前端 + Functions）
```

---

## 部署到 Cloudflare Pages

1. 将代码推送到 Git 仓库（GitHub / GitLab）
2. 进入 Cloudflare 控制台 → **Workers & Pages → Create → Pages → Connect to Git**，选择该仓库
3. 构建配置：
   - **Framework preset**：Vite（或 None）
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
4. **Settings → Environment variables** 添加（生产环境）：

   | 变量 | 类型 | 值 |
   | --- | --- | --- |
   | `SUPABASE_URL` | Text | Supabase 项目 URL |
   | `SUPABASE_ANON_KEY` | Text | Supabase 匿名密钥 |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Secret（加密）** | Supabase 服务角色密钥 |

5. 点击 **Deploy** 发布；`functions/` 目录会被自动识别为 Pages Functions，无需额外配置
6. （可选）绑定自定义域名：**Custom domains**

> 也可以命令行部署：`npm run deploy`（首次需 `wrangler login`）。

---

## API 接口一览

所有接口均需在请求头携带 `Authorization: Bearer <Supabase Access Token>`（前端 Fetch 客户端已自动附加）；错误统一返回 `{ "error": "中文提示" }`。

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | 邮箱密码登录（前端一般直接使用 Supabase SDK） | 公开 |
| GET | `/api/auth/me` | 获取当前用户资料 | 登录用户 |
| GET | `/api/items` | 商品列表（学生仅见上架商品，管理员见全部） | 登录用户 |
| POST | `/api/items` | 添加商品（含商品类型/下载链接） | 管理员 |
| PUT | `/api/items/:id` | 编辑商品（含商品类型/下载链接） | 管理员 |
| DELETE | `/api/items/:id` | 删除商品（软删除下架） | 管理员 |
| GET | `/api/students` | 学生列表 | 管理员 |
| POST | `/api/students` | 创建学生（含 Auth 账号） | 管理员 |
| POST | `/api/students/award` | 积分增减（原子操作，需原因） | 管理员 |
| POST | `/api/redemptions` | 兑换商品（原子操作：校验积分/库存 → 扣减 → 快照） | 登录用户 |
| GET | `/api/redemptions/:studentId` | 兑换记录 | 本人 / 管理员 |
| GET | `/api/ledger/:studentId` | 积分明细 | 本人 / 管理员 |
| GET | `/api/stats` | 统计概览（商品数/总库存/发放总积分/学生数） | 管理员 |

---

## 设计说明

### 数据一致性（防超卖/防余额错乱）

积分调整与物品兑换都封装在数据库函数中（`database/migrations/05_create_functions.sql`）：

- `adjust_student_points`：锁定学生行 → 校验余额 → 更新 → 写积分明细，单事务原子完成
- `redeem_item`：锁定商品行 → 校验上架/库存/积分 → 扣积分扣库存 → 写兑换记录（**商品名与价格快照**）→ 写积分明细
- 商品类型（`items.type`）：
  - `physical`（默认，旧数据自动补全）—— 有库存，兑换后状态为"待发放"，需教师标记已发放
  - `digital`（新）—— **不扣库存，兑换后自动标记"已发放"并下发下载链接（`download_url`）**，学生到兑换记录页下载
  - 教师工作台对带下载链接的兑换记录显示"系统已自动发放"，不可下架

兑换记录保存商品名/积分快照，商品后续修改或删除不会使历史记录失真。

### 安全模型

- 所有写操作经后端完成：普通写（商品/学生管理）使用 SERVICE_ROLE 密钥；学生侧变更（兑换、被调分）走 `SECURITY DEFINER` 数据库函数
- 已启用行级安全（RLS）：普通用户凭证只能读取自己的资料/记录；即使拿到 anon key 也无法直接改写数据
- 服务角色密钥只存在于 Cloudflare 环境变量 / 本地 `.dev.vars`，不进入前端代码

### 可扩展性

- **积分原因枚举**：管理员可选原因集中在 `src/lib/constants.ts`（`POINT_REASONS`），追加一项即可生效；数据库 `reason` 为自由文本，无需迁移。系统自动写入的原因：`兑换商品：<商品名>`、`初始积分`
- **角色扩展**：`students.role` 使用 CHECK 约束并预留扩展空间，未来可添加"教师"等角色（需同步调整约束与 `is_current_admin()` 逻辑）
- **分层架构**：API 路由（functions/api）→ 中间件（认证/权限）→ Supabase 客户端工厂，前端 likewise（api 客户端 → hooks → 组件），便于独立替换与测试
- **软删除**：商品使用 `is_active` 下架而非物理删除，外键 `RESTRICT` 保证历史记录完整

---

## 常见问题

**登录提示"邮箱或密码错误"？**
确认已在 Authentication → Users 中创建该邮箱的用户，且邮箱已确认（Auto Confirm）。

**登录提示"用户资料不存在"？**
`students` 表中没有该 Auth 用户对应记录。请执行 `database/seed/01_create_admin.sql`、`02_create_students.sql`（或自行插入，`id` 填 Auth 用户 ID）。

**提示"服务端缺少 SUPABASE_SERVICE_ROLE_KEY"？**
Cloudflare Pages 环境变量（或本地 `.dev.vars`）未配置服务角色密钥，配置后重新部署/重启。

**本地 `npm run dev` 时接口 404？**
`vite dev` 只启动前端；请同时运行 `npm run pages:dev` 启动本地 Functions（Vite 已配置 `/api` 代理到 8788），或直接使用 `npm run pages:dev` 打开 8788 端口。

**兑换提示"积分不足 / 商品库存不足"？**
为学生增加积分（管理员 → 学生管理）或补充库存（重新上架商品）。并发场景下数据库函数会保证不会超卖。

**如何修改演示商品/账号？**
直接编辑 `database/seed/` 下的 SQL 模板内容后执行；或登录管理员后台操作。

**为什么学生不能在前端直接用 Supabase Key 改积分？**
已通过 RLS 策略禁止：普通用户凭证对四张表只有 SELECT 权限，全部写操作必须经后端 API 与数据库函数完成。

**提示"该商品未配置下载链接，请联系管理员"？**
新式网络商品（`type=digital`）必须在管理员后台补全 `download_url`，否则不能兑换。

**网络商品能撤回为"待发放"吗？**
不能。网络商品兑换即发放，系统禁止撤回，确保学生始终能找到下载链接。

**如何添加一个网络商品？**
管理员 → 商品管理 → 添加商品 → 勾选「网络商品」→ 填写积分价格、下载链接（必填）→ 提交。后续学生兑换后直接在下拉列表中点击下载。

---

## 交付清单

- [x] 完整项目代码（React 18 前端 + Cloudflare Pages Functions API + Supabase SQL）
- [x] 全部配置文件（package.json、vite.config.ts、tailwind.config.js、postcss.config.js、tsconfig、wrangler.toml）
- [x] 数据库迁移文件（database/migrations/，含原子函数与 RLS）
- [x] 种子数据模板（database/seed/，不自动执行）
- [x] 中文 README（含数据库初始化与部署步骤）
- [x] 环境变量模板（.env.example、.dev.vars.example）
- [x] 全中文界面与注释
