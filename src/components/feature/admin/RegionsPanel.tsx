/**
 * 区域与权限（超级管理员）
 *
 * 三块内容：
 *   1. 区域树：校区 → 年级 → 班级，可新增/删除
 *   2. 区域授权：给教师/管理员分配可管理的区域（授权父级自动覆盖子级）
 *   3. 角色调整：修改某个账号的角色（学生/教师/管理员/超级管理员）
 *
 * 注意：这里只负责「配置」；真正的越权拦截发生在后端（functions/lib/rbac.ts）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { adminApi, studentsApi } from '../../../api';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../common/Button';
import { Card } from '../../common/Card';
import { Input } from '../../common/Input';
import { Select } from '../../common/Select';
import { getErrorMessage } from '../../../lib/utils';
import type { Region, RegionMember, Student, UserRole } from '../../../types';

const REGION_TYPE_LABEL: Record<Region['type'], string> = {
  campus: '校区',
  grade: '年级',
  class: '班级',
  other: '其他',
};

const ROLE_LABEL: Record<UserRole, string> = {
  student: '学生',
  teacher: '教师',
  admin: '区域管理员',
  super_admin: '超级管理员',
};

/** 按父子关系把扁平列表排成树，附带层级用于缩进 */
function buildTree(regions: Region[]): { region: Region; depth: number }[] {
  const children = new Map<string | null, Region[]>();
  for (const region of regions) {
    const list = children.get(region.parent_id) ?? [];
    list.push(region);
    children.set(region.parent_id, list);
  }
  const result: { region: Region; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const region of children.get(parentId) ?? []) {
      result.push({ region, depth });
      walk(region.id, depth + 1);
    }
  };
  walk(null, 0);
  return result;
}

