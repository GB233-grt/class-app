/**
 * 商品管理面板：商品列表（表格）+ 添加/编辑商品表单
 *
 * 商品类型：
 *   实物商品：有库存，学生兑换后教师线下发放
 *   网络商品：不扣库存，交换后自动下发下载链接
 */
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Coins, Package, Pencil, Plus, Shield, X } from 'lucide-react';
import { itemsApi } from '../../../api';
import { useItems } from '../../../hooks/useItems';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { Input } from '../../common/Input';
import { Textarea } from '../../common/Textarea';
import { ErrorNotice } from '../../common/States';
import { cn, formatPoints, getErrorMessage } from '../../../lib/utils';
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

export function ItemsPanel() {
  const { items, loading, error, refresh } = useItems();
  const { showToast } = useToast();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  // 进入编辑模式：用该商品当前值填充表单
  const startEdit = (item: Item) => {
    setEditingItem(item);
    setConfirmId(null);
    reset({
      name: item.name,
      description: item.description ?? '',
      cost: String(item.cost),
      stock: String(item.stock),
      image_url: item.image_url ?? '',
      type: item.type,
      download_url: item.download_url ?? '',
      download_limit: String(item.download_limit ?? 0),
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
      download_url: (values.type === 'digital' && values.download_url ? values.download_url : undefined),
      download_limit:
        values.type === 'digital' && values.download_limit.length > 0
          ? Number(values.download_limit)
          : 0,
    };
    try {
      if (editingItem) {
        await itemsApi.update(editingItem.id, payload);
        showToast('success', `「${values.name}」已更新`);
        cancelEdit();
      } else {
        await itemsApi.create(payload);
        showToast('success', '商品添加成功');
        reset(NEW_ITEM_FORM);
      }
      await refresh();
    } catch (err) {
      showToast('error', getErrorMessage(err, editingItem ? '保存商品失败' : '添加商品失败'));
    }
  });

  // 删除商品（两步确认；后端软删除下架）
  const handleDelete = async (item: Item) => {
    setDeletingId(item.id);
    try {
      await itemsApi.remove(item.id);
      showToast('success', '商品已删除（下架）');
      // 若删除的正是正在编辑的商品，退出编辑模式
      if (editingItem?.id === item.id) cancelEdit();
      await refresh();
    } catch (err) {
      showToast('error', getErrorMessage(err, '删除商品失败'));
    } finally {
      setDeletingId(null);
      setConfirmId(null);
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
      render: (item) => (
        <span className="flex items-center gap-1 font-semibold text-brand-600">
          <Coins className="h-3.5 w-3.5" />
          {formatPoints(item.cost)}
        </span>
      ),
    },
    {
      header: '库存',
      render: (item) => <span className="text-ink-700">{formatPoints(item.stock)}</span>,
    },
    {
      header: '状态',
      render: (item) => (
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            item.is_active ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-500',
          )}
        >
          {item.is_active ? '已上架' : '已下架'}
        </span>
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
          {item.is_active && (
            <Button
              size="sm"
              variant={confirmId === item.id ? 'danger' : 'outline'}
              loading={deletingId === item.id}
              onClick={() => {
                if (confirmId === item.id) {
                  void handleDelete(item);
                  return;
                }
                // 三秒内再次点击才确认删除
                setConfirmId(item.id);
                window.setTimeout(
                  () => setConfirmId((current) => (current === item.id ? null : current)),
                  3000,
                );
              }}
            >
              {confirmId === item.id ? '确认删除' : '删除'}
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
        <h2 className="font-display text-lg font-bold text-ink-900">商品列表</h2>
        {error ? (
          <ErrorNotice message={error} onRetry={() => void refresh()} />
        ) : (
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(item) => item.id}
            loading={loading}
            emptyText="还没有商品，快去添加吧"
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
              min={1}
              placeholder="30"
              error={errors.cost?.message}
              {...register('cost')}
            />
            <Input
              label="库存数量"
              type="number"
              min={0}
              placeholder="50"
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
          <Button type="submit" className="w-full" loading={isSubmitting}>
            {editingItem ? '保存修改' : '添加商品'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
