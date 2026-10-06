/* MathLab topic · 数论 / 模运算
   素数螺旋（Ulam）、模乘表（乘法群结构）、Collatz 轨迹（对数瀑布）。
   筛法用 Uint8Array；Collatz 有 Number.MAX_SAFE_INTEGER 溢出保护。 */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};
  var U = LAB.util;
  LAB.topics = LAB.topics || {};

  var meta = {
    id: 'numbertheory',
    title: '数论 · 模运算',
    group: '数论',
    blurb: '素数螺旋、模乘表与 Collatz 轨迹：秩序从看似随机的结构中浮现。点击模乘表的格子查看 i·j mod m。',
    space: '2d',
    domain2: [-1.9, 1.9, -1.9, 1.9],
    defaults: {
      mode: 'spiral',
      n: 700, m: 17, start: 27, steps: 120,
      showNumbers: false
    },
    schema: {
      modes: [
        {
          key: 'mode', label: '主题',
          options: [
            { v: 'spiral', t: '素数螺旋 (Ulam)' },
            { v: 'mul', t: '模乘表 (i·j mod m)' },
            { v: 'collatz', t: 'Collatz 轨迹' }
          ]
        }
      ],
      params: [
        { key: 'n', label: '点数 n', min: 100, max: 6000, step: 100 },
        { key: 'm', label: '模数 m', min: 2, max: 64, step: 1 },
        { key: 'start', label: 'Collatz 起点', min: 1, max: 200000, step: 1 },
        { key: 'steps', label: '步数上限', min: 20, max: 1000, step: 10 }
      ],
      toggles: [
        { key: 'showNumbers', label: '显示数字（小规模时）' }
      ],
      reads: [
        { key: 'info1', label: '统计 ①' },
        { key: 'info2', label: '统计 ②' },
        { key: 'cell', label: '选中格' }
      ]
    },
    timeline: { duration: 10, step: 0.05, keyframes: [] }
  };

  /* ---------- Ulam 螺旋坐标 ---------- */
  function ulamPos(i) {
    if (i === 1) return [0, 0];
    var r = Math.ceil((Math.sqrt(i) - 1) / 2);
    var p = (2 * r + 1) * (2 * r + 1);
    var side = 2 * r;
    if (i > p - side) return [r - (p - i), -r];
    if (i > p - 2 * side) return [-r, -r + (p - side - i)];
    if (i > p - 3 * side) return [-r + (p - 2 * side - i), r];
    return [r, r - (p - 3 * side - i)];
  }
  function phi(m) {
    var c = 0;
    for (var i = 1; i <= m; i++) if (U.gcd(i, m) === 1) c++;
    return c;
  }
  function collatzSeq(start, maxSteps) {
    var seq = [];
    var v = Math.floor(start);
    var reached = false, overflow = false;
    for (var i = 0; i <= maxSteps; i++) {
      seq.push(v);
      if (v === 1) { reached = true; break; }
      // 只有奇数才做 ×3+1，才会放大：只对奇数做溢出检查
      if (v % 2 === 1 && v > Number.MAX_SAFE_INTEGER / 3) { overflow = true; break; }
      v = (v % 2 === 0) ? v / 2 : 3 * v + 1;
    }
    return { seq: seq, reached: reached, overflow: overflow, max: Math.max.apply(null, seq) };
  }

  var impl = {
    init: function (ctx) {
      ctx.__n = { sieve: null, sieveN: 0, lastFit: '', sel: null, hover: null };
    },
    onMode: function (ctx, key, v) {
      ctx.__n.lastFit = '';
      ctx.__n.sel = null;
    },
    onPointer: function (ctx, ev) {
      var s = ctx.state.get();
      if (s.mode !== 'mul') return false;
      if (ev.type === 'down' && ev.button === 0) {
        var c = this.mulCell(ctx, ev.world2);
        ctx.__n.sel = c;
        if (c) {
          var v = (c.i * c.j) % s.m;
          ctx.ui.setRead('cell', c.i + '·' + c.j + ' ≡ ' + v + ' (mod ' + s.m + ')' + (U.gcd(v, s.m) === 1 ? '　单位 ✓' : '　非单位'));
          ctx.ui.setRead('info1', 'φ(' + s.m + ') = ' + phi(s.m) + ' 个单位');
          ctx.ui.setRead('info2', '单位与 m 互素：gcd(i,m)=1');
        }
        return true;
      }
      if (ev.type === 'move') {
        var h = this.mulCell(ctx, ev.world2);
        if (h && (!ctx.__n.hover || h.i !== ctx.__n.hover.i || h.j !== ctx.__n.hover.j)) ctx.__n.hover = h;
        else if (!h && ctx.__n.hover) ctx.__n.hover = null;
      }
      return false;
    },
    mulCell: function (ctx, w) {
      var s = ctx.state.get();
      var cw = 3.6 / s.m;
      var ci = Math.round(w[0] / cw + (s.m + 1) / 2);
      var cj = Math.round((s.m + 1) / 2 - w[1] / cw);
      if (ci >= 1 && ci <= s.m && cj >= 1 && cj <= s.m) return { i: ci, j: cj };
      return null;
    },
    render: function (ctx) {
      var s = ctx.state.get();
      var dr = ctx.draw;
      var N = ctx.__n;

      if (s.mode === 'spiral') {
        if (N.lastFit !== 'spiral') { ctx.view2.setDomain(-1.9, 1.9, -1.9, 1.9); N.lastFit = 'spiral'; }
        if (!N.sieve || N.sieveN < s.n) { N.sieve = U.sieve(s.n); N.sieveN = s.n; }
        var rmax = Math.ceil((Math.sqrt(s.n) - 1) / 2);
        var scale = 3.5 / (2 * rmax + 1);
        var primes = 0;
        for (var i = 1; i <= s.n; i++) {
          var p = ulamPos(i);
          var x = p[0] * scale, y = p[1] * scale;
          var isP = N.sieve[i] === 1;
          if (isP) primes++;
          dr.dot2([x, y], isP ? 2.4 : 1.1, { color: isP ? '#ffff00' : 'rgba(88,196,221,0.5)', glow: isP ? 3 : 0 });
          if (s.showNumbers && s.n <= 600) {
            dr.text2([x, y - 0.06], i, { color: isP ? 'rgba(255,255,0,0.85)' : 'rgba(255,255,255,0.4)', font: '9px "JetBrains Mono", monospace', textAlign: 'center' });
          }
        }
        ctx.ui.setRead('info1', '1–' + s.n + ' 中共 ' + primes + ' 个素数');
        ctx.ui.setRead('info2', '密度 ' + U.fmt(primes / s.n * 100, 1) + '%（黄点 = 素数）');
        ctx.ui.setRead('cell', '—');
      }

      else if (s.mode === 'mul') {
        if (N.lastFit !== 'mul') { ctx.view2.setDomain(-1.9, 1.9, -1.9, 1.9); N.lastFit = 'mul'; }
        var m = Math.max(2, Math.round(s.m));
        var cw = 3.6 / m;
        var half = (m + 1) / 2;
        for (var j = 1; j <= m; j++) {
          for (var k = 1; k <= m; k++) {
            var v = (k * j) % m;
            var unit = U.gcd(v, m) === 1;
            var x0 = (k - half) * cw, y0 = (half - j) * cw;
            var sel = N.sel && N.sel.i === k && N.sel.j === j;
            var hov = N.hover && N.hover.i === k && N.hover.j === j;
            dr.poly2([[x0, y0], [x0 + cw * 0.92, y0], [x0 + cw * 0.92, y0 + cw * 0.92], [x0, y0 + cw * 0.92]], {
              color: sel ? '#ffffff' : (hov ? 'rgba(255,255,255,0.7)' : (unit ? 'rgba(255,255,0,0.55)' : 'rgba(255,255,255,0.12)')),
              fillAlpha: sel ? 0.75 : (hov ? 0.35 : (unit ? 0.25 : (v === 0 ? 0.02 : U.mapRange(v, 0, m, 0.04, 0.3)))),
              width: sel || hov ? 1.5 : 1
            });
            if (s.showNumbers && m <= 14) {
              dr.text2([x0 + cw * 0.46, y0 + cw * 0.46], v, { color: unit ? '#ffff00' : 'rgba(255,255,255,0.55)', font: Math.max(8, Math.round(cw * ctx.view2.scale * 0.35)) + 'px "JetBrains Mono", monospace', textAlign: 'center', baseline: 'middle' });
            }
          }
        }
        // 行/列标签（只标单位行）
        for (var a = 1; a <= m; a++) {
          var isU = U.gcd(a, m) === 1;
          if (m <= 20) {
            dr.text2([(a - half) * cw + cw * 0.46, (half - (m + 0.55)) * cw], a, { color: isU ? '#ffff00' : 'rgba(255,255,255,0.4)', font: '10px "JetBrains Mono", monospace', textAlign: 'center' });
            dr.text2([(m + 0.55 - half) * cw, (half - a) * cw + cw * 0.46], a, { color: isU ? '#ffff00' : 'rgba(255,255,255,0.4)', font: '10px "JetBrains Mono", monospace', textAlign: 'center', baseline: 'middle' });
          }
        }
        var units = phi(m);
        ctx.ui.setRead('info1', 'φ(' + m + ') = ' + units + ' 个单位（黄框）');
        ctx.ui.setRead('info2', '单位与 m 互素，构成乘法群');
        ctx.ui.setRead('cell', N.sel ? (N.sel.i + '·' + N.sel.j + ' ≡ ' + ((N.sel.i * N.sel.j) % m) + ' (mod ' + m + ')') : '点击格子查看 i·j mod m');
      }

      else {
        /* collatz：对数瀑布 */
        var seq = collatzSeq(s.start, Math.max(20, Math.round(s.steps)));
        var maxV = Math.max(2, seq.max);
        var ymax = Math.log2(maxV) * 1.12 + 0.5;
        var fitKey = 'collatz|' + seq.seq.length + '|' + ymax.toFixed(2);
        if (N.lastFit !== fitKey) {
          ctx.view2.setDomain(-seq.seq.length * 0.03, seq.seq.length * 1.06, -1.2, ymax);
          N.lastFit = fitKey;
        }
        for (var t = 0; t < seq.seq.length - 1; t++) {
          var yA = seq.seq[t] === 1 ? 0 : Math.log2(seq.seq[t]);
          var yB = seq.seq[t + 1] === 1 ? 0 : Math.log2(seq.seq[t + 1]);
          dr.line2([t, yA], [t + 1, yB], { color: seq.seq[t] % 2 === 0 ? 'rgba(88,196,221,0.8)' : 'rgba(255,255,0,0.8)', width: 1.6 });
          dr.dot2([t, yA], 1.6, { color: seq.seq[t] % 2 === 0 ? '#58c4dd' : '#ffff00' });
        }
        var lastT = seq.seq.length - 1;
        dr.dot2([lastT, seq.seq[lastT] === 1 ? 0 : Math.log2(seq.seq[lastT])], 3, { color: '#ffffff', glow: 6 });
        // 参考线 y=log2(1)=0
        dr.line2([-seq.seq.length * 0.03, 0], [seq.seq.length * 1.06, 0], { color: 'rgba(255,255,255,0.25)', width: 1 });
        ctx.ui.setRead('info1', '起点 ' + seq.seq[0] + '　经过 ' + (seq.seq.length - 1) + ' 步' + (seq.reached ? '　到达 1 ✓' : ''));
        ctx.ui.setRead('info2', '峰值 ' + seq.max + (seq.overflow ? '　⚠ 超出安全整数上限，已提前停止' : ''));
        ctx.ui.setRead('cell', '黄 = 奇数（×3+1）· 青 = 偶数（÷2）· 纵轴 log₂');
      }
    },
    selftest: function () {
      var out = [];
      function t(name, ok, extra) { out.push({ name: name, ok: ok, extra: extra }); }
      var sv = U.sieve(100);
      var cnt = 0;
      for (var i = 2; i <= 100; i++) if (sv[i]) cnt++;
      t('筛法：100 以内恰有 25 个素数', cnt === 25, 'count=' + cnt);
      var p1 = ulamPos(1), p2 = ulamPos(2), p5 = ulamPos(5), p9 = ulamPos(9);
      t('Ulam 螺旋：1 在中心', p1[0] === 0 && p1[1] === 0);
      t('Ulam 螺旋：2 在 (1,0)，5 在 (-1,1)，9 在 (1,-1)',
        p2[0] === 1 && p2[1] === 0 && p5[0] === -1 && p5[1] === 1 && p9[0] === 1 && p9[1] === -1);
      t('φ(12) = 4', phi(12) === 4);
      t('φ(17) = 16（素数）', phi(17) === 16);
      var c27 = collatzSeq(27, 1000);
      t('Collatz(27) 在 1000 步内到达 1', c27.reached === true, 'steps=' + (c27.seq.length - 1));
      t('Collatz(27) 峰值 > 1000', c27.max > 1000, 'max=' + c27.max);
      var c1 = collatzSeq(1, 50);
      t('Collatz(1) 立即终止', c1.reached === true && c1.seq.length === 1);
      var ov = collatzSeq(Number.MAX_SAFE_INTEGER, 10);
      t('溢出保护：超过安全整数提前停止', ov.overflow === true || ov.reached === true);
      return out;
    }
  };

  LAB.topics.numbertheory = { meta: meta, impl: impl };
})();
