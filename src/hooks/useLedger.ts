/**
 * 积分明细数据 Hook（按当前登录用户查询，分页加载）
 */
import { useCallback, useEffect, useState } from 'react';
import { ledgerApi } from '../api';
import { useAuth } from './useAuth';
import { getErrorMessage } from '../lib/utils';
import type { LedgerEntry } from '../types';

/** 每页条数（后端上限 100） */
const PAGE_SIZE = 100;

export function useLedger() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const page = await ledgerApi.listByStudent(profile.id, { limit: PAGE_SIZE, offset: 0 });
      setEntries(page.items);
      setHasMore(page.has_more);
    } catch (err) {
      setError(getErrorMessage(err, '获取积分明细失败'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const loadMore = useCallback(async () => {
    if (!profile || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await ledgerApi.listByStudent(profile.id, {
        limit: PAGE_SIZE,
        offset: entries.length,
      });
      setEntries((prev) => [...prev, ...page.items]);
      setHasMore(page.has_more);
    } catch (err) {
      setError(getErrorMessage(err, '加载更多积分明细失败'));
    } finally {
      setLoadingMore(false);
    }
  }, [entries.length, hasMore, loadingMore, profile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, loadingMore, hasMore, error, refresh, loadMore };
}
