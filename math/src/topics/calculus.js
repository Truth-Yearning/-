/* MathLab topic · 微积分
   表达式驱动的函数曲线：割线→切线极限（h→0）、中心差分求导、五种黎曼和方法、
   误差随 N 收敛的对数图、滚动切点。安全表达式解析走 LAB.expr（无 eval）。 */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};
  var U = LAB.util;
  LAB.topics = LAB.topics || {};

  var PAL = {
    curve: '#58c4dd', curve2: '#f26ac0',
    tangent: '#83c167', secant: '#ff9f45',
    riemann: 'rgba(88,196,221,0.25)', riemannLine: '#58c4dd',
    err: '#ffff00', grid: 'rgba(255,255,255,0.10)', axis: 'rgba(255,255,255,0.25)'
  };

  var meta = {
    id: 'calculus',
    title: '微积分',
    group: '分析',
    blurb: '导数是切线的斜率：割线随 h→0 收敛为切线；黎曼和随 N 增大逼近积分。输入你自己的 f(x)。',
    space: '2d',
    domain2: [-1.2, 7.2, -2.4, 2.4],
    defaults: {
      expr: 'sin(x)',
      expr2: '',
      x0: 2.2, h: 0.6, N: 20,
      a: 0, b: 3.14159,
      method: 'mid',
      speed: 0.5,
      showCurve: true, showCurve2: false, showTangent: true, showSecant: true,
      showRiemann: true, showError: true,
      autoScroll: false
    },
    schema: {
      fields: [
        { key: 'expr', label: 'f(x) =', placeholder: 'sin(x)', def: 'sin(x)' },
        { key: 'expr2', label: 'g(x) =', placeholder: 'cos(x)（留空隐藏）', def: '' }
      ],
      params: [
        { key: 'x0', label: '切点 x₀', min: -3, max: 9, step: 0.01 },
        { key: 'h', label: '割线步长 h', min: 0.0001, max: 1.5, step: 0.001 },
        { key: 'N', label: '黎曼和 N', min: 2, max: 400, step: 1 },
        { key: 'a', label: '积分下限 a', min: -3, max: 9, step: 0.05 },
        { key: 'b', label: '积分上限 b', min: -3, max: 9, step: 0.05 },
        { key: 'speed', label: '滚动速度', min: 0.05, max: 2, step: 0.05 }
      ],
      modes: [
        {
          key: 'method', label: '黎曼和方法',
          options: [
            { v: 'left', t: '左端点' }, { v: 'right', t: '右端点' },
            { v: 'mid', t: '中点' }, { v: 'trap', t: '梯形' }, { v: 'simpson', t: '辛普森' }
          ]
        }
      ],
      toggles: [
        { key: 'showCurve', label: '曲线 f(x)' },
        { key: 'showCurve2', label: '曲线 g(x)' },
        { key: 'showTangent', label: '切线' },
        { key: 'showSecant', label: '割线' },
        { key: 'showRiemann', label: '黎曼和' },
        { key: 'showError', label: '收敛误差图' },
        { key: 'autoScroll', label: '自动滚动切点' }
      ],
      reads: [
        { key: 'exprStatus', label: '表达式' },
        { key: 'f0', label: 'f(x₀)' },
        { key: 'df', label: "f'(x₀)" },
        { key: 'secSlope', label: '割线斜率' },
        { key: 'sum', label: '黎曼和' },
        { key: 'trueInt', label: '参考积分' },
        { key: 'err', label: '误差' }
      ]
    }
  };

  /* ---------- 数值方法 ---------- */
  function safeEval(c, x) {
    try {
      var y = c.eval({ x: x });
      return (typeof y === 'number' && isFinite(y)) ? y : null;
    } catch (e) {
      return null;
    }
  }
  function riemann(c, a, b, N, method) {
    if (!c || !(b > a) || N < 1) return null;
    var dx = (b - a) / N, sum = 0;
    for (var i = 0; i < N; i++) {
      var xL = a + i * dx, xR = xL + dx;
      var fL = safeEval(c, xL), fR = safeEval(c, xR);
      var h;
      if (method === 'left') h = fL;
      else if (method === 'right') h = fR;
      else if (method === 'mid') h = safeEval(c, (xL + xR) / 2);
      else if (method === 'trap') h = (fL + fR) / 2;
      else h = (fL + 4 * safeEval(c, (xL + xR) / 2) + fR) / 6;   // simpson
      if (h === null || !isFinite(h)) return null;
      sum += h * dx;
    }
    return sum;
  }
  function derivative(c, x) {
    var hd = 1e-4 * Math.max(1, Math.abs(x));
    var f1 = safeEval(c, x + hd), f2 = safeEval(c, x - hd);
    if (f1 === null || f2 === null) return null;
    return (f1 - f2) / (2 * hd);
  }
  /* 自适应采样：断开不连续处 */
  function sampleCurve(c, xmin, xmax, N, ylim) {
    var pts = [];
    var yw = Math.max(1, ylim[1] - ylim[0]);
    for (var i = 0; i <= N; i++) {
      var x = xmin + (xmax - xmin) * i / N;
      var y = safeEval(c, x);
      if (y === null || Math.abs(y) > ylim[1] + yw * 3 || Math.abs(y) < ylim[0] - yw * 3) pts.push(null);
      else pts.push([x, y]);
    }
    return pts;
  }

  var impl = {
    init: function (ctx) {
      var s = ctx.state.get();
      ctx.__c = {
        c1: LAB.expr.compile(s.expr),
        c2: LAB.expr.compile(s.expr2),
        cacheKey: null, cacheRef: null, cacheErr: null, cacheErrKey: null,
        drag: null
      };
    },
    onField: function (ctx, key, value) {
      if (key === 'expr2' && value.trim() === '') {
        // 第二曲线留空 = 隐藏，属于合法状态
        ctx.__c.c2 = { ok: false, error: '（留空，已隐藏）' };
        ctx.__c.cacheKey = null;
        ctx.ui.fields[key].markBad(false);
        ctx.ui.setRead('exprStatus', '✓ f(x) 有效，g(x) 留空', 'ok');
        return true;
      }
      var comp = LAB.expr.compile(value);
      if (key === 'expr') ctx.__c.c1 = comp;
      else ctx.__c.c2 = comp;
      ctx.__c.cacheKey = null;
      if (comp.ok) {
        ctx.ui.fields[key].markBad(false);
        ctx.ui.setRead('exprStatus', '✓ ' + (comp.names.length ? '变量：' + comp.names.join(', ') : '常数表达式'), 'ok');
        return true;
      }
      ctx.ui.setRead('exprStatus', '✗ ' + comp.error, 'bad');
      return false;
    },
    onParam: function (ctx, key, v) {
      if (key === 'a' || key === 'b' || key === 'method') ctx.__c.cacheKey = null;
    },
    onMode: function (ctx, key, v) {
      ctx.__c.cacheKey = null;
    },
    applyTime: function (ctx, t, dt) {
      var s = ctx.state.get();
      if (s.autoScroll && s.b > s.a) {
        var span = s.b - s.a;
        var xNew = s.a + (((t * s.speed) % span) + span) % span;
        ctx.state.set('x0', +xNew.toFixed(4));
        ctx.ui.params.x0.set(xNew, true);
      }
    },
    onPointer: function (ctx, ev) {
      if (ev.type === 'down') {
        if (ev.altKey || ev.ctrlKey || ev.button === 1) return false;   // 交给 app 平移
        if (ev.button !== 0) return false;
        ctx.__c.drag = { kind: 'x0' };
        ctx.__c.lastX = ev.world2[0];
        return true;
      }
      if (ev.type === 'move' && ctx.__c.drag) {
        var s = ctx.state.get();
        var xr = ctx.view2.worldX();
        var nx = U.clamp(ev.world2[0], xr[0], xr[1]);
        ctx.state.set('x0', +nx.toFixed(4));
        ctx.ui.params.x0.set(nx, true);
        return true;
      }
      if (ev.type === 'up') { ctx.__c.drag = null; return true; }
      return false;
    },
    render: function (ctx) {
      var s = ctx.state.get();
      var dr = ctx.draw;
      var c = ctx.__c;
      var xr = ctx.view2.worldX();
      var yr = ctx.view2.worldY();
      var xmin = xr[0], xmax = xr[1];

      /* 网格与坐标轴 */
      var step = 1;
      while (step * ctx.view2.scale < 30) step *= 2;
      while (step * ctx.view2.scale > 120) step /= 2;
      var gx0 = Math.floor(xmin / step) * step, gy0 = Math.floor(yr[0] / step) * step;
      for (var gx = gx0; gx <= xmax; gx += step) {
        dr.line2([gx, yr[0]], [gx, yr[1]], { color: Math.abs(gx) < 1e-9 ? PAL.axis : PAL.grid, width: 1 });
      }
      for (var gy = gy0; gy <= yr[1]; gy += step) {
        dr.line2([xmin, gy], [xmax, gy], { color: Math.abs(gy) < 1e-9 ? PAL.axis : PAL.grid, width: 1 });
      }

      /* 曲线 */
      function drawCurve(comp, color, width) {
        if (!comp.ok) return;
        var pts = sampleCurve(comp, xmin, xmax, 420, yr);
        var seg = [];
        function flush() {
          if (seg.length >= 2) {
            for (var i = 0; i < seg.length - 1; i++) {
              dr.line2(seg[i], seg[i + 1], { color: color, width: width });
            }
          }
          seg = [];
        }
        for (var i = 0; i < pts.length; i++) {
          if (pts[i] === null) flush();
          else seg.push(pts[i]);
        }
        flush();
      }
      if (s.showCurve) drawCurve(c.c1, PAL.curve, 2.4);
      if (s.showCurve2 && s.expr2.trim()) drawCurve(c.c2, PAL.curve2, 2);

      /* 切线与割线 */
      var f0 = c.c1.ok ? safeEval(c.c1, s.x0) : null;
      var m = c.c1.ok ? derivative(c.c1, s.x0) : null;
      var fh = c.c1.ok ? safeEval(c.c1, s.x0 + s.h) : null;
      var secSlope = (f0 !== null && fh !== null) ? (fh - f0) / Math.max(1e-12, s.h) : null;

      if (s.showTangent && m !== null && isFinite(m)) {
        var L = 1.3;
        dr.line2([s.x0 - L, f0 - m * L], [s.x0 + L, f0 + m * L], { color: PAL.tangent, width: 2, glow: 4 });
        dr.dot2([s.x0, f0], 4.5, { color: PAL.tangent, glow: 6 });
        dr.text2([s.x0 + 0.15, f0 + 0.3], '切线', { color: PAL.tangent, font: 'italic 13px Georgia, "Songti SC", serif' });
      }
      if (s.showSecant && secSlope !== null && isFinite(secSlope)) {
        var tangentBlend = s.h < 0.005;
        var extend = tangentBlend ? 1.3 : 0.35;
        dr.line2([s.x0 - extend, f0 - secSlope * extend], [s.x0 + s.h + extend, fh + secSlope * extend],
          { color: PAL.secant, width: tangentBlend ? 2 : 1.8, dash: tangentBlend ? null : [6, 4], glow: tangentBlend ? 4 : 0 });
        dr.dot2([s.x0 + s.h, fh], 3.5, { color: PAL.secant });
        dr.text2([s.x0 + s.h + 0.15, fh - 0.25], 'x₀+h', { color: PAL.secant, font: '12px "JetBrains Mono", monospace' });
        if (!tangentBlend) dr.text2([s.x0 + 0.15, f0 + 0.5], '割线 → 切线 (h→0)', { color: PAL.secant, font: 'italic 13px Georgia, "Songti SC", serif' });
      }

      /* 黎曼和 */
      var sum = null;
      if (s.showRiemann && c.c1.ok && s.b > s.a && s.N >= 1) {
        var dx = (s.b - s.a) / s.N;
        for (var i = 0; i < s.N; i++) {
          var xL = s.a + i * dx, xR = xL + dx;
          var yL = safeEval(c.c1, xL), yR = safeEval(c.c1, xR);
          var yTop;
          if (s.method === 'left') yTop = yL;
          else if (s.method === 'right') yTop = yR;
          else if (s.method === 'mid') yTop = safeEval(c.c1, (xL + xR) / 2);
          else if (s.method === 'simpson') yTop = (yL + 4 * safeEval(c.c1, (xL + xR) / 2) + yR) / 6;
          else yTop = null;                             // 梯形单独处理
          if (yTop !== null) {
            var top = U.clamp(yTop, yr[0] - 4, yr[1] + 4);
            if (Math.abs(top) > 1e-6) {
              dr.poly2([[xL, 0], [xL, top], [xR, top], [xR, 0]], { color: PAL.riemannLine, fillAlpha: 0.16, width: 1 });
            }
          } else if (s.method === 'trap' && yL !== null && yR !== null) {
            dr.poly2([[xL, 0], [xL, yL], [xR, yR], [xR, 0]], { color: PAL.riemannLine, fillAlpha: 0.16, width: 1 });
          }
        }
        sum = riemann(c.c1, s.a, s.b, s.N, s.method);
      }

      /* 参考积分（缓存） */
      var key = s.expr + '|' + s.a + '|' + s.b + '|' + s.method;
      if (c.cacheKey !== key) {
        c.cacheKey = key;
        c.cacheRef = c.c1.ok ? riemann(c.c1, s.a, s.b, 2000, 'simpson') : null;
        c.cacheErr = null;
      }
      var refVal = c.cacheRef;

      /* 收敛误差图（对数坐标，右下角） */
      if (s.showError && c.c1.ok && refVal !== null && s.b > s.a) {
        var boxX0 = xmax - 1.9, boxX1 = xmax - 0.15;
        var boxY0 = yr[1] - 1.55, boxY1 = yr[1] - 0.1;
        dr.poly2([[boxX0, boxY0], [boxX1, boxY0], [boxX1, boxY1], [boxX0, boxY1]], { color: 'rgba(255,255,255,0.25)', width: 1 });
        var errKey = key + '|err';
        if (c.cacheErrKey !== errKey) {
          c.cacheErrKey = errKey;
          var series = [];
          for (var NN = 4; NN <= 512; NN *= 2) {
            var sv = riemann(c.c1, s.a, s.b, NN, s.method);
            if (sv === null) continue;
            var err = Math.abs(sv - refVal);
            series.push([NN, Math.max(err, 1e-15)]);
          }
          c.cacheErr = series;
        }
        if (c.cacheErr && c.cacheErr.length >= 2) {
          var pts = c.cacheErr.map(function (p) {
            var lx = U.mapRange(Math.log(p[0]), Math.log(c.cacheErr[0][0]), Math.log(c.cacheErr[c.cacheErr.length - 1][0]), boxX0, boxX1);
            var ly = U.mapRange(Math.log(p[1]), Math.log(c.cacheErr[c.cacheErr.length - 1][1]), Math.log(c.cacheErr[0][1]), boxY0, boxY1);
            return [lx, ly];
          });
          for (var q = 0; q < pts.length - 1; q++) {
            dr.line2(pts[q], pts[q + 1], { color: PAL.err, width: 1.8 });
          }
          dr.text2([boxX0, boxY0 - 0.28], '误差 |Σ−∫| 随 N（log-log）', { color: PAL.err, font: '11px "JetBrains Mono", monospace' });
        }
      }

      /* 读数 */
      ctx.ui.setRead('f0', f0 === null ? '—' : U.fmt(f0, 5));
      ctx.ui.setRead('df', m === null ? '—' : U.fmt(m, 5));
      ctx.ui.setRead('secSlope', secSlope === null ? '—' : U.fmt(secSlope, 5));
      ctx.ui.setRead('sum', sum === null ? '—' : U.fmt(sum, 6));
      ctx.ui.setRead('trueInt', refVal === null ? '—' : U.fmt(refVal, 6));
      var errTxt = '—', errCls = '';
      if (sum !== null && refVal !== null) {
        var e = sum - refVal;
        errTxt = U.fmt(e, 6) + '（' + U.fmt(Math.abs(e) / Math.max(1e-12, Math.abs(refVal)) * 100, 2) + '%）';
        errCls = Math.abs(e) / Math.max(1e-12, Math.abs(refVal)) < 0.01 ? 'ok' : '';
      }
      ctx.ui.setRead('err', errTxt, errCls);
      if (c.c1.ok && !c.c2.ok && s.expr2.trim()) ctx.ui.setRead('exprStatus', '✗ g(x)：' + c.c2.error, 'bad');
      else if (c.c1.ok) ctx.ui.setRead('exprStatus', '✓ f(x)' + (s.expr2.trim() && c.c2.ok ? '，✓ g(x)' : ''), 'ok');
      else ctx.ui.setRead('exprStatus', '✗ f(x)：' + c.c1.error, 'bad');
    },
    selftest: function () {
      var out = [];
      function t(name, ok, extra) { out.push({ name: name, ok: ok, extra: extra }); }
      var x2 = LAB.expr.compile('x^2');
      var d3 = derivative(x2, 3);
      t("(x²)' 在 x=3 处 ≈ 6", d3 !== null && Math.abs(d3 - 6) < 1e-6, 'd=' + d3);
      var sin = LAB.expr.compile('sin(x)');
      var d0 = derivative(sin, 0);
      t("sin' 在 x=0 处 ≈ 1", d0 !== null && Math.abs(d0 - 1) < 1e-6, 'd=' + d0);
      var sLeft = riemann(x2, 0, 1, 500, 'left');
      var sRight = riemann(x2, 0, 1, 500, 'right');
      t('x² 在 [0,1] 上：左端点 < 1/3 < 右端点', sLeft !== null && sRight !== null && sLeft < 1 / 3 && sRight > 1 / 3, sLeft + ' < 1/3 < ' + sRight);
      var sMid = riemann(x2, 0, 1, 500, 'mid');
      t('中点法 N=500 误差 < 1e-6', sMid !== null && Math.abs(sMid - 1 / 3) < 1e-6, 'e=' + (sMid - 1 / 3));
      var sSimp = riemann(x2, 0, 1, 100, 'simpson');
      t('辛普森对二次函数精确', sSimp !== null && Math.abs(sSimp - 1 / 3) < 1e-12, 'e=' + (sSimp - 1 / 3));
      var bad = LAB.expr.compile('sin(x');
      t('括号不匹配 → 可读错误', bad.ok === false && !!bad.error, bad.error);
      var evalErr = LAB.expr.tryEval('ln(x)', { x: -1 });
      t('ln(-1) 定义域错误被捕获', evalErr.ok === false && !!evalErr.error, evalErr.error);
      var trap = riemann(x2, 0, 1, 200, 'trap');
      t('梯形法 N=200 误差 < 1e-5', trap !== null && Math.abs(trap - 1 / 3) < 1e-5, 'e=' + (trap - 1 / 3));
      return out;
    }
  };

  LAB.topics.calculus = { meta: meta, impl: impl };
})();
