/**
 * 商品管理面板：商品列表（表格）+ 添加商品表单
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Coins, Package, Plus } from 'lucide-react';
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
import { itemFormSchema, type ItemFormValues } from '../../../lib/validation';
import type { Item } from '../../../types';

export function ItemsPanel() {
  const { items, loading, error, refresh } = useItems();
  const { showToast } = useToast();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: { name: '', description: '', cost: '', stock: '', image_url: '' },
  });

  // 添加商品（数值字段已在表单层校验为整数格式，此处转换为数字）
  const onSubmit = handleSubmit(async (values) => {
    try {
      await itemsApi.create({
        name: values.name,
        description: values.description || undefined,
        cost: Number(values.cost),
        stock: Number(values.stock),
        image_url: values.image_url || undefined,
      });
      showToast('success', '商品添加成功');
      reset();
      await refresh();
    } catch (err) {
      showToast('error', getErrorMessage(err, '添加商品失败'));
    }
  });

  // 删除商品（两步确认；后端软删除下架）
  const handleDelete = async (item: Item) => {
    setDeletingId(item.id);
    try {
      await itemsApi.remove(item.id);
      showToast('success', '商品已删除（下架）');
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
          <p className="font-medium text-ink-900">{item.name}</p>
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
      render: (item) =>
        item.is_active ? (
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
        ) : (
          <span className="text-xs text-ink-400">—</span>
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

      {/* 添加商品表单 */}
      <Card className="h-fit p-5 lg:col-span-2">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-ink-900">
          <Plus className="h-5 w-5 text-brand-500" />
          添加商品
        </h2>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
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
          <Input
            label="图片URL"
            placeholder="https://…（选填）"
            error={errors.image_url?.message}
            {...register('image_url')}
          />
          <Button type="submit" className="w-full" loading={isSubmitting}>
            添加商品
          </Button>
        </form>
      </Card>
    </div>
  );
}
