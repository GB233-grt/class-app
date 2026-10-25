/**
 * 兑换记录面板：历史兑换表格（含数量与发放状态）
 */
import { CheckCircle2, PackageCheck, ReceiptText } from 'lucide-react';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { ErrorNotice } from '../../common/States';
import { formatDateTime, formatPoints } from '../../../lib/utils';
import type { FulfillmentStatus, Redemption } from '../../../types';

interface RedemptionsPanelProps {
  redemptions: Redemption[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

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

const columns: DataTableColumn<Redemption>[] = [
  {
    header: '商品名称',
    render: (record) => <span className="font-medium text-ink-900">{record.item_name}</span>,
  },
  {
    header: '数量',
    render: (record) => <span className="text-ink-700">× {record.quantity ?? 1}</span>,
  },
  {
    header: '消耗积分',
    render: (record) => (
      <span className="font-semibold text-red-500">
        -{formatPoints((record.cost ?? 0) * (record.quantity ?? 1))}
      </span>
    ),
  },
  {
    header: '发放状态',
    render: (record) => <StatusBadge status={record.status} />,
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
