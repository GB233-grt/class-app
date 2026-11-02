import { describe, expect, it } from 'vitest';
import {
  awardFormSchema,
  checkPasswordStrength,
  itemFormSchema,
  NEW_ITEM_FORM,
  passwordFormSchema,
  profileFormSchema,
  studentFormSchema,
} from './validation';

describe('checkPasswordStrength', () => {
  it('拒绝过短的密码', () => {
    expect(checkPasswordStrength('Aa1!')).toBe('密码长度不能少于 8 位');
  });

  it('缺少大写时给出对应提示', () => {
    expect(checkPasswordStrength('aa12345!')).toBe('密码必须包含大写英文字母');
  });

  it('缺少小写时给出对应提示', () => {
    expect(checkPasswordStrength('AA12345!')).toBe('密码必须包含小写英文字母');
  });

  it('缺少数字时给出对应提示', () => {
    expect(checkPasswordStrength('Aaabcdef!')).toBe('密码必须包含数字');
  });

  it('缺少特殊字符时给出对应提示', () => {
    expect(checkPasswordStrength('Aa1234567')).toBe('密码必须包含特殊字符（如 ! @ # $ %）');
  });

  it('满足全部规则时通过', () => {
    expect(checkPasswordStrength('Aa123456!')).toBeNull();
  });
});

describe('passwordFormSchema', () => {
  it('三个字段都必填', () => {
    const result = passwordFormSchema.safeParse({
      old_password: '',
      new_password: '',
      confirm_password: '',
    });
    expect(result.success).toBe(false);
  });

  it('填写完整时通过（一致性由表单 superRefine 之外的后端兜底）', () => {
    const result = passwordFormSchema.safeParse({
      old_password: 'old-pass',
      new_password: 'new-pass',
      confirm_password: 'new-pass',
    });
    expect(result.success).toBe(true);
  });
});

describe('profileFormSchema', () => {
  it('昵称必填', () => {
    expect(profileFormSchema.safeParse({ name: '   ', student_no: '' }).success).toBe(false);
  });

  it('昵称超过 20 字被拒绝', () => {
    expect(profileFormSchema.safeParse({ name: 'a'.repeat(21), student_no: '' }).success).toBe(false);
  });

  it('学号可以为空', () => {
    expect(profileFormSchema.safeParse({ name: '林小雨', student_no: '' }).success).toBe(true);
  });
});

describe('itemFormSchema', () => {
  const base = {
    ...NEW_ITEM_FORM,
    name: '学校笔记本',
    description: 'A5 硬壳',
    cost: '30',
    stock: '10',
  };

  it('实物商品合法', () => {
    expect(itemFormSchema.safeParse(base).success).toBe(true);
  });

  it('允许 0 积分的免费商品', () => {
    expect(itemFormSchema.safeParse({ ...base, cost: '0' }).success).toBe(true);
  });

  it('拒绝负数价格', () => {
    expect(itemFormSchema.safeParse({ ...base, cost: '-1' }).success).toBe(false);
  });

  it('网络商品必须填下载链接', () => {
    const result = itemFormSchema.safeParse({ ...base, type: 'digital', download_url: '' });
    expect(result.success).toBe(false);
  });

  it('网络商品填了下载链接就合法', () => {
    const result = itemFormSchema.safeParse({
      ...base,
      type: 'digital',
      download_url: 'https://example.com/a.pdf',
    });
    expect(result.success).toBe(true);
  });

  it('到期时间格式非法时被拒绝', () => {
    expect(itemFormSchema.safeParse({ ...base, expires_at: 'not-a-date' }).success).toBe(false);
  });

  it('到期时间为空表示永不过期', () => {
    expect(itemFormSchema.safeParse({ ...base, expires_at: '' }).success).toBe(true);
  });
});

describe('studentFormSchema', () => {
  const base = {
    name: '张三',
    student_no: 'S001',
    email: 'zhangsan@school.edu',
    password: '123456',
    points: '10',
    role: 'student' as const,
  };

  it('合法学生信息通过', () => {
    expect(studentFormSchema.safeParse(base).success).toBe(true);
  });

  it('邮箱格式错误被拒绝', () => {
    expect(studentFormSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });

  it('初始积分可以留空', () => {
    expect(studentFormSchema.safeParse({ ...base, points: '' }).success).toBe(true);
  });

  it('初始积分不能为负', () => {
    expect(studentFormSchema.safeParse({ ...base, points: '-5' }).success).toBe(false);
  });
});

describe('awardFormSchema', () => {
  it('积分数量必须大于 0', () => {
    const result = awardFormSchema.safeParse({ type: 'add', amount: '0', reason: '课堂表现' });
    expect(result.success).toBe(false);
  });

  it('原因必填', () => {
    const result = awardFormSchema.safeParse({ type: 'add', amount: '10', reason: '  ' });
    expect(result.success).toBe(false);
  });

  it('合法加分通过', () => {
    const result = awardFormSchema.safeParse({ type: 'add', amount: '10', reason: '课堂表现' });
    expect(result.success).toBe(true);
  });
});
