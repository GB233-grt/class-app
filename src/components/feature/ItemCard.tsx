/**
 * 商品卡片：商城列表中的商品预览，点击进入详情页
 */
import { useState } from 'react';
import { ArrowRight, Coins, Gift, Package, Shield } from 'lucide-react';
import { cn, formatDateTime, formatPoints } from '../../lib/utils';
import type { Item } from '../../types';

interface ItemCardProps {
  item: Item;
  /** 打开商品详情 */
  onOpen: (item: Item) => void;
  /** 渐入动画延迟（毫秒） */
  delay?: number;
}

export function ItemCard({ item, onOpen, delay = 0 }: ItemCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const soldOut = item.stock <= 0;
  const isFree = item.cost === 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={`查看商品详情：${item.name}`}
      className="animate-fade-up group flex w-full flex-col overflow-hidden rounded-xl border border-ink-100 bg-white text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* 商品图 / 占位图 */}
      <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-ink-100 to-ink-200">
        {item.image_url && !imageFailed ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Gift className="h-10 w-10 text-ink-300" />
          </div>
        )}
        {item.type === 'digital' && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-blue-600/90 px-2.5 py-1 text-xs font-medium text-white">
            <Shield className="h-3 w-3" />
            网络商品
          </span>
        )}
        <span
          className={cn(
            'absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur',
            soldOut ? 'bg-red-500/90 text-white' : 'bg-white/90 text-ink-700',
          )}
        >
          <Package className="h-3 w-3" />
          {soldOut ? '已售罄' : `库存 ${formatPoints(item.stock)}`}
        </span>
      </div>

      {/* 商品信息预览 */}
      <div className="flex w-full flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-base font-semibold text-ink-900">{item.name}</h3>
        <p className="line-clamp-2 min-h-[2.5rem] w-full text-sm leading-relaxed text-ink-500">
          {item.description || '暂无商品描述'}
        </p>
        <div className="mt-auto flex w-full items-end justify-between gap-2 pt-1">
          <span className="flex items-center gap-1 font-semibold text-brand-700">
            {isFree ? (
              '免费'
            ) : (
              <>
                <Coins className="h-4 w-4" />
                {formatPoints(item.cost)} 积分
              </>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-400 transition-colors group-hover:text-brand-700">
            {item.expires_at ? `限时至 ${formatDateTime(item.expires_at)}` : '查看详情'}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}
