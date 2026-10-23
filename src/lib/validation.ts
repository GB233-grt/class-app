/**
 * 表单校验规则（zod）
 * 全部提示文案为中文。
 * 数值字段以字符串形式输入与校验（正则保证整数格式），提交时再转换为数字，
 * 以保持 zodResolver 输入/输出类型一致（resolvers 3.x 兼容做法）。
 */
import { z } from 'zod';

/** 正整数格式（用于积分价格、积分数量） */
const POSITIVE_INT = /^\d+$/;
/** 非负整数格式（用于库存、初始积分） */
const NON_NEGATIVE_INT = /^\d+$/;

/** 登录表单 */
export const loginSchema = z.object({
  email: z.string().min(1, '请输入邮箱').email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
});

export type LoginValues = z.infer<typeof loginSchema>;

/** 添加商品表单 */
export const itemFormSchema = z.object({
  name: z.string().trim().min(1, '请输入商品名称').max(50, '商品名称不能超过 50 个字'),
  description: z.string().trim().max(200, '商品描述不能超过 200 个字'),
  cost: z
    .string()
    .min(1, '请输入积分价格')
    .refine((v) => POSITIVE_INT.test(v), '积分价格必须是正整数')
    .refine((v) => Number(v) > 0, '积分价格必须大于 0'),
  stock: z
    .string()
    .min(1, '请输入库存')
    .refine((v) => NON_NEGATIVE_INT.test(v), '库存必须是非负整数'),
  image_url: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https?:\/\//.test(v), '图片地址需以 http:// 或 https:// 开头'),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

/** 创建学生表单 */
export const studentFormSchema = z.object({
  name: z.string().trim().min(1, '请输入学生姓名').max(20, '姓名不能超过 20 个字'),
  student_no: z.string().trim().max(20, '学号不能超过 20 个字'),
  email: z.string().min(1, '请输入邮箱').email('邮箱格式不正确'),
  password: z.string().min(6, '初始密码至少 6 位').max(32, '初始密码最多 32 位'),
  points: z
    .string()
    .refine((v) => v === '' || NON_NEGATIVE_INT.test(v), '初始积分必须是非负整数'),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;

/** 积分增减表单 */
export const awardFormSchema = z.object({
  type: z.enum(['add', 'deduct'], { required_error: '请选择调整类型' }),
  amount: z
    .string()
    .min(1, '请输入积分数量')
    .refine((v) => POSITIVE_INT.test(v), '积分数量必须是正整数')
    .refine((v) => Number(v) > 0, '积分数量必须大于 0'),
  reason: z.string().trim().min(1, '请填写变动原因').max(50, '变动原因不能超过 50 个字'),
});

export type AwardFormValues = z.infer<typeof awardFormSchema>;
