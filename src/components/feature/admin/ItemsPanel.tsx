/**
 * 商品管理面板：商品列表（已上架 / 已下架 两个分组）+ 添加/编辑商品表单
 *
 * 商品类型：
 *   实物商品：有库存，学生兑换后教师线下发放
 *   网络商品：不扣库存，兑换后自动下发下载链接
 *
 * 上架状态：
 *   已上架：学生端可见、可兑换
 *   已下架：学生端不可见，但商品与历史兑换记录保留，可随时重新上架
 */
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Coins, Eye, EyeOff, Package, Pencil, Plus, Shield, X } from 'lucide-react';
import { itemsApi } from '../../../api';
import { useItems } from '../../../hooks/useItems';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { Input } from '../../common/Input';
import { Textarea } from '../../common/Textarea';
import { ErrorNotice } from '../../common/States';
import { cn, formatDateTime, formatPoints, fromDateTimeLocalValue, getErrorMessage, toDateTimeLocalValue } from '../../../lib/utils';
import { itemFormSchema, NEW_ITEM_FORM, type ItemFormValues } from '../../../lib/validation';
import type { Item } from '../../../types';

/** 商品类型徽标 */
function ItemTag({ item }: { item: Item }) {
  return item.type === 'digital' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
      <Shield className="h-2.5 w-2.5" />
      网络商品
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
      <Package className="h-2.5 w-2.5" />
      实物商品
    </span>
  );
}

/** 判断到期时间是否已过 */
function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return !Number.isNaN(time) && time <= Date.now();
}

/** 商品分组：已上架 / 已下架 */
type StatusTab = 'active' | 'inactive';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'active', label: '已上架' },
  { key: 'inactive', label: '已下架' },
];

