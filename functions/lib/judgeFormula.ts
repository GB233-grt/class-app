/**
 * 判断公式引擎（re-export）
 * 单一源：src/lib/judgeFormula.ts（纯 TS、无 DOM 依赖，前后端共用同一实现）
 * 批量加分时后端以本文件重新编译、逐行计算，最终入账金额以后端为准。
 */
export * from '../../src/lib/judgeFormula';
