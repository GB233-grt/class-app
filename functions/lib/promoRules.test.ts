import { describe, expect, it } from 'vitest';
import { isWithinWindow, matchesAudience, validatePromoImage, validatePromoLink } from './promoRules';

describe('isWithinWindow', () => {
  const now = new Date('2026-11-16T12:00:00Z');

  it('两端为空时始终可见', () => {
    expect(isWithinWindow(null, null, now)).toBe(true);
  });

  it('未到开始时间不可见', () => {
    expect(isWithinWindow('2026-11-17T00:00:00Z', null, now)).toBe(false);
  });

  it('已过结束时间不可见', () => {
    expect(isWithinWindow(null, '2026-11-15T00:00:00Z', now)).toBe(false);
  });

  it('时间窗内可见', () => {
    expect(isWithinWindow('2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z', now)).toBe(true);
  });

  it('结束时间等于当前时刻视为过期', () => {
    expect(isWithinWindow(null, '2026-11-16T12:00:00Z', now)).toBe(false);
  });
});

describe('matchesAudience', () => {
  it('all 对所有人可见', () => {
    expect(matchesAudience('all', 'student')).toBe(true);
    expect(matchesAudience('all', 'teacher')).toBe(true);
  });

  it('student 只给学生', () => {
    expect(matchesAudience('student', 'student')).toBe(true);
    expect(matchesAudience('student', 'teacher')).toBe(false);
    expect(matchesAudience('student', 'super_admin')).toBe(false);
  });

  it('staff 给教师与管理员', () => {
    expect(matchesAudience('staff', 'teacher')).toBe(true);
    expect(matchesAudience('staff', 'admin')).toBe(true);
    expect(matchesAudience('staff', 'super_admin')).toBe(true);
    expect(matchesAudience('staff', 'student')).toBe(false);
  });
});

describe('validatePromoLink', () => {
  it('允许为空（纯展示）', () => {
    expect(validatePromoLink('')).toBeNull();
  });

  it('允许站内相对路径', () => {
    expect(validatePromoLink('/store')).toBeNull();
  });

  it('允许教育域名', () => {
    expect(validatePromoLink('https://www.example.edu.cn/hongyan')).toBeNull();
  });

  it('允许政务域名', () => {
    expect(validatePromoLink('https://www.gov.cn/zt/2026')).toBeNull();
  });

  it('拒绝 http 外链', () => {
    expect(validatePromoLink('http://example.edu.cn')).toContain('https');
  });

  it('拒绝白名单外的商业域名', () => {
    expect(validatePromoLink('https://shop.example.com/promo')).toContain('白名单');
  });

  it('拒绝协议相对路径 //evil.com', () => {
    expect(validatePromoLink('//evil.com/path')).not.toBeNull();
  });

  it('支持通过环境变量追加白名单', () => {
    expect(validatePromoLink('https://news.school.test/a', 'school.test')).toBeNull();
  });

  it('格式错误给出提示', () => {
    expect(validatePromoLink('不是链接')).toContain('格式');
  });
});

describe('validatePromoImage', () => {
  it('允许为空', () => {
    expect(validatePromoImage('')).toBeNull();
  });

  it('允许 https', () => {
    expect(validatePromoImage('https://cdn.example.com/a.webp')).toBeNull();
  });

  it('允许站内路径', () => {
    expect(validatePromoImage('/images/a.png')).toBeNull();
  });

  it('拒绝 http', () => {
    expect(validatePromoImage('http://cdn.example.com/a.png')).toContain('https');
  });

  it('拒绝 data 协议', () => {
    expect(validatePromoImage('data:image/png;base64,xxx')).not.toBeNull();
  });
});
