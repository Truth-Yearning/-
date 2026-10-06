/* MathLab core · 向量与 4×4 矩阵（列主序）
   3D 相机管线：lookAt → perspective/ortho → 屏幕；反投影射线与平面求交。 */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};
  var EPS = 1e-10;

  /* ---------- 向量 ---------- */
  function v3(x, y, z) { return [x, y, z]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }
  function len(a) { return Math.hypot(a[0], a[1], a[2]); }
  function norm(a) {
    var l = len(a);
    if (l < 1e-12) return null;
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  function lerpV(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  /* ---------- 4×4 列主序矩阵（16 个元素，索引 = 行 + 4*列） ---------- */
  function matIdentity() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function matMultiply(a, b) {
    var o = new Array(16);
    for (var c = 0; c < 4; c++) {
      for (var r = 0; r < 4; r++) {
        var s = 0;
        for (var k = 0; k < 4; k++) s += a[r + 4 * k] * b[k + 4 * c];
        o[r + 4 * c] = s;
      }
    }
    return o;
  }
  function matTranslate(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }
  function matRotateX(rad) {
    var c = Math.cos(rad), s = Math.sin(rad);
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  }
  function matRotateY(rad) {
    var c = Math.cos(rad), s = Math.sin(rad);
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  }
  function matRotateZ(rad) {
    var c = Math.cos(rad), s = Math.sin(rad);
    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }
  function matPerspective(fovDeg, aspect, near, far) {
    var f = 1 / Math.tan(fovDeg * Math.PI / 360);
    var nf = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ];
  }
  function matOrtho(l, r, b, t, n, f) {
    return [
      2 / (r - l), 0, 0, 0,
      0, 2 / (t - b), 0, 0,
      0, 0, -2 / (f - n), 0,
      -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1
    ];
  }
  function matLookAt(eye, target, up) {
    var z = norm(sub(eye, target));        // 相机看向 -z
    if (!z) return matIdentity();
    var x = norm(cross(up || [0, 1, 0], z));
    if (!x) return matIdentity();          // z ∥ up（万向锁）：返回单位阵保护
    var y = cross(z, x);
    return [
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
    ];
  }
  /* 矩阵 × 点（w=1），返回 [x,y,z,w] */
  function matTransform(m, p) {
    var x = p[0], y = p[1], z = p[2];
    return [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
      m[3] * x + m[7] * y + m[11] * z + m[15]
    ];
  }
  /* 一般 4×4 逆矩阵（伴随矩阵法），不可逆返回 null */
  function matInverse(m) {
    var inv = new Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    var det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    if (Math.abs(det) < EPS) return null;
    det = 1 / det;
    for (var i = 0; i < 16; i++) inv[i] *= det;
    return inv;
  }

  /* ---------- 相机 ----------
     cam = { yaw(deg), pitch(deg), dist, tx, ty, tz, fov(deg), mode:'persp'|'ortho', orthoScale } */
  function camera(cam, aspect) {
    var yaw = (cam.yaw || 0) * Math.PI / 180;
    var pitch = (cam.pitch || 0) * Math.PI / 180;
    var cp = Math.cos(pitch);
    var eye = [
      cam.tx + cam.dist * cp * Math.sin(yaw),
      cam.ty + cam.dist * Math.sin(pitch),
      cam.tz + cam.dist * cp * Math.cos(yaw)
    ];
    var target = [cam.tx || 0, cam.ty || 0, cam.tz || 0];
    var view = matLookAt(eye, target, [0, 1, 0]);
    var proj;
    if (cam.mode === 'ortho') {
      var s = cam.orthoScale || 6;
      proj = matOrtho(-s * aspect, s * aspect, -s, s, -300, 300);
    } else {
      proj = matPerspective(cam.fov || 42, aspect || 1, 0.1, 500);
    }
    return { eye: eye, view: view, proj: proj, vp: matMultiply(proj, view), cam: cam };
  }
  /* 世界点 → 屏幕 [x, y, clipZ]；在相机后方返回 null */
  function screenOf(vp, W, H, p) {
    var q = matTransform(vp, p);
    if (q[3] <= 1e-7) return null;
    return [
      (q[0] / q[3] * 0.5 + 0.5) * W,
      (1 - (q[1] / q[3] * 0.5 + 0.5)) * H,
      q[2] / q[3]
    ];
  }
  /* 屏幕像素 → 世界射线 {o, d} */
  function ray(vp, W, H, sx, sy) {
    var nx = (sx / W) * 2 - 1;
    var ny = 1 - (sy / H) * 2;
    var inv = matInverse(vp);
    if (!inv) return null;
    var a = matTransform(inv, [nx, ny, -1]);
    var b = matTransform(inv, [nx, ny, 1]);
    var wa = Math.abs(a[3]) < 1e-10 ? 1e-10 : a[3];
    var wb = Math.abs(b[3]) < 1e-10 ? 1e-10 : b[3];
    a = [a[0] / wa, a[1] / wa, a[2] / wa];
    b = [b[0] / wb, b[1] / wb, b[2] / wb];
    var d = sub(b, a);
    var l = len(d);
    if (l < 1e-12) return null;
    return { o: a, d: [d[0] / l, d[1] / l, d[2] / l] };
  }
  /* 射线与平面求交；平行时返回 null（退化保护） */
  function planeHit(o, d, point, normal) {
    var den = dot(d, normal);
    if (Math.abs(den) < 1e-8) return null;
    var t = dot(sub(point, o), normal) / den;
    if (t <= 0) return null;
    return add(o, scale(d, t));
  }

  LAB.vec = {
    EPS: EPS,
    v3: v3, add: add, sub: sub, scale: scale, dot: dot, cross: cross, len: len, norm: norm, lerpV: lerpV,
    identity: matIdentity, multiply: matMultiply, translate: matTranslate,
    rotateX: matRotateX, rotateY: matRotateY, rotateZ: matRotateZ,
    perspective: matPerspective, ortho: matOrtho, lookAt: matLookAt,
    transform: matTransform, inverse: matInverse,
    camera: camera, screenOf: screenOf, ray: ray, planeHit: planeHit
  };
})();
