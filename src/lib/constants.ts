/**
 * 积分变动原因（可扩展枚举）
 *
 * 扩展方式：新增积分场景时，在此数组中追加一项即可（前端表单下拉/联想会自动同步）。
 * 数据库端 reason 为自由文本，无需迁移即可扩展。
 *
 * 系统自动写入的原因（不在此列）：
 *   - "兑换商品：<商品名>"  —— 学生兑换物品时自动记录
 *   - "初始积分"            —— 创建学生且初始积分 > 0 时自动记录
 */
export const POINT_REASONS: readonly string[] = [
  '课堂表现奖励',
  '作业完成奖励',
  '考试进步奖励',
  '活动参与奖励',
  '志愿服务奖励',
  '行为规范奖励',
  '积分调整',
  '积分惩罚',
  '其他',
] as const;

/** 登录页展示的演示账号邮箱（密码由管理员在 Supabase 后台设置） */
export const DEMO_ACCOUNTS = {
  admin: 'admin@school.edu',
  teacher: 'teacher@school.edu',
  student: 'student@school.edu',
} as const;

/** 项目作者（页脚「帮助」中展示） */
export const PROJECT_AUTHOR = 'GB233-grt(高兰圯)';

/** 页脚「系统消息」公告（新的放在前面即可） */
export const SYSTEM_MESSAGES: readonly { title: string; detail: string }[] = [
  {
    title: '教师工作台已上线',
    detail: '教师可确认兑换发放、给学生加减积分；学生兑换的物品需线下向教师领取。',
  },
  {
    title: 'Excel 批量导入已上线',
    detail: '管理员可在「新建用户 → Excel 批量导入」中一次导入整个班级名单（支持下载模板）。',
  },
  {
    title: '按数量兑换已上线',
    detail: '学生兑换商品时可自选数量，可选上限由剩余库存与可用积分共同决定。',
  },
];

/** 页脚「帮助」使用方法（按角色分栏） */
export const USAGE_GUIDE: readonly { role: string; points: readonly string[] }[] = [
  {
    role: '学生',
    points: [
      '登录后在「积分商店」选择商品与数量，确认合计积分后兑换',
      '「兑换记录」查看每笔兑换的发放状态（待发放 / 已发放）',
      '「积分明细」查看每一笔积分的来源与去处',
    ],
  },
  {
    role: '教师',
    points: [
      '登录后自动进入教师工作台',
      '「兑换发放」：核对学生后当面发放物品，点击「标记已发放」；误操作可「撤回」（不退积分）',
      '「学生加分」：输入姓名或学号搜索学生，快速加减积分并选择原因',
    ],
  },
  {
    role: '管理员',
    points: [
      '「商品管理」：上架 / 下架商品，维护积分价格与库存',
      '「新建用户」：单个创建，或用 Excel 表格批量导入整个班级',
      '「学生管理」：查看名单与积分，直接调整积分',
    ],
  },
];
