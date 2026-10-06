/* MathLab 构建脚本
   用法（在 F:\math 下）：node tools/build.mjs
   行为：读取 src/index.html，把 LAB:SCRIPTS:BEGIN/END 之间的 <script src="..."> 依序内联为单个
   <script> 块（仅字符串拼接，不做压缩混淆，产物可读），输出 dist/mathlab.html（单文件、双击即用）。 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcHTML = resolve(root, 'src', 'index.html');
const outHTML = resolve(root, 'dist', 'mathlab.html');

const html = readFileSync(srcHTML, 'utf8');
const BEGIN = '<!-- LAB:SCRIPTS:BEGIN -->';
const END = '<!-- LAB:SCRIPTS:END -->';

const b = html.indexOf(BEGIN);
const e = html.indexOf(END);
if (b < 0 || e < 0 || e <= b) {
  console.error('[build] 未找到 LAB:SCRIPTS:BEGIN/END 标记，构建中止');
  process.exit(1);
}

const block = html.slice(b + BEGIN.length, e);
const srcs = [];
const re = /<script\s+src="([^"]+)"\s*><\/script>/g;
let m;
while ((m = re.exec(block)) !== null) srcs.push(m[1]);

if (!srcs.length) {
  console.error('[build] 标记之间没有 <script src> 标签，构建中止');
  process.exit(1);
}

const inline = srcs
  .map((rel) => {
    const p = resolve(root, 'src', rel);
    let code;
    try {
      code = readFileSync(p, 'utf8');
    } catch (err) {
      console.error('[build] 读取失败：', rel, err.message);
      process.exit(1);
    }
    return '/* ===== ' + rel + ' ===== */\n' + code.trim() + '\n';
  })
  .join('\n');

const out = html.slice(0, b + BEGIN.length) + '\n<script>\n' + inline + '</script>\n' + html.slice(e);

mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(outHTML, out, 'utf8');
console.log('[build] 完成 → dist/mathlab.html（' + (out.length / 1024).toFixed(1) + ' KB，' + srcs.length + ' 个模块已内联）');
