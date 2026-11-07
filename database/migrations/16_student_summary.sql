-- ============================================================
-- 16_student_summary.sql —— 学生兑换汇总（分页场景下的准确统计）
-- 执行方式：Supabase 控制台 → SQL Editor，粘贴本文件全部内容 → Run
--
-- 背景：学生端「已兑换件数 / 累计消耗积分」原本由前端累加已加载的记录，
--       分页之后只能统计到前几页。改由数据库聚合，一次返回准确结果。
-- ============================================================

CREATE OR REPLACE FUNCTION student_redemption_summary(p_student_id uuid)
RETURNS TABLE (total_items bigint, total_spent bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 只能查自己（学生端统计用；教职工看的是 /api/stats）
  IF auth.uid() IS DISTINCT FROM p_student_id THEN
    RAISE EXCEPTION '无权限：只能查看自己的兑换汇总';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(COALESCE(quantity, 1)), 0)::bigint                      AS total_items,
    COALESCE(SUM(COALESCE(cost, 0) * COALESCE(quantity, 1)), 0)::bigint  AS total_spent
  FROM redemptions
  WHERE student_id = p_student_id;
END;
$$;

REVOKE ALL ON FUNCTION student_redemption_summary(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION student_redemption_summary(uuid) TO authenticated;

-- 验证
-- select * from student_redemption_summary('<你的学生 UUID>');
