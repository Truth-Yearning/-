/* MathLab core · 视口
   - ensureSize：每帧检查窗口/DPR，几何永不与视口脱节（直接使用 window.innerWidth/innerHeight，
     避免首次布局时 canvas 尚未完成布局导致的 0 尺寸读取）
   - View2：2D 世界坐标系（数学系，y 向上）
   - View3：3D 球坐标轨道相机（方位/俯仰/距离/目标点，透视或正交） */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};
  var U = LAB.util;
  var dims = { W: 1, H: 1, dpr: 1, changed: false };

  function ensureSize(canvas) {
    var W = Math.max(1, window.innerWidth);
    var H = Math.max(1, window.innerHeight);
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var changed = (W !== dims.W || H !== dims.H || Math.abs(dpr - dims.dpr) > 1e-6);
    dims.changed = changed;
    if (changed) {
      dims.W = W; dims.H = H; dims.dpr = dpr;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
    }
    return changed;
  }

  /* ---------- 2D ---------- */
  function View2() {
    var v = {
      cx: 0, cy: 0, scale: 80, scaleTarget: 80,
      setDomain: function (xmin, xmax, ymin, ymax) {
        var w = Math.max(1, xmax - xmin), h = Math.max(1, ymax - ymin);
        // 首次布局尺寸可能尚未就绪：回退到窗口尺寸
        var vw = dims.W > 10 ? dims.W : Math.max(1, window.innerWidth);
        var vh = dims.H > 10 ? dims.H : Math.max(1, window.innerHeight);
        var s = Math.min(vw / w, vh / h) * 0.94;
        v.scale = v.scaleTarget = s;
        v.cx = vw / 2 - (xmin + xmax) / 2 * s;
        v.cy = vh / 2 + (ymin + ymax) / 2 * s;
      },
      toScreen: function (x, y) { return [v.cx + x * v.scale, v.cy - y * v.scale]; },
      toWorld: function (sx, sy) { return [(sx - v.cx) / v.scale, (v.cy - sy) / v.scale]; },
      worldX: function () {
        return [v.toWorld(0, 0)[0], v.toWorld(dims.W, 0)[0]];
      },
      worldY: function () {
        return [v.toWorld(0, dims.H)[1], v.toWorld(0, 0)[1]];
      },
      shift: function (dx, dy) { v.cx += dx; v.cy += dy; },
      zoomAt: function (sx, sy, f) {
        var w = v.toWorld(sx, sy);
        var k = U.clamp(v.scale * f, 2, 4000);
        v.scale = v.scaleTarget = k;
        v.cx = sx - w[0] * k;
        v.cy = sy + w[1] * k;
      },
      tick: function () {
        if (Math.abs(v.scale - v.scaleTarget) > 0.05) v.scale += (v.scaleTarget - v.scale) * 0.2;
      }
    };
    v.setDomain(-8, 8, -5.5, 5.5);
    return v;
  }

  /* ---------- 3D ---------- */
  function View3() {
    var v = {
      cam: { yaw: 32, pitch: 22, dist: 9, tx: 0, ty: 0, tz: 0, fov: 42, mode: 'persp', orthoScale: 5.5 },
      camera: function () {
        return LAB.vec.camera(v.cam, Math.max(0.2, dims.W / Math.max(1, dims.H)));
      },
      screenOf: function (p) {
        return LAB.vec.screenOf(v.camera().vp, dims.W, dims.H, p);
      },
      ray: function (sx, sy) {
        var c = v.camera();
        return LAB.vec.ray(c.vp, dims.W, dims.H, sx, sy);
      },
      /* 相机前向（世界系），用于「在相机朝向的平面上拖动」 */
      forward: function () {
        var m = v.camera().view;
        return [m[2], m[6], m[10]];
      },
      right: function () {
        var m = v.camera().view;
        return [m[0], m[4], m[8]];
      },
      up: function () {
        var m = v.camera().view;
        return [m[1], m[5], m[9]];
      },
      orbit: function (dx, dy) {
        v.cam.yaw = (v.cam.yaw + dx * 0.35) % 360;
        v.cam.pitch = U.clamp(v.cam.pitch + dy * 0.25, -89.9, 89.9);
      },
      pan: function (dx, dy) {
        var s = (v.cam.mode === 'ortho' ? v.cam.orthoScale : 2 * Math.tan((v.cam.fov || 42) * Math.PI / 360) * v.cam.dist)
          / Math.max(1, dims.H);
        var r = v.right(), u = v.up();
        v.cam.tx += (-r[0] * dx + u[0] * dy) * s;
        v.cam.ty += (-r[1] * dx + u[1] * dy) * s;
        v.cam.tz += (-r[2] * dx + u[2] * dy) * s;
      },
      zoom: function (f) {
        if (v.cam.mode === 'ortho') v.cam.orthoScale = U.clamp(v.cam.orthoScale * f, 0.5, 60);
        else v.cam.dist = U.clamp(v.cam.dist * f, 1.2, 120);
      }
    };
    return v;
  }

  LAB.viewport = {
    dims: dims,
    ensureSize: ensureSize,
    View2: View2,
    View3: View3
  };
})();
