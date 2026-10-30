/**
 * POST /api/students/award-batch —— 批量加分（教师/管理员）
 * 流程：编译判断公式 → 逐行取判断值 → 服务端重新计算每行加分（权威）
 *       → 数据库函数 adjust_student_points_batch 单事务原子入账
 *
 * 安全说明：
 *   - 前端预览仅供展示；最终加分一律以本接口用同一公式引擎重算的结果为准
 *   - 任何一行计算失败则整批拒绝（避免部分入账造成账目混乱），教师修正后重试
 *   - 入账走数据库安全函数：教职工权限校验 + 逐行锁 + 积分明细留痕
 */
import { HttpError, jsonResponse, readJson, requireString, translateDbError } from '../../lib/http';
import { requireStaff } from '../../lib/auth';
import { createUserClient } from '../../lib/supabase';
import { compileJudgeFormula, JudgeFormulaError } from '../../lib/judgeFormula';
import type { Env, Student } from '../../lib/types';

const MAX_ROWS = 200;
const MAX_DELTA = 100000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AwardBatchBody {
  expression?: unknown;
  reason?: unknown;
  rows?: unknown;
}

interface RowError {
  row: number;
  message: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const ctx = await requireStaff(env, request);

  const body = await readJson<AwardBatchBody>(request);
  const expression = requireString(body.expression, '判断公式', { max: 200 });
  const reason = requireString(body.reason, '变动原因', { max: 50 });

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    throw new HttpError(400, '请上传至少 1 行数据');
  }
  if (body.rows.length > MAX_ROWS) {
    throw new HttpError(400, `单次批量不能超过 ${MAX_ROWS} 名学生`);
  }

  // 1. 编译判断公式（语法错误直接拒绝，不触碰数据库）
  let formula;
  try {
    formula = compileJudgeFormula(expression);
  } catch (err) {
    if (err instanceof JudgeFormulaError) {
      throw new HttpError(400, `判断公式有误：${err.message}`);
    }
    throw new HttpError(400, '判断公式格式错误');
  }

  // 2. 规范化行数据：student_id（uuid）+ value（有限数值）
  const rows: { student_id: string; value: number }[] = [];
  body.rows.forEach((raw, i) => {
    const line = i + 1;
    const item = raw as Record<string, unknown> | null;
    if (typeof item !== 'object' || item === null) {
      throw new HttpError(400, `第 ${line} 行数据损坏，请重新上传`);
    }
    const studentId = item.student_id;
    if (typeof studentId !== 'string' || !UUID_PATTERN.test(studentId)) {
      throw new HttpError(400, `第 ${line} 行：学生标识无效`);
    }
    const value = typeof item.value === 'number' ? item.value : Number(item.value);
    if (!Number.isFinite(value) || Math.abs(value) > 1e9) {
      throw new HttpError(400, `第 ${line} 行：判断值必须是有效数字`);
    }
    rows.push({ student_id: studentId, value });
  });

  // 3. 拉取相关学生（公式中的 points 变量需要当前积分）
  const client = createUserClient(env, ctx.token);
  const ids = [...new Set(rows.map((row) => row.student_id))];
  const { data: studentRows, error: listError } = await client
    .from('students')
    .select('id, name, role, points')
    .in('id', ids);
  if (listError) {
    throw new HttpError(500, '获取学生列表失败');
  }
  const byId = new Map((studentRows as (Student & { id: string })[]).map((s) => [s.id, s]));

  // 4. 逐行重算（服务端为权威；points 取当前余额，value 取 Excel 判断值）
  const awardRows: { student_id: string; delta: number }[] = [];
  const skipped: { student_id: string; message: string }[] = [];
  const errors: RowError[] = [];

  rows.forEach((row, i) => {
    const line = i + 1;
    const student = byId.get(row.student_id);
    if (!student) {
      errors.push({ row: line, message: `第 ${line} 行：学生不存在` });
      return;
    }
    if (student.role !== 'student') {
      errors.push({ row: line, message: `第 ${line} 行：教师/管理员不能被加分` });
      return;
    }
    let result: number;
    try {
      result = formula({ value: row.value, points: student.points });
    } catch (err) {
      errors.push({
        row: line,
        message: `第 ${line} 行：${err instanceof JudgeFormulaError ? err.message : '公式计算失败'}`,
      });
      return;
    }
    if (!Number.isFinite(result)) {
      errors.push({ row: line, message: `第 ${line} 行：公式结果不是有效数字（可能存在除以零）` });
      return;
    }
    if (!Number.isInteger(result)) {
      errors.push({ row: line, message: `第 ${line} 行：公式结果 ${result} 不是整数，请调整公式（可用 floor/round 取整）` });
      return;
    }
    if (result < 0) {
      errors.push({ row: line, message: `第 ${line} 行：批量加分仅支持加分，公式结果不能为负` });
      return;
    }
    if (result > MAX_DELTA) {
      errors.push({ row: line, message: `第 ${line} 行：加分值不能超过 ${MAX_DELTA}` });
      return;
    }
    if (result === 0) {
      skipped.push({ student_id: row.student_id, message: '公式结果为 0 分，不变更' });
      return;
    }
    awardRows.push({ student_id: row.student_id, delta: result });
  });

  // 5. 存在行级错误 → 整批拒绝（避免部分入账），返回明细供教师修正
  if (errors.length > 0) {
    const detail = errors.slice(0, 3).map((e) => e.message).join('；');
    const more = errors.length > 3 ? `等共 ${errors.length} 处` : '';
    throw new HttpError(400, `有 ${errors.length} 行数据未通过校验，整批未入账。${detail}${more}`);
  }
  if (awardRows.length === 0) {
    throw new HttpError(400, '所有行的公式结果均为 0 分，未进行加分');
  }

  // 6. 原子入账：单事务逐行锁学生 → 加分 → 写积分明细（全成功或全回滚）
  const { data, error } = await client.rpc('adjust_student_points_batch', {
    p_rows: awardRows,
    p_reason: reason,
  });

  if (error) {
    throw new HttpError(500, translateDbError(error.message));
  }

  return jsonResponse({
    awarded: awardRows.length,
    reason,
    results: data as { student_id: string; delta: number; balance_after: number }[],
    skipped,
  });
};