export function RegionsPanel() {
  const { showToast } = useToast();

  const [regions, setRegions] = useState<Region[]>([]);
  const [members, setMembers] = useState<RegionMember[]>([]);
  const [users, setUsers] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // 新建区域
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<Region['type']>('class');
  const [newParent, setNewParent] = useState('');

  // 授权
  const [assignUser, setAssignUser] = useState('');
  const [assignRegion, setAssignRegion] = useState('');

  const load = useCallback(async () => {
    try {
      const [regionList, memberList, userList] = await Promise.all([
        adminApi.regions.list(),
        adminApi.members.list(),
        // 复用学生列表接口拿全部账号（超管可见全部）
        studentsApi.list(),
      ]);
      setRegions(regionList);
      setMembers(memberList);
      setUsers(userList);
    } catch (err) {
      showToast('error', getErrorMessage(err, '读取区域数据失败，请确认已执行 15_regions_and_rbac.sql'));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const tree = useMemo(() => buildTree(regions), [regions]);

  /** 可被授权的账号：教师 / 管理员 / 超级管理员 */
  const staffUsers = useMemo(
    () => users.filter((u) => u.role !== 'student'),
    [users],
  );

  const handleCreateRegion = async () => {
    if (!newName.trim()) {
      showToast('error', '请填写区域名称');
      return;
    }
    setBusy(true);
    try {
      await adminApi.regions.create({
        name: newName.trim(),
        type: newType,
        parent_id: newParent || null,
      });
      showToast('success', `已创建区域「${newName.trim()}」`);
      setNewName('');
      setNewParent('');
      await load();
    } catch (err) {
      showToast('error', getErrorMessage(err, '创建区域失败'));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRegion = async (region: Region) => {
    if (!window.confirm(`确认删除区域「${region.name}」？子区域会一并删除。`)) return;
    setBusy(true);
    try {
      await adminApi.regions.remove(region.id);
      showToast('success', '区域已删除');
      await load();
    } catch (err) {
      showToast('error', getErrorMessage(err, '删除区域失败'));
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = async () => {
    if (!assignUser || !assignRegion) {
      showToast('error', '请选择账号和区域');
      return;
    }
    setBusy(true);
    try {
      await adminApi.members.assign(assignUser, assignRegion);
      showToast('success', '授权成功');
      setAssignUser('');
      setAssignRegion('');
      await load();
    } catch (err) {
      showToast('error', getErrorMessage(err, '授权失败'));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (member: RegionMember) => {
    setBusy(true);
    try {
      await adminApi.members.revoke(member.user_id, member.region_id);
      showToast('success', '已取消授权');
      await load();
    } catch (err) {
      showToast('error', getErrorMessage(err, '取消授权失败'));
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (user: Student, role: UserRole) => {
    setBusy(true);
    try {
      await adminApi.updateRole(user.id, role);
      showToast('success', `${user.name} 的角色已改为${ROLE_LABEL[role]}`);
      await load();
    } catch (err) {
      showToast('error', getErrorMessage(err, '修改角色失败'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 p-10 text-sm text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" /> 正在读取区域数据…
      </Card>
    );
  }

  return (
    <div className="animate-fade-up space-y-6">
      <Card className="p-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-ink-900">
          <ShieldCheck className="h-5 w-5 text-brand-600" />
          区域结构
        </h2>
        <p className="mb-4 text-sm text-ink-500">
          按「校区 → 年级 → 班级」随意分层。给某人授权某个区域后，他自动拥有该区域及其所有子区域的管理权。
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-ink-50 p-3">
          <div className="w-full sm:w-44">
            <Input label="区域名称" placeholder="如 高一(3)班" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="w-full sm:w-32">
            <Select label="类型" value={newType} onChange={(e) => setNewType(e.target.value as Region['type'])}>
              <option value="campus">校区</option>
              <option value="grade">年级</option>
              <option value="class">班级</option>
              <option value="other">其他</option>
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select label="上级区域" value={newParent} onChange={(e) => setNewParent(e.target.value)}>
              <option value="">（顶级）</option>
              {tree.map(({ region, depth }) => (
                <option key={region.id} value={region.id}>
                  {'　'.repeat(depth)}
                  {region.name}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={() => void handleCreateRegion()} loading={busy}>
            <Plus className="h-4 w-4" />
            添加区域
          </Button>
        </div>

        {tree.length === 0 ? (
          <p className="text-sm text-ink-400">还没有区域，先添加一个校区或班级。</p>
        ) : (
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
            {tree.map(({ region, depth }) => (
              <li key={region.id} className="flex items-center justify-between px-3 py-2.5">
                <div style={{ paddingLeft: `${depth * 1.25}rem` }} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink-900">{region.name}</span>
                  <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-500">
                    {REGION_TYPE_LABEL[region.type]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteRegion(region)}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-ink-900">
          <UserPlus className="h-5 w-5 text-brand-600" />
          区域授权
        </h2>
        <p className="mb-4 text-sm text-ink-500">教师与区域管理员只能看到被授权区域内的学生、兑换与积分数据。</p>

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-ink-50 p-3">
          <div className="w-full sm:w-56">
            <Select label="账号" value={assignUser} onChange={(e) => setAssignUser(e.target.value)}>
              <option value="">选择教师/管理员</option>
              {staffUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}（{ROLE_LABEL[user.role]}）
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select label="区域" value={assignRegion} onChange={(e) => setAssignRegion(e.target.value)}>
              <option value="">选择区域</option>
              {tree.map(({ region, depth }) => (
                <option key={region.id} value={region.id}>
                  {'　'.repeat(depth)}
                  {region.name}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={() => void handleAssign()} loading={busy}>
            授权
          </Button>
        </div>

        {members.length === 0 ? (
          <p className="text-sm text-ink-400">还没有任何授权记录。</p>
        ) : (
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
            {members.map((member) => (
              <li key={`${member.user_id}-${member.region_id}`} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-ink-900">{member.students?.name ?? member.user_id}</span>
                  <span className="text-ink-400">→</span>
                  <span className="text-ink-700">{member.regions?.name ?? member.region_id}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRevoke(member)}
                  className="rounded px-2 py-1 text-xs text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  取消授权
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-bold text-ink-900">角色调整</h2>
        <p className="mb-4 text-sm text-ink-500">
          学生只看自己；教师可加分与发放；区域管理员可管理授权区域内的账号与商品数据；超级管理员不受区域限制。
        </p>
        <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
          {users
            .filter((user) => user.role !== 'student')
            .map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="text-sm">
                  <span className="font-medium text-ink-900">{user.name}</span>
                  <span className="ml-2 text-ink-400">{user.email}</span>
                </div>
                <Select
                  className="w-40"
                  value={user.role}
                  onChange={(e) => void handleRoleChange(user, e.target.value as UserRole)}
                  disabled={busy}
                >
                  <option value="teacher">教师</option>
                  <option value="admin">区域管理员</option>
                  <option value="super_admin">超级管理员</option>
                  <option value="student">学生</option>
                </Select>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
