/**
 * 模板在线预览：以表格形式展示导入模板的列头、示例行与填写说明，
 * 无需下载 .xlsx 即可对照格式填表。
 */
interface TemplatePreviewProps {
  columns: string[];
  rows: (string | number)[][];
  notes?: string[];
}

export function TemplatePreview({ columns, rows, notes }: TemplatePreviewProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-100 bg-white">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="whitespace-nowrap border-b border-ink-100 bg-ink-50 px-3 py-2 text-left text-xs font-medium text-ink-500"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-ink-50 last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="whitespace-nowrap px-3 py-2 text-ink-600">
                  {cell === '' ? <span className="text-ink-300">（留空）</span> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {notes && notes.length > 0 && (
        <ul className="space-y-1 border-t border-ink-100 bg-ink-50/60 px-4 py-3 text-xs leading-relaxed text-ink-500">
          {notes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
