/**
 * 管理员 · 系统设置面板
 * 目前包含：是否允许学生自助修改个人信息（昵称 / 学号）
 */
import { useEffect, useState } from 'react';
import { Globe, Loader2, ShieldCheck } from 'lucide-react';
import { adminApi } from '../../../api';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { cn, getErrorMessage } from '../../../lib/utils';

export function SystemSettingsPanel() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowProfileEdit, setAllowProfileEdit] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await adminApi.systemSettings.list();
        if (cancelled) return;
        const record = list.find((item) => item.key === 'allow_profile_edit');
        if (record) {
          setAllowProfileEdit(record.value?.enabled !== false);
        }
      } catch (err) {
        if (!cancelled) showToast('error', getErrorMessage(err, '读取系统配置失败'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.systemSettings.update('allow_profile_edit', { enabled: allowProfileEdit });
      showToast(
        'success',
        allowProfileEdit ? '已允许学生修改个人信息' : '已禁止学生修改个人信息',
      );
    } catch (err) {
      showToast('error', getErrorMessage(err, '保存系统配置失败'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 p-10 text-sm text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在读取系统配置…
      </Card>
    );
  }

  return (
    <div className="animate-fade-up space-y-6">
      <Card className="p-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-ink-900">
          <ShieldCheck className="h-5 w-5 text-brand-600" />
          学生自助修改个人信息
        </h2>
        <p className="mb-6 text-sm text-ink-500">
          控制学生 / 教师是否可以在「设置 → 个人资料」中自助修改昵称和学号。
          关闭后，前端表单会被禁用，后端接口同样会拒绝修改请求，需由管理员在「学生管理」中调整。
        </p>

        <div className="flex items-center justify-between rounded-lg border border-ink-200 px-4 py-4">
          <div>
            <h3 className="text-sm font-medium text-ink-900">允许自助修改昵称 / 学号</h3>
            <p className="mt-1 text-xs text-ink-500">
              当前状态：
              <span
                className={cn(
                  'ml-1 font-semibold',
                  allowProfileEdit ? 'text-emerald-600' : 'text-red-600',
                )}
              >
                {allowProfileEdit ? '已开启' : '已关闭'}
              </span>
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={allowProfileEdit}
            aria-label="允许自助修改个人信息"
            onClick={() => setAllowProfileEdit((prev) => !prev)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
              allowProfileEdit ? 'bg-brand-600' : 'bg-ink-300',
            )}
          >
            <span
              className={cn(
                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                allowProfileEdit ? 'translate-x-[22px]' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={() => void handleSave()} loading={saving}>
            保存设置
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-ink-900">
          <Globe className="h-5 w-5 text-brand-600" />
          其他系统设置
        </h2>
        <p className="text-sm text-ink-500">更多系统级配置项正在规划中，敬请期待。</p>
      </Card>
    </div>
  );
}
