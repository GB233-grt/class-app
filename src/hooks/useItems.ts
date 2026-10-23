/**
 * 商品（物品）列表数据 Hook
 */
import { useCallback, useEffect, useState } from 'react';
import { itemsApi } from '../api';
import { getErrorMessage } from '../lib/utils';
import type { Item } from '../types';

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setItems(await itemsApi.list());
    } catch (err) {
      setError(getErrorMessage(err, '获取商品列表失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
