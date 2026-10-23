/**
 * 兑换记录面板：历史兑换表格
 */
import { ReceiptText } from 'lucide-react';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { ErrorNotice } from '../../common/States';
import { formatDateTime, formatPoints } from '../../../lib/utils';
import type { Redemption } from '../../../types';

interface RedemptionsPanelProps {
  redemptions: Redemption[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const columns: DataTableColumn<Redemption>[] = [
  {
    header: '商品名称',
    render: (record) => <span className="font-medium text-ink-900">{record.item_name}</span>,
  },
  {
    header: '消耗积分',
    render: (record) => (
      <span className="font-semibold text-red-500">-{formatPoints(record.cost)}</span>
    ),
  },
  {
    header: '兑换时间',
    render: (record) => <span className="text-ink-500">{formatDateTime(record.created_at)}</span>,
  },
];

export function RedemptionsPanel({ redemptions, loading, error, onRetry }: RedemptionsPanelProps) {
  if (error) {
    return <ErrorNotice message={error} onRetry={onRetry} />;
  }
  return (
    <div className="animate-fade-up">
      <DataTable
        columns={columns}
        rows={redemptions}
        rowKey={(record) => record.id}
        loading={loading}
        emptyText="暂无兑换记录"
        emptyIcon={ReceiptText}
      />
    </div>
  );
}
