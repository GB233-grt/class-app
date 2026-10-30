-- ============================================================
-- 08_batch_points_adjust.sql —— 批量加分（原子批量入账）
-- 执行方式：Supabase 控制台 → SQL Editor → 粘贴本文件全部内容 → Run
--
-- 适用对象：已经执行过 01~07 的现有数据库（增量升级，不影响已有数据）
--
-- 内容：新增 adjust_student_points_batch 安全函数
--   1. 一次调用批量为多名学生加分，整批在同一个事务内原子完成（全成功或全回滚）
--   2. 每名学生：锁行 → 校验角色（仅学生可被加分）→ 加积分 → 写积分明细
--   3. 返回每行结果：[{student_id, delta, balance_after}]
--   4. 权限与 07 的 adjust_student_points 一致：仅教职工（教师/管理员）可调用
--
-- 说明：执行一次即可。函数使用 CREATE OR REPLACE，重复执行无害
-- ============================================================

CREATE OR REPLACE FUNCTION adjust_student_points_batch(
  p_rows jsonb,     -- 形如 [{"student_id":"uuid","delta":5}]
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row      jsonb;
  v_sid      uuid;
  v_delta    integer;
  v_student  record;
  v_balance  integer;
  v_result   jsonb := '[]'::jsonb;
BEGIN
  -- 权限：仅教师 / 管理员
  IF NOT is_current_staff() THEN
    RAISE EXCEPTION '无权限：仅教师或管理员可调整积分';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION '请填写积分变动原因';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION '批量数据格式错误';
  END IF;
  IF jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION '批量名单为空';
  END IF;
  IF jsonb_array_length(p_rows) > 200 THEN
    RAISE EXCEPTION '单次批量不能超过 200 名学生';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    BEGIN
      v_sid := (v_row->>'student_id')::uuid;
      v_delta := (v_row->>'delta')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION '批量数据格式错误：%', v_row;
    END;

    IF v_delta < 1 THEN
      RAISE EXCEPTION '加分值必须为正整数（批量加分不支持扣分或 0 分）';
    END IF;
    IF v_delta > 100000 THEN
      RAISE EXCEPTION '单名学生加分值不能超过 100000';
    END IF;

    -- 锁定学生行，防止并发操作
    SELECT * INTO v_student FROM students WHERE id = v_sid FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION '学生不存在：%', v_row->>'student_id';
    END IF;
    IF v_student.role <> 'student' THEN
      RAISE EXCEPTION '仅学生可被加分：%（%）', v_student.name, v_student.role;
    END IF;

    v_balance := v_student.points + v_delta;
    UPDATE students SET points = v_balance WHERE id = v_sid;

    INSERT INTO points_ledger (student_id, delta, balance_after, reason, actor_id)
    VALUES (v_sid, v_delta, v_balance, trim(p_reason), auth.uid());

    v_result := v_result || jsonb_build_object(
      'student_id', v_sid,
      'delta', v_delta,
      'balance_after', v_balance
    );
  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION adjust_student_points_batch(jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION adjust_student_points_batch(jsonb, text) TO authenticated;
