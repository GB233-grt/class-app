/**
 * 兑换记录面板：历史兑换表格（含数量、发放状态、网络商品下载链接）
 */
import { CheckCircle2, ExternalLink, PackageCheck, ReceiptText } from 'lucide-react';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { ErrorNotice } from '../../common/States';
import { Button } from '../../common/Button';
import { formatDateTime, formatPoints } from '../../../lib/utils';
import type { FulfillmentStatus, Redemption } from '../../../types';

interface RedemptionsPanelProps {
  redemptions: Redemption[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** 是否还有下一页（后端分页） */
  hasMore?: boolean;
  /** 正在加载下一页 */
  loadingMore?: boolean;
  /** 加载下一页 */
  onLoadMore?: () => void;
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

/** 有效下载链接按钮（网络商品） */
function DownloadButton({ url, label }: { url: string; label?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {label || '下载'}
    </a>
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
    header: '下载链接',
    render: (record) =>
      record.status === 'fulfilled' && record.download_url ? (
        <DownloadButton url={record.download_url} label="点击下载" />
      ) : (
        <span className="text-xs text-ink-400">—</span>
      ),
  },
  {
    header: '兑换时间',
    render: (record) => <span className="text-ink-500">{formatDateTime(record.created_at)}</span>,
  },
];

export function RedemptionsPanel({
  redemptions,
  loading,
  error,
  onRetry,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: RedemptionsPanelProps) {
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
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" loading={loadingMore} onClick={onLoadMore}>
            加载更多兑换记录
          </Button>
        </div>
      )}
    </div>
  );
}
