/**
 * 判断公式引擎（自定义判断函数）—— 学生批量加分
 *
 * 为教师提供一个安全、可控的「判断值 → 加分」表达式语言：
 *   变量：  value = 本行判断值（Excel 填入，如作业得分）
 *           points = 该学生当前积分余额
 *   运算：  + - * / % ( )
 *   比较：  >= <= > < == !=
 *   逻辑：  && || （数值 0 为假，其余为真）
 *   三元：  条件 ? 值A : 值B（可嵌套）
 *   函数：  min(a,b) max(a,b) floor(x) round(x) abs(x)
 *
 * 实现方式：手写分词器 + 递归下降解析器，不使用 eval / Function，
 * 只能访问 value / points 两个变量与白名单函数，无字符串、无对象访问。
 *
 * 前后端共用本文件（单一源）：
 *   前端（src）实时编译并预览每行结果；
 *   后端（functions/lib/judgeFormula.ts re-export 本文件）重新编译计算，
 *   最终入账金额以后端计算为准，前端预览仅供参考。
 */

/** 公式错误（含出错字符位置，0 起始） */
export class JudgeFormulaError extends Error {
  position: number | null;

  constructor(message: string, position: number | null = null) {
    super(position === null ? message : `${message}（第 ${position + 1} 个字符处）`);
    this.name = 'JudgeFormulaError';
    this.position = position;
  }
}

/** 公式求值时可见的变量 */
export interface JudgeFormulaVars {
  /** 本行判断值（Excel 填入，如作业得分） */
  value: number;
  /** 该学生当前积分余额 */
  points: number;
}

/** 编译后的公式：返回有限数值；结果无效（如除以零）时抛 JudgeFormulaError */
export type CompiledJudgeFormula = (vars: JudgeFormulaVars) => number;

/** 前端输入框占位示例 */
export const JUDGE_FORMULA_EXAMPLE = 'value >= 90 ? 10 : value >= 80 ? 5 : 0';

/** 公式最大长度（防止超长输入） */
export const JUDGE_FORMULA_MAX_LENGTH = 200;

/** 内置函数白名单 */
const FUNCTIONS: Record<string, { arity: number; apply: (nums: number[]) => number }> = {
  min: { arity: 2, apply: ([a, b]) => Math.min(a, b) },
  max: { arity: 2, apply: ([a, b]) => Math.max(a, b) },
  floor: { arity: 1, apply: ([a]) => Math.floor(a) },
  round: { arity: 1, apply: ([a]) => Math.round(a) },
  abs: { arity: 1, apply: ([a]) => Math.abs(a) },
};

const FUNCTION_NAMES = Object.keys(FUNCTIONS);

/**
 * 全角 → 半角逐字符归一化（一一对应替换，错误位置不偏移）
 * 教师常用全角键盘输入，归一化后降低出错率
 */
function normalizeSource(source: string): string {
  const map: Record<number, string> = {
    0xff08: '(', // （
    0xff09: ')', // ）
    0xff0c: ',', // ，
    0xff1f: '?', // ？
    0xff1a: ':', // ：
    0xff0b: '+', // ＋
    0xff0d: '-', // －
    0xff0a: '*', // ＊
    0xff0f: '/', // ／
    0xff05: '%', // ％
    0xff1c: '<', // ＜
    0xff1e: '>', // ＞
    0xff1d: '=', // ＝
  };
  for (let i = 0; i < 10; i += 1) {
    map[0xff10 + i] = String(i); // ０-９
  }
  let out = '';
  for (let i = 0; i < source.length; i += 1) {
    out += map[source.charCodeAt(i)] ?? source[i];
  }
  return out;
}

interface Token {
  kind: 'num' | 'ident' | 'op';
  text: string;
  num?: number;
  pos: number;
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || isDigit(ch) || ch === '_';
}

