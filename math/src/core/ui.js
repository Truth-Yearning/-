/* MathLab core · schema 驱动 UI
   由主题声明的 schema 自动生成面板：
   params 滑杆+数字、fields 文本输入（表达式）、modes 下拉、toggles 开关、reads 读数行。
   关键行为：聚焦中的输入框不被程序回写（避免和用户输入打架）。 */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};
  var U = LAB.util;

  function buildPanel(host, schema, initials, hooks) {
    hooks = hooks || {};
    host.innerHTML = '';                       // 清掉上一个主题的面板
    var api = { params: {}, fields: {}, toggles: {}, modes: {}, reads: {}, host: host };

    function section(title) {
      var h = U.el('div', 'sec-title', title);
      host.appendChild(h);
    }
    function valueOf(key, fallback) {
      return (initials && initials[key] !== undefined) ? initials[key] : fallback;
    }

    /* ----- 参数：滑杆 + 数字输入 ----- */
    if (schema.params && schema.params.length) {
      section('参数');
      (schema.params).forEach(function (p) {
        var row = U.el('div', 'prow');
        var lab = U.el('span', 'plab', p.label);
        var range = U.el('input', 'range');
        range.type = 'range';
        range.min = p.min; range.max = p.max; range.step = p.step || 0.1;
        range.value = valueOf(p.key, (p.min + p.max) / 2);
        var num = U.el('input', 'num');
        num.type = 'number'; num.step = p.step || 0.1;
        num.value = U.fmt(valueOf(p.key, (p.min + p.max) / 2), 4);
        var unit = U.el('span', 'unit', p.unit || '');
        row.appendChild(lab); row.appendChild(range); row.appendChild(num); row.appendChild(unit);
        host.appendChild(row);

        function set(v, silent) {
          var c = U.clamp(typeof v === 'number' && isFinite(v) ? v : parseFloat(v) || 0, parseFloat(range.min), parseFloat(range.max));
          range.value = c;
          if (document.activeElement !== num) num.value = U.fmt(c, 4);
          if (!silent) hooks.onParam && hooks.onParam(p.key, c);
        }
        range.addEventListener('input', function () { set(parseFloat(range.value), false); });
        num.addEventListener('change', function () {
          var v = parseFloat(num.value);
          if (!isFinite(v)) { num.classList.add('bad'); return; }
          num.classList.remove('bad');
          set(v, false);
        });
        num.addEventListener('keydown', function (e) {
          var d = 0;
          if (e.key === 'ArrowUp') d = e.ctrlKey ? 0.01 : (e.shiftKey ? 1 : parseFloat(range.step));
          else if (e.key === 'ArrowDown') d = -(e.ctrlKey ? 0.01 : (e.shiftKey ? 1 : parseFloat(range.step)));
          if (d) { e.preventDefault(); set(parseFloat(num.value || 0) + d, false); }
          if (e.key === 'Enter') num.blur();
        });
        api.params[p.key] = {
          key: p.key,
          get: function () { return parseFloat(range.value); },
          set: function (v) { set(v, true); },
          el: row
        };
      });
    }

    /* ----- 表达式文本输入 ----- */
    if (schema.fields && schema.fields.length) {
      section('表达式');
      (schema.fields).forEach(function (f) {
        var row = U.el('div', 'frow');
        var lab = U.el('span', 'flab', f.label);
        var inp = U.el('input', 'expr');
        inp.type = 'text';
        inp.spellcheck = false;
        inp.autocomplete = 'off';
        inp.value = valueOf(f.key, f.def || '');
        inp.placeholder = f.placeholder || 'sin(x)';
        row.appendChild(lab); row.appendChild(inp);
        host.appendChild(row);
        function commit() {
          inp.classList.remove('bad');
          if (hooks.onField) {
            var r = hooks.onField(f.key, inp.value);
            if (r === false) inp.classList.add('bad');
          }
        }
        inp.addEventListener('change', commit);
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
        api.fields[f.key] = {
          key: f.key,
          get: function () { return inp.value; },
          set: function (v, silent) { inp.value = v; if (!silent) commit(); },
          markBad: function (on) { inp.classList.toggle('bad', !!on); },
          el: row
        };
      });
    }

    /* ----- 模式下拉 ----- */
    if (schema.modes && schema.modes.length) {
      section('模式');
      (schema.modes).forEach(function (m) {
        var row = U.el('div', 'mrow');
        var lab = U.el('span', 'mlab', m.label);
        var sel = U.el('select');
        (m.options || []).forEach(function (o) {
          var opt = U.el('option', null, o.t);
          opt.value = o.v;
          sel.appendChild(opt);
        });
        sel.value = valueOf(m.key, m.options && m.options[0] ? m.options[0].v : '');
        row.appendChild(lab); row.appendChild(sel);
        host.appendChild(row);
        sel.addEventListener('change', function () { hooks.onMode && hooks.onMode(m.key, sel.value); });
        api.modes[m.key] = {
          key: m.key,
          get: function () { return sel.value; },
          set: function (v, silent) { sel.value = v; if (!silent) hooks.onMode && hooks.onMode(m.key, v); },
          el: row
        };
      });
    }

    /* ----- 图层开关 ----- */
    if (schema.toggles && schema.toggles.length) {
      section('图层');
      var grid = U.el('div', 'tgrid');
      (schema.toggles).forEach(function (t) {
        var lab = U.el('label', 'tgl');
        var cb = U.el('input');
        cb.type = 'checkbox';
        cb.checked = !!valueOf(t.key, t.def !== undefined ? t.def : true);
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(' ' + t.label));
        grid.appendChild(lab);
        cb.addEventListener('change', function () { hooks.onToggle && hooks.onToggle(t.key, cb.checked); });
        api.toggles[t.key] = {
          key: t.key,
          get: function () { return cb.checked; },
          set: function (v, silent) {
            cb.checked = !!v;
            if (!silent) hooks.onToggle && hooks.onToggle(t.key, cb.checked);
          },
          el: lab
        };
      });
      host.appendChild(grid);
    }

    /* ----- 读数 ----- */
    if (schema.reads && schema.reads.length) {
      section('读数');
      (schema.reads).forEach(function (r) {
        var row = U.el('div', 'rrow');
        var k = U.el('span', 'rk', r.label);
        var v = U.el('span', 'rv', '—');
        row.appendChild(k); row.appendChild(v);
        host.appendChild(row);
        api.reads[r.key] = { el: v, key: r.key };
      });
    }

    api.setRead = function (key, text, cls) {
      var r = api.reads[key];
      if (!r) return;
      r.el.textContent = text;
      r.el.className = 'rv' + (cls ? ' ' + cls : '');
    };
    api.destroy = function () { host.innerHTML = ''; };

    return api;
  }

  LAB.ui = { buildPanel: buildPanel };
})();