export function ItemsPanel() {
  const { items, loading, error, refresh } = useItems();
  const { showToast } = useToast();
  /** 当前查看的分组（默认已上架） */
  const [statusTab, setStatusTab] = useState<StatusTab>('active');
  /** 正在切换上架状态的商品 ID */
  const [togglingId, setTogglingId] = useState<string | null>(null);
  /** 当前正在编辑的商品（null = 表单处于添加模式） */
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: NEW_ITEM_FORM,
  });

  // 商品类型（控制网络商品专属字段的显示与隐藏）
  const itemType = useWatch({ name: 'type', control });
  // 表单里的上架状态（用于提示文案）
  const formIsActive = useWatch({ name: 'is_active', control });

  // 两个分组的商品与数量
  const activeItems = useMemo(() => items.filter((item) => item.is_active), [items]);
  const inactiveItems = useMemo(() => items.filter((item) => !item.is_active), [items]);
  const counts: Record<StatusTab, number> = {
    active: activeItems.length,
    inactive: inactiveItems.length,
  };
  const visibleItems = statusTab === 'active' ? activeItems : inactiveItems;

  // 进入编辑模式：用该商品当前值填充表单
  const startEdit = (item: Item) => {
    setEditingItem(item);
    reset({
      name: item.name,
      description: item.description ?? '',
      cost: String(item.cost),
      stock: String(item.stock),
      image_url: item.image_url ?? '',
      type: item.type,
      download_url: item.download_url ?? '',
      download_limit: String(item.download_limit ?? 0),
      is_active: item.is_active,
      expires_at: toDateTimeLocalValue(item.expires_at),
    });
  };

  // 退出编辑模式：清空表单回到添加模式
  const cancelEdit = () => {
    setEditingItem(null);
    reset(NEW_ITEM_FORM);
  };

  // 提交：按模式调用 新建 / 更新（数值字段已在表单层校验为整数格式）
  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      name: values.name,
      description: values.description || undefined,
      cost: Number(values.cost),
      stock: Number(values.stock),
      image_url: values.image_url || undefined,
      type: values.type,
      publish_date: undefined,
      download_url: values.type === 'digital' && values.download_url ? values.download_url : undefined,
      download_limit:
        values.type === 'digital' && values.download_limit.length > 0
          ? Number(values.download_limit)
          : 0,
      is_active: values.is_active,
      expires_at: fromDateTimeLocalValue(values.expires_at),
    };
    try {
      if (editingItem) {
        await itemsApi.update(editingItem.id, payload);
        showToast('success', `「${values.name}」已更新`);
        cancelEdit();
      } else {
        await itemsApi.create(payload);
        showToast('success', values.is_active ? '商品已添加并上架' : '商品已添加，保存在「已下架」分组');
        // 新建后跳到对应分组，方便立刻看到结果
        setStatusTab(values.is_active ? 'active' : 'inactive');
        reset(NEW_ITEM_FORM);
      }
      await refresh();
    } catch (err) {
      showToast('error', getErrorMessage(err, editingItem ? '保存商品失败' : '添加商品失败'));
    }
  });

  // 上架 / 下架切换
  const toggleStatus = async (item: Item, nextActive: boolean) => {
    setTogglingId(item.id);
    try {
      await itemsApi.updateStatus(item.id, nextActive);
      showToast('success', nextActive ? `「${item.name}」已上架` : `「${item.name}」已下架`);
      // 正在编辑的商品被下架时，保持编辑态不变（商品仍然存在）
      await refresh();
    } catch (err) {
      showToast('error', getErrorMessage(err, nextActive ? '上架失败' : '下架失败'));
    } finally {
      setTogglingId(null);
    }
  };

  const columns: DataTableColumn<Item>[] = [
    {
      header: '商品',
      render: (item) => (
        <div className="min-w-[10rem]">
          <div className="flex items-center gap-2">
            <p className="font-medium text-ink-900">{item.name}</p>
            <ItemTag item={item} />
          </div>
          {item.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-ink-400">{item.description}</p>
          )}
        </div>
      ),
    },
    {
      header: '积分价格',
      render: (item) =>
        item.cost === 0 ? (
          <span className="font-semibold text-emerald-600">免费</span>
        ) : (
          <span className="flex items-center gap-1 font-semibold text-brand-600">
            <Coins className="h-3.5 w-3.5" />
            {formatPoints(item.cost)}
          </span>
        ),
    },
    {
      header: '库存',
      render: (item) => (
        <span className={item.stock <= 0 ? 'font-medium text-red-600' : 'text-ink-700'}>
          {formatPoints(item.stock)}
        </span>
      ),
    },
    {
      header: '到期',
      render: (item) =>
        item.expires_at ? (
          <span className="whitespace-nowrap text-xs text-ink-600">
            {formatDateTime(item.expires_at)}
            {isExpired(item.expires_at) && (
              <span className="ml-1 rounded bg-red-50 px-1 text-red-600">已到期</span>
            )}
          </span>
        ) : (
          <span className="text-xs text-ink-400">永不过期</span>
        ),
    },
    {
      header: '操作',
      render: (item) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={editingItem?.id === item.id ? 'dark' : 'outline'}
            onClick={() => startEdit(item)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {editingItem?.id === item.id ? '编辑中' : '编辑'}
          </Button>
          {item.is_active ? (
            <Button
              size="sm"
              variant="outline"
              loading={togglingId === item.id}
              onClick={() => void toggleStatus(item, false)}
            >
              <EyeOff className="h-3.5 w-3.5" />
              下架
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              loading={togglingId === item.id}
              onClick={() => void toggleStatus(item, true)}
            >
              <Eye className="h-3.5 w-3.5" />
              上架
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-up grid gap-4 lg:grid-cols-5">
      {/* 商品列表 */}
      <div className="space-y-3 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink-900">商品列表</h2>
          {/* 分组切换：已上架 / 已下架 */}
          <div className="flex items-center gap-1 rounded-lg bg-ink-100 p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  statusTab === tab.key
                    ? 'bg-white text-ink-900 shadow-sm'
                    : 'text-ink-500 hover:text-ink-800',
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 text-xs',
                    statusTab === tab.key ? 'bg-brand-50 text-brand-700' : 'bg-ink-200 text-ink-600',
                  )}
                >
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {statusTab === 'inactive' && (
          <p className="rounded-lg bg-ink-100/70 px-3 py-2 text-xs text-ink-500">
            已下架商品在学生端不可见，历史兑换记录与积分明细不受影响，可随时重新上架。
          </p>
        )}

        {error ? (
          <ErrorNotice message={error} onRetry={() => void refresh()} />
        ) : (
          <DataTable
            columns={columns}
            rows={visibleItems}
            rowKey={(item) => item.id}
            loading={loading}
            emptyText={
              statusTab === 'active' ? '还没有已上架的商品' : '没有已下架的商品'
            }
            emptyIcon={Package}
          />
        )}
      </div>

      {/* 添加 / 编辑商品表单 */}
      <Card className={cn('h-fit p-5 lg:col-span-2', editingItem && 'border-amber-300')}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink-900">
            {editingItem ? (
              <>
                <Pencil className="h-5 w-5 text-amber-500" />
                编辑商品
              </>
            ) : (
              <>
                <Plus className="h-5 w-5 text-brand-500" />
                添加商品
              </>
            )}
          </h2>
          {editingItem && (
            <button
              type="button"
              onClick={cancelEdit}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              <X className="h-3.5 w-3.5" />
              取消编辑
            </button>
          )}
        </div>
        {editingItem && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
            正在编辑「{editingItem.name}」。修改价格会影响之后的兑换（已完成的兑换记录不受影响）；调低库存不会影响已提交的兑换。
          </p>
        )}
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          {/* 商品类型 */}
          <div>
            <p className="mb-2 text-sm font-medium text-ink-900">商品类型</p>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm font-medium">
                <input type="radio" value="physical" {...register('type')} className="text-brand-600" />
                实物商品
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm font-medium">
                <input type="radio" value="digital" {...register('type')} className="text-brand-600" />
                网络商品
              </label>
            </div>
          </div>
          <Input
            label="商品名称"
            placeholder="例如：学校笔记本"
            error={errors.name?.message}
            {...register('name')}
          />
          <Textarea
            label="商品描述"
            placeholder="简单描述一下这个物品（选填）"
            rows={2}
            error={errors.description?.message}
            {...register('description')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="积分价格"
              type="number"
              min={0}
              placeholder="30（0 = 免费）"
              hint="填 0 表示免费商品，不消耗学生积分"
              error={errors.cost?.message}
              {...register('cost')}
            />
            <Input
              label="库存数量"
              type="number"
              min={0}
              placeholder="50"
              hint={itemType === 'digital' ? '网络商品的库存＝可被兑换的总次数' : undefined}
              error={errors.stock?.message}
              {...register('stock')}
            />
          </div>
          {/* 网络商品专属字段：下载链接 + 下载次数限制 */}
          {itemType === 'digital' && (
            <>
              <Input
                label="下载链接"
                type="url"
                placeholder="https://…（必填）"
                error={errors.download_url?.message}
                {...register('download_url')}
              />
              <Input
                label="下载次数限制（0=不限制）"
                type="number"
                min={0}
                placeholder="0"
                error={errors.download_limit?.message}
                {...register('download_limit')}
              />
            </>
          )}
          <Input
            label="图片URL"
            placeholder="https://…（选填）"
            error={errors.image_url?.message}
            {...register('image_url')}
          />

          {/* 到期时间：到点后自动下架（实物 / 网络商品通用） */}
          <Input
            label="到期时间（留空 = 永不过期）"
            type="datetime-local"
            hint="到达该时间后商品会自动下架，历史兑换记录保留，可改时间后重新上架"
            error={errors.expires_at?.message}
            {...register('expires_at')}
          />

          {/* 上架状态：决定商品进入哪个分组 */}
          <div className="rounded-lg border border-ink-100 px-3 py-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink-900">上架状态</span>
                <span className="mt-0.5 block text-xs text-ink-400">
                  {formIsActive
                    ? '已上架：学生端可见、可兑换'
                    : '已下架：学生端不可见，保存在「已下架」分组'}
                </span>
              </span>
              <span className="relative inline-flex shrink-0 items-center">
                <input type="checkbox" {...register('is_active')} className="sr-only" />
                <span
                  className={cn(
                    'inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    formIsActive ? 'bg-brand-600' : 'bg-ink-300',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                      formIsActive ? 'translate-x-[22px]' : 'translate-x-0.5',
                    )}
                  />
                </span>
              </span>
            </label>
          </div>

          <Button type="submit" className="w-full" loading={isSubmitting}>
            {editingItem ? '保存修改' : '添加商品'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
