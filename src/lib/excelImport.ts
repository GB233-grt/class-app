/**
 * Excel 批量导入学生：解析工作簿 → 表头别名映射 → 逐行校验
 * xlsx 库按需动态加载（仅管理员打开导入面板时才会下载该代码块）
 *
 * 模板列（表头支持以下别名，顺序不限）：
 *   姓名（必填）、学号（选填）、邮箱（必填，唯一）、初始密码（选填，留空自动生成）、
 *   初始积分（选填，默认 0）、角色（选填：学生/教师，默认 学生）
 *
 * 批量加分模板（parseBulkAwardWorkbook）：
 *   学号（选填）/ 姓名（选填，两者至少填一项）、判断值（必填，数字，如作业得分）
 */
export type ImportRole = 'student' | 'teacher';

import type { WorkBook } from 'xlsx';

/** 单行导入状态 */
export type ImportStatus = 'ready' | 'error' | 'importing' | 'success' | 'failed';

export interface ImportRow {
  /** Excel 数据行号（表头为第 1 行，数据从 2 开始） */
  index: number;
  name: string;
  student_no: string;
  email: string;
  /** 留空时解析阶段已自动生成，预览中直接可见 */
  password: string;
  /** 非负整数字符串 */
  points: string;
  role: ImportRole;
  status: ImportStatus;
  /** 校验失败原因 / 导入结果 / 自动生成提示 */
  message: string;
}

/** 支持的表头别名 → 字段（键为归一化后的表头：去空格、转小写） */
const FIELD_ALIASES: Record<string, keyof ImportFieldValues> = {
  姓名: 'name',
  名字: 'name',
  学生姓名: 'name',
  name: 'name',
  学号: 'student_no',
  编号: 'student_no',
  学生编号: 'student_no',
  student_no: 'student_no',
  studentno: 'student_no',
  邮箱: 'email',
  电子邮件: 'email',
  电子邮箱: 'email',
  邮箱地址: 'email',
  email: 'email',
  初始密码: 'password',
  密码: 'password',
  password: 'password',
  初始积分: 'points',
  积分: 'points',
  points: 'points',
  角色: 'role',
  身份: 'role',
  role: 'role',
};

interface ImportFieldValues {
  name: string;
  student_no: string;
  email: string;
  password: string;
  points: string;
  role: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NON_NEGATIVE_INT = /^\d{1,6}$/;

/** 归一化表头：去首尾及中间空白、转小写 */
function normalizeHeader(key: string): string {
  return String(key).trim().toLowerCase().replace(/\s+/g, '');
}

/** 从一行原始数据中按别名提取字段 */
function pickFields(raw: Record<string, unknown>): ImportFieldValues {
  const picked: ImportFieldValues = { name: '', student_no: '', email: '', password: '', points: '', role: '' };
  for (const [key, value] of Object.entries(raw)) {
    const field = FIELD_ALIASES[normalizeHeader(key)];
    if (field) {
      picked[field] = String(value ?? '').trim();
    }
  }
  return picked;
}

/** 角色中文 → 枚举；返回 null 表示非法 */
function mapRole(raw: string): ImportRole | null {
  const value = raw.trim().toLowerCase();
  if (value === '') return 'student';
  if (['学生', 'student', '同学'].includes(value)) return 'student';
  if (['教师', '老师', 'teacher'].includes(value)) return 'teacher';
  return null;
}

/** 生成 8 位随机密码（字母 + 数字，避开易混淆字符），前缀 S 便于口头告知 */
function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const random = new Uint32Array(7);
  crypto.getRandomValues(random);
  let password = 'S';
  for (let i = 0; i < random.length; i++) {
    password += chars[random[i] % chars.length];
  }
  return password;
}

/**
 * 解析并校验学生导入表格
 * @param file 用户选择的 .xlsx / .xls / .csv 文件
 * @param existingEmails 系统中已注册的邮箱（小写），用于预检重复
 */
