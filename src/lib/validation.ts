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

/** 添加商品表单（实物商品的库存 / 网络商品的下载链接二选一） */
export const itemFormSchema = z
  .object({
    name: z.string().trim().min(1, '请输入商品名称').max(50, '商品名称不能超过 50 个字'),
    description: z.string().trim().max(200, '商品描述不能超过 200 个字'),
    cost: z
      .string()
      .min(1, '请输入积分价格')
      .refine((v) => NON_NEGATIVE_INT.test(v), '积分价格必须是非负整数（0 表示免费）'),
    stock: z
      .string()
      .min(1, '请输入库存')
      .refine((v) => NON_NEGATIVE_INT.test(v), '库存必须是非负整数'),
    image_url: z
      .string()
      .trim()
      .refine((v) => v === '' || /^https?:\/\//.test(v), '图片地址需以 http:// 或 https:// 开头'),
    /** 商品类型：physical=实物商品，digital=网络商品 */
    type: z.enum(['physical', 'digital'], { required_error: '请选择商品类型' }),
    /** 下载链接（网络商品必填） */
    download_url: z.string().trim(),
    /** 下载次数限制（0=不限制；网络商品必填） */
    download_limit: z
      .string()
      .refine((v) => v === '' || NON_NEGATIVE_INT.test(v), '下载次数限制必须是非负整数'),
    /** 上架状态：true=已上架，false=已下架（先存草稿） */
    is_active: z.boolean(),
    /** 到期时间（datetime-local 字符串；空 = 永不过期） */
    expires_at: z
      .string()
      .refine((v) => v === '' || !Number.isNaN(new Date(v).getTime()), '到期时间格式不正确'),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'digital') {
      if (!data.download_url || data.download_url.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '网络商品必须提供下载链接',
          path: ['download_url'],
        });
      }
    }
  });

export type ItemFormValues = z.infer<typeof itemFormSchema>;

/** 新建商品的表单空值（实物商品作为默认类型） */
export const NEW_ITEM_FORM: ItemFormValues = {
  name: '',
  description: '',
  cost: '',
  stock: '',
  image_url: '',
  type: 'physical',
  download_url: '',
  download_limit: '',
  is_active: true,
  expires_at: '',
};

/** 密码强度规则（8 位以上 + 大小写 + 数字 + 特殊字符） */
export const passwordStrengthExp = {
  minLength: 8,
  upper: /[A-Z]/,
  lower: /[a-z]/,
  digit: /[0-9]/,
  special: /[!@#$%^&*()_\-+=\[\]{};:'"\\|,.<>\/?~`]/,
};

/** 校验新密码强度，返回 null 表示通过 */
export function checkPasswordStrength(password: string): string | null {
  if (password.length < passwordStrengthExp.minLength) {
    return `密码长度不能少于 ${passwordStrengthExp.minLength} 位`;
  }
  if (!passwordStrengthExp.upper.test(password)) return '密码必须包含大写英文字母';
  if (!passwordStrengthExp.lower.test(password)) return '密码必须包含小写英文字母';
  if (!passwordStrengthExp.digit.test(password)) return '密码必须包含数字';
  if (!passwordStrengthExp.special.test(password)) return '密码必须包含特殊字符（如 ! @ # $ %）';
  return null;
}

/** 修改密码表单 */
export const passwordFormSchema = z.object({
  old_password: z.string().min(1, '请输入旧密码'),
  new_password: z.string().min(1, '请输入新密码'),
  confirm_password: z.string().min(1, '请再次确认新密码'),
});

export type PasswordFormValues = z.infer<typeof passwordFormSchema>;

/** 个人资料修改表单 */
export const profileFormSchema = z.object({
  name: z.string().trim().min(1, '请输入昵称').max(20, '昵称不能超过 20 个字'),
  student_no: z.string().trim().max(20, '学号不能超过 20 个字'),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

/** 创建学生/教师表单 */
export const studentFormSchema = z.object({
  name: z.string().trim().min(1, '请输入姓名').max(20, '姓名不能超过 20 个字'),
  student_no: z.string().trim().max(20, '学号不能超过 20 个字'),
  email: z.string().min(1, '请输入邮箱').email('邮箱格式不正确'),
  password: z.string().min(6, '初始密码至少 6 位').max(32, '初始密码最多 32 位'),
  points: z
    .string()
    .refine((v) => v === '' || NON_NEGATIVE_INT.test(v), '初始积分必须是非负整数'),
  role: z.enum(['student', 'teacher']).default('student'),
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

/** 教师端积分奖励表单（在通用积分表单基础上增加学生选择） */
export const teacherAwardFormSchema = awardFormSchema.extend({
  student_id: z.string().min(1, '请选择学生'),
});

export type TeacherAwardFormValues = z.infer<typeof teacherAwardFormSchema>;
