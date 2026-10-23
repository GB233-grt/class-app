/**
 * 积分明细数据 Hook（按当前登录用户查询）
 */
import { useCallback, useEffect, useState } from 'react';
import { ledgerApi } from '../api';
import { useAuth } from './useAuth';
import { getErrorMessage } from '../lib/utils';
import type { LedgerEntry } from '../types';

export function useLedger() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      setEntries(await ledgerApi.listByStudent(profile.id));
    } catch (err) {
      setError(getErrorMessage(err, '获取积分明细失败'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}
