/**
 * 批量加分面板（教师）：
 * 填写判断公式（页面，实时校验）→ 上传含判断值的 Excel（学号/姓名 + 判断值）
 * → 逐行预览加分结果 → 确认后单事务批量入账
 *
 * 公式示例：value >= 90 ? 10 : value >= 80 ? 5 : 0
 * （判断值 90 分以上加 10 分，80 分以上加 5 分，其余不加）
 */
import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Download,
  Eye,
  FileSpreadsheet,
  Sigma,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { studentsApi } from '../../../api';
import { useStudents } from '../../../hooks/useStudents';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { Select } from '../../common/Select';
import { TemplatePreview } from '../../common/TemplatePreview';
import { ErrorNotice } from '../../common/States';
import { FormulaHelpModal } from './FormulaHelp';
import { Spinner } from '../../common/Spinner';
import { POINT_REASONS } from '../../../lib/constants';
import { cn, formatPoints, getErrorMessage } from '../../../lib/utils';
import { parseBulkAwardWorkbook, type BulkAwardRow } from '../../../lib/excelImport';
import {
  compileJudgeFormula,
  JUDGE_FORMULA_EXAMPLE,
  JudgeFormulaError,
  type CompiledJudgeFormula,
} from '../../../lib/judgeFormula';
import type { Student } from '../../../types';

/** 单行加分上限（与后端一致） */
const MAX_DELTA = 100000;

/** 预览行状态 */
type PreviewStatus = 'ready' | 'skipped' | 'error' | 'waiting' | 'done';

/** 逐行预览结果 */
interface PreviewRow {
  index: number;
  student: Student | null;
  student_no: string;
  name: string;
  value: number | null;
  /** 加分值（可计算且合法时非 null） */
  delta: number | null;
  status: PreviewStatus;
  message: string;
}

const STATUS_MAP: Record<PreviewStatus, { text: string; className: string }> = {
  ready: { text: '待入账', className: 'bg-ink-100 text-ink-600' },
  skipped: { text: '0 分 · 不变更', className: 'bg-ink-50 text-ink-400' },
  error: { text: '校验失败', className: 'bg-red-50 text-red-600' },
  waiting: { text: '等待公式', className: 'bg-amber-50 text-amber-700' },
  done: { text: '已加分', className: 'bg-green-50 text-green-700' },
};

/** 按学号（优先）→ 姓名 匹配学生 */
function matchStudent(
  students: Student[],
  row: BulkAwardRow,
): { student: Student | null; message: string } {
  if (row.student_no) {
    const byNo = students.filter(
      (s) => (s.student_no ?? '').trim().toLowerCase() === row.student_no.toLowerCase(),
    );
    if (byNo.length === 1) return { student: byNo[0], message: '' };
    if (byNo.length > 1) return { student: null, message: '该学号对应多名学生，请联系管理员核对' };
  }
  const byName = students.filter((s) => s.name.trim().toLowerCase() === row.name.trim().toLowerCase());
  if (byName.length === 1) return { student: byName[0], message: '' };
  if (byName.length > 1) {
    return { student: null, message: `有 ${byName.length} 名学生同名「${row.name}」，请在 Excel 中填写学号` };
  }
  return {
    student: null,
    message: row.student_no ? '未找到该学号的学生' : '未找到该姓名的学生',
  };
}

