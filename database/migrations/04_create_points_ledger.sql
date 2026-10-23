-- ============================================================
-- 04_create_points_ledger.sql —— 积分明细表
-- 执行方式：Supabase 控制台 → SQL Editor，按文件名顺序依次执行
-- ============================================================

CREATE TABLE points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  delta integer NOT NULL,                      -- 积分变动值（正=增加，负=减少）
  balance_after integer NOT NULL,              -- 变动后余额
  reason text NOT NULL,                        -- 变动原因（可扩展枚举，见前端 src/lib/constants.ts）
  actor_id uuid REFERENCES students(id) ON DELETE SET NULL, -- 操作者（管理员ID，系统操作为 NULL）
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_student ON points_ledger(student_id);
CREATE INDEX idx_ledger_created ON points_ledger(created_at DESC);
