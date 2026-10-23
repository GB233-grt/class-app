/**
 * 商品卡片：图片（含占位图）、库存徽章、积分价格、兑换按钮
 */
import { useState } from 'react';
import { Coins, Gift } from 'lucide-react';
import { Button } from '../common/Button';
import { cn, formatPoints } from '../../lib/utils';
import type { Item } from '../../types';

interface ItemCardProps {
  item: Item;
  /** 当前用户积分（用于判断"积分不足"状态） */
  points: number;
  /** 是否正在兑换该商品 */
  redeeming?: boolean;
  onRedeem: (item: Item) => void;
  /** 渐入动画延迟（毫秒） */
  delay?: number;
}

export function ItemCard({ item, points, redeeming = false, onRedeem, delay = 0 }: ItemCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const soldOut = item.stock <= 0;
  const insufficient = points < item.cost;
  const disabled = soldOut || insufficient;

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
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Gift className="h-10 w-10 text-white/30" />
          </div>
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
            <Coins className="h-4 w-4" />
            {formatPoints(item.cost)} 积分
          </span>
        </div>

        {/* 兑换按钮：售罄/积分不足时禁用 */}
        <Button
          className="mt-1 w-full"
          variant={disabled ? 'outline' : 'primary'}
          disabled={disabled}
          loading={redeeming}
          onClick={() => onRedeem(item)}
        >
          {soldOut ? '已售罄' : insufficient ? '积分不足' : '立即兑换'}
        </Button>
      </div>
    </div>
  );
}
