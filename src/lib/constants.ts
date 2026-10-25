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
