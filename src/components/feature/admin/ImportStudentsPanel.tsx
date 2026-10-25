/**
 * Excel 批量导入面板（内容区，外层 Card 由 CreateStudentPanel 提供）：
 * 选择文件 → 校验预览（每行状态与原因）→ 逐个创建 → 结果反馈
 */
import { useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
import { studentsApi } from '../../../api';
import { useStudents } from '../../../hooks/useStudents';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../common/Button';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { cn, getErrorMessage } from '../../../lib/utils';
import { parseStudentWorkbook, type ImportRow, type ImportStatus } from '../../../lib/excelImport';

/** 行状态徽章与说明 */
function RowStatus({ row }: { row: ImportRow }) {
  const map: Record<ImportStatus, { text: string; className: string }> = {
    ready: { text: '可导入', className: 'bg-ink-100 text-ink-600' },
    error: { text: '校验失败', className: 'bg-red-50 text-red-600' },
    importing: { text: '正在创建…', className: 'bg-brand-50 text-brand-700' },
    success: { text: '创建成功', className: 'bg-green-50 text-green-700' },
    failed: { text: '创建失败', className: 'bg-red-50 text-red-600' },
  };
  const badge = map[row.status];
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', badge.className)}>
        {row.status === 'success' && <CheckCircle2 className="h-3 w-3" />}
        {(row.status === 'error' || row.status === 'failed') && <XCircle className="h-3 w-3" />}
        {row.status === 'importing' && <Loader2 className="h-3 w-3 animate-spin" />}
        {badge.text}
      </span>
      {row.message && (
        <span className={cn('text-xs', row.status === 'error' || row.status === 'failed' ? 'text-red-500' : 'text-ink-400')}>
          {row.message}
        </span>
      )}
    </div>
  );
}

export function ImportStudentsPanel() {
  const { showToast } = useToast();
  // 已注册邮箱用于导入前预检（教师/管理员账号也算占用邮箱）
  const { students } = useStudents();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [finished, setFinished] = useState(false);

  const readyCount = rows?.filter((row) => row.status === 'ready').length ?? 0;
  const errorCount = rows?.filter((row) => row.status === 'error').length ?? 0;
  const successCount = rows?.filter((row) => row.status === 'success').length ?? 0;
  const failedCount = rows?.filter((row) => row.status === 'failed').length ?? 0;

  // 选择文件：解析 + 校验 + 预检重复
  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError(null);
    setFinished(false);
    try {
      const existingEmails = new Set(students.map((student) => student.email.toLowerCase()));
      const { rows: parsed } = await parseStudentWorkbook(file, existingEmails);
      setRows(parsed);
    } catch (err) {
      setRows(null);
      setParseError(getErrorMessage(err, '解析文件失败'));
    }
  };

  const resetFile = () => {
    setRows(null);
    setFileName('');
    setParseError(null);
    setFinished(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 开始导入：逐行调用创建接口（每行独立请求，避免后端子请求限制）
  const startImport = async () => {
    if (!rows) return;
    setImporting(true);
    setFinished(false);
    let ok = 0;
    let fail = 0;
    for (const row of rows) {
      if (row.status !== 'ready') continue;
      setRows((prev) =>
        prev?.map((item) => (item.index === row.index ? { ...item, status: 'importing', message: '' } : item)) ?? null,
      );
      try {
        await studentsApi.create({
          name: row.name,
          student_no: row.student_no || undefined,
          email: row.email,
          password: row.password,
          points: Number(row.points || 0),
          role: row.role,
        });
        ok += 1;
        setRows((prev) =>
          prev?.map((item) =>
            item.index === row.index ? { ...item, status: 'success', message: '创建成功' } : item,
          ) ?? null,
        );
      } catch (err) {
        fail += 1;
        setRows((prev) =>
          prev?.map((item) =>
            item.index === row.index
              ? { ...item, status: 'failed', message: getErrorMessage(err, '创建失败') }
              : item,
          ) ?? null,
        );
      }
    }
    setImporting(false);
    setFinished(true);
    showToast(ok > 0 ? 'success' : 'error', `导入完成：成功 ${ok} 人${fail > 0 ? `，失败 ${fail} 人` : ''}`);
  };

  const columns: DataTableColumn<ImportRow>[] = [
    { header: '行号', render: (row) => <span className="text-ink-400">第 {row.index} 行</span> },
    { header: '姓名', render: (row) => <span className="font-medium text-ink-900">{row.name || '—'}</span> },
    { header: '学号', render: (row) => <span className="text-ink-500">{row.student_no || '—'}</span> },
    { header: '邮箱', render: (row) => <span className="text-ink-700">{row.email || '—'}</span> },
    {
      header: '登录密码',
      render: (row) => <span className="font-mono text-xs text-ink-700">{row.password || '—'}</span>,
    },
    { header: '初始积分', render: (row) => <span className="text-ink-700">{row.points || '0'}</span> },
    {
      header: '角色',
      render: (row) => (
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            row.role === 'teacher' ? 'bg-ink-950 text-white' : 'bg-brand-50 text-brand-700',
          )}
        >
          {row.role === 'teacher' ? '教师' : '学生'}
        </span>
      ),
    },
    { header: '状态', render: (row) => <RowStatus row={row} /> },
  ];

  return (
    <div className="space-y-4">
      {/* 隐藏的文件选择框 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {/* 操作区：选文件 / 下模板 */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => fileInputRef.current?.click()} disabled={importing}>
          <Upload className="h-4 w-4" />
          {rows ? '重新选择文件' : '选择 Excel 文件'}
        </Button>
        <a
          href="/学生导入模板.xlsx"
          download
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          <Download className="h-4 w-4" />
          下载模板
        </a>
        {fileName && <span className="flex items-center gap-1.5 text-sm text-ink-500"><FileSpreadsheet className="h-4 w-4" />{fileName}</span>}
      </div>

      {/* 格式说明 */}
      {!rows && !parseError && (
        <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-600">
          表头支持：<b>姓名</b>（必填）、<b>学号</b>、<b>邮箱</b>（必填，不能与已有账号重复）、<b>初始密码</b>（留空自动生成）、
          <b>初始积分</b>（留空为 0）、<b>角色</b>（学生/教师，留空为学生）。点击「下载模板」可获取标准格式。
        </div>
      )}

      {parseError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{parseError}</div>
      )}

      {/* 预览与导入 */}
      {rows && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-600">
              共 <b>{rows.length}</b> 行 · 可导入 <b className="text-brand-600">{readyCount}</b> 行
              {errorCount > 0 && <> · 校验失败 <b className="text-red-500">{errorCount}</b> 行</>}
              {finished && <> · 本次成功 <b className="text-green-600">{successCount}</b> · 失败 <b className="text-red-500">{failedCount}</b></>}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={resetFile} disabled={importing}>
                清空
              </Button>
              <Button onClick={() => void startImport()} loading={importing} disabled={readyCount === 0}>
                {importing ? `正在导入…（已成功 ${successCount}）` : `开始导入（${readyCount} 人）`}
              </Button>
            </div>
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => String(row.index)}
            emptyText="没有可显示的行"
          />

          {readyCount === 0 && !importing && (
            <p className="text-sm text-ink-400">没有可导入的行。请修正错误后重新选择文件（错误行会在表格中标注原因）。</p>
          )}
          {finished && failedCount > 0 && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              部分行创建失败（邮箱已存在是最常见原因）。修正后重新选择文件导入即可，已成功的账号不会重复创建。
            </p>
          )}
        </>
      )}
    </div>
  );
}
