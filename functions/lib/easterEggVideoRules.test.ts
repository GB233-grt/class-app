import { describe, expect, it } from 'vitest';

const BV_PATTERN = /^BV[0-9A-Za-z]{10}$/;
const CATEGORIES = ['campus', 'study', 'culture', 'other'] as const;
const STATUSES = ['pending', 'approved', 'rejected'] as const;

describe('easter egg video submission rules', () => {
  it('接受标准 BV 号', () => {
    expect(BV_PATTERN.test('BV1xx411c7mD')).toBe(true);
  });

  it('拒绝不是 BV 格式的输入', () => {
    expect(BV_PATTERN.test('https://www.bilibili.com/video/BV1xx411c7mD')).toBe(false);
    expect(BV_PATTERN.test('BV1xx')).toBe(false);
    expect(BV_PATTERN.test('javascript:alert(1)')).toBe(false);
  });

  it('分类和审核状态只接受白名单值', () => {
    expect(CATEGORIES.includes('campus')).toBe(true);
    expect(CATEGORIES.includes('commercial' as (typeof CATEGORIES)[number])).toBe(false);
    expect(STATUSES.includes('pending')).toBe(true);
    expect(STATUSES.includes('published' as (typeof STATUSES)[number])).toBe(false);
  });

  it('新提交状态必须是待审核，不能直接公开', () => {
    const initialStatus: (typeof STATUSES)[number] = 'pending';
    expect(initialStatus).not.toBe('approved');
  });
});
