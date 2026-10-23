-- ============================================================
-- 02_create_items.sql —— 商品（物品）表
-- 执行方式：Supabase 控制台 → SQL Editor，按文件名顺序依次执行
-- ============================================================

CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                          -- 商品名称
  description text,                            -- 商品描述
  cost integer NOT NULL CHECK (cost > 0),      -- 兑换所需积分
  stock integer NOT NULL DEFAULT 0
    CHECK (stock >= 0),                        -- 库存数量
  image_url text,                              -- 商品图片URL
  is_active boolean NOT NULL DEFAULT true,     -- 是否上架（软删除标记，删除=下架）
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_cost ON items(cost ASC);
CREATE INDEX idx_items_active ON items(is_active) WHERE is_active = true;
