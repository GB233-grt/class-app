/**
 * 管理员统计概览数据 Hook
 */
import { useCallback, useEffect, useState } from 'react';
import { statsApi } from '../api';
import { getErrorMessage } from '../lib/utils';
import type { Stats } from '../types';

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setStats(await statsApi.get());
    } catch (err) {
      setError(getErrorMessage(err, '获取统计数据失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}
