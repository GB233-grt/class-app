/**
 * 判断公式入门 —— 批量加分的专门介绍（模态）
 * 完整教程：概念 / 变量 / 运算 / 比较与逻辑 / 三元运算符 / 函数 / 常用配方 / 注意事项 / 常见错误
 */
import { useEffect, type ReactNode } from 'react';
import { BookOpen, X } from 'lucide-react';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-900">
        <span className="h-3.5 w-1 rounded-full bg-brand-500" aria-hidden="true" />
        {title}
      </h4>
      {children}
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[13px] leading-none text-brand-700">
      {children}
    </code>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-100">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap border-b border-ink-100 bg-ink-50 px-3 py-2 text-left text-xs font-medium text-ink-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-ink-50 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top text-ink-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 教程正文（可复用：帮助弹层等） */
export function FormulaGuide() {
  return (
    <div className="space-y-5">
      {/* 1. 概念 */}
      <Section title="什么是判断公式">
        <p className="text-sm leading-relaxed text-ink-600">
          Excel 每行带一个「判断值」（如作业得分、出勤次数）。判断公式接收这个值，输出
          <b>「该行加多少分」</b>。系统对每一行分别套用，所以判断值不同的学生加的分数可以不同。
        </p>
      </Section>

      {/* 2. 变量 */}
      <Section title="两个变量">
        <Table
          head={['变量', '含义', '例子']}
          rows={[
            [
              <Code>value</Code>,
              '本行的判断值（Excel 中填入的数字）',
              '某行填了 85，则 value = 85',
            ],
            [
              <Code>points</Code>,
              '该学生当前的积分余额（本批加分之前）',
              '学生现有 120 分，则 points = 120',
            ],
          ]}
        />
      </Section>

      {/* 3. 算术 */}
      <Section title="算术运算">
        <p className="text-sm leading-relaxed text-ink-600">
          支持 <Code>+ - * / % ( )</Code>，优先级与数学一致（先乘除后加减）：
          <Code>2 + 3 * 4</Code> = 14；用括号改变顺序 <Code>(2 + 3) * 4</Code> = 20。
          <Code>%</Code> 是取余：<Code>10 % 3</Code> = 1。
        </p>
      </Section>

      {/* 4. 比较与逻辑 */}
      <Section title="比较与逻辑">
        <p className="text-sm leading-relaxed text-ink-600">
          比较：<Code>&gt;= &lt;= &gt; &lt; == !=</Code>，比较的结果是「真/假」，在公式里等于数字
          <Code>1 / 0</Code>。
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          逻辑：<Code>&amp;&amp;</Code> 表示「且」（两边都要成立）、<Code>||</Code> 表示「或」（一边成立即可）。
          例：<Code>value &gt;= 60 &amp;&amp; value &lt;= 100</Code> 表示判断值在 60~100 之间（含两端）。
        </p>
      </Section>

      {/* 5. 三元运算符 */}
      <Section title="三元运算符（核心：按条件给不同分）">
        <p className="text-sm leading-relaxed text-ink-600">
          写法：<Code>条件 ? 成立时的值 : 不成立时的值</Code>。逐步拆解
          <Code>value &gt;= 90 ? 10 : value &gt;= 80 ? 5 : 0</Code>：
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-600">
          <li>
            判断值 <b>95</b>：第一个条件 95 &gt;= 90 成立 → 加 <b>10</b> 分
          </li>
          <li>
            判断值 <b>85</b>：95 那档不成立，看下一档 85 &gt;= 80 成立 → 加 <b>5</b> 分
          </li>
          <li>
            判断值 <b>70</b>：两档都不成立 → 加 <b>0</b> 分（该行跳过，不做变更）
          </li>
        </ul>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          三元可以向右继续嵌套，从而实现三档、四档……任意档位的奖励。
        </p>
      </Section>

      {/* 6. 函数 */}
      <Section title="内置函数">
        <Table
          head={['函数', '作用', '例子']}
          rows={[
            [<Code>min(a,b)</Code>, '取两者中较小', 'min(value, 100)：判断值封顶 100'],
            [<Code>max(a,b)</Code>, '取两者中较大', 'max(value, 0)：最低按 0 计'],
            [<Code>floor(x)</Code>, '向下取整', 'floor(8.9) = 8'],
            [<Code>round(x)</Code>, '四舍五入取整', 'round(8.5) = 9'],
            [<Code>abs(x)</Code>, '绝对值', 'abs(-3) = 3'],
          ]}
        />
      </Section>

      {/* 7. 常用配方 */}
      <Section title="常用配方（可直接复制使用）">
        <div className="space-y-2">
          {[
            {
              name: '分档奖励',
              code: 'value >= 90 ? 10 : value >= 80 ? 5 : 0',
              desc: '90 分以上加 10 分，80 分以上加 5 分，其余不加',
            },
            {
              name: '每档计分（封顶）',
              code: 'floor(min(value / 10, 20))',
              desc: '每 10 分判断值加 1 分，最多加 20 分',
            },
            {
              name: '及格奖励',
              code: 'value >= 60 ? 5 : 0',
              desc: '判断值达到 60（及格）加 5 分',
            },
            {
              name: '定向激励',
              code: 'points < 50 && value >= 60 ? 10 : 0',
              desc: '只对「当前余额不足 50 且本次及格」的学生加 10 分',
            },
            {
              name: '全员固定加分',
              code: '10',
              desc: '公式只写数字时，名单里每人都加同样的分',
            },
            {
              name: '满分加奖',
              code: 'value >= 100 ? 15 : 0',
              desc: '判断值满 100 加 15 分，其余不加',
            },
          ].map((recipe) => (
            <div key={recipe.name} className="rounded-lg bg-ink-50 px-3.5 py-2.5">
              <p className="text-xs font-semibold text-ink-500">{recipe.name}</p>
              <p className="mt-1 font-mono text-[13px] text-ink-900">{recipe.code}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">{recipe.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 8. 注意事项 */}
      <Section title="注意事项">
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-600">
          <li>
            结果必须是<b>整数</b>：除法会产生小数，用 <Code>floor()</Code> 或 <Code>round()</Code> 取整，否则该行校验失败。
          </li>
          <li>
            结果为 <b>0</b> 的行会「不变更」：跳过不加、不写积分明细。
          </li>
          <li>
            <b>不能为负</b>：批量加分只支持加分，任何算出负数的行都会使整批失败。
          </li>
          <li>
            单行加分上限 <b>100000</b>；单批最多 <b>200</b> 行。
          </li>
          <li>
            <b>整批原子入账</b>：只要有一行校验失败，本批一行都不会入账，避免账目混乱。
          </li>
          <li>
            预览仅供参考：提交后服务端用同一份公式重新逐行计算，以服务端结果为准。
          </li>
        </ul>
      </Section>

      {/* 9. 常见错误 */}
      <Section title="常见错误与修复">
        <Table
          head={['提示', '原因', '修复办法']}
          rows={[
            [
              '公式结果 8.5 不是整数',
              '除法产生了小数',
              '用 floor() 或 round() 包住结果',
            ],
            [
              '未知变量 "xxx"',
              '变量名拼错，只能用 value / points',
              '检查拼写；中文输入需切换英文',
            ],
            [
              '三元运算符缺少对应的 ":"',
              '? 与 : 不配对',
              '每个 ? 都要有对应的 : 和兜底值',
            ],
            [
              '公式结果不是有效数字',
              '除数为 0（如 1/value 且 value=0）',
              '先判空：value != 0 ? 1 / value : 0',
            ],
            [
              '教师/管理员不能被加分',
              '匹配到的账号不是学生',
              '在 Excel 中改填该学生的学号',
            ],
          ]}
        />
      </Section>
    </div>
  );
}

/** 完整弹层 */
export function FormulaHelpModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="判断公式入门"
    >
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-fade-up relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink-900">
            <BookOpen className="h-5 w-5 text-brand-500" />
            判断公式入门
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <FormulaGuide />
        <p className="mt-5 rounded-lg bg-brand-50 px-4 py-3 text-xs leading-relaxed text-ink-600">
          在上方公式框输入内容时会<b>实时校验</b>：语法有误会即时标红并提示具体位置；预览表格中每行的加分结果也会随公式即时更新。
        </p>
      </div>
    </div>
  );
}