export async function parseStudentWorkbook(
  file: File,
  existingEmails: Set<string>,
): Promise<{ rows: ImportRow[]; sheetName: string; total: number }> {
  const XLSX = await import('xlsx');

  let workbook: WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  } catch {
    throw new Error('无法读取该文件，请使用 .xlsx / .xls / .csv 格式');
  }

  // 取第一个有数据的工作表
  let records: Record<string, unknown>[] = [];
  let sheetName = '';
  for (const name of workbook.SheetNames) {
    const sheetRecords = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[name],
      { defval: '' },
    );
    if (sheetRecords.length > 0) {
      records = sheetRecords;
      sheetName = name;
      break;
    }
  }
  if (records.length === 0) {
    throw new Error('表格中没有数据行。第 1 行需为表头（姓名/学号/邮箱/初始密码/初始积分/角色），数据从第 2 行开始');
  }

  const rows: ImportRow[] = [];
  const seenEmails = new Set<string>();

  records.forEach((raw, i) => {
    const index = i + 2; // 表头占第 1 行
    const fields = pickFields(raw);

    const role = mapRole(fields.role);
    if (role === null) {
      rows.push({ index, ...fields, role: 'student', status: 'error', message: '角色只能是「学生」或「教师」' });
      return;
    }

    // 必填与格式校验
    if (!fields.name) {
      rows.push({ index, ...fields, role, status: 'error', message: '缺少姓名' });
      return;
    }
    if (fields.name.length > 20) {
      rows.push({ index, ...fields, role, status: 'error', message: '姓名不能超过 20 个字' });
      return;
    }
    if (!EMAIL_PATTERN.test(fields.email)) {
      rows.push({ index, ...fields, role, status: 'error', message: '邮箱格式不正确' });
      return;
    }
    if (fields.password && (fields.password.length < 6 || fields.password.length > 32)) {
      rows.push({ index, ...fields, role, status: 'error', message: '初始密码需为 6~32 位' });
      return;
    }
    if (fields.points && !NON_NEGATIVE_INT.test(fields.points)) {
      rows.push({ index, ...fields, role, status: 'error', message: '初始积分必须是非负整数' });
      return;
    }
    if (fields.student_no.length > 20) {
      rows.push({ index, ...fields, role, status: 'error', message: '学号不能超过 20 个字' });
      return;
    }
    // 重复检查：先查表格内部，再查系统已有账号
    const emailKey = fields.email.toLowerCase();
    if (seenEmails.has(emailKey)) {
      rows.push({ index, ...fields, role, status: 'error', message: '邮箱在本表格中重复出现' });
      return;
    }
    if (existingEmails.has(emailKey)) {
      rows.push({ index, ...fields, role, status: 'error', message: '该邮箱已被注册' });
      return;
    }
    seenEmails.add(emailKey);

    const generated = fields.password === '';
    rows.push({
      index,
      name: fields.name,
      student_no: fields.student_no,
      email: fields.email,
      password: generated ? generatePassword() : fields.password,
      points: fields.points === '' ? '0' : fields.points,
      role,
      status: 'ready',
      message: generated ? '密码为自动生成' : '',
    });
  });

  return { rows, sheetName, total: records.length };
}

// ============================================================
// 批量加分（教师）：解析工作簿 → 表头别名映射 → 逐行校验
// 模板列：学号（选填）/ 姓名（选填，两者至少填一项）、判断值（必填，数字）
// ============================================================

export interface BulkAwardRow {
  /** Excel 数据行号（表头为第 1 行，数据从 2 开始） */
  index: number;
  student_no: string;
  name: string;
  /** 判断值（如作业得分）；null 表示本行格式无效（见 message） */
  value: number | null;
  status: 'ready' | 'error';
  message: string;
}

/** 批量加分表头别名 → 字段（键为归一化后的表头） */
const BULK_AWARD_ALIASES: Record<string, 'student_no' | 'name' | 'value'> = {
  学号: 'student_no',
  编号: 'student_no',
  学生编号: 'student_no',
  studentno: 'student_no',
  student_no: 'student_no',
  姓名: 'name',
  名字: 'name',
  学生姓名: 'name',
  name: 'name',
  判断值: 'value',
  得分: 'value',
  分数: 'value',
  成绩: 'value',
  数量: 'value',
  value: 'value',
  score: 'value',
};

/**
 * 解析批量加分表格
 * @param file 用户选择的 .xlsx / .xls / .csv 文件
 */
export async function parseBulkAwardWorkbook(
  file: File,
): Promise<{ rows: BulkAwardRow[]; sheetName: string; total: number }> {
  const XLSX = await import('xlsx');

  let workbook: WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  } catch {
    throw new Error('无法读取该文件，请使用 .xlsx / .xls / .csv 格式');
  }

  // 取第一个有数据的工作表
  let records: Record<string, unknown>[] = [];
  let sheetName = '';
  for (const name of workbook.SheetNames) {
    const sheetRecords = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], {
      defval: '',
    });
    if (sheetRecords.length > 0) {
      records = sheetRecords;
      sheetName = name;
      break;
    }
  }
  if (records.length === 0) {
    throw new Error('表格中没有数据行。第 1 行需为表头（学号/姓名/判断值），数据从第 2 行开始');
  }

  const rows: BulkAwardRow[] = [];
  const seen = new Set<string>();

  records.forEach((raw, i) => {
    const index = i + 2; // 表头占第 1 行
    const picked: { student_no: string; name: string; value: string } = {
      student_no: '',
      name: '',
      value: '',
    };
    for (const [key, value] of Object.entries(raw)) {
      const field = BULK_AWARD_ALIASES[normalizeHeader(key)];
      if (field) {
        picked[field] = String(value ?? '').trim();
      }
    }

    const base = { index, student_no: picked.student_no, name: picked.name };

    if (!picked.student_no && !picked.name) {
      rows.push({ ...base, value: null, status: 'error', message: '学号与姓名至少填写一项' });
      return;
    }
    if (picked.student_no.length > 20) {
      rows.push({ ...base, value: null, status: 'error', message: '学号不能超过 20 个字' });
      return;
    }
    if (picked.name.length > 20) {
      rows.push({ ...base, value: null, status: 'error', message: '姓名不能超过 20 个字' });
      return;
    }
    if (picked.value === '') {
      rows.push({ ...base, value: null, status: 'error', message: '缺少判断值' });
      return;
    }
    const value = Number(picked.value);
    if (!Number.isFinite(value) || Math.abs(value) > 1e9) {
      rows.push({ ...base, value: null, status: 'error', message: '判断值必须是有效数字' });
      return;
    }
    // 重复检查：按学号（无学号则按姓名）去重
    const dedupeKey = (picked.student_no || picked.name).toLowerCase();
    if (seen.has(dedupeKey)) {
      rows.push({ ...base, value, status: 'error', message: '在本表格中重复出现' });
      return;
    }
    seen.add(dedupeKey);

    rows.push({ ...base, value, status: 'ready', message: '' });
  });

  return { rows, sheetName, total: records.length };
}
