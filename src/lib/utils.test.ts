import { describe, expect, it } from 'vitest';
import {
  cn,
  formatDateTime,
  formatPoints,
  fromDateTimeLocalValue,
  getErrorMessage,
  toDateTimeLocalValue,
} from './utils';

describe('cn', () => {
  it('拼接真值并忽略假值', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});

describe('formatPoints', () => {
  it('添加千分位', () => {
    expect(formatPoints(1234)).toBe('1,234');
  });

  it('0 也能正常格式化', () => {
    expect(formatPoints(0)).toBe('0');
  });

  it('负数保留符号', () => {
    expect(formatPoints(-1234)).toBe('-1,234');
  });
});

describe('formatDateTime', () => {
  it('非法时间返回占位符', () => {
    expect(formatDateTime('not-a-date')).toBe('-');
  });

  it('输出 YYYY-MM-DD HH:mm', () => {
    const value = formatDateTime('2026-11-02T21:30:00+08:00');
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});

describe('toDateTimeLocalValue', () => {
  it('空值返回空串', () => {
    expect(toDateTimeLocalValue(null)).toBe('');
    expect(toDateTimeLocalValue(undefined)).toBe('');
  });

  it('非法时间返回空串', () => {
    expect(toDateTimeLocalValue('bad')).toBe('');
  });

  it('输出 datetime-local 需要的格式', () => {
    expect(toDateTimeLocalValue('2026-11-02T21:30:00+08:00')).toMatch(/^2026-11-02T\d{2}:\d{2}$/);
  });
});

describe('fromDateTimeLocalValue（与 toDateTimeLocalValue 互为逆运算）', () => {
  it('空值返回 null', () => {
    expect(fromDateTimeLocalValue('')).toBeNull();
    expect(fromDateTimeLocalValue(null)).toBeNull();
  });

  it('往返转换后时间一致', () => {
    const iso = new Date(2026, 10, 2, 21, 30).toISOString();
    const local = toDateTimeLocalValue(iso);
    const roundTrip = fromDateTimeLocalValue(local);
    expect(roundTrip).not.toBeNull();
    expect(new Date(roundTrip as string).getTime()).toBe(new Date(iso).getTime());
  });

  it('非法输入返回 null', () => {
    expect(fromDateTimeLocalValue('bad')).toBeNull();
  });
});

describe('getErrorMessage', () => {
  it('优先取 Error.message', () => {
    expect(getErrorMessage(new Error('出错了'))).toBe('出错了');
  });

  it('非空字符串直接使用', () => {
    expect(getErrorMessage('字符串错误')).toBe('字符串错误');
  });

  it('无法识别时回退到默认文案', () => {
    expect(getErrorMessage(undefined)).toBe('操作失败，请稍后重试');
    expect(getErrorMessage({}, '自定义兜底')).toBe('自定义兜底');
  });
});
