/**
 * 课堂模式（投屏用）
 *
 * 场景：希沃大屏 / 投影上直接点，老师上课最高频的两件事——随机点名、即时加减分。
 * 设计取舍：
 *   · 全屏深色高对比，10 米外也能看清
 *   · 按钮全部 ≥ 56px 高，触屏可点，不依赖 hover
 *   · 支持键盘：空格=点名、+/- = 加减 1 分、Esc = 退出（配合翻页笔更好用）
 *   · 分数变更只调用既有 /api/students/award，不新增后端逻辑
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dices, Loader2, Minus, Plus, RotateCcw, Sparkles, Trophy, X } from 'lucide-react';import { studentsApi } from '../../../api';
import { useStudents } from '../../../hooks/useStudents';
import { useToast } from '../../../hooks/useToast';
import { cn, formatPoints, getErrorMessage } from '../../../lib/utils';
import type { Student } from '../../../types';

/** 快捷加减分的档位 */
const QUICK_STEPS = [1, 2, 3, 5];

/** 课堂场景固定原因（写进积分明细，便于日后统计） */
const REASON_ADD = '课堂表现奖励';
const REASON_SUB = '积分惩罚';

interface ClassroomModeProps {
  onExit: () => void;
}

/** 从数组里随机取一项（尽量避开当前项，避免「点了没反应」的错觉） */
function pickRandom<T>(list: T[], exclude?: T): T | null {
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  const pool = exclude === undefined ? list : list.filter((item) => item !== exclude);
  const source = pool.length > 0 ? pool : list;
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return source[buffer[0] % source.length];
}

