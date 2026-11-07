/**
 * 根组件：根据登录状态与角色渲染对应页面
 */
import { useAuth } from './hooks/useAuth';
import { PageLoader } from './components/common/Spinner';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const { profile, initializing } = useAuth();

  // 首次会话探测中
  if (initializing) {
    return <PageLoader />;
  }

  // 未登录
  if (!profile) {
    return <LoginPage />;
  }

  // 按角色进入对应仪表盘
  // 注意：super_admin 也属于管理端，必须显式判断，否则会掉进学生端兜底分支
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

  if (isAdmin) return <AdminDashboard />;
  if (profile.role === 'teacher') return <TeacherDashboard />;
  return <StudentDashboard />;
}
