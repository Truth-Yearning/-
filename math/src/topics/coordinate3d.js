/* MathLab topic · 空间直角坐标系
   3D 向量可视化：加法平行四边形/平行六面体、内积投影、叉积、自由点与三种坐标制式。
   交互：拖动箭头端点/自由点（默认在地面 z=0 平面，Shift 拖 = 相机朝向平面上的全自由度），
   空白处拖动旋转视角，双击地面添加自由点，Alt+点击自由点移除。 */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};
  var U = LAB.util;
  var V = LAB.vec;
  LAB.topics = LAB.topics || {};

  var PAL = {
    ax: '#f26ac0', ay: '#83c167', az: '#58c4dd',
    v1: '#83c167', v2: '#f26ac0', v3: '#ffff00',
    dot: '#ff9f45', cross: '#ffff00', point: '#58c4dd',
    grid: 'rgba(255,255,255,0.10)', gridStrong: 'rgba(255,255,255,0.22)'
  };

  var meta = {
    id: 'coordinate3d',
    title: '空间直角坐标系',
    group: '几何与向量',
    blurb: '三维空间中的向量：加法、内积、叉积与三种坐标制式。拖动箭头端点改向量，空白处拖动旋转视角。',
    space: '3d',
    camera3: { yaw: 36, pitch: 24, dist: 9.5, fov: 42, mode: 'persp', orthoScale: 5.5 },
    defaults: {
      v1x: 3, v1y: 1, v1z: 1.5,
      v2x: -1.2, v2y: 2.4, v2z: 0.8,
      v3x: 0.6, v3y: -1, v3z: 2.2,
      px: 2.1, py: 1.4, pz: 1.2,
      showAxes: true, showGrid: true, showShell: false,
      showDot: true, showCross: true, showAdd: true, showBox: false, showPoint: true,
      coordSys: 'cart'
    },
    schema: {
      params: [
        { key: 'v1x', label: 'v₁ x', min: -5, max: 5, step: 0.1 },
        { key: 'v1y', label: 'v₁ y', min: -5, max: 5, step: 0.1 },
        { key: 'v1z', label: 'v₁ z', min: -5, max: 5, step: 0.1 },
        { key: 'v2x', label: 'v₂ x', min: -5, max: 5, step: 0.1 },
        { key: 'v2y', label: 'v₂ y', min: -5, max: 5, step: 0.1 },
        { key: 'v2z', label: 'v₂ z', min: -5, max: 5, step: 0.1 },
        { key: 'v3x', label: 'v₃ x', min: -5, max: 5, step: 0.1 },
        { key: 'v3y', label: 'v₃ y', min: -5, max: 5, step: 0.1 },
        { key: 'v3z', label: 'v₃ z', min: -5, max: 5, step: 0.1 },
        { key: 'px', label: 'P x', min: -5, max: 5, step: 0.1 },
        { key: 'py', label: 'P y', min: -5, max: 5, step: 0.1 },
        { key: 'pz', label: 'P z', min: -5, max: 5, step: 0.1 }
      ],
      modes: [
        {
          key: 'coordSys', label: '坐标制式',
          options: [{ v: 'cart', t: '直角 (x,y,z)' }, { v: 'cyl', t: '柱坐标 (r,θ,z)' }, { v: 'sph', t: '球坐标 (ρ,θ,φ)' }]
        }
      ],
      toggles: [
        { key: 'showAxes', label: '坐标轴' },
        { key: 'showGrid', label: '地面网格' },
        { key: 'showShell', label: '空间网格壳' },
        { key: 'showAdd', label: '加法平行四边形' },
        { key: 'showBox', label: '平行六面体' },
        { key: 'showDot', label: '内积投影' },
        { key: 'showCross', label: '叉积' },
        { key: 'showPoint', label: '自由点 P' }
      ],
      reads: [
        { key: 'len1', label: '|v₁|' },
        { key: 'len2', label: '|v₂|' },
        { key: 'dot', label: 'v₁·v₂' },
        { key: 'angle', label: '夹角' },
        { key: 'cross', label: '|v₁×v₂|' },
        { key: 'pt', label: 'P 坐标' }
      ]
    },
    timeline: {
      duration: 16,
      step: 0.05,
      keyframes: [
        { at: 0, state: { v1x: 3, v1y: 1, v1z: 1.5, v2x: -1.2, v2y: 2.4, v2z: 0.8 } },
        { at: 8, state: { v1x: -2, v1y: 2.5, v1z: 1, v2x: 2, v2y: -1.5, v2z: 1.6 } },
        { at: 16, state: { v1x: 3, v1y: 1, v1z: 1.5, v2x: -1.2, v2y: 2.4, v2z: 0.8 } }
      ]
    }
  };

  /* ---------- 坐标换算 ---------- */
  function cartToCyl(p) {
    var r = Math.hypot(p[0], p[1]);
    var th = Math.atan2(p[1], p[0]) * 180 / Math.PI;
    return [r, th, p[2]];
  }
  function cartToSph(p) {
    var rho = Math.hypot(p[0], p[1], p[2]);
    var th = Math.atan2(p[1], p[0]) * 180 / Math.PI;
    var phi = rho < 1e-12 ? 0 : Math.acos(U.clamp(p[2] / rho, -1, 1)) * 180 / Math.PI;
    return [rho, th, phi];
  }
  function fmtPoint(p, sys) {
    if (sys === 'cyl') { var c = cartToCyl(p); return '(r=' + U.fmt(c[0]) + ', θ=' + U.fmt(c[1]) + '°, z=' + U.fmt(c[2]) + ')'; }
    if (sys === 'sph') { var s = cartToSph(p); return '(ρ=' + U.fmt(s[0]) + ', θ=' + U.fmt(s[1]) + '°, φ=' + U.fmt(s[2]) + '°)'; }
    return '(' + U.fmt(p[0]) + ', ' + U.fmt(p[1]) + ', ' + U.fmt(p[2]) + ')';
  }

  var impl = {
    init: function (ctx) {
      ctx.__d = { drag: null, hover: null };
    },

    /* 拾取拖拽目标：v1/v2 端点、加法角点、自由点（隐藏的不可拾取） */
    hitTest: function (ctx, sx, sy) {
      var s = ctx.state.get();
      var v1 = [s.v1x, s.v1y, s.v1z], v2 = [s.v2x, s.v2y, s.v2z];
      var cands = [
        { id: 'v1', p: v1 },
        { id: 'v2', p: v2 }
      ];
      if (s.showAdd) cands.push({ id: 'add', p: [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]] });
      if (s.showPoint) cands.push({ id: 'point', p: [s.px, s.py, s.pz] });
      var best = null, bestD = 16;
      for (var i = 0; i < cands.length; i++) {
        var sp = ctx.view3.screenOf(cands[i].p);
        if (!sp) continue;
        var d = Math.hypot(sp[0] - sx, sp[1] - sy);
        if (d <= bestD) { bestD = d; best = cands[i]; }
      }
      return best;
    },

    onPointer: function (ctx, ev) {
      var d = ctx.__d;
      if (ev.type === 'down') {
        var hit = this.hitTest(ctx, ev.x, ev.y);
        if (hit && (ev.button === 2 || ev.altKey)) {
          if (hit.id === 'point') {
            ctx.state.set('px', 0); ctx.state.set('py', 0); ctx.state.set('pz', 0);
            LAB.hud.toast('自由点 P 已归零（再次双击地面重新放置）');
            return true;
          }
          return false;
        }
        if (hit) {
          d.drag = hit.id;
          d.last = ev;
          return true;                       // 主题接管拖拽
        }
        return false;                        // 空白处 → app 旋转视角
      }
      if (ev.type === 'move') {
        if (!d.drag) {
          var hov = this.hitTest(ctx, ev.x, ev.y);
          if (hov && hov.id !== d.hover) { d.hover = hov.id; }
          else if (!hov && d.hover) { d.hover = null; }
          else return false;
          return false;
        }
        // 拖拽：默认落在地面 z=0；Shift 落在过当前点、垂直于视线（相机朝向平面）的平面上
        var s = ctx.state.get();
        var v1 = [s.v1x, s.v1y, s.v1z], v2 = [s.v2x, s.v2y, s.v2z];
        var anchor = null;
        if (d.drag === 'v1') anchor = v1;
        else if (d.drag === 'v2') anchor = v2;
        else if (d.drag === 'add') anchor = [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
        else anchor = [s.px, s.py, s.pz];

        var normal = [0, 0, 1];
        if (ev.shiftKey) normal = ctx.view3.forward();
        var hit3 = ev.ray ? V.planeHit(ev.ray.o, ev.ray.d, anchor, normal) : null;
        if (!hit3) {
          // 射线与平面平行：冻结（不产生 NaN），提示换视角
          LAB.hud.toast('射线与拖动平面平行：换个视角或放开 Shift', 1200);
          return true;
        }
        var nx = U.clamp(+hit3[0].toFixed(3), -5, 5);
        var ny = U.clamp(+hit3[1].toFixed(3), -5, 5);
        var nz = U.clamp(+hit3[2].toFixed(3), -5, 5);
        if (d.drag === 'v1') { ctx.state.set('v1x', nx); ctx.state.set('v1y', ny); ctx.state.set('v1z', nz); }
        else if (d.drag === 'v2') { ctx.state.set('v2x', nx); ctx.state.set('v2y', ny); ctx.state.set('v2z', nz); }
        else if (d.drag === 'add') { ctx.state.set('v2x', nx - v1[0]); ctx.state.set('v2y', ny - v1[1]); ctx.state.set('v2z', nz - v1[2]); }
        else { ctx.state.set('px', nx); ctx.state.set('py', ny); ctx.state.set('pz', nz); }
        return true;
      }
      if (ev.type === 'up') { d.drag = null; return true; }
      if (ev.type === 'dbl') {
        // 双击地面：放置自由点
        var hitP = ev.ray ? V.planeHit(ev.ray.o, ev.ray.d, [0, 0, 0], [0, 0, 1]) : null;
        if (hitP) {
          ctx.state.set('px', U.clamp(+hitP[0].toFixed(3), -5, 5));
          ctx.state.set('py', U.clamp(+hitP[1].toFixed(3), -5, 5));
          ctx.state.set('pz', U.clamp(+hitP[2].toFixed(3), -5, 5));
          ctx.state.set('showPoint', true);
          LAB.hud.toast('自由点已放置：' + fmtPoint(hitP, ctx.state.get().coordSys));
        }
        return true;
      }
      return false;
    },

    render: function (ctx) {
      var s = ctx.state.get();
      var dr = ctx.draw;
      var v1 = [s.v1x, s.v1y, s.v1z];
      var v2 = [s.v2x, s.v2y, s.v2z];
      var v3 = [s.v3x, s.v3y, s.v3z];
      var d = ctx.__d;

      /* 坐标轴 */
      if (s.showAxes) {
        var R = 5.6;
        var axd = { width: 2, glow: 6 };
        dr.arrow3([0, 0, 0], [R, 0, 0], Object.assign({ color: PAL.ax }, axd));
        dr.arrow3([0, 0, 0], [0, R, 0], Object.assign({ color: PAL.ay }, axd));
        dr.arrow3([0, 0, 0], [0, 0, R], Object.assign({ color: PAL.az }, axd));
        dr.line3([-R, 0, 0], [0, 0, 0], { color: 'rgba(255,255,255,0.18)', width: 1 });
        dr.line3([0, -R, 0], [0, 0, 0], { color: 'rgba(255,255,255,0.18)', width: 1 });
        dr.line3([0, 0, -R], [0, 0, 0], { color: 'rgba(255,255,255,0.18)', width: 1 });
        dr.text3([R + 0.25, 0, 0], 'x', { color: PAL.ax, font: 'italic 15px Georgia, "Songti SC", serif' });
        dr.text3([0, R + 0.25, 0], 'y', { color: PAL.ay, font: 'italic 15px Georgia, "Songti SC", serif' });
        dr.text3([0, 0, R + 0.25], 'z', { color: PAL.az, font: 'italic 15px Georgia, "Songti SC", serif' });
      }

      /* 地面网格 */
      if (s.showGrid) {
        for (var i = -5; i <= 5; i++) {
          dr.line3([i, -5, 0], [i, 5, 0], { color: i === 0 ? PAL.gridStrong : PAL.grid, width: i === 0 ? 1.4 : 1 });
          dr.line3([-5, i, 0], [5, i, 0], { color: i === 0 ? PAL.gridStrong : PAL.grid, width: i === 0 ? 1.4 : 1 });
        }
      }
      /* 后墙网格壳 */
      if (s.showShell) {
        var wall = 'rgba(255,255,255,0.06)';
        for (var j = -5; j <= 5; j++) {
          dr.line3([-5, j, 0], [-5, j, 5], { color: wall, width: 1 });
          dr.line3([j, -5, 0], [j, -5, 5], { color: wall, width: 1 });
        }
        for (var k = 0; k <= 5; k++) {
          dr.line3([-5, -5, k], [-5, 5, k], { color: wall, width: 1 });
          dr.line3([-5, -5, k], [5, -5, k], { color: wall, width: 1 });
        }
      }

      /* 加法平行四边形 / 六面体 */
      var corner = [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
      if (s.showAdd) {
        dr.poly3([[0, 0, 0], v1, corner, v2], { color: 'rgba(255,255,255,0.55)', width: 1.4, fillAlpha: 0.10, dash: [5, 4] });
      }
      if (s.showBox) {
        var c123 = [corner[0] + v3[0], corner[1] + v3[1], corner[2] + v3[2]];
        var edges = [
          [[0, 0, 0], v1], [[0, 0, 0], v2], [[0, 0, 0], v3],
          [v1, [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]]],
          [v2, corner],
          [v3, [v3[0] + v1[0], v3[1] + v1[1], v3[2] + v1[2]]],
          [v3, [v3[0] + v2[0], v3[1] + v2[1], v3[2] + v2[2]]],
          [corner, c123],
          [[v1[0] + v3[0], v1[1] + v3[1], v1[2] + v3[2]], c123],
          [[v2[0] + v3[0], v2[1] + v3[1], v2[2] + v3[2]], c123]
        ];
        edges.forEach(function (e) {
          dr.line3(e[0], e[1], { color: 'rgba(255,255,255,0.3)', width: 1, dash: [4, 4] });
        });
      }

      /* 向量与手柄 */
      var v1Len = V.len(v1), v2Len = V.len(v2);
      dr.arrow3([0, 0, 0], v1, { color: PAL.v1, width: 3, glow: 8, head: 14 });
      dr.arrow3([0, 0, 0], v2, { color: PAL.v2, width: 3, glow: 8, head: 14 });
      if (s.showBox) dr.arrow3([0, 0, 0], v3, { color: PAL.v3, width: 3, glow: 8, head: 14 });
      dr.text3([v1[0] + 0.3, v1[1] + 0.15, v1[2] + 0.1], 'v₁', { color: PAL.v1, font: 'italic 14px Georgia, "Songti SC", serif' });
      dr.text3([v2[0] + 0.3, v2[1] + 0.15, v2[2] + 0.1], 'v₂', { color: PAL.v2, font: 'italic 14px Georgia, "Songti SC", serif' });
      if (s.showBox) dr.text3([v3[0] + 0.3, v3[1] + 0.15, v3[2] + 0.1], 'v₃', { color: PAL.v3, font: 'italic 14px Georgia, "Songti SC", serif' });

      /* 内积：v2 在 v1 上的投影 */
      if (s.showDot && v1Len > 1e-9) {
        var proj = V.scale(v1, V.dot(v1, v2) / (v1Len * v1Len));
        dr.line3([0, 0, 0], proj, { color: PAL.dot, width: 2, dash: [7, 5] });
        dr.line3(proj, v2, { color: 'rgba(255,255,255,0.25)', width: 1.2, dash: [3, 5] });
        // 直角标记
        var pu = V.norm(proj);
        if (pu) {
          var perp = V.cross(V.cross(v1, v2), v1);
          var pp = V.norm(perp);
          if (pp) {
            var m1 = V.add(V.scale(pu, 0.28), V.scale(pp, 0.28));
            dr.line3(V.scale(pu, 0.28), m1, { color: PAL.dot, width: 1.4 });
            dr.line3(V.scale(pp, 0.28), m1, { color: PAL.dot, width: 1.4 });
          }
        }
        dr.text3(V.scale(proj, 0.5), 'proj', { color: PAL.dot, font: '12px "JetBrains Mono", monospace' });
      }
      /* 叉积 */
      var cross = V.cross(v1, v2);
      var crossLen = V.len(cross);
      if (s.showCross && crossLen > 1e-9) {
        dr.arrow3([0, 0, 0], cross, { color: PAL.cross, width: 2.6, glow: 10, head: 13 });
        dr.text3([cross[0] + 0.3, cross[1] + 0.3, cross[2] + 0.15], 'v₁×v₂', { color: PAL.cross, font: 'italic 13px Georgia, "Songti SC", serif' });
      }

      /* 自由点 */
      if (s.showPoint) {
        var P = [s.px, s.py, s.pz];
        dr.line3(P, [s.px, s.py, 0], { color: 'rgba(255,255,255,0.22)', width: 1, dash: [2, 5] });
        dr.line3([s.px, s.py, 0], [s.px, 0, 0], { color: 'rgba(255,255,255,0.15)', width: 1, dash: [2, 5] });
        dr.line3([s.px, s.py, 0], [0, s.py, 0], { color: 'rgba(255,255,255,0.15)', width: 1, dash: [2, 5] });
        dr.dot3(P, d.hover === 'point' ? 6 : 4.5, { color: PAL.point, glow: 8 });
        dr.text3([P[0] + 0.22, P[1] + 0.22, P[2] + 0.15], 'P ' + fmtPoint(P, s.coordSys), { color: PAL.point, font: '12px "JetBrains Mono", monospace' });
      }

      /* 手柄 */
      function handle(p, color, on) {
        dr.dot3(p, on ? 6.5 : 5, { color: color, glow: on ? 12 : 6, fill: false });
      }
      handle(v1, PAL.v1, d.drag === 'v1' || d.hover === 'v1');
      handle(v2, PAL.v2, d.drag === 'v2' || d.hover === 'v2');
      if (s.showAdd) handle(corner, 'rgba(255,255,255,0.8)', d.drag === 'add' || d.hover === 'add');
      if (s.showBox) handle(v3, PAL.v3, false);
      if (s.showPoint) handle(P, PAL.point, d.drag === 'point' || d.hover === 'point');

      /* 读数 */
      var dotV = V.dot(v1, v2);
      var ang = (v1Len > 1e-9 && v2Len > 1e-9)
        ? Math.acos(U.clamp(dotV / (v1Len * v2Len), -1, 1)) * 180 / Math.PI : 0;
      ctx.ui.setRead('len1', U.fmt(v1Len));
      ctx.ui.setRead('len2', U.fmt(v2Len));
      ctx.ui.setRead('dot', U.fmt(dotV));
      ctx.ui.setRead('angle', U.fmt(ang) + '°');
      ctx.ui.setRead('cross', U.fmt(crossLen));
      ctx.ui.setRead('pt', s.showPoint ? fmtPoint([s.px, s.py, s.pz], s.coordSys) : '（隐藏）');
    },

    selftest: function () {
      var out = [];
      function t(name, ok, extra) { out.push({ name: name, ok: ok, extra: extra }); }
      var proj = V.scale([1, 0, 0], V.dot([3, 4, 0], [1, 0, 0]));
      t('投影公式：proj(3,4,0 → x轴) = (3,0,0)', Math.abs(proj[0] - 3) < 1e-12 && Math.abs(proj[1]) < 1e-12);
      var c = cartToCyl([0, 2, 3]);
      t('直角→柱坐标：(0,2,3) → r=2, θ=90°', Math.abs(c[0] - 2) < 1e-12 && Math.abs(c[1] - 90) < 1e-9);
      var sp = cartToSph([0, 0, 2]);
      t('直角→球坐标：(0,0,2) → ρ=2, φ=0°', Math.abs(sp[0] - 2) < 1e-12 && Math.abs(sp[2]) < 1e-9);
      var cr = V.cross([1, 0, 0], [2, 0, 0]);
      t('平行向量叉积为零向量（无 NaN）', cr[0] === 0 && cr[1] === 0 && cr[2] === 0);
      var z = V.norm([0, 0, 0]);
      t('零向量归一化返回 null', z === null);
      return out;
    }
  };

  LAB.topics.coordinate3d = { meta: meta, impl: impl };
})();
