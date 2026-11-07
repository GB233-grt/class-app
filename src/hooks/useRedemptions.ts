/**
 * 兑换记录数据 Hook（按当前登录用户查询，分页加载）
 */
import { useCallback, useEffect, useState } from 'react';
import { redemptionsApi } from '../api';
import { useAuth } from './useAuth';
import { getErrorMessage } from '../lib/utils';
import type { Redemption } from '../types';

/** 每页条数（后端上限 100） */
const PAGE_SIZE = 100;

export function useRedemptions() {
  const { profile } = useAuth();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const page = await redemptionsApi.listByStudent(profile.id, { limit: PAGE_SIZE, offset: 0 });
      setRedemptions(page.items);
      setHasMore(page.has_more);
    } catch (err) {
      setError(getErrorMessage(err, '获取兑换记录失败'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  /** 追加下一页（避免深翻页，不做全量拉取） */
  const loadMore = useCallback(async () => {
    if (!profile || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await redemptionsApi.listByStudent(profile.id, {
        limit: PAGE_SIZE,
        offset: redemptions.length,
      });
      setRedemptions((prev) => [...prev, ...page.items]);
      setHasMore(page.has_more);
    } catch (err) {
      setError(getErrorMessage(err, '加载更多兑换记录失败'));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, profile, redemptions.length]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { redemptions, loading, loadingMore, hasMore, error, refresh, loadMore };
}