/** 分词：数字 / 标识符 / 运算符 */
function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    // 空白（含全角空格）
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\u00a0') {
      i += 1;
      continue;
    }
    // 数字（支持小数）
    if (isDigit(ch) || (ch === '.' && isDigit(src[i + 1] ?? ''))) {
      const start = i;
      while (i < src.length && (isDigit(src[i]) || src[i] === '.')) i += 1;
      const text = src.slice(start, i);
      const num = Number(text);
      if (Number.isNaN(num)) throw new JudgeFormulaError(`无效数字 "${text}"`, start);
      tokens.push({ kind: 'num', text, num, pos: start });
      continue;
    }
    // 标识符（变量 / 函数名）
    if (isIdentStart(ch)) {
      const start = i;
      while (i < src.length && isIdentPart(src[i])) i += 1;
      tokens.push({ kind: 'ident', text: src.slice(start, i), pos: start });
      continue;
    }
    // 双字符运算符
    const two = src.slice(i, i + 2);
    if (two === '>=' || two === '<=' || two === '==' || two === '!=' || two === '&&' || two === '||') {
      tokens.push({ kind: 'op', text: two, pos: i });
      i += 2;
      continue;
    }
    // 单字符运算符
    if ('+-*/%<>()?:,'.includes(ch)) {
      tokens.push({ kind: 'op', text: ch, pos: i });
      i += 1;
      continue;
    }
    throw new JudgeFormulaError(`无法识别的字符 "${ch}"`, i);
  }
  return tokens;
}

type ExprFn = (vars: JudgeFormulaVars) => number;

