/**
 * 兑换发放面板（教师）：查看全部兑换记录，按状态筛选，标记已发放/撤回
 */
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, PackageCheck, RotateCcw } from 'lucide-react';
import { redemptionsApi } from '../../../api';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../common/Button';
import { Select } from '../../common/Select';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { ErrorNotice } from '../../common/States';
import { formatDateTime, formatPoints, getErrorMessage } from '../../../lib/utils';
import type { FulfillmentStatus, StaffRedemption } from '../../../types';

type StatusFilter = 'all' | FulfillmentStatus;

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: '待发放' },
  { value: 'fulfilled', label: '已发放' },
  { value: 'all', label: '全部记录' },
];

/** 发放状态徽章 */
function StatusBadge({ status }: { status: FulfillmentStatus }) {
  return status === 'fulfilled' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      已发放
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      <PackageCheck className="h-3.5 w-3.5" />
      待发放
    </span>
  );
}

export function FulfillmentPanel() {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [rows, setRows] = useState<StaffRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const refresh = useCallback(async (currentFilter: StatusFilter) => {
    try {
      setError(null);
      setLoading(true);
      setRows(
        await redemptionsApi.listForStaff(currentFilter === 'all' ? undefined : currentFilter),
      );
    } catch (err) {
      setError(getErrorMessage(err, '获取兑换记录失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(filter);
  }, [filter, refresh]);

  // 更新发放状态（撤回需二次确认；不退还积分，仅改状态）
  const handleUpdate = async (record: StaffRedemption, next: FulfillmentStatus) => {
    if (next === 'pending') {
      const ok = window.confirm(
        `确认将「${record.item_name} × ${record.quantity ?? 1}」撤回为待发放？\n` +
          '（仅改状态，不会退还积分）',
      );
      if (!ok) return;
    }
    setUpdatingId(record.id);
    try {
      await redemptionsApi.updateStatus(record.id, next);
      showToast('success', next === 'fulfilled' ? '已标记为已发放' : '已撤回为待发放');
      // 本地同步状态，避免整表刷新
      setRows((prev) =>
        prev.map((row) => (row.id === record.id ? { ...row, status: next } : row)),
      );
    } catch (err) {
      showToast('error', getErrorMessage(err, '状态更新失败，请稍后重试'));
    } finally {
      setUpdatingId(null);
    }
  };

  const columns: DataTableColumn<StaffRedemption>[] = [
    {
      header: '学生',
      render: (record) => (
        <div>
          <div className="font-medium text-ink-900">{record.students?.name ?? '未知学生'}</div>
          <div className="text-xs text-ink-400">{record.students?.student_no || '未设学号'}</div>
        </div>
      ),
    },
    {
      header: '物品名称',
      render: (record) => <span className="font-medium text-ink-900">{record.item_name}</span>,
    },
    {
      header: '数量',
      render: (record) => <span className="text-ink-700">× {record.quantity ?? 1}</span>,
    },
    {
      header: '合计积分',
      render: (record) => (
        <span className="font-semibold text-red-500">
          -{formatPoints((record.cost ?? 0) * (record.quantity ?? 1))}
        </span>
      ),
    },
    {
      header: '兑换时间',
      render: (record) => <span className="text-ink-500">{formatDateTime(record.created_at)}</span>,
    },
    {
      header: '发放状态',
      render: (record) => <StatusBadge status={record.status} />,
    },
    {
      header: '操作',
      render: (record) =>
        record.status === 'pending' ? (
          <Button
            size="sm"
            loading={updatingId === record.id}
            onClick={() => void handleUpdate(record, 'fulfilled')}
          >
            标记已发放
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            loading={updatingId === record.id}
            onClick={() => void handleUpdate(record, 'pending')}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            撤回
          </Button>
        ),
    },
  ];

  return (
    <div className="animate-fade-up space-y-4">
      {/* 状态筛选 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-40">
          <Select
            value={filter}
            onChange={(event) => setFilter(event.target.value as StatusFilter)}
            aria-label="按发放状态筛选"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-ink-400">
          学生兑换后需由教师当面发放物品，确认后标记「已发放」；误操作可撤回（不影响积分账目）。
        </p>
      </div>

      {error ? (
        <ErrorNotice message={error} onRetry={() => void refresh(filter)} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(record) => record.id}
          loading={loading}
          emptyText={filter === 'pending' ? '没有待发放的兑换记录' : '暂无兑换记录'}
          emptyIcon={PackageCheck}
        />
      )}
    </div>
  );
}
