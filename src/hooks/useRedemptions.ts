/**
 * 兑换记录数据 Hook（按当前登录用户查询）
 */
import { useCallback, useEffect, useState } from 'react';
import { redemptionsApi } from '../api';
import { useAuth } from './useAuth';
import { getErrorMessage } from '../lib/utils';
import type { Redemption } from '../types';

export function useRedemptions() {
  const { profile } = useAuth();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      setRedemptions(await redemptionsApi.listByStudent(profile.id));
    } catch (err) {
      setError(getErrorMessage(err, '获取兑换记录失败'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { redemptions, loading, error, refresh };
}
