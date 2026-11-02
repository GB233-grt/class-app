-- ============================================================
-- redeem_item.test.sql —— 兑换函数的行为测试（积分 / 库存原子性）
-- 执行方式：Supabase 控制台 → SQL Editor，整段粘贴后 Run
--
-- 说明：
--   · 全程在一个事务里跑，最后 ROLLBACK，不会留下任何测试数据
--   · 任意断言失败会抛异常并终止，控制台会显示具体是哪个场景挂了
--   · 期望结果：运行结束后只看到 "DO" 和 "ROLLBACK"，没有任何错误
--
-- 覆盖场景：
--   1. 实物商品：扣积分、扣库存、记录状态为 pending
--   2. 网络商品：扣积分、扣库存、自动 fulfilled 并写入下载链接
--   3. 库存不足时拒绝兑换，且不产生任何副作用
--   4. 积分不足时拒绝兑换
--   5. 0 积分免费商品：积分不变、库存照扣、不写积分明细
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 测试数据（固定 UUID，方便定位）
-- ------------------------------------------------------------
insert into students (id, name, email, role, points) values
  ('00000000-0000-0000-0000-0000000000a1', '测试学生', 'ci_student@example.com', 'student', 100);

insert into items (id, name, cost, stock, type, is_active, download_url) values
  ('00000000-0000-0000-0000-0000000000b1', '测试实物', 5, 2, 'physical', true, null),
  ('00000000-0000-0000-0000-0000000000b2', '测试网络', 5, 1, 'digital', true, 'https://example.com/a.pdf'),
  ('00000000-0000-0000-0000-0000000000b3', '测试免费', 0, 3, 'physical', true, null);

-- 伪造 JWT：让 auth.uid() 返回测试学生（redeem_item 内部有 auth.uid() 校验）
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-0000000000a1')::text,
  true
);

do $$
declare
  v_points          integer;
  v_stock           integer;
  v_status          text;
  v_download        text;
  v_ledger_before   integer;
  v_ledger_after    integer;
  v_before          integer;
  v_after           integer;
  v_err             text;
begin
  -- 场景 1：实物商品 --------------------------------------------------
  perform redeem_item(
    '00000000-0000-0000-0000-0000000000a1'::uuid,
    '00000000-0000-0000-0000-0000000000b1'::uuid,
    1
  );

  select points into v_points from students where id = '00000000-0000-0000-0000-0000000000a1';
  if v_points <> 95 then
    raise exception '场景1失败：实物兑换后余额应为 95，实际 %', v_points;
  end if;

  select stock into v_stock from items where id = '00000000-0000-0000-0000-0000000000b1';
  if v_stock <> 1 then
    raise exception '场景1失败：实物兑换后库存应为 1，实际 %', v_stock;
  end if;

  select status into v_status from redemptions
   where item_id = '00000000-0000-0000-0000-0000000000b1'
   order by created_at desc limit 1;
  if v_status <> 'pending' then
    raise exception '场景1失败：实物兑换记录状态应为 pending，实际 %', v_status;
  end if;

  -- 场景 2：网络商品 --------------------------------------------------
  select count(*) into v_ledger_before from points_ledger
   where student_id = '00000000-0000-0000-0000-0000000000a1';

  perform redeem_item(
    '00000000-0000-0000-0000-0000000000a1'::uuid,
    '00000000-0000-0000-0000-0000000000b2'::uuid,
    1
  );

  select points into v_points from students where id = '00000000-0000-0000-0000-0000000000a1';
  if v_points <> 90 then
    raise exception '场景2失败：网络商品兑换后余额应为 90，实际 %', v_points;
  end if;

  select stock into v_stock from items where id = '00000000-0000-0000-0000-0000000000b2';
  if v_stock <> 0 then
    raise exception '场景2失败：网络商品兑换后库存应为 0，实际 %', v_stock;
  end if;

  select status, download_url into v_status, v_download from redemptions
   where item_id = '00000000-0000-0000-0000-0000000000b2'
   order by created_at desc limit 1;
  if v_status <> 'fulfilled' then
    raise exception '场景2失败：网络商品应自动 fulfilled，实际 %', v_status;
  end if;
  if v_download is null or v_download = '' then
    raise exception '场景2失败：网络商品兑换记录缺少下载链接';
  end if;

  select count(*) into v_ledger_after from points_ledger
   where student_id = '00000000-0000-0000-0000-0000000000a1';
  if v_ledger_after <> v_ledger_before + 1 then
    raise exception '场景2失败：应新增 1 条积分明细，实际新增 %', v_ledger_after - v_ledger_before;
  end if;

  -- 场景 3：库存不足（网络商品库存已为 0）------------------------------
  v_err := null;
  begin
    perform redeem_item(
      '00000000-0000-0000-0000-0000000000a1'::uuid,
      '00000000-0000-0000-0000-0000000000b2'::uuid,
      1
    );
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null then
    raise exception '场景3失败：库存为 0 时仍兑换成功';
  end if;
  if v_err not like '%库存不足%' then
    raise exception '场景3失败：期望库存不足提示，实际「%」', v_err;
  end if;

  select points into v_points from students where id = '00000000-0000-0000-0000-0000000000a1';
  if v_points <> 90 then
    raise exception '场景3失败：兑换失败不应扣积分，实际余额 %', v_points;
  end if;

  -- 场景 4：积分不足 --------------------------------------------------
  v_err := null;
  begin
    perform redeem_item(
      '00000000-0000-0000-0000-0000000000a1'::uuid,
      '00000000-0000-0000-0000-0000000000b1'::uuid,
      99
    );
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null or v_err not like '%积分不足%' then
    raise exception '场景4失败：期望积分不足提示，实际「%」', coalesce(v_err, '无错误');
  end if;

  -- 场景 5：0 积分免费商品 ---------------------------------------------
  select points into v_before from students where id = '00000000-0000-0000-0000-0000000000a1';
  select count(*) into v_ledger_before from points_ledger
   where student_id = '00000000-0000-0000-0000-0000000000a1';

  perform redeem_item(
    '00000000-0000-0000-0000-0000000000a1'::uuid,
    '00000000-0000-0000-0000-0000000000b3'::uuid,
    1
  );

  select points into v_after from students where id = '00000000-0000-0000-0000-0000000000a1';
  select count(*) into v_ledger_after from points_ledger
   where student_id = '00000000-0000-0000-0000-0000000000a1';
  select stock into v_stock from items where id = '00000000-0000-0000-0000-0000000000b3';

  if v_after <> v_before then
    raise exception '场景5失败：免费商品不应改变积分，% -> %', v_before, v_after;
  end if;
  if v_stock <> 2 then
    raise exception '场景5失败：免费商品库存应为 2，实际 %', v_stock;
  end if;
  if v_ledger_after <> v_ledger_before then
    raise exception '场景5失败：免费商品不应写积分明细，新增 % 条', v_ledger_after - v_ledger_before;
  end if;

  raise notice '全部场景通过 ✅';
end $$;

rollback;
