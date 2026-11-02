/**
 * 商品卡片：图片（含占位图）、库存徽章、积分价格、数量选择、兑换按钮
 * 网络商品不展示库存（ unlimited ），兑换后在兑换记录中下载
 */
import { useState } from 'react';
import { Coins, Gift, Minus, Plus, Shield } from 'lucide-react';
import { Button } from '../common/Button';
import { cn, formatDateTime, formatPoints } from '../../lib/utils';
import type { Item } from '../../types';

interface ItemCardProps {
  item: Item;
  /** 当前用户积分（用于判断"积分不足"状态） */
  points: number;
  /** 是否正在兑换该商品 */
  redeeming?: boolean;
  onRedeem: (item: Item, quantity: number) => void;
  /** 渐入动画延迟（毫秒） */
  delay?: number;
}

export function ItemCard({ item, points, redeeming = false, onRedeem, delay = 0 }: ItemCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [qty, setQty] = useState(1);

  // 库存对实物商品和网络商品都生效（网络商品也能用库存控制可兑换次数）
  // 0 积分 = 免费商品，不受积分余额限制
  const isFree = item.cost === 0;
  const maxAffordable = isFree ? 99 : Math.floor(points / item.cost);
  const maxQty = Math.max(0, Math.min(item.stock, maxAffordable, 99));
  const effectiveQty = Math.min(qty, maxQty);
  const total = item.cost * effectiveQty;
  const soldOut = item.stock <= 0;
  const insufficient = maxQty < 1 && !soldOut;
  const disabled = soldOut || insufficient || redeeming;

  const clamp = (value: number) => Math.max(1, Math.min(value, maxQty || 1));

  return (
    <div
      className="animate-fade-up group flex flex-col overflow-hidden rounded-xl border border-ink-100 bg-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* 商品图 / 占位图 */}
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-ink-800 to-ink-950">
        {item.image_url && !imageFailed ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            // 不发送 Referer：淘宝/阿里云等图片 CDN 有防盗链，
            // 带本站 Referer 会被 403 拒绝，空来源可正常加载
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Gift className="h-10 w-10 text-white/30" />
          </div>
        )}
        {item.type === 'digital' && (
          <span className="absolute left-2 top-2 rounded-full bg-blue-600/90 px-2.5 py-1 text-xs font-medium text-white">
            <Shield className="mr-1 inline h-3 w-3" />
            网络商品
          </span>
        )}
        <span
          className={cn(
            'absolute right-2 top-2 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur',
            soldOut ? 'bg-red-500/90 text-white' : 'bg-white/90 text-ink-700',
          )}
        >
          {soldOut ? '已售罄' : `库存 ${item.stock}`}
        </span>
      </div>

      {/* 商品信息 */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display font-semibold text-ink-900">{item.name}</h3>
        <p className="line-clamp-2 min-h-[2.5rem] flex-1 text-sm text-ink-500">
          {item.description || '暂无描述'}
        </p>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 font-semibold text-brand-600">
            {isFree ? (
              '免费'
            ) : (
              <>
                <Coins className="h-4 w-4" />
                {formatPoints(item.cost)} 积分
              </>
            )}
          </span>
          {item.expires_at && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
              限时至 {formatDateTime(item.expires_at)}
            </span>
          )}
        </div>

        {/* 数量选择器：可兑换时展示 */}
        {!soldOut && !insufficient && (
          <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
            <span className="text-xs font-medium text-ink-600">兑换数量</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="减少数量"
                disabled={effectiveQty <= 1 || redeeming}
                onClick={() => setQty((prev) => clamp(prev - 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-700 transition-colors hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-semibold text-ink-900">
                {effectiveQty}
              </span>
              <button
                type="button"
                aria-label="增加数量"
                disabled={effectiveQty >= maxQty || redeeming}
                onClick={() => setQty((prev) => clamp(prev + 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-700 transition-colors hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 合计积分 */}
        {!soldOut && !insufficient && (
          <p className="text-xs text-ink-500">
            {isFree ? (
              <span className="font-semibold text-emerald-600">免费商品，不消耗积分</span>
            ) : (
              <>
                合计 <span className="font-semibold text-ink-900">{formatPoints(total)}</span> 积分
              </>
            )}
            {effectiveQty >= maxQty && maxQty > 1 && (
              <span className="ml-1 text-amber-600">
                （已达
                {item.stock <= maxAffordable ? '库存' : '积分可兑换'}
                上限）
              </span>
            )}
          </p>
        )}

        {/* 兑换按钮：售罄/积分不足时禁用 */}
        <Button
          className="mt-1 w-full"
          variant={disabled ? 'outline' : 'primary'}
          disabled={disabled}
          loading={redeeming}
          onClick={() => onRedeem(item, effectiveQty)}
        >
          {soldOut
            ? '已售罄'
            : insufficient
              ? '积分不足'
              : redeeming
                ? '兑换中…'
                : isFree
                  ? '免费兑换'
                  : `立即兑换（${formatPoints(total)} 积分）`}
        </Button>
      </div>
    </div>
  );
}
