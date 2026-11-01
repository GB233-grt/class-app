/**
 * 兑换商品面板：可兑换商品卡片网格
 */
import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { redemptionsApi } from '../../../api';
import { useAuth } from '../../../hooks/useAuth';
import { useItems } from '../../../hooks/useItems';
import { useToast } from '../../../hooks/useToast';
import { ItemCard } from '../ItemCard';
import { EmptyState, ErrorNotice } from '../../common/States';
import { Spinner } from '../../common/Spinner';
import { getErrorMessage } from '../../../lib/utils';
import type { Item } from '../../../types';

interface StorePanelProps {
  /** 兑换成功后的联动刷新（兑换记录、统计数据等） */
  onRedeemed: () => void;
}

/** 兑换成功提示：实体商品需要等待教师发放，数字商品可直接下载 */
function redeemSuccessMessage(itemType: 'physical' | 'digital', quantity: number, title: string) {
  return itemType === 'digital'
    ? `兑换成功！${title} 已关联下载链接，请到「兑换记录」中查看`
    : quantity > 1
      ? `兑换成功！${title} × ${quantity} 已提交，请到兑换记录查看发放状态`
      : '兑换成功，请到兑换记录查看发放状态';
}

export function StorePanel({ onRedeemed }: StorePanelProps) {
  const { profile, refreshProfile } = useAuth();
  const { items, loading, error, refresh } = useItems();
  const { showToast } = useToast();
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  // 兑换物品：后端原子校验数量/积分与库存
  const handleRedeem = async (item: Item, quantity: number) => {
    if (!profile) return;
    setRedeemingId(item.id);
    try {
      await redemptionsApi.redeem(item.id, quantity);
      showToast(
        'success',
        redeemSuccessMessage(item.type, quantity, item.name),
      );
      // 刷新积分余额与商品库存
      await Promise.all([refreshProfile(), refresh()]);
      onRedeemed();
    } catch (err) {
      showToast('error', getErrorMessage(err, '兑换失败，请稍后重试'));
    } finally {
      setRedeemingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center rounded-xl border border-ink-100 bg-white py-16">
        <Spinner />
      </div>
    );
  }
  if (error) {
    return <ErrorNotice message={error} onRetry={() => void refresh()} />;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="商店暂时没有可兑换的物品"
        description="管理员上架商品后会在这里展示"
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <ItemCard
          key={item.id}
          item={item}
          points={profile?.points ?? 0}
          redeeming={redeemingId === item.id}
          onRedeem={(target, quantity) => void handleRedeem(target, quantity)}
          delay={index * 60}
        />
      ))}
    </div>
  );
}
