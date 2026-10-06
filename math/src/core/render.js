/* MathLab core · 显示列表
   主题只往列表里投图元（世界坐标），flush 统一绘制：
   2D 先画，3D 按相机深度从远到近（画家算法）。样式：{color,width,dash,glow,alpha,font,textAlign} */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};
  var U = LAB.util;

  function create() {
    var items = [];
    var api = {};

    api.clear = function () { items.length = 0; };
    api.count = function () { return items.length; };

    function st(s) { return s || {}; }
    function is3(kind) { return kind === 'l3' || kind === 'p3' || kind === 'd3' || kind === 't3' || kind === 'a3'; }

    api.line2 = function (a, b, style) { items.push({ k: 'l2', a: a, b: b, s: st(style) }); };
    api.poly2 = function (pts, style, close) { items.push({ k: 'p2', pts: pts, s: st(style), close: !!close }); };
    api.arrow2 = function (a, b, style) { items.push({ k: 'a2', a: a, b: b, s: st(style) }); };
    api.dot2 = function (p, r, style) { items.push({ k: 'd2', p: p, r: (r === undefined ? 3 : r), s: st(style) }); };
    api.text2 = function (p, str, style) { items.push({ k: 't2', p: p, str: String(str), s: st(style) }); };

    api.line3 = function (a, b, style) { items.push({ k: 'l3', a: a, b: b, s: st(style) }); };
    api.poly3 = function (pts, style, close) { items.push({ k: 'p3', pts: pts, s: st(style), close: !!close }); };
    api.arrow3 = function (a, b, style) { items.push({ k: 'a3', a: a, b: b, s: st(style) }); };
    api.dot3 = function (p, r, style) { items.push({ k: 'd3', p: p, r: (r === undefined ? 3 : r), s: st(style) }); };
    api.text3 = function (p, str, style) { items.push({ k: 't3', p: p, str: String(str), s: st(style) }); };

    /* ---------- 绘制 ---------- */
    function prep(style, ctx, extra) {
      var c = ctx;
      c.save();
      c.strokeStyle = style.color || '#e8ecef';
      c.fillStyle = style.color || '#e8ecef';
      c.lineWidth = style.width || 1.5;
      c.globalAlpha = style.alpha === undefined ? 1 : style.alpha;
      c.lineCap = style.cap || 'round';
      c.lineJoin = 'round';
      if (style.dash) c.setLineDash(Array.isArray(style.dash) ? style.dash : [5, 5]);
      if (style.glow) { c.shadowColor = style.color || '#fff'; c.shadowBlur = style.glow; }
      if (extra && extra.font) c.font = extra.font;
      return c;
    }
    function finish(ctx) { ctx.restore(); }

    function drawArrow(ctx, a, b, head) {
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var L = Math.hypot(dx, dy);
      if (L < 0.6) { ctx.beginPath(); ctx.arc(b[0], b[1], 2.5, 0, Math.PI * 2); ctx.fill(); return; }
      var ux = dx / L, uy = dy / L;
      var h = Math.min(head || 12, L * 0.5);
      var bx = b[0] - ux * h * 0.92, by = b[1] - uy * h * 0.92;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(bx, by); ctx.stroke();
      var hw = h * 0.46;
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(bx - uy * hw, by + ux * hw);
      ctx.lineTo(bx + uy * hw, by - ux * hw);
      ctx.closePath(); ctx.fill();
    }
    function polyPath(ctx, pts, close) {
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
        else ctx.lineTo(pts[i][0], pts[i][1]);
      }
      if (close) ctx.closePath();
    }

    function drawItem(ctx, it, v2, v3, dims) {
      var style = it.s;
      if (it.k === 'l2' || it.k === 'a2') {
        var a = v2.toScreen(it.a[0], it.a[1]);
        var b = v2.toScreen(it.b[0], it.b[1]);
        prep(style, ctx);
        if (it.k === 'a2') drawArrow(ctx, a, b, style.head);
        else { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
        finish(ctx);
      } else if (it.k === 'p2') {
        var pts = it.pts.map(function (p) { return v2.toScreen(p[0], p[1]); });
        prep(style, ctx);
        polyPath(ctx, pts, it.close);
        if (style.fillAlpha !== undefined) { ctx.globalAlpha = style.fillAlpha; ctx.fill(); ctx.globalAlpha = style.alpha === undefined ? 1 : style.alpha; }
        ctx.stroke();
        finish(ctx);
      } else if (it.k === 'd2') {
        var p = v2.toScreen(it.p[0], it.p[1]);
        prep(style, ctx);
        ctx.beginPath(); ctx.arc(p[0], p[1], it.r, 0, Math.PI * 2);
        if (style.fillAlpha !== undefined) { ctx.globalAlpha = style.fillAlpha; ctx.fill(); ctx.globalAlpha = style.alpha === undefined ? 1 : style.alpha; }
        if (style.fill !== false) ctx.fill();
        ctx.stroke();
        finish(ctx);
      } else if (it.k === 't2') {
        var q = v2.toScreen(it.p[0], it.p[1]);
        prep(style, ctx, { font: style.font || '13px "JetBrains Mono", Consolas, monospace' });
        ctx.textAlign = style.textAlign || 'left';
        ctx.textBaseline = style.baseline || 'alphabetic';
        ctx.fillText(it.str, q[0], q[1]);
        finish(ctx);
      } else if (it.k === 'l3' || it.k === 'a3') {
        var sa = v3.screenOf(it.a);
        var sb = v3.screenOf(it.b);
        if (!sa || !sb) return;
        prep(style, ctx);
        if (it.k === 'a3') drawArrow(ctx, sa, sb, style.head);
        else { ctx.beginPath(); ctx.moveTo(sa[0], sa[1]); ctx.lineTo(sb[0], sb[1]); ctx.stroke(); }
        finish(ctx);
      } else if (it.k === 'p3') {
        var spts = [];
        for (var i = 0; i < it.pts.length; i++) {
          var sp = v3.screenOf(it.pts[i]);
          if (!sp) return;
          spts.push(sp);
        }
        prep(style, ctx);
        polyPath(ctx, spts, it.close);
        if (style.fillAlpha !== undefined) { ctx.globalAlpha = style.fillAlpha; ctx.fill(); ctx.globalAlpha = style.alpha === undefined ? 1 : style.alpha; }
        ctx.stroke();
        finish(ctx);
      } else if (it.k === 'd3') {
        var dp = v3.screenOf(it.p);
        if (!dp) return;
        prep(style, ctx);
        ctx.beginPath(); ctx.arc(dp[0], dp[1], it.r, 0, Math.PI * 2);
        if (style.fill !== false) ctx.fill();
        ctx.stroke();
        finish(ctx);
      } else if (it.k === 't3') {
        var tp = v3.screenOf(it.p);
        if (!tp) return;
        prep(style, ctx, { font: style.font || '13px "JetBrains Mono", Consolas, monospace' });
        ctx.textAlign = style.textAlign || 'left';
        ctx.textBaseline = style.baseline || 'alphabetic';
        ctx.fillText(it.str, tp[0], tp[1]);
        finish(ctx);
      }
    }

    /* flush：2D 先画（后画者在上），3D 按深度从远到近 */
    api.flush = function (ctx, v2, v3) {
      var dims = LAB.viewport.dims;
      var flat = items.filter(function (it) { return !is3(it.k); });
      var deep = items.filter(function (it) { return is3(it.k); });
      flat.forEach(function (it) { drawItem(ctx, it, v2, v3, dims); });
      deep.sort(function (a, b) {
        var za = depthOf(a, v3), zb = depthOf(b, v3);
        return (zb === null ? -1 : zb) - (za === null ? -1 : za);
      });
      deep.forEach(function (it) { drawItem(ctx, it, v2, v3, dims); });
    };
    function depthOf(it, v3) {
      var p = it.k === 'l3' || it.k === 'a3' ? [(it.a[0] + it.b[0]) / 2, (it.a[1] + it.b[1]) / 2, (it.a[2] + it.b[2]) / 2]
        : it.k === 'p3' ? it.pts.reduce(function (acc, q) { return [acc[0] + q[0], acc[1] + q[1], acc[2] + q[2]]; }, [0, 0, 0]).map(function (v) { return v / it.pts.length; })
        : it.p;
      var s = v3.screenOf(p);
      return s ? s[2] : null;
    }

    return api;
  }

  LAB.render = { create: create };
})();