export function ClassroomMode({ onExit }: ClassroomModeProps) {
  const { students, loading, error, refresh } = useStudents();
  const { showToast } = useToast();

  /** 当前选中的学生 ID */
  const [pickedId, setPickedId] = useState<string | null>(null);
  /** 点名滚动中 */
  const [rolling, setRolling] = useState(false);
  /** 滚动过程中闪现的名字 */
  const [rollingName, setRollingName] = useState('');
  /** 本次课堂的临时加减分记录（不落库，仅用于课堂内展示） */
  const [sessionDelta, setSessionDelta] = useState<Record<string, number>>({});
  /** 正在提交的学生 ID */
  const [busyId, setBusyId] = useState<string | null>(null);

  const rollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 只把真正的学生放进点名池 */
  const roster = useMemo(() => students.filter((s) => s.role === 'student'), [students]);

  const picked = useMemo(
    () => roster.find((student) => student.id === pickedId) ?? null,
    [roster, pickedId],
  );

  // 离开页面时清掉定时器
  useEffect(() => {
    return () => {
      if (rollTimer.current) clearInterval(rollTimer.current);
    };
  }, []);

  /** 随机点名：先快速滚动 1.2 秒，再定格 */
  const roll = useCallback(() => {
    if (rolling || roster.length === 0) return;
    setRolling(true);
    setPickedId(null);

    const startedAt = Date.now();
    rollTimer.current = setInterval(() => {
      const current = pickRandom(roster);
      if (current) setRollingName(current.name);

      if (Date.now() - startedAt > 1200) {
        if (rollTimer.current) clearInterval(rollTimer.current);
        rollTimer.current = null;
        const winner = pickRandom(roster);
        if (winner) {
          setRollingName(winner.name);
          setPickedId(winner.id);
        }
        setRolling(false);
      }
    }, 70);
  }, [rolling, roster]);

  /** 加减分：调用既有接口，成功后刷新名单 */
  const award = useCallback(
    async (student: Student, delta: number) => {
      if (busyId) return;
      setBusyId(student.id);
      try {
        await studentsApi.award({
          student_id: student.id,
          delta,
          reason: delta >= 0 ? REASON_ADD : REASON_SUB,
        });
        setSessionDelta((prev) => ({ ...prev, [student.id]: (prev[student.id] ?? 0) + delta }));
        showToast('success', `${student.name} ${delta >= 0 ? '+' : ''}${delta} 分`);
        await refresh();
      } catch (err) {
        showToast('error', getErrorMessage(err, '加减分失败'));
      } finally {
        setBusyId(null);
      }
    },
    [busyId, refresh, showToast],
  );

  // 键盘快捷键：空格点名、+/- 加减、Esc 退出
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onExit();
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        roll();
        return;
      }
      if (!picked) return;
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        void award(picked, 1);
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        void award(picked, -1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [award, onExit, picked, roll]);

  const totalSession = useMemo(
    () => Object.values(sessionDelta).reduce((sum, value) => sum + value, 0),
    [sessionDelta],
  );

  const displayName = rolling ? rollingName : picked?.name;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-950 text-white">
      {/* 顶栏 */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-6 py-3 sm:px-10">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium tracking-wide text-white/70">
            课堂模式
          </span>
          <span className="text-sm text-white/40">
            共 {roster.length} 人 · 本节合计{' '}
            <b className={cn('text-base', totalSession >= 0 ? 'text-brand-300' : 'text-red-300')}>
              {totalSession >= 0 ? '+' : ''}
              {totalSession}
            </b>{' '}
            分
          </span>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/20 hover:text-white"
        >
          <X className="h-4 w-4" />
          退出
          <span className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white/50 sm:inline">
            Esc
          </span>
        </button>
      </header>

      {/* 主体 */}
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-6 py-6">
        {loading ? (
          <Loader2 className="h-10 w-10 animate-spin text-white/40" />
        ) : error ? (
          <div className="text-center">
            <p className="text-lg text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-4 rounded-xl bg-white/10 px-5 py-2.5 text-sm text-white/80 hover:bg-white/20"
            >
              重试
            </button>
          </div>
        ) : roster.length === 0 ? (
          <p className="text-xl text-white/50">名单里还没有学生，请先在「学生管理」中添加</p>
        ) : (
          <>
            {/* 被点到的学生 */}
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="text-sm uppercase tracking-[0.3em] text-white/30">
                {rolling ? '正在点名…' : picked ? '当前学生' : '点一下开始'}
              </span>
              <h1
                className={cn(
                  'font-display font-bold leading-none tracking-tight transition-all',
                  picked || rolling ? 'text-6xl sm:text-7xl lg:text-8xl' : 'text-4xl sm:text-5xl',
                  rolling ? 'text-white/60 blur-[1px]' : picked ? 'text-white' : 'text-white/30',
                )}
              >
                {displayName ?? '准备好了吗？'}
              </h1>
              {picked && !rolling && (
                <div className="flex items-center gap-6 text-white/60">
                  {picked.student_no && <span className="text-lg">学号 {picked.student_no}</span>}
                  <span className="flex items-center gap-1.5 text-lg">
                    <Trophy className="h-5 w-5 text-amber-400" />
                    当前 <b className="text-2xl text-white">{formatPoints(picked.points)}</b> 分
                  </span>
                  {(sessionDelta[picked.id] ?? 0) !== 0 && (
                    <span className="rounded-full bg-brand-500/20 px-3 py-1 text-base font-medium text-brand-300">
                      本节 {(sessionDelta[picked.id] ?? 0) > 0 ? '+' : ''}
                      {sessionDelta[picked.id]}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 加减分按钮 */}
            <div
              className={cn(
                'flex flex-col items-center gap-4 transition-opacity',
                picked && !rolling ? 'opacity-100' : 'pointer-events-none opacity-30',
              )}
            >
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                {QUICK_STEPS.map((step) => (
                  <button
                    key={step}
                    type="button"
                    disabled={!picked || Boolean(busyId)}
                    onClick={() => picked && void award(picked, step)}
                    aria-label={`加 ${step} 分`}
                    className="flex h-14 min-w-[62px] items-center justify-center gap-1 rounded-2xl bg-brand-500 text-xl font-bold text-white shadow-lg shadow-brand-500/20 transition-transform active:scale-95 disabled:opacity-50 sm:h-20 sm:min-w-[94px] sm:text-3xl"
                  >
                    <Plus className="h-6 w-6" />
                    {step}
                  </button>
                ))}
                <div className="mx-1 h-12 w-px bg-white/15 sm:h-16" />
                {QUICK_STEPS.map((step) => (
                  <button
                    key={`minus-${step}`}
                    type="button"
                    disabled={!picked || Boolean(busyId)}
                    onClick={() => picked && void award(picked, -step)}
                    aria-label={`减 ${step} 分`}
                    className="flex h-14 min-w-[62px] items-center justify-center gap-1 rounded-2xl bg-white/10 text-xl font-bold text-red-300 transition-transform active:scale-95 disabled:opacity-50 sm:h-20 sm:min-w-[94px] sm:text-3xl"
                  >
                    <Minus className="h-6 w-6" />
                    {step}
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/30">
                快捷键：空格点名 · + / − 加减 1 分 · Esc 退出
              </p>
            </div>

            {/* 点名按钮 */}
            <button
              type="button"
              onClick={roll}
              disabled={rolling}
              className={cn(
                'flex h-16 items-center gap-3 rounded-2xl px-10 text-xl font-semibold transition-all',
                'disabled:opacity-50 sm:h-20 sm:text-2xl',
                picked || rolling
                  ? 'border-2 border-white/20 bg-white/5 text-white hover:border-brand-400 hover:bg-brand-500/10'
                  : 'bg-brand-500 text-white shadow-xl shadow-brand-500/25 hover:bg-brand-400 active:scale-95',
              )}
            >
              {rolling ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <Dices className="h-7 w-7" />
              )}
              {rolling ? '点名中…' : picked ? '再来一个' : '随机点名'}
            </button>
          </>
        )}
      </main>

      {/* 底部名单：直接点学生也能加减分 */}
      {roster.length > 0 && (
        <footer className="shrink-0 border-t border-white/10 px-4 py-3 sm:px-8">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-xs text-white/30">
              <Sparkles className="h-3.5 w-3.5" />
              点名字可直接切到该学生
            </span>
            <button
              type="button"
              onClick={() => {
                setSessionDelta({});
                setPickedId(null);
                showToast('success', '已清空本节记录（不影响已入账的积分）');
              }}
              className="flex items-center gap-1 text-xs text-white/30 transition-colors hover:text-white/70"
            >
              <RotateCcw className="h-3 w-3" />
              清空本节
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {roster.map((student) => {
              const delta = sessionDelta[student.id] ?? 0;
              const active = student.id === pickedId;
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => {
                    setPickedId(student.id);
                    setRolling(false);
                  }}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                    active
                      ? 'border-brand-400 bg-brand-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30 hover:text-white',
                  )}
                >
                  <span className="font-medium">{student.name}</span>
                  {delta !== 0 && (
                    <span
                      className={cn(
                        'rounded px-1.5 text-xs font-semibold',
                        delta > 0 ? 'bg-brand-500/30 text-brand-200' : 'bg-red-500/20 text-red-300',
                      )}
                    >
                      {delta > 0 ? '+' : ''}
                      {delta}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </footer>
      )}
    </div>
  );
}
