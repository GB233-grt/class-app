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
  return profile.role === 'admin'
    ? <AdminDashboard />
    : profile.role === 'teacher'
      ? <TeacherDashboard />
      : <StudentDashboard />;
}
