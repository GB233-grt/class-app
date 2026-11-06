/**
 * 录制 README 演示 GIF（开发辅助脚本，不参与构建）
 *
 * 做法：用本机 Edge（puppeteer-core 驱动）+ 本地预览服务器，跑一段真实操作，
 * 定时截图后编码成 GIF。产物：docs/screenshots/demo.gif
 *
 * 用法：
 *   npm run build
 *   node tools/record-demo.mjs
 *
 * 需要本机安装 Microsoft Edge。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'screenshots', 'demo.gif');
const PORT = 8899;
const WIDTH = 960;
const HEIGHT = 600;
/** 每帧停留时间（毫秒），GIF 的 delay 单位是 1/100 秒 */
const FRAME_DELAY_MS = 110;

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/microsoft-edge',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findEdge() {
  const found = EDGE_PATHS.find((p) => fs.existsSync(p));
  if (!found) throw new Error('未找到 Microsoft Edge，请修改 EDGE_PATHS');
  return found;
}

/** 点掉页面上第一个文本匹配的按钮 */
async function clickByText(page, text) {
  const ok = await page.evaluate((label) => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent?.replace(/\s/g, '').includes(label),
    );
    if (!btn) return false;
    btn.click();
    return true;
  }, text);
  if (!ok) console.warn(`  ! 没找到按钮「${text}」`);
}

async function main() {
  const edge = findEdge();

  const server = spawn(process.execPath, ['tools/preview-server.mjs', 'teacher', String(PORT)], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  await sleep(1500);

  const browser = await puppeteer.launch({
    executablePath: edge,
    headless: 'new',
    args: [`--window-size=${WIDTH},${HEIGHT}`, '--hide-scrollbars'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

  /** 已采集的帧（PNG Buffer） */
  const frames = [];
  const capture = async (count = 1, gap = FRAME_DELAY_MS) => {
    for (let i = 0; i < count; i += 1) {
      const buffer = await page.screenshot({ type: 'png' });
      frames.push(Buffer.from(buffer));
      if (i < count - 1) await sleep(gap);
    }
  };

  try {
    // ── 场景一：课堂模式 · 随机点名 + 即时加分 ──────────────────
    await page.goto(`http://localhost:${PORT}/#classroom`, { waitUntil: 'networkidle2' });
    await sleep(900);
    await capture(10);

    await clickByText(page, '随机点名');
    await capture(12); // 点名滚动
    await sleep(500);
    await capture(5);

    for (let i = 0; i < 2; i += 1) {
      const clicked = await page.evaluate(() => {
        const btn = document.querySelector('[aria-label="加 3 分"]');
        if (!btn) return false;
        btn.click();
        return true;
      });
      if (!clicked) console.warn('  ! 没找到「加 3 分」按钮');
      await sleep(450);
      await capture(4);
    }

    // ── 场景二：批量加分 · 公式 + 拖拽上传 + 预览 ───────────────
    await page.goto(`http://localhost:${PORT}/#bulk-award`, { waitUntil: 'networkidle2' });
    await sleep(800);
    await capture(8);

    await page.click('#judge-formula');
    await page.type('#judge-formula', 'value >= 90 ? 10 : value >= 80 ? 5 : 0', { delay: 10 });
    await sleep(400);
    await capture(6);

    // 用真实的 .xlsx（CSV 在浏览器里可能因编码导致中文列名匹配失败）
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([
      ['学号', '姓名', '判断值（得分）'],
      ['S2024017', '林小雨', 95],
      ['S2024018', '陈昊', 82],
      ['S2024019', '赵一诺', 71],
      ['S9999999', '查无此人', 88],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, '批量加分');
    const xlsxPath = path.join(ROOT, '.tmp-demo-students.xlsx');
    XLSX.writeFile(wb, xlsxPath);

    const input = await page.$('input[type=file]');
    if (!input) throw new Error('没找到文件输入框');
    await input.uploadFile(xlsxPath);
    await sleep(1000);
    await capture(12);
    fs.rmSync(xlsxPath, { force: true });
  } finally {
    await browser.close();
    server.kill();
  }

  if (frames.length === 0) throw new Error('没有采集到任何帧');

  // ── 编码 GIF ────────────────────────────────────────────────
  // 隔帧采样 + 128 色，体积能压到 ~700KB，README 里加载才不会太慢
  const sampled = frames.filter((_, index) => index % 2 === 0);
  const gif = GIFEncoder();
  const delay = Math.round((FRAME_DELAY_MS * 2) / 10);
  let palette = null;

  for (const buffer of sampled) {
    const png = PNG.sync.read(buffer);
    const rgba = new Uint8Array(png.data);
    if (!palette) palette = quantize(rgba, 128);
    const indexed = applyPalette(rgba, palette);
    gif.writeFrame(indexed, png.width, png.height, { palette, delay });
  }
  gif.finish();

  fs.writeFileSync(OUT, gif.bytes());
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`✓ 已生成 ${path.relative(ROOT, OUT)}（${sampled.length} 帧，${kb} KB）`);
}

main().catch((err) => {
  console.error('✖ 录制失败：', err instanceof Error ? err.message : err);
  process.exit(1);
});
