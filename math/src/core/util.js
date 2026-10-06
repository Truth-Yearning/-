/* MathLab core · 工具函数
   命名空间：window.LAB（全局，供经典 <script> 顺序加载与 dist 内联合并使用） */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ilerp(a, b, v) { return a === b ? 0 : (v - a) / (b - a); }
  function mapRange(v, a, b, c, d) { return c + (d - c) * ilerp(a, b, v); }
  function fmt(x, n) {
    n = (n === undefined) ? 2 : n;
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    var r = Math.abs(x) < 1e-12 ? 0 : x;
    var s = r.toFixed(n);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function debounce(fn, ms) {
    var t = null;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, a); }, ms);
    };
  }
  function throttle(fn, ms) {
    var last = 0, timer = null;
    return function () {
      var a = arguments, self = this, now = Date.now();
      var rest = ms - (now - last);
      if (rest <= 0) { last = now; fn.apply(self, a); }
      else if (!timer) {
        timer = setTimeout(function () { timer = null; last = Date.now(); fn.apply(self, a); }, rest);
      }
    };
  }
  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return [255, 255, 255];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  function hsv(h, s, v, a) {
    var hh = ((h % 360) + 360) % 360 / 60;
    var i = Math.floor(hh), f = hh - i;
    var p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
    var rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return 'rgba(' + Math.round(rgb[0] * 255) + ',' + Math.round(rgb[1] * 255) + ',' + Math.round(rgb[2] * 255) + ',' + (a === undefined ? 1 : a) + ')';
  }
  function uid(prefix) { return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 8); }
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a;
  }
  /* 埃氏筛：返回 Uint8Array(n+1)，1 表示素数 */
  function sieve(n) {
    n = Math.max(0, Math.floor(n));
    var p = new Uint8Array(n + 1);
    if (n >= 2) p[2] = 1;
    for (var i = 3; i <= n; i += 2) p[i] = 1;
    var lim = Math.sqrt(n) | 0;
    for (var j = 3; j <= lim; j += 2) {
      if (p[j]) for (var k = j * j; k <= n; k += 2 * j) p[k] = 0;
    }
    return p;
  }
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function clipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    }
    fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
    ta.remove();
  }

  LAB.util = {
    $: $, $$: $$, el: el,
    clamp: clamp, lerp: lerp, ilerp: ilerp, mapRange: mapRange,
    fmt: fmt, esc: esc, debounce: debounce, throttle: throttle,
    hexToRgb: hexToRgb, rgba: rgba, hsv: hsv, uid: uid,
    gcd: gcd, sieve: sieve, download: download, clipboard: clipboard
  };
})();
