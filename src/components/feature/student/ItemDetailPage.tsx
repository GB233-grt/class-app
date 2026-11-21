/**
 * 商品详情页：让学生先查看商品信息，再确认兑换。
 * 展示库存、上架时间、配图、价格和数量，兑换操作仍复用既有 StorePanel 回调。
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Coins, Gift, Minus, Package, Plus, Shield } from 'lucide-react';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { cn, formatDateTime, formatPoints } from '../../../lib/utils';
import type { Item } from '../../../types';

interface ItemDetailPageProps {
  item: Item;
  points: number;
  redeeming?: boolean;
  onBack: () => void;
  onRedeem: (item: Item, quantity: number) => void;
}

export function ItemDetailPage({
  item,
  points,
  redeeming = false,
  onBack,
  onRedeem,
}: ItemDetailPageProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // 商品切换时重置本地 UI 状态。
  useEffect(() => {
    setImageFailed(false);
    setQuantity(1);
  }, [item.id]);

  const isFree = item.cost === 0;
  const affordable = isFree ? 99 : Math.floor(points / item.cost);
  const maxQuantity = Math.max(0, Math.min(item.stock, affordable, 99));
  const selectedQuantity = Math.min(quantity, maxQuantity);
  const totalCost = item.cost * selectedQuantity;
  const soldOut = item.stock <= 0;
  const insufficient = !soldOut && maxQuantity < 1;
  const disabled = soldOut || insufficient || redeeming;

  return (
    <section className="mx-auto max-w-4xl animate-fade-up space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        <ArrowLeft className="h-4 w-4" />
        返回商品列表
      </button>

      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-[1.08fr_0.92fr]">
          {/* 图片区域 */}
          <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden bg-ink-100 md:min-h-[480px]">
            {item.image_url && !imageFailed ? (
              <img
                src={item.image_url}
                alt={item.name}
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
                className="h-full max-h-[560px] min-h-[260px] w-full object-cover"
              />
            ) : (
              <div className="flex min-h-[260px] w-full items-center justify-center bg-gradient-to-br from-ink-100 to-ink-200 md:min-h-[480px]">
                <Gift className="h-16 w-16 text-ink-300" />
              </div>
            )}
            {item.type === 'digital' && (
              <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                <Shield className="h-3.5 w-3.5" />
                网络商品
              </span>
            )}
          </div>

          {/* 商品信息与兑换区 */}
          <div className="flex flex-col p-5 sm:p-7 md:p-8">
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold leading-snug text-ink-950 sm:text-3xl">
                {item.name}
              </h1>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600 sm:text-base">
                {item.description || '暂无商品描述'}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="flex items-center gap-1.5 text-lg font-bold text-brand-700">
                  {isFree ? (
                    <span>免费</span>
                  ) : (
                    <>
                      <Coins className="h-5 w-5" />
                      {formatPoints(item.cost)} 积分
                    </>
                  )}
                </span>
                {item.type === 'physical' && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                      soldOut ? 'bg-red-50 text-red-700' : 'bg-ink-100 text-ink-700',
                    )}
                  >
                    <Package className="h-3.5 w-3.5" />
                    {soldOut ? '已售罄' : `剩余 ${formatPoints(item.stock)} 件`}
                  </span>
                )}
              </div>

              <dl className="mt-6 divide-y divide-ink-100 border-y border-ink-100 text-sm">
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="flex items-center gap-2 text-ink-500">
                    <CalendarDays className="h-4 w-4" />
                    上架时间
                  </dt>
                  <dd className="text-right font-medium text-ink-800">
                    {formatDateTime(item.created_at)}
                  </dd>
                </div>
                {item.type === 'digital' && (
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="flex items-center gap-2 text-ink-500">
                      <Package className="h-4 w-4" />
                      剩余库存
                    </dt>
                    <dd className={cn('text-right font-semibold', soldOut ? 'text-red-600' : 'text-ink-800')}>
                      {soldOut ? '已售罄' : `${formatPoints(item.stock)} 份`}
                    </dd>
                  </div>
                )}
                {item.expires_at && (
                  <div className="flex items-center justify-between gap-3 py-3">
                    <dt className="text-ink-500">活动截止</dt>
                    <dd className="text-right font-medium text-amber-700">
                      {formatDateTime(item.expires_at)}
                    </dd>
                  </div>
                )}
                {isFree && (
                  <div className="flex items-center gap-2 py-3 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <dt>免费领取，不消耗积分</dt>
                  </div>
                )}
              </dl>
            </div>

            {/* 兑换数量与确认 */}
            <div className="mt-6 space-y-4">
              {!soldOut && !insufficient && (
                <div className="flex items-center justify-between rounded-lg bg-ink-50 px-4 py-3">
                  <span className="text-sm font-medium text-ink-700">兑换数量</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="减少兑换数量"
                      disabled={selectedQuantity <= 1 || redeeming}
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-lg font-semibold tabular-nums text-ink-900">
                      {selectedQuantity}
                    </span>
                    <button
                      type="button"
                      aria-label="增加兑换数量"
                      disabled={selectedQuantity >= maxQuantity || redeeming}
                      onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {!soldOut && !insufficient && (
                <p className="text-right text-sm text-ink-600">
                  合计：
                  <strong className="ml-1 text-base font-bold text-ink-950">
                    {isFree ? '免费' : `${formatPoints(totalCost)} 积分`}
                  </strong>
                </p>
              )}

              <Button
                className="h-12 w-full rounded-xl text-base"
                disabled={disabled}
                loading={redeeming}
                onClick={() => onRedeem(item, selectedQuantity)}
              >
                {soldOut
                  ? '已售罄'
                  : insufficient
                    ? '积分不足'
                    : redeeming
                      ? '兑换中…'
                      : isFree
                        ? '确认免费兑换'
                        : `确认兑换 · ${formatPoints(totalCost)} 积分`}
              </Button>

              <p className="text-center text-xs text-ink-400">
                {item.type === 'digital'
                  ? '兑换成功后可在「兑换记录」中查看下载链接'
                  : '兑换成功后请到「兑换记录」查看发放状态'}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
