/* MathLab core · 应用中枢
   主题注册表 + 生命周期 + 单一 rAF 主循环 + 指针/键盘统一转发 + 关键帧 + 状态分享。 */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};
  var U = LAB.util;
  LAB.topics = LAB.topics || {};

  var canvas = null, ctx = null, v2 = null, v3 = null, draw = null;
  var cur = null;                       // 当前主题运行时对象
  var time = 0, playing = false;
  var lastT = 0;
  var stat = { frames: 0, acc: 0, fps: 60, ms: 0, prims: 0 };
  var statsOn = /[?&]stats=1/.test(location.search);
  var selftestOn = /[?&]selftest=1/.test(location.search);
  var appDrag = null;                   // app 级拖拽（轨道/平移）
  var pointerDown = null;               // {sx, sy, button, shift, alt, ctrl}
  var scrubbing = false;

  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  /* ================= 主题生命周期 ================= */
  function activate(id) {
    var topic = LAB.topics[id];
    if (!topic) { id = firstTopic(); topic = LAB.topics[id]; }
    if (!topic) return false;
    var meta = topic.meta, impl = topic.impl || {};

    time = 0; playing = false;
    var defaults = JSON.parse(JSON.stringify(meta.defaults || {}));
    var st = LAB.state.create(defaults);

    LAB.viewport.ensureSize(canvas);          // 确保首次 setDomain 时尺寸可用
    if (meta.domain2) v2.setDomain(meta.domain2[0], meta.domain2[1], meta.domain2[2], meta.domain2[3]);
    else v2.setDomain(-8, 8, -5.5, 5.5);
    if (meta.camera3) Object.assign(v3.cam, meta.camera3);

    var host = U.$('#paramhost');
    var ui = LAB.ui.buildPanel(host, meta.schema || {}, defaults, {
      onParam: function (k, v) { st.set(k, v); if (impl.onParam) impl.onParam(cur, k, v); },
      onField: function (k, v) {
        st.set(k, v);
        if (impl.onField) { var r = impl.onField(cur, k, v); return r !== false; }
        return true;
      },
      onMode: function (k, v) { st.set(k, v); if (impl.onMode) impl.onMode(cur, k, v); },
      onToggle: function (k, v) { st.set(k, v); if (impl.onToggle) impl.onToggle(cur, k, v); }
    });

    cur = {
      id: id, meta: meta, impl: impl, state: st, ui: ui,
      app: app, view2: v2, view3: v3, draw: draw,
      get time() { return time; },
      get playing() { return playing; },
      get dims() { return LAB.viewport.dims; }
    };

    // 状态被外部改写（关键帧/拖拽/导入）时，静默回写面板
    st.listen(function (k) {
      if (k === '*') {
        Object.keys(ui.params).forEach(function (key) { ui.params[key].set(st.get(key), true); });
        Object.keys(ui.toggles).forEach(function (key) { ui.toggles[key].set(st.get(key), true); });
        Object.keys(ui.modes).forEach(function (key) { ui.modes[key].set(st.get(key), true); });
        Object.keys(ui.fields).forEach(function (key) { ui.fields[key].set(st.get(key), true); });
        return;
      }
      if (ui.params[k]) ui.params[k].set(st.get(k), true);
      else if (ui.toggles[k]) ui.toggles[k].set(st.get(k), true);
      else if (ui.modes[k]) ui.modes[k].set(st.get(k), true);
      else if (ui.fields[k]) ui.fields[k].set(st.get(k), true);
    });

    // 主题级全局快捷键（随主题激活/注销）
    LAB.shortcuts.clearGroup('topic');
    if (meta.shortcuts) {
      meta.shortcuts.forEach(function (s) {
        LAB.shortcuts.register({
          group: 'topic', key: s.key, shift: s.shift, ctrl: s.ctrl, alt: s.alt,
          help: s.help, run: s.run, when: function () { return !!cur; }
        });
      });
    }

    var tl = meta.timeline || {};
    if (LAB.hud.tl) {
      LAB.hud.tl.setRange(tl.duration || 10, tl.keyframes || []);
      LAB.hud.tl.setStep(tl.step || 0.05);
    }

    refreshSidebar();
    if (impl.init) impl.init(cur);
    draw.clear();
    if (impl.render) impl.render(cur);
    return true;
  }
  function firstTopic() {
    var ids = Object.keys(LAB.topics);
    return ids.length ? ids[0] : null;
  }
  function refreshSidebar() {
    var list = U.$('#topiclist');
    if (!list) return;
    list.innerHTML = '';
    var groups = {};
    Object.keys(LAB.topics).forEach(function (id) {
      var meta = LAB.topics[id].meta;
      var g = meta.group || '其他';
      (groups[g] = groups[g] || []).push({ id: id, meta: meta });
    });
    Object.keys(groups).forEach(function (g) {
      var gh = U.el('div', 'topic-group', g);
      list.appendChild(gh);
      groups[g].forEach(function (entry) {
        var b = U.el('button', 'topic' + (cur && cur.id === entry.id ? ' on' : ''), entry.meta.title);
        b.title = entry.meta.blurb || '';
        b.addEventListener('click', function () {
          activate(entry.id);
          b.blur();
        });
        list.appendChild(b);
      });
    });
  }

  /* ================= 时间轴 ================= */
  function setPlaying(on) {
    if (on === playing) return;
    playing = on;
    if (on) LAB.hud.toast('播放中 · 空格暂停 · 拖动时间轴可 scrub', 1400);
  }
  function seek(t) {
    var dur = (cur && cur.meta.timeline && cur.meta.timeline.duration) || 10;
    time = U.clamp(t, 0, Math.max(dur, t));
  }

  /* ================= 关键帧插值 ================= */
  function applyKeyframes(c, t) {
    var ks = (c.meta.timeline && c.meta.timeline.keyframes) || [];
    if (!ks.length) return;
    var a = ks[0], b = ks[ks.length - 1];
    if (t <= a.at) { c.state.patch(a.state); return; }
    if (t >= b.at) { c.state.patch(b.state); return; }
    for (var i = 0; i < ks.length - 1; i++) {
      if (t >= ks[i].at && t <= ks[i + 1].at) {
        var p = ks[i], q = ks[i + 1];
        var u = (t - p.at) / Math.max(1e-6, q.at - p.at);
        var patch = {};
        for (var k in p.state) {
          if (typeof p.state[k] === 'number' && typeof q.state[k] === 'number') patch[k] = U.lerp(p.state[k], q.state[k], u);
        }
        c.state.patch(patch);
        return;
      }
    }
  }

  /* ================= 指针 ================= */
  function makeEv(e, type) {
    return {
      type: type,
      x: e.clientX, y: e.clientY,
      world2: v2.toWorld(e.clientX, e.clientY),
      ray: v3.ray(e.clientX, e.clientY),
      button: e.button, buttons: e.buttons,
      shiftKey: e.shiftKey, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey,
      pointerId: e.pointerId, deltaY: e.deltaY
    };
  }
  function bindPointer() {
    canvas.addEventListener('pointerdown', function (e) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
      pointerDown = { sx: e.clientX, sy: e.clientY, button: e.button, shift: e.shiftKey, alt: e.altKey };
      if (!cur) return;
      var ev = makeEv(e, 'down');
      if (cur.impl.onPointer && cur.impl.onPointer(cur, ev) === true) return;  // 主题接管
      if (e.button === 0 && cur.meta.space === '3d' && !e.altKey && !e.shiftKey) appDrag = { kind: 'orbit', sx: e.clientX, sy: e.clientY };
      else if (e.button === 0 && cur.meta.space === '3d' && e.shiftKey) appDrag = { kind: 'pan', sx: e.clientX, sy: e.clientY };
      else if (e.button === 1 || (e.altKey && e.button === 0)) appDrag = { kind: 'pan', sx: e.clientX, sy: e.clientY };
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!cur) return;
      if (appDrag) {
        var dx = e.clientX - appDrag.sx, dy = e.clientY - appDrag.sy;
        appDrag.sx = e.clientX; appDrag.sy = e.clientY;
        if (appDrag.kind === 'orbit') v3.orbit(dx, dy);
        else if (appDrag.kind === 'pan') {
          if (cur.meta.space === '3d') v3.pan(dx, dy);
          else v2.shift(dx, dy);
        }
      }
      var ev = makeEv(e, 'move');
      if (cur.impl.onPointer) cur.impl.onPointer(cur, ev);
    });
    function up(e) {
      if (cur) {
        var ev = makeEv(e, 'up');
        if (cur.impl.onPointer) cur.impl.onPointer(cur, ev);
      }
      appDrag = null;
      pointerDown = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) { }
    }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) return;           // 交给浏览器页面缩放
      e.preventDefault();
      if (!cur) return;
      var f = Math.pow(1.0016, -e.deltaY);
      if (cur.meta.space === '3d') v3.zoom(f);
      else v2.zoomAt(e.clientX, e.clientY, f);
      var ev = makeEv(e, 'wheel');
      if (cur.impl.onPointer) cur.impl.onPointer(cur, ev);
    }, { passive: false });
    canvas.addEventListener('dblclick', function (e) {
      if (!cur) return;
      var ev = makeEv(e, 'dbl');
      if (cur.impl.onPointer) cur.impl.onPointer(cur, ev);
    });
    canvas.addEventListener('contextmenu', function (e) {
      if (!cur) return;
      var ev = makeEv(e, 'ctx');
      if (cur.impl.onPointer && cur.impl.onPointer(cur, ev) === true) e.preventDefault();
    });
  }

  /* ================= 键盘 ================= */
  function isTyping() {
    var ae = document.activeElement;
    if (!ae) return false;
    var tag = ae.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || ae.isContentEditable;
  }
  function bindKeys() {
    window.addEventListener('keydown', function (e) {
      if (isTyping()) return;
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying(!playing);
        return;
      }
      if (LAB.shortcuts.handle(e)) return;
      if (!cur) return;
      if (cur.impl.onKey && cur.impl.onKey(cur, e) === true) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); seek(time - 0.05); }
      if (e.key === 'ArrowRight') { e.preventDefault(); seek(time + 0.05); }
      if (e.key === '?') LAB.hud.toast('快捷键：空格 播放 · ←/→ 逐帧 · 滚轮 缩放 · 拖动 旋转/平移 · Alt+拖动 平移', 3200);
    });
  }

  /* ================= 分享 ================= */
  function shareState() {
    var out = { v: 1, topic: cur ? cur.id : null, state: cur ? cur.state.snapshot() : {} };
    if (cur && cur.meta.space === '3d') out.cam = JSON.parse(JSON.stringify(v3.cam));
    else if (cur) out.view2 = { scale: v2.scale, cx: v2.cx, cy: v2.cy };
    if (cur && cur.impl.serialize) out.extra = cur.impl.serialize(cur);
    return out;
  }
  function shareURL() {
    var base = location.href.split('#')[0];
    var obj = shareState();
    var s = LAB.state.encode(obj);
    return base + '#t=' + encodeURIComponent(obj.topic || '') + (s ? '&s=' + s : '');
  }
  function loadState(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.topic && LAB.topics[obj.topic]) activate(obj.topic);
    if (!cur) return false;
    if (obj.state) cur.state.load(obj.state);
    if (obj.cam && cur.meta.space === '3d') Object.assign(v3.cam, obj.cam);
    if (obj.view2 && cur.meta.space !== '3d') {
      if (typeof obj.view2.scale === 'number') { v2.scale = v2.scaleTarget = obj.view2.scale; }
      if (typeof obj.view2.cx === 'number') v2.cx = obj.view2.cx;
      if (typeof obj.view2.cy === 'number') v2.cy = obj.view2.cy;
    }
    if (obj.extra && cur.impl.deserialize) cur.impl.deserialize(cur, obj.extra);
    return true;
  }
  function parseHash() {
    var h = location.hash || '';
    if (h.charAt(0) === '#') h = h.slice(1);
    var out = {};
    h.split('&').forEach(function (part) {
      if (!part) return;
      var kv = part.split('=');
      if (kv[0] === 't') out.topic = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
      else if (kv[0] === 's') out.encoded = kv[1] || '';
    });
    if (out.encoded) {
      var obj = LAB.state.decode(out.encoded);
      if (obj && typeof obj === 'object') out.state = obj;
    }
    return out;
  }

  /* ================= 自检 ================= */
  function near(a, b, tol) { return Math.abs(a - b) < (tol === undefined ? 1e-9 : tol); }
  function runSelftest() {
    var lines = [];
    function t(name, ok, extra) { lines.push({ name: name, ok: !!ok, extra: extra }); }
    var E = LAB.expr, V = LAB.vec, S = LAB.state;

    /* 表达式解析器 */
    try { t('expr: sin(pi/2) = 1', near(E.compile('sin(pi/2)').eval({}), 1)); } catch (e) { t('expr: sin(pi/2) = 1', false, String(e)); }
    try { t('expr: x^2+2x+1 在 x=3 处 = 16', near(E.compile('x^2 + 2*x + 1').eval({ x: 3 }), 16)); } catch (e) { t('expr: 多项式求值', false, String(e)); }
    try { t('expr: 优先级 1+2*3 = 7', near(E.compile('1 + 2 * 3').eval({}), 7)); } catch (e) { t('expr: 优先级', false, String(e)); }
    try { t('expr: 右结合 2^3^2 = 512', near(E.compile('2^3^2').eval({}), 512)); } catch (e) { t('expr: 右结合', false, String(e)); }
    try { t('expr: 幂优先于一元负号 -2^2 = -4', near(E.compile('-2^2').eval({}), -4)); } catch (e) { t('expr: 一元负号优先级', false, String(e)); }
    try { t('expr: (-2)^2 = 4', near(E.compile('(-2)^2').eval({}), 4)); } catch (e) { t('expr: 括号优先级', false, String(e)); }
    var r1 = E.compile('alert(1)');
    t('expr: 拒绝未知函数 alert', r1.ok === false, r1.error);
    var r2 = E.compile('x; window.document');
    t('expr: 拒绝分号与点访问', r2.ok === false, r2.error);
    var r3 = E.compile('eval(1)');
    t('expr: 拒绝 eval', r3.ok === false, r3.error);
    var r4 = E.compile('1/0');
    var div0 = false;
    try { r4.eval({}); } catch (e) { div0 = true; }
    t('expr: 除 0 抛出可读错误', div0);
    var r5 = E.compile('ln(-1)');
    var domErr = false;
    try { r5.eval({}); } catch (e) { domErr = true; }
    t('expr: 定义域错误被捕获', domErr);
    var r6 = E.compile('clamp(x, 0, 1)');
    t('expr: clamp(2,0,1) = 1', near(r6.eval({ x: 2 }), 1));
    var r7 = E.compile('a*b + c');
    t('expr: 命名参数 a,b,c', near(r7.eval({ a: 2, b: 3, c: 4 }), 10) && r7.names.indexOf('a') >= 0);

    /* 向量与矩阵 */
    var c0 = V.cross([1, 0, 0], [0, 1, 0]);
    t('vec: i×j = k', near(c0[0], 0) && near(c0[1], 0) && near(c0[2], 1));
    var m1 = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 3, 4, 5, 1];
    var mi = V.inverse(m1);
    var mm = mi ? V.multiply(m1, mi) : null;
    t('vec: 4×4 逆矩阵往返 = 单位阵', !!mm && near(mm[0], 1, 1e-6) && near(mm[5], 1, 1e-6) && near(mm[10], 1, 1e-6) && near(mm[12], 0, 1e-6));
    var cam = V.camera({ yaw: 33, pitch: 21, dist: 8, tx: 0, ty: 0, tz: 0, fov: 42, mode: 'persp' }, 16 / 9);
    var p0 = [1.5, 2.5, 0];
    var sp = V.screenOf(cam.vp, 1280, 720, p0);
    var ry = sp ? V.ray(cam.vp, 1280, 720, sp[0], sp[1]) : null;
    var hit = ry ? V.planeHit(ry.o, ry.d, [0, 0, 0], [0, 0, 1]) : null;
    t('vec: 投影→反投影→地面求交 还原同一点', !!hit && near(hit[0], p0[0], 1e-5) && near(hit[1], p0[1], 1e-5) && near(hit[2], 0, 1e-5));
    var par = V.planeHit([0, 0, 5], [1, 0, 0], [0, 0, 0], [0, 0, 1]);
    t('vec: 射线与平面平行的退化保护', par === null);

    /* 状态编解码 */
    var sample = { v: 1, topic: 'calculus', state: { expr: 'sin(x)', x0: 2.2, N: 40 }, cam: { yaw: 30, pitch: 20, dist: 9 } };
    var enc = S.encode(sample);
    var dec = enc ? S.decode(enc) : null;
    t('state: 编码→解码 往返一致', !!dec && dec.topic === 'calculus' && dec.state.expr === 'sin(x)' && near(dec.cam.dist, 9));
    t('state: 非法输入返回 null', S.decode('!!!!not-base64$$$') === null && S.decode('') === null);
    var long = { big: new Array(2000).join('数学可视化abc123') };
    var encL = S.encode(long);
    var decL = encL ? S.decode(encL) : null;
    t('state: 超长串走原始路径仍可往返', !!decL && decL.big === long.big);

    /* 视口 */
    var t2 = LAB.viewport.View2();
    t2.setDomain(-2, 2, -1, 1);
    var w0 = t2.toWorld(t2.toScreen(0.75, -0.25)[0], t2.toScreen(0.75, -0.25)[1]);
    t('viewport: 2D 屏幕↔世界 往返', near(w0[0], 0.75, 1e-9) && near(w0[1], -0.25, 1e-9));

    /* 主题自检 */
    Object.keys(LAB.topics).forEach(function (id) {
      var impl = LAB.topics[id].impl;
      if (impl && impl.selftest) {
        try {
          impl.selftest().forEach(function (r) { t('[' + id + '] ' + r.name, r.ok, r.extra); });
        } catch (e) {
          t('[' + id + '] selftest 抛异常', false, String(e && e.message ? e.message : e));
        }
      }
    });

    /* 渲染结果 */
    var host = U.$('#selftest');
    var pass = 0, fail = 0;
    lines.forEach(function (l) { l.ok ? pass++ : fail++; });
    var html = '<div class="st-head">SELF-TEST · 自检 ' + pass + '/' + lines.length + (fail ? '（失败 ' + fail + '）' : '　全部通过 ✓') + '</div>';
    lines.forEach(function (l) {
      html += '<div class="' + (l.ok ? 'st-ok' : 'st-no') + '">' + (l.ok ? '✓ ' : '✗ ') + U.esc(l.name) + (l.extra ? '　' + U.esc(String(l.extra)) : '') + '</div>';
    });
    host.innerHTML = html;
    host.classList.add('on');
    document.title = (fail ? '✗ ' : '✓ ') + '自检 ' + pass + '/' + lines.length + ' · MathLab';
    return { pass: pass, fail: fail };
  }

  /* ================= 主循环 ================= */
  function loop(ts) {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    var dt = Math.min(0.1, (ts - lastT) / 1000);
    lastT = ts;
    LAB.viewport.ensureSize(canvas);
    var dims = LAB.viewport.dims;
    ctx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
    ctx.clearRect(0, 0, dims.W, dims.H);
    ctx.fillStyle = '#0e1116';
    ctx.fillRect(0, 0, dims.W, dims.H);

    if (playing && cur) {
      time += dt;
      var dur = (cur.meta.timeline && cur.meta.timeline.duration) || 10;
      if (dur > 0) time %= dur;
    }
    if (cur) {
      applyKeyframes(cur, time);
      if (cur.impl.applyTime) cur.impl.applyTime(cur, time, dt);
      draw.clear();
      if (cur.impl.render) cur.impl.render(cur);
      stat.prims = draw.count();
      draw.flush(ctx, v2, v3);
      v2.tick();
    }
    if (LAB.hud.tl) LAB.hud.tl.refresh(time, playing);

    /* 统计 */
    if (statsOn) {
      stat.frames++; stat.acc += dt;
      if (stat.acc >= 0.5) {
        stat.fps = stat.frames / stat.acc;
        stat.ms = stat.acc / stat.frames * 1000;
        stat.frames = 0; stat.acc = 0;
        var stEl = U.$('#stats');
        if (stEl) {
          stEl.classList.add('on');
          stEl.textContent = (stat.fps).toFixed(0) + ' fps · ' + stat.ms.toFixed(1) + ' ms · 图元 ' + stat.prims + ' · ' + (cur ? cur.meta.title : '—');
        }
      }
    }
  }

  /* ================= 启动 ================= */
  var app = {
    _started: false,
    ready: false,
    markReady: function () { app.ready = true; },
    start: function (libs) {
      if (app._started) return;
      app._started = true;
      LAB.tween.init();
      if (libs && !libs.gsap) console.info('[mathlab] GSAP 不可用，使用内置补间器（功能完整，缓动略简）。');
      canvas = U.$('#stage');
      if (!canvas) { console.error('[mathlab] 找不到 #stage'); return; }
      ctx = canvas.getContext('2d');
      v2 = LAB.viewport.View2();
      v3 = LAB.viewport.View3();
      draw = LAB.render.create();

      var boot = parseHash();
      activate(boot.topic || firstTopic());
      if (boot.state) loadState(boot.state);

      bindPointer();
      bindKeys();
      LAB.hud.init(app, boot);
      if (LAB.hud.tl) LAB.hud.tl.onSeek = function (t) { seek(t); };

      // 全局快捷键
      LAB.shortcuts.register({ group: 'app', key: ' ', help: '播放/暂停', run: function () { setPlaying(!playing); } });
      LAB.shortcuts.register({ group: 'app', key: 'ArrowLeft', help: '后退一帧', run: function () { seek(time - 0.05); } });
      LAB.shortcuts.register({ group: 'app', key: 'ArrowRight', help: '前进一帧', run: function () { seek(time + 0.05); } });
      var hints = U.$('#hints');
      if (hints) hints.innerHTML = LAB.shortcuts.helpHTML();

      lastT = now();
      requestAnimationFrame(loop);
      if (selftestOn) setTimeout(runSelftest, 80);
    },

    activate: activate,
    active: function () { return cur ? cur.id : null; },
    ctx: function () { return cur; },
    playing: function () { return playing; },
    setPlaying: setPlaying,
    seek: seek,
    time: function () { return time; },
    shareState: shareState,
    shareURL: shareURL,
    loadState: loadState,
    runSelftest: runSelftest
  };
  LAB.app = app;
  LAB.selftest = { run: runSelftest };
})();