export function BulkAwardPanel() {
  const { showToast } = useToast();
  const { students, loading, error, refresh } = useStudents();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expression, setExpression] = useState('');
  const [reason, setReason] = useState<string>(POINT_REASONS[0]);
  const [fileName, setFileName] = useState('');
  const [fileRows, setFileRows] = useState<BulkAwardRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [showFormulaHelp, setShowFormulaHelp] = useState(false);
  /** 入账成功后的结果（按学生 ID），预览中展示「已加分」 */
  const [applied, setApplied] = useState<Map<string, { delta: number; balance_after: number }> | null>(null);
  /** 是否正在把文件拖到上传区 */
  const [dragging, setDragging] = useState(false);
  /** 预览表是否只看问题行 */
  const [onlyErrors, setOnlyErrors] = useState(false);

  // 编译判断公式（实时校验；公式为空视为未填写）
  const { formula, formulaError } = useMemo<{
    formula: CompiledJudgeFormula | null;
    formulaError: string | null;
  }>(() => {
    if (expression.trim() === '') return { formula: null, formulaError: null };
    try {
      return { formula: compileJudgeFormula(expression), formulaError: null };
    } catch (err) {
      return {
        formula: null,
        formulaError: err instanceof JudgeFormulaError ? err.message : '公式格式错误',
      };
    }
  }, [expression]);

  // 预览：匹配学生 + 逐行重算加分（与后端同一引擎；最终以服务端重算为准）
  const preview = useMemo<PreviewRow[]>(() => {
    if (!fileRows) return [];
    return fileRows.map((row) => {
      const base = { index: row.index, student_no: row.student_no, name: row.name, value: row.value };
      if (row.status === 'error') {
        return { ...base, student: null, delta: null, status: 'error' as const, message: row.message };
      }
      const { student, message } = matchStudent(students, row);
      if (!student) {
        return { ...base, student: null, delta: null, status: 'error' as const, message };
      }
      if (student.role !== 'student') {
        return { ...base, student, delta: null, status: 'error' as const, message: '教师/管理员不能被加分' };
      }
      const appliedRow = applied?.get(student.id);
      if (appliedRow) {
        return {
          ...base,
          student,
          delta: appliedRow.delta,
          status: 'done' as const,
          message: `已加分，当前余额 ${appliedRow.balance_after}`,
        };
      }
      if (!formula) {
        return {
          ...base,
          student,
          delta: null,
          status: 'waiting' as const,
          message: '填写有效的判断公式后预览加分结果',
        };
      }
      let result: number;
      try {
        result = formula({ value: row.value as number, points: student.points });
      } catch (err) {
        return {
          ...base,
          student,
          delta: null,
          status: 'error' as const,
          message: err instanceof JudgeFormulaError ? err.message : '公式计算失败',
        };
      }
      if (!Number.isFinite(result)) {
        return { ...base, student, delta: null, status: 'error' as const, message: '公式结果不是有效数字（可能存在除以零）' };
      }
      if (!Number.isInteger(result)) {
        return {
          ...base,
          student,
          delta: null,
          status: 'error' as const,
          message: `公式结果 ${result} 不是整数，可用 floor/round 取整`,
        };
      }
      if (result < 0) {
        return { ...base, student, delta: null, status: 'error' as const, message: '批量加分仅支持加分，结果不能为负' };
      }
      if (result > MAX_DELTA) {
        return { ...base, student, delta: null, status: 'error' as const, message: `加分值不能超过 ${MAX_DELTA}` };
      }
      if (result === 0) {
        return { ...base, student, delta: 0, status: 'skipped' as const, message: '公式结果为 0 分，不变更' };
      }
      return { ...base, student, delta: result, status: 'ready' as const, message: '' };
    });
  }, [fileRows, students, formula, applied]);

  const stats = useMemo(() => {
    const ready = preview.filter((p) => p.status === 'ready');
    return {
      readyCount: ready.length,
      skippedCount: preview.filter((p) => p.status === 'skipped').length,
      errorCount: preview.filter((p) => p.status === 'error').length,
      doneCount: preview.filter((p) => p.status === 'done').length,
      totalDelta: ready.reduce((sum, p) => sum + (p.delta ?? 0), 0),
    };
  }, [preview]);

  const canSubmit =
    formula !== null &&
    formulaError === null &&
    !loading &&
    !submitting &&
    applied === null &&
    stats.readyCount > 0;

  // 选择文件：先做类型/大小校验，再解析
  const handleFile = async (file: File) => {
    resetPreviewState();
    setFileName(file.name);

    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setParseError(`「${file.name}」不是支持的格式，请上传 .xlsx / .xls / .csv`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setParseError('文件超过 5MB，请拆分后再上传（单批最多 200 行）');
      return;
    }

    try {
      const { rows } = await parseBulkAwardWorkbook(file);
      setFileRows(rows);
    } catch (err) {
      setFileRows(null);
      setParseError(getErrorMessage(err, '解析文件失败'));
    }
  };

  /** 清掉与「当前文件」相关的状态（不清公式与原因） */
  const resetPreviewState = () => {
    setFileRows(null);
    setParseError(null);
    setApplied(null);
    setOnlyErrors(false);
  };

  const resetFile = () => {
    resetPreviewState();
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 拖拽上传
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (submitting) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  // 客户端生成标准模板（学号 + 姓名 + 判断值）
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['学号', '姓名', '判断值（得分）'],
      ['S2024001', '张三', 95],
      ['S2024002', '李四', 82],
      ['S2024003', '王五', 71],
    ]);
    ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '批量加分');
    XLSX.writeFile(wb, '批量加分模板.xlsx');
  };

  // 确认批量加分：服务端重新计算每行结果并单事务入账
  const onSubmit = async () => {
    if (!formula || !fileRows) return;
    const ready = preview.filter((p) => p.status === 'ready' && p.student !== null);
    if (ready.length === 0) return;
    setSubmitting(true);
    try {
      const res = await studentsApi.awardBatch({
        expression: expression.trim(),
        reason,
        rows: ready.map((p) => ({ student_id: p.student!.id, value: p.value as number })),
      });
      const map = new Map<string, { delta: number; balance_after: number }>();
      for (const item of res.results) {
        map.set(item.student_id, { delta: item.delta, balance_after: item.balance_after });
      }
      setApplied(map);
      await refresh();
      const total = res.results.reduce((sum, r) => sum + r.delta, 0);
      showToast('success', `批量加分完成：${res.awarded} 名学生共增加 ${formatPoints(total)} 积分`);
    } catch (err) {
      showToast('error', getErrorMessage(err, '批量加分失败'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center rounded-xl border border-ink-100 bg-white py-16">
        <Spinner />
      </div>
    );
  }
  if (error) {
    return <ErrorNotice message={error} onRetry={() => void refresh()} />;
  }

  const columns: DataTableColumn<PreviewRow>[] = [
    { header: '行号', render: (row) => <span className="text-ink-400">第 {row.index} 行</span> },
    {
      header: '学生',
      render: (row) => (
        <span className="font-medium text-ink-900">{row.student?.name ?? row.name ?? '—'}</span>
      ),
    },
    { header: '学号', render: (row) => <span className="text-ink-500">{row.student_no || '—'}</span> },
    { header: '判断值', render: (row) => <span className="text-ink-700">{row.value ?? '—'}</span> },
    {
      header: '加分',
      render: (row) =>
        row.status === 'ready' || row.status === 'done' ? (
          <span className="font-semibold text-brand-600">+{row.delta}</span>
        ) : row.status === 'skipped' ? (
          <span className="text-ink-400">0</span>
        ) : (
          <span className="text-ink-300">—</span>
        ),
    },
    {
      header: '当前积分',
      render: (row) => <span className="text-ink-500">{row.student ? row.student.points : '—'}</span>,
    },
    {
      header: '预计余额',
      render: (row) => {
        if (row.status === 'done') {
          const appliedRow = row.student ? applied?.get(row.student.id) : undefined;
          return <span className="font-semibold text-green-700">{appliedRow?.balance_after ?? '—'}</span>;
        }
        if (!row.student || row.delta === null) return <span className="text-ink-300">—</span>;
        return <span className="font-medium text-ink-900">{row.student.points + row.delta}</span>;
      },
    },
    {
      header: '状态',
      render: (row) => {
        const badge = STATUS_MAP[row.status];
        return (
          <div className="flex flex-col gap-0.5">
            <span
              className={cn(
                'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                badge.className,
              )}
            >
              {row.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
              {row.status === 'error' && <XCircle className="h-3 w-3" />}
              {badge.text}
            </span>
            {row.message && (
              <span className={cn('text-xs', row.status === 'error' ? 'text-red-500' : 'text-ink-400')}>
                {row.message}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Card className="animate-fade-up mx-auto max-w-5xl p-6">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-ink-900">
        <Sigma className="h-5 w-5 text-brand-500" />
        批量加分（Excel）
      </h2>
      <p className="mb-5 text-sm text-ink-500">
        上传带「判断值」（如作业得分）的名单，用判断公式决定每行加多少分；预览确认后一次性入账，全部计入积分明细。
      </p>

      {/* 1. 判断公式 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="judge-formula" className="text-sm font-medium text-ink-700">
            判断公式
          </label>
          {expression.trim() !== '' &&
            (formulaError ? (
              <span className="text-xs font-medium text-red-500">公式有误</span>
            ) : (
              <span className="text-xs font-medium text-green-600">✓ 公式有效</span>
            ))}
        </div>
        <textarea
          id="judge-formula"
          rows={2}
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          placeholder={JUDGE_FORMULA_EXAMPLE}
          spellCheck={false}
          className={cn(
            'w-full resize-y rounded-lg border bg-white px-3 py-2.5 font-mono text-sm text-ink-900 outline-none transition',
            'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
            formulaError ? 'border-red-400 focus:ring-red-400/20' : 'border-ink-200',
          )}
        />
        {formulaError && <p className="text-xs text-red-500">{formulaError}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <button
            type="button"
            onClick={() => setShowFormulaHelp(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 font-medium text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          >
            <CircleHelp className="h-3.5 w-3.5" />
            判断公式入门（变量 / 运算 / 三元 / 函数 / 常用配方）
          </button>
          <span className="text-ink-400">
            速记：<code className="font-mono text-ink-600">value</code> = 本行判断值 ·{' '}
            <code className="font-mono text-ink-600">points</code> = 当前积分 · 结果须为整数
          </span>
        </div>
      </div>

      {/* 2. 上传 Excel（支持拖拽） */}
      <div className="mt-5 space-y-3">
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

        {/* 拖拽区：没有文件时是主入口，有文件后收成一条状态条 */}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!submitting) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !submitting && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (!submitting) fileInputRef.current?.click();
            }
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-5 py-7 text-center transition-colors',
            dragging
              ? 'border-brand-500 bg-brand-50'
              : 'border-ink-200 bg-ink-50/60 hover:border-brand-300 hover:bg-brand-50/40',
            submitting && 'cursor-not-allowed opacity-60',
          )}
        >
          <Upload
            className={cn('h-7 w-7', dragging ? 'text-brand-600' : 'text-ink-400')}
            aria-hidden
          />
          <p className="text-sm font-medium text-ink-800">
            {dragging ? '松开即可上传' : '把 Excel 拖到这里，或点击选择文件'}
          </p>
          <p className="text-xs text-ink-400">
            支持 .xlsx / .xls / .csv，单批最多 200 行，文件 ≤ 5MB
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => fileInputRef.current?.click()} disabled={submitting} variant="outline" size="sm">
            <Upload className="h-4 w-4" />
            {fileRows ? '换一个文件' : '选择文件'}
          </Button>
          <button
            type="button"
            onClick={() => setShowTemplate((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              showTemplate
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-ink-200 text-ink-600 hover:bg-ink-100 hover:text-ink-900',
            )}
          >
            <Eye className="h-4 w-4" />
            {showTemplate ? '收起模板' : '预览模板'}
          </button>
          {fileName && (
            <span className="flex items-center gap-1.5 rounded-lg bg-ink-100 px-2.5 py-1.5 text-sm text-ink-600">
              <FileSpreadsheet className="h-4 w-4 text-brand-600" />
              <span className="max-w-[16rem] truncate">{fileName}</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  resetFile();
                }}
                aria-label="移除已选文件"
                className="rounded p-0.5 text-ink-400 transition-colors hover:bg-ink-200 hover:text-ink-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}
        </div>

        {showTemplate ? (
          <div className="space-y-2">
            <TemplatePreview
              columns={['学号', '姓名', '判断值（得分）']}
              rows={[
                ['S2024001', '张三', 95],
                ['S2024002', '李四', 82],
                ['', '王五', 71],
              ]}
              notes={[
                '学号、姓名至少填一项（都填时优先按学号匹配）；判断值必填且为数字（如作业得分）。',
                '判断值可以是任意数字：得分、次数、数量都行，公式决定它对应加多少分。',
                '表头支持别名：编号/学生编号、名字/学生姓名、得分/分数/成绩/数量；每批最多 200 行。',
              ]}
            />
            <button
              type="button"
              onClick={() => void downloadTemplate()}
              className="inline-flex items-center gap-1 text-xs text-ink-400 underline-offset-4 transition-colors hover:text-ink-600 hover:underline"
            >
              <Download className="h-3 w-3" />
              直接下载 .xlsx 模板文件
            </button>
          </div>
        ) : (
          !fileRows &&
          !parseError && (
            <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-600">
              模板列：<b>学号</b>（选填）、<b>姓名</b>（选填，学号与姓名至少填一项）、
              <b>判断值</b>（必填，数字，如作业得分）。点击「预览模板」可直接查看标准格式与示例。
            </div>
          )
        )}

        {parseError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{parseError}</div>}
      </div>

      {/* 3. 预览 */}
      {fileRows && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-600">
              共 <b>{fileRows.length}</b> 行 · 待入账 <b className="text-brand-600">{stats.readyCount}</b> 行
              {stats.skippedCount > 0 && <> · 0 分不变更 <b>{stats.skippedCount}</b> 行</>}
              {stats.errorCount > 0 && <> · 校验失败 <b className="text-red-500">{stats.errorCount}</b> 行</>}
              {stats.doneCount > 0 && <> · 已入账 <b className="text-green-600">{stats.doneCount}</b> 行</>}
              {stats.readyCount > 0 && <> · 合计加 <b className="text-brand-600">{formatPoints(stats.totalDelta)}</b> 分</>}
            </p>
            <Button variant="ghost" size="sm" onClick={resetFile} disabled={submitting}>
              清空
            </Button>
          </div>

          {/* 问题行汇总：一眼看到「哪几行没匹配上」 */}
          {stats.errorCount > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  {stats.errorCount} 行需要处理（这些行不会被加分）
                </p>
                <button
                  type="button"
                  onClick={() => setOnlyErrors((v) => !v)}
                  className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
                >
                  {onlyErrors ? '显示全部行' : '只看问题行'}
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-red-600">
                {preview
                  .filter((row) => row.status === 'error')
                  .slice(0, 3)
                  .map((row) => (
                    <li key={row.index}>
                      第 {row.index} 行{row.student_no || row.name ? `（${row.student_no || row.name}）` : ''}：
                      {row.message}
                    </li>
                  ))}
                {stats.errorCount > 3 && (
                  <li className="text-red-400">…另有 {stats.errorCount - 3} 行，点击「只看问题行」查看</li>
                )}
              </ul>
            </div>
          )}

          <DataTable
            columns={columns}
            rows={onlyErrors ? preview.filter((row) => row.status === 'error') : preview}
            rowKey={(row) => String(row.index)}
          />

          {applied && (
            <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              ✓ 本批 {stats.doneCount} 名学生已入账。继续处理新名单请「重新选择文件」；公式与原因已保留。
            </p>
          )}
          {!applied && stats.readyCount > 0 && formulaError !== null && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
              修正上方判断公式后，预览与确认会自动恢复。
            </p>
          )}
          {!applied && stats.readyCount === 0 && (
            <p className="text-sm text-ink-400">
              暂无可入账的行。请填写有效的判断公式并核对错误行的提示后重试。
            </p>
          )}

          {/* 4. 原因 + 确认 */}
          {!applied && (
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-ink-100 pt-4">
              <div className="w-full sm:w-64">
                <Select label="变动原因" value={reason} onChange={(event) => setReason(event.target.value)}>
                  {POINT_REASONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              </div>
              <Button onClick={() => void onSubmit()} loading={submitting} disabled={!canSubmit}>
                确认批量加分（{stats.readyCount} 人，共 {formatPoints(stats.totalDelta)} 分）
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 判断公式入门（专门介绍） */}
      {showFormulaHelp && <FormulaHelpModal onClose={() => setShowFormulaHelp(false)} />}
    </Card>
  );
}
