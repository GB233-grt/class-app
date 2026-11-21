/**
 * 根组件：根据登录状态与角色渲染对应页面
 */
import { useAuth } from './hooks/useAuth';
import { PageLoader } from './components/common/Spinner';
import LoginPage from './pages/LoginPage';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { SplashPromo } from './components/feature/promo/SplashPromo';
import UserTermsPage from './pages/UserTermsPage';

/** 用户守则公开路径：兼容站内无后缀路由与 README 中既有的 .md 链接 */
function isPublicTermsPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return normalized === '/docs/user-terms' || normalized === '/docs/user-terms.md';
}

/** 未登录访问业务页时，记下目标，登录后可返回原页 */
function redirectToLogin(pathname: string, search: string, hash: string): void {
  const target = `${pathname}${search}${hash}`;
  const query = target && target !== '/' ? `?redirect=${encodeURIComponent(target)}` : '';
  window.location.replace(`/${query}`);
}

export default function App() {
  const { profile, initializing } = useAuth();
  const pathname = window.location.pathname;
  const isTermsPage = isPublicTermsPath(pathname);

  // 公开守则路由不经过 Auth 初始化与登录守卫，带不带 .md 都可直接访问
  if (isTermsPage) {
    return <UserTermsPage />;
  }

  // 根路径保持登录页行为；其他未登录业务路由记下原路径并跳到根路径登录页
  if (!initializing && !profile && pathname !== '/') {
    redirectToLogin(pathname, window.location.search, window.location.hash);
    return <PageLoader />;
  }

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

  return (
    <>
      {/* 启幕宣传页：满足频次策略时覆盖在主界面之上，关闭后不阻塞任何操作 */}
      <SplashPromo />
      {isAdmin ? <AdminDashboard /> : profile.role === 'teacher' ? <TeacherDashboard /> : <StudentDashboard />}
    </>
  );
}
