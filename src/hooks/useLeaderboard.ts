/**
 * 积分排行榜数据 Hook（学生端）
 */
import { useCallback, useEffect, useState } from 'react';
import { leaderboardApi } from '../api';
import { getErrorMessage } from '../lib/utils';
import type { LeaderboardEntry } from '../types';

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setEntries(await leaderboardApi.get());
    } catch (err) {
      setError(getErrorMessage(err, '获取排行榜失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}
