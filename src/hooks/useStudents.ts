/**
 * 学生列表数据 Hook（管理员端）
 */
import { useCallback, useEffect, useState } from 'react';
import { studentsApi } from '../api';
import { getErrorMessage } from '../lib/utils';
import type { Student } from '../types';

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setStudents(await studentsApi.list());
    } catch (err) {
      setError(getErrorMessage(err, '获取学生列表失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { students, loading, error, refresh };
}
