/**
 * 本地预览服务器 —— 仅用于生成 README 截图
 *
 * 它把 dist/ 静态产物跑起来，并把 /api/* 请求替换成内置的示例数据，
 * 这样在没有真实数据库的情况下也能截到真实界面（真实组件 + 示例数据）。
 *
 * 用法：
 *   npm run build
 *   node tools/preview-server.mjs student 8801
 *   node tools/preview-server.mjs teacher 8802
 *   node tools/preview-server.mjs admin   8803
 *
 * 然后浏览器打开 http://localhost:8801 即可（会自动注入登录态）。
 * 请勿用于生产，数据全部是假的。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const role = process.argv[2] ?? 'student';
const port = Number(process.argv[3] ?? 8801);

const now = Date.now();
const iso = (daysAgo = 0) => new Date(now - daysAgo * 86400000).toISOString();

const PROFILES = {
  student: {
    id: '11111111-1111-1111-1111-111111111111',
    name: '林小雨',
    student_no: 'S2024017',
    email: 'student@school.edu',
    role: 'student',
    points: 268,
    created_at: iso(120),
  },
  teacher: {
    id: '22222222-2222-2222-2222-222222222222',
    name: '王老师',
    student_no: null,
    email: 'teacher@school.edu',
    role: 'teacher',
    points: 0,
    created_at: iso(200),
  },
  admin: {
    id: '33333333-3333-3333-3333-333333333333',
    name: '系统管理员',
    student_no: null,
    email: 'admin@school.edu',
    role: 'admin',
    points: 0,
    created_at: iso(260),
  },
};

const ITEMS = [
  { id: 'i1', name: '学校笔记本', description: 'A5 硬壳，带校徽压印', cost: 30, stock: 42, type: 'physical', is_active: true },
  { id: 'i2', name: '中性笔套装', description: '黑蓝红三色各一支', cost: 12, stock: 88, type: 'physical', is_active: true },
  { id: 'i3', name: '数学专题讲义', description: '几何与函数各 20 页，含解析', cost: 8, stock: 30, type: 'digital', is_active: true },
  { id: 'i4', name: '英语听力音频包', description: '12 个单元 MP3 + 文本', cost: 6, stock: 50, type: 'digital', is_active: true },
  { id: 'i5', name: '实验室开放日名额', description: '物理实验室参观，限时免费', cost: 0, stock: 20, type: 'physical', is_active: true },
  { id: 'i6', name: '定制帆布包', description: '已下架，下一批制作中', cost: 60, stock: 0, type: 'physical', is_active: false },
].map((item) => ({
  ...item,
  image_url: null,
  publish_date: item.type === 'digital' ? iso(10) : null,
  download_url: item.type === 'digital' ? 'https://example.com/handout.pdf' : null,
  download_limit: 0,
  expires_at: null,
  created_at: iso(30),
  updated_at: iso(2),
}));

const REDEMPTIONS = [
  { id: 'r1', student_id: PROFILES.student.id, item_id: 'i3', item_name: '数学专题讲义', cost: 8, quantity: 1, status: 'fulfilled', download_url: 'https://example.com/handout.pdf', fulfilled_at: iso(1), fulfilled_by: null, created_at: iso(1) },
  { id: 'r2', student_id: PROFILES.student.id, item_id: 'i1', item_name: '学校笔记本', cost: 30, quantity: 2, status: 'pending', download_url: null, fulfilled_at: null, fulfilled_by: null, created_at: iso(3) },
  { id: 'r3', student_id: PROFILES.student.id, item_id: 'i2', item_name: '中性笔套装', cost: 12, quantity: 1, status: 'fulfilled', download_url: null, fulfilled_at: iso(9), fulfilled_by: PROFILES.teacher.id, created_at: iso(10) },
];

const STUDENTS = [
  { id: PROFILES.student.id, name: '林小雨', student_no: 'S2024017', email: 'student@school.edu', role: 'student', points: 268, created_at: iso(120) },
  { id: 's2', name: '陈昊', student_no: 'S2024018', email: 'chenhao@school.edu', role: 'student', points: 312, created_at: iso(118) },
  { id: 's3', name: '赵一诺', student_no: 'S2024019', email: 'zhaoyinuo@school.edu', role: 'student', points: 240, created_at: iso(117) },
  { id: 's4', name: '孙可欣', student_no: 'S2024020', email: 'sunkexin@school.edu', role: 'student', points: 205, created_at: iso(110) },
  { id: 's5', name: '周明宇', student_no: 'S2024021', email: 'zhoumingyu@school.edu', role: 'student', points: 96, created_at: iso(96) },
];

const STAFF_REDEMPTIONS = [
  { ...REDEMPTIONS[1], students: { name: '林小雨', student_no: 'S2024017' } },
  { id: 'r4', student_id: 's2', item_id: 'i2', item_name: '中性笔套装', cost: 12, quantity: 1, status: 'pending', download_url: null, fulfilled_at: null, fulfilled_by: null, created_at: iso(0), students: { name: '陈昊', student_no: 'S2024018' } },
  { id: 'r5', student_id: 's3', item_id: 'i1', item_name: '学校笔记本', cost: 30, quantity: 1, status: 'pending', download_url: null, fulfilled_at: null, fulfilled_by: null, created_at: iso(0), students: { name: '赵一诺', student_no: 'S2024019' } },
  { ...REDEMPTIONS[2], students: { name: '林小雨', student_no: 'S2024017' } },
];

const LEDGER = [
  { id: 'l1', student_id: PROFILES.student.id, delta: -8, balance_after: 268, reason: '兑换商品：数学专题讲义（已发放下载链接，请到兑换记录查看）', actor_id: null, created_at: iso(1) },
  { id: 'l2', student_id: PROFILES.student.id, delta: 20, balance_after: 276, reason: '课堂表现优秀', actor_id: PROFILES.teacher.id, created_at: iso(2) },
  { id: 'l3', student_id: PROFILES.student.id, delta: -60, balance_after: 256, reason: '兑换商品：学校笔记本 × 2', actor_id: null, created_at: iso(3) },
  { id: 'l4', student_id: PROFILES.student.id, delta: 16, balance_after: 316, reason: '作业按时完成', actor_id: PROFILES.teacher.id, created_at: iso(5) },
  { id: 'l5', student_id: PROFILES.student.id, delta: 300, balance_after: 300, reason: '初始积分', actor_id: null, created_at: iso(120) },
];

const LEADERBOARD = [
  { id: 's2', name: '陈昊', points: 312 },
  { id: PROFILES.student.id, name: '林小雨', points: 268 },
  { id: 's3', name: '赵一诺', points: 240 },
  { id: 's4', name: '孙可欣', points: 205 },
  { id: 's5', name: '周明宇', points: 96 },
  { id: 's6', name: '吴思远', points: 88 },
  { id: 's7', name: '郑欣然', points: 74 },
  { id: 's8', name: '黄子豪', points: 61 },
];

const STATS = { item_count: 6, total_stock: 230, total_awarded: 4820, student_count: 5 };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** 注入登录态：让 SPA 启动时认为已登录（仅本地预览用） */
function injectSession(html) {
  const session = {
    access_token: 'preview-token',
    refresh_token: 'preview-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
  const script = `<script>localStorage.setItem('spe_session', ${JSON.stringify(
    JSON.stringify(session),
  )});</script>`;
  return html.replace('<script type="module"', `${script}\n    <script type="module"`);
}

function apiPayload(pathname) {
  const profile = PROFILES[role];
  if (pathname === '/api/auth/me' || pathname === '/api/user') return profile;
  // 学生端只应看到上架商品（与真实接口行为一致）
  if (pathname === '/api/items') return role === 'student' ? ITEMS.filter((i) => i.is_active) : ITEMS;
  if (pathname === '/api/students') return STUDENTS;
  if (pathname === '/api/stats') return STATS;
  if (pathname === '/api/leaderboard') return LEADERBOARD;
  if (pathname === '/api/redemptions') return STAFF_REDEMPTIONS;
  if (pathname.startsWith('/api/redemptions/')) return REDEMPTIONS;
  if (pathname.startsWith('/api/ledger/')) return LEDGER;
  if (pathname === '/api/user/system-settings') {
    return [{ key: 'allow_profile_edit', value: { enabled: true }, description: '是否允许学生自助修改个人信息' }];
  }
  return {};
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(apiPayload(pathname)));
    return;
  }

  let filePath = path.join(DIST, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath);
  if (ext === '.html') {
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end(injectSession(fs.readFileSync(filePath, 'utf8')));
    return;
  }

  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`preview (${role}) → http://localhost:${port}`);
});
