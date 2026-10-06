/* MathLab core · 依赖装载
   GSAP / KaTeX 走 CDN，任一失败都不阻塞页面（降级链：GSAP→内置补间器，KaTeX→文本排版）。
   装载完成后轮询等待 app.ready（本文件是第一个脚本，其余脚本尚未解析）。 */
(function () {
  'use strict';
  if (window.__LAB_BOOT__) return;
  window.__LAB_BOOT__ = true;

  var CDN = {
    gsap: 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
    katex: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js',
    katexCss: 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css'
  };
  var results = { gsap: false, katex: false };

  function injectCss(href) {
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  }
  function injectJs(src, done) {
    var s = document.createElement('script');
    s.src = src; s.async = false; s.crossOrigin = 'anonymous';
    var settled = false;
    var timer = setTimeout(function () { if (!settled) { settled = true; done(false); } }, 8000);
    s.onload = function () { if (settled) return; settled = true; clearTimeout(timer); done(true); };
    s.onerror = function () { if (settled) return; settled = true; clearTimeout(timer); done(false); };
    document.head.appendChild(s);
  }

  var pending = 2, started = false;
  function finish() {
    if (started) return;
    started = true;
    results.gsap = !!(window.gsap);
    results.katex = !!(window.katex && window.katex.render);
    window.__LAB_LIBS__ = results;
    // 轮询等待其余脚本解析完毕（app.ready 由最后一个脚本置位）
    var tries = 0;
    (function wait() {
      if (window.LAB && LAB.app && LAB.app.ready) {
        try { LAB.app.start(results); }
        catch (err) { console.error('[mathlab] 启动失败', err); }
        return;
      }
      if (++tries < 300) setTimeout(wait, 40);
      else console.error('[mathlab] 启动超时：app.ready 未被置位');
    })();
  }
  function step() { if (--pending <= 0) finish(); }

  injectCss(CDN.katexCss);
  injectJs(CDN.gsap, function () { step(); });
  injectJs(CDN.katex, function () { step(); });
  // 兜底：即使脚本永不回调，页面也必须活起来
  setTimeout(function () { if (!window.__LAB_LIBS__) { pending = 0; finish(); } }, 9000);
})();
