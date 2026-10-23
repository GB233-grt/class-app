/**
 * 积分明细面板：积分变动流水表格
 */
import { ScrollText } from 'lucide-react';
import { useLedger } from '../../../hooks/useLedger';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { ErrorNotice } from '../../common/States';
import { cn, formatDateTime, formatPoints } from '../../../lib/utils';
import type { LedgerEntry } from '../../../types';

const columns: DataTableColumn<LedgerEntry>[] = [
  {
    header: '变动原因',
    render: (entry) => <span className="text-ink-700">{entry.reason}</span>,
  },
  {
    header: '变动值',
    render: (entry) => (
      <span className={cn('font-semibold', entry.delta > 0 ? 'text-brand-600' : 'text-red-500')}>
        {entry.delta > 0 ? '+' : ''}
        {formatPoints(entry.delta)}
      </span>
    ),
  },
  {
    header: '变动后余额',
    render: (entry) => <span className="text-ink-700">{formatPoints(entry.balance_after)}</span>,
  },
  {
    header: '时间',
    render: (entry) => <span className="text-ink-500">{formatDateTime(entry.created_at)}</span>,
  },
];

export function LedgerPanel() {
  const { entries, loading, error, refresh } = useLedger();

  if (error) {
    return <ErrorNotice message={error} onRetry={() => void refresh()} />;
  }
  return (
    <div className="animate-fade-up">
      <DataTable
        columns={columns}
        rows={entries}
        rowKey={(entry) => entry.id}
        loading={loading}
        emptyText="暂无积分明细"
        emptyIcon={ScrollText}
      />
    </div>
  );
}
