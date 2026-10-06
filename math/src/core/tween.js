/* MathLab core · 补间抽象层
   GSAP 可用则用 GSAP；否则用内置 rAF 补间器（同一 API，支持同一对象上多条不同属性的补间并存）。 */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};
  var useGsap = false;
  var SIMPLE = /^(opacity|scale|progress|zoom|num|t)$/;
  var killers = new Map();   // target → 该目标上活跃的内置补间取消函数数组
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function init() { useGsap = !!(window.gsap && window.gsap.to); }
  function dur(seconds) {
    if (reduced) return Math.min(seconds, 0.01);
    return seconds;
  }
  function easeName(e) {
    if (e === 'power2.out' || e === 'out') return 'out';
    if (e === 'power2.inOut' || e === 'inOut') return 'inOut';
    if (e === 'power2.in' || e === 'in') return 'in';
    if (e === 'none' || e === 'linear') return 'none';
    return 'inOut';
  }
  function easeFn(kind, t) {
    switch (kind) {
      case 'out': return 1 - Math.pow(1 - t, 3);
      case 'in': return t * t * t;
      case 'none': return t;
      case 'inOut': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      default: return t;
    }
  }
  function gsapTween(targets, vars, seconds, ease, onComplete, onUpdate) {
    var v = {};
    for (var k in vars) if (Object.prototype.hasOwnProperty.call(vars, k)) v[k] = vars[k];
    v.duration = dur(seconds);
    v.ease = ease;
    v.overwrite = 'auto';
    if (onComplete) v.onComplete = onComplete;
    if (onUpdate) v.onUpdate = onUpdate;
    return window.gsap.to(targets, v);
  }
  function fallbackTween(target, vars, seconds, ease, onComplete, onUpdate) {
    var keys = Object.keys(vars).filter(function (k) { return k !== 'duration' && k !== 'ease'; });
    var from = {}, to = {};
    keys.forEach(function (k) {
      var cur = target[k];
      if (typeof cur !== 'number' || !isFinite(cur)) cur = 0;
      from[k] = cur;
      var t = vars[k];
      if (typeof t === 'string' && t.charAt(0) === '+') t = cur + parseFloat(t.slice(1));
      to[k] = (typeof t === 'number') ? t : (parseFloat(t) || 0);
    });
    var kind = easeName(ease);
    var total = Math.max(dur(seconds), 0.001) * 1000;
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var entry = { cancel: false };
    function register() {
      var list = killers.get(target);
      if (!list) { list = []; killers.set(target, list); }
      list.push(entry);
    }
    function unregister() {
      var list = killers.get(target);
      if (!list) return;
      var i = list.indexOf(entry);
      if (i >= 0) list.splice(i, 1);
      if (!list.length) killers.delete(target);
    }
    function frame() {
      if (entry.cancel) return;
      var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      var t = Math.min(1, (now - t0) / total);
      var e = easeFn(kind, t);
      keys.forEach(function (k) { target[k] = from[k] + (to[k] - from[k]) * e; });
      if (onUpdate) onUpdate();
      if (t < 1) requestAnimationFrame(frame);
      else { unregister(); if (onComplete) onComplete(); }
    }
    // 允许同一目标上并存多条作用于不同属性的补间（与 GSAP overwrite:'auto' 语义一致）
    register();
    requestAnimationFrame(frame);
    return { cancel: function () { entry.cancel = true; unregister(); } };
  }
  function kill(target) {
    if (useGsap && window.gsap && window.gsap.killTweensOf) window.gsap.killTweensOf(target);
    var list = killers.get(target);
    if (list) list.slice().forEach(function (fn) { try { fn.cancel(); } catch (e) { } });
    killers.delete(target);
  }
  function to(target, vars, opts) {
    opts = opts || {};
    var seconds = (opts.duration === undefined) ? 0.6 : opts.duration;
    var ease = opts.ease || 'power2.inOut';
    if (useGsap && window.gsap) {
      var tw = gsapTween(target, vars, seconds, ease, opts.onComplete, opts.onUpdate);
      if (opts.onStart) { tw.pause(); opts.onStart(); tw.play(); }
      return tw;
    }
    if (opts.onStart) opts.onStart();
    return fallbackTween(target, vars, seconds, ease, opts.onComplete, opts.onUpdate);
  }
  function fromTo(target, fromVars, toVars, opts) {
    for (var k in fromVars) if (Object.prototype.hasOwnProperty.call(fromVars, k)) target[k] = fromVars[k];
    return to(target, toVars, opts);
  }

  LAB.tween = {
    init: init,
    get usingGsap() { return useGsap; },
    reduced: reduced,
    dur: dur,
    kill: kill,
    to: to,
    fromTo: fromTo
  };
})();
