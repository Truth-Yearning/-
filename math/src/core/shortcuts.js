/* MathLab core · 键盘注册表
   集中注册快捷键、检查冲突、渲染帮助文本。主题自身的热键走 app 的 onKey 通道。 */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};
  var regs = [];

  function normalize(key) {
    if (key === ' ') return 'space';
    return String(key).toLowerCase();
  }
  function register(entry) {
    if (!entry || !entry.key || typeof entry.run !== 'function') return null;
    // 冲突检测：同 key + 同修饰键组合已有注册 → 拒绝并提示
    var clash = regs.some(function (r) {
      return normalize(r.key) === normalize(entry.key) &&
        !!r.shift === !!entry.shift && !!r.ctrl === !!entry.ctrl && !!r.alt === !!entry.alt;
    });
    if (clash) {
      if (window.console) console.warn('[shortcuts] 快捷键冲突：', entry.key, entry.modifiers || '');
      return null;
    }
    entry.id = entry.id || ('sc-' + LAB.util.uid());
    regs.push(entry);
    return entry.id;
  }
  function unregister(id) {
    regs = regs.filter(function (r) { return r.id !== id; });
  }
  function clearGroup(group) {
    regs = regs.filter(function (r) { return r.group !== group; });
  }
  function handle(e) {
    var key = normalize(e.key);
    for (var i = 0; i < regs.length; i++) {
      var r = regs[i];
      if (normalize(r.key) !== key) continue;
      if (!!r.shift !== !!e.shiftKey || !!r.ctrl !== !!e.ctrlKey || !!r.alt !== !!e.altKey) continue;
      if (r.when && !r.when()) continue;
      e.preventDefault();
      try { r.run(e); } catch (err) { if (window.console) console.error('[shortcuts]', err); }
      return true;
    }
    return false;
  }
  function helpHTML() {
    return regs.map(function (r) {
      var mods = (r.ctrl ? 'Ctrl+' : '') + (r.alt ? 'Alt+' : '') + (r.shift ? 'Shift+' : '');
      var k = r.key === 'space' ? '空格' : String(r.key).toUpperCase();
      return '<span class="sc"><span class="kbd">' + mods + k + '</span> ' + LAB.util.esc(r.help || '') + '</span>';
    }).join('');
  }

  LAB.shortcuts = { register: register, unregister: unregister, clearGroup: clearGroup, handle: handle, helpHTML: helpHTML, list: function () { return regs.slice(); } };
})();
