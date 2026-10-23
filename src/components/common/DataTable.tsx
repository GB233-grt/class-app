/**
 * 通用数据表格：列定义 + 空状态 + 加载状态
 */
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Spinner } from './Spinner';
import { EmptyState } from './States';

export interface DataTableColumn<T> {
  /** 列标题 */
  header: ReactNode;
  /** 单元格渲染 */
  render: (row: T) => ReactNode;
  /** 单元格附加类名 */
  className?: string;
  /** 表头附加类名 */
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyText?: string;
  emptyIcon?: Parameters<typeof EmptyState>[0]['icon'];
}

export function DataTable<T>({ columns, rows, rowKey, loading = false, emptyText = '暂无数据', emptyIcon }: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex justify-center rounded-xl border border-ink-100 bg-white py-14">
        <Spinner />
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyText} />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white shadow-soft">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className={cn(
                  'whitespace-nowrap bg-ink-50 px-4 py-3 text-left text-xs font-medium text-ink-500',
                  column.headerClassName,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-ink-100 transition-colors hover:bg-ink-50/50">
              {columns.map((column, index) => (
                <td key={index} className={cn('px-4 py-3 align-middle', column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
