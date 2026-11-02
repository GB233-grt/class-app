/**
 * 把 wiki/ 目录下的 Markdown 同步发布到 GitHub Wiki
 *
 * 用法：
 *   npm run wiki:publish
 *   npm run wiki:publish -- "自定义提交说明"
 *
 * 首次使用前，需要现在网页上创建 Wiki 的第一页（GitHub 不提供创建 Wiki 的 API），
 * 否则 wiki 的 git 仓库根本不存在，脚本会给出提示。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WIKI_DIR = path.join(ROOT, 'wiki');

const REPO = process.env.WIKI_REPO ?? 'GB233-grt/class-app';
const WIKI_URL = `https://github.com/${REPO}.wiki.git`;

/** Windows 上 git 自带的 CA 包常常校验失败，切到系统证书库更稳 */
const GIT_BASE = process.platform === 'win32' ? ['-c', 'http.sslBackend=schannel'] : [];

function git(args, cwd, { inherit = false } = {}) {
  const result = spawnSync('git', [...GIT_BASE, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe',
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`git ${args.join(' ')} 失败\n${detail}`);
  }
  return result.stdout ?? '';
}

function main() {
  if (!fs.existsSync(WIKI_DIR)) {
    console.error(`✖ 找不到 ${WIKI_DIR}`);
    process.exit(1);
  }

  const pages = fs.readdirSync(WIKI_DIR).filter((f) => f.endsWith('.md'));
  if (pages.length === 0) {
    console.error('✖ wiki/ 目录里没有 .md 文件');
    process.exit(1);
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'class-app-wiki-'));
  const cloneDir = path.join(tmpRoot, 'wiki');

  console.log(`→ 克隆 ${WIKI_URL}`);
  const clone = spawnSync('git', [...GIT_BASE, 'clone', '--depth', '1', WIKI_URL, cloneDir], {
    encoding: 'utf8',
  });

  if (clone.status !== 0) {
    const lines = (clone.stderr || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    // 跳过 "Cloning into …" 这类进度噪音，取真正的错误行
    const reason =
      lines.find((l) => /fatal|not found|denied|error/i.test(l)) ?? lines[lines.length - 1] ?? '未知错误';
    console.error('\n✖ 无法克隆 Wiki 仓库：');
    console.error(`  ${reason}`);
    console.error('\n  GitHub 不提供「创建 Wiki」的 API，需要先手动建第一页：');
    console.error(`  1. 打开 https://github.com/${REPO}/wiki`);
    console.error('  2. 点击 “Create the first page”, 随便填点内容并保存（之后会被本脚本覆盖）');
    console.error('  3. 重新执行 npm run wiki:publish\n');
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    process.exit(1);
  }

  // 清掉旧页面，保持与 wiki/ 完全一致（_Sidebar.md 等以下划线开头的也一并同步）
  for (const file of fs.readdirSync(cloneDir)) {
    if (file.endsWith('.md')) {
      fs.rmSync(path.join(cloneDir, file), { force: true });
    }
  }

  for (const file of pages) {
    fs.copyFileSync(path.join(WIKI_DIR, file), path.join(cloneDir, file));
    console.log(`  + ${file}`);
  }

  git(['add', '-A'], cloneDir);
  const status = git(['status', '--porcelain'], cloneDir).trim();
  if (!status) {
    console.log('\n✓ Wiki 内容没有变化，无需提交');
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    return;
  }

  const message =
    process.argv[2] ?? `docs(wiki): 同步 wiki/ 目录（${new Date().toISOString().slice(0, 10)}）`;
  git(['-c', 'user.name=wiki-bot', '-c', 'user.email=wiki-bot@users.noreply.github.com', 'commit', '-m', message], cloneDir);
  console.log(`→ 推送（${message}）`);
  git(['push', 'origin', 'HEAD'], cloneDir);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log(`\n✓ 已发布：https://github.com/${REPO}/wiki`);
}

try {
  main();
} catch (err) {
  console.error(`\n✖ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