/** 递归下降解析器（运算符优先级从低到高：三元 → || → && → 比较相等 → 关系 → 加减 → 乘除模 → 一元 → 原语） */
class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | null {
    return this.tokens[this.pos] ?? null;
  }

  private next(): Token | null {
    const token = this.tokens[this.pos] ?? null;
    this.pos += 1;
    return token;
  }

  private expect(op: string, hint: string): void {
    const token = this.peek();
    if (!token || token.text !== op) {
      throw new JudgeFormulaError(hint, token ? token.pos : null);
    }
    this.next();
  }

  /** 入口：完整表达式，且不允许有多余尾部内容 */
  parse(): CompiledJudgeFormula {
    if (this.tokens.length === 0) {
      throw new JudgeFormulaError('公式不能为空');
    }
    const expr = this.parseTernary();
    const leftover = this.peek();
    if (leftover) {
      throw new JudgeFormulaError(`表达式在 "${leftover.text}" 处有多余内容`, leftover.pos);
    }
    return (vars) => {
      const result = expr(vars);
      if (!Number.isFinite(result)) {
        throw new JudgeFormulaError('公式结果不是有效数字（可能存在除以零）');
      }
      return result;
    };
  }

  private parseTernary(): ExprFn {
    const cond = this.parseOr();
    const q = this.peek();
    if (q && q.text === '?') {
      this.next();
      const yes = this.parseTernary();
      const colon = this.peek();
      if (!colon || colon.text !== ':') {
        throw new JudgeFormulaError('三元运算符缺少对应的 ":"', q.pos);
      }
      this.next();
      const no = this.parseTernary();
      return (vars) => (cond(vars) !== 0 ? yes(vars) : no(vars));
    }
    return cond;
  }

  private parseOr(): ExprFn {
    let left = this.parseAnd();
    for (;;) {
      const t = this.peek();
      if (t && t.text === '||') {
        this.next();
        const right = this.parseAnd();
        const l = left;
        left = (vars) => (l(vars) !== 0 || right(vars) !== 0 ? 1 : 0);
        continue;
      }
      return left;
    }
  }

  private parseAnd(): ExprFn {
    let left = this.parseEquality();
    for (;;) {
      const t = this.peek();
      if (t && t.text === '&&') {
        this.next();
        const right = this.parseEquality();
        const l = left;
        left = (vars) => (l(vars) !== 0 && right(vars) !== 0 ? 1 : 0);
        continue;
      }
      return left;
    }
  }

  private parseEquality(): ExprFn {
    let left = this.parseRelational();
    for (;;) {
      const t = this.peek();
      if (t && (t.text === '==' || t.text === '!=')) {
        this.next();
        const right = this.parseRelational();
        const l = left;
        const op = t.text;
        left = (vars) => (op === '==' ? (l(vars) === right(vars) ? 1 : 0) : l(vars) !== right(vars) ? 1 : 0);
        continue;
      }
      return left;
    }
  }

  private parseRelational(): ExprFn {
    let left = this.parseAdditive();
    for (;;) {
      const t = this.peek();
      if (t && (t.text === '>=' || t.text === '<=' || t.text === '>' || t.text === '<')) {
        this.next();
        const right = this.parseAdditive();
        const l = left;
        const op = t.text;
        left = (vars) => {
          const a = l(vars);
          const b = right(vars);
          const ok = op === '>=' ? a >= b : op === '<=' ? a <= b : op === '>' ? a > b : a < b;
          return ok ? 1 : 0;
        };
        continue;
      }
      return left;
    }
  }

  private parseAdditive(): ExprFn {
    let left = this.parseMultiplicative();
    for (;;) {
      const t = this.peek();
      if (t && (t.text === '+' || t.text === '-')) {
        this.next();
        const right = this.parseMultiplicative();
        const l = left;
        const op = t.text;
        left = (vars) => (op === '+' ? l(vars) + right(vars) : l(vars) - right(vars));
        continue;
      }
      return left;
    }
  }

  private parseMultiplicative(): ExprFn {
    let left = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t && (t.text === '*' || t.text === '/' || t.text === '%')) {
        this.next();
        const right = this.parseUnary();
        const l = left;
        const op = t.text;
        left = (vars) => {
          const a = l(vars);
          const b = right(vars);
          if (op === '*') return a * b;
          if (op === '/') return a / b;
          return a % b;
        };
        continue;
      }
      return left;
    }
  }

  private parseUnary(): ExprFn {
    const t = this.peek();
    if (t && (t.text === '-' || t.text === '+')) {
      this.next();
      const operand = this.parseUnary();
      return t.text === '-' ? (vars) => -operand(vars) : operand;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExprFn {
    const t = this.next();
    if (!t) {
      throw new JudgeFormulaError('表达式不完整（缺少右侧内容）');
    }
    if (t.kind === 'num') {
      const n = t.num as number;
      return () => n;
    }
    if (t.kind === 'ident') {
      const name = t.text;
      const nextToken = this.peek();
      // 函数调用
      if (nextToken && nextToken.text === '(') {
        const fn = FUNCTIONS[name];
        if (!fn) {
          if (name === 'value' || name === 'points') {
            throw new JudgeFormulaError(`变量 "${name}" 不能作为函数调用`, t.pos);
          }
          throw new JudgeFormulaError(`未知函数 "${name}"（可用函数：${FUNCTION_NAMES.join(' / ')}）`, t.pos);
        }
        this.next(); // 吃掉 "("
        const args: ExprFn[] = [];
        if (this.peek()?.text !== ')') {
          args.push(this.parseTernary());
          while (this.peek()?.text === ',') {
            this.next();
            args.push(this.parseTernary());
          }
        }
        this.expect(')', `函数 ${name}(...) 缺少右括号 ")"`);
        if (args.length !== fn.arity) {
          throw new JudgeFormulaError(`函数 ${name} 需要 ${fn.arity} 个参数，实际给了 ${args.length} 个`, t.pos);
        }
        return (vars) => fn.apply(args.map((a) => a(vars)));
      }
      // 变量
      if (name === 'value' || name === 'points') {
        return (vars) => vars[name];
      }
      throw new JudgeFormulaError(
        `未知变量 "${name}"（可用变量：value 判断值、points 当前积分；可用函数：${FUNCTION_NAMES.join(' / ')}）`,
        t.pos,
      );
    }
    if (t.text === '(') {
      const inner = this.parseTernary();
      this.expect(')', '缺少右括号 ")"');
      return inner;
    }
    throw new JudgeFormulaError(`此处不应出现 "${t.text}"`, t.pos);
  }
}

/**
 * 编译判断公式
 * @throws JudgeFormulaError 语法错误（含中文提示与位置）
 */
export function compileJudgeFormula(source: string): CompiledJudgeFormula {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    throw new JudgeFormulaError('公式不能为空');
  }
  if (trimmed.length > JUDGE_FORMULA_MAX_LENGTH) {
    throw new JudgeFormulaError(`公式不能超过 ${JUDGE_FORMULA_MAX_LENGTH} 个字符`);
  }
  const tokens = tokenize(normalizeSource(trimmed));
  return new Parser(tokens).parse();
}
