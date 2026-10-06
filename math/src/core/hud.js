/* MathLab core · HUD：toast、时间轴条、数据分享面板、统计面板、自检面板 */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};
  var U = LAB.util;

  var toastTimer = null;
  function toast(msg, ms) {
    var t = U.$('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, ms || 2000);
  }

  var hud = { toast: toast };

  hud.init = function (app, boot) {
    /* ---------- 时间轴 ---------- */
    var elPlay = U.$('#btn-play'), elScrub = U.$('#t-scrub'),
      elTime = U.$('#t-time'), elPrev = U.$('#t-prev'), elNext = U.$('#t-next'),
      elStep = U.$('#t-step');
    var stepSec = 0.05;
    var tl = {
      dur: 10, keyframes: [],
      onSeek: null,
      setRange: function (dur, keyframes) { tl.dur = dur || 10; tl.keyframes = keyframes || []; },
      refresh: function (t, playing) {
        var tt = tl.dur > 0 ? ((t % tl.dur) + tl.dur) % tl.dur : t;
        if (document.activeElement !== elScrub) {
          elScrub.value = tl.dur > 0 ? Math.round(tt / tl.dur * 1000) : 0;
        }
        elTime.textContent = U.fmt(tt, 2) + ' / ' + U.fmt(tl.dur, 2) + ' s';
        elPlay.textContent = playing ? '❚❚' : '▶';
      },
      setStep: function (s) { stepSec = Math.max(0.01, s); elStep.textContent = stepSec + 's'; }
    };
    elPlay.addEventListener('click', function () { app.setPlaying(!app.playing()); elPlay.blur(); });
    elPrev.addEventListener('click', function () { app.seek(app.time() - stepSec); elPrev.blur(); });
    elNext.addEventListener('click', function () { app.seek(app.time() + stepSec); elNext.blur(); });
    elScrub.addEventListener('input', function () {
      var t = tl.dur * (parseFloat(elScrub.value) / 1000);
      if (tl.onSeek) tl.onSeek(t);
    });
    elScrub.addEventListener('change', function () { elScrub.blur(); });
    hud.tl = tl;

    /* ---------- 数据面板 ---------- */
    var btnCopy = U.$('#btn-copy'), btnOut = U.$('#btn-json-out'),
      btnIn = U.$('#btn-json-in'), btnPng = U.$('#btn-png');
    var fileIn = document.createElement('input');
    fileIn.type = 'file'; fileIn.accept = '.json,application/json';
    fileIn.style.display = 'none';
    document.body.appendChild(fileIn);

    btnCopy.addEventListener('click', function () {
      var url = app.shareURL();
      U.clipboard(url);
      toast('链接已复制到剪贴板（含当前主题与全部参数）');
      btnCopy.blur();
    });
    btnOut.addEventListener('click', function () {
      var json = JSON.stringify(app.shareState(), null, 2);
      U.download('mathlab-' + (app.active() || 'state') + '.json', json, 'application/json');
      toast('已导出 JSON 状态文件');
      btnOut.blur();
    });
    btnIn.addEventListener('click', function () { fileIn.click(); btnIn.blur(); });
    fileIn.addEventListener('change', function () {
      var f = fileIn.files && fileIn.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(String(reader.result));
          var ok = app.loadState(obj);
          toast(ok ? '已导入状态' : '导入失败：文件结构不兼容');
        } catch (e) {
          toast('导入失败：不是有效的 JSON');
        }
      };
      reader.readAsText(f);
      fileIn.value = '';
    });
    btnPng.addEventListener('click', function () {
      var canvas = U.$('#stage');
      if (!canvas) return;
      canvas.toBlob(function (blob) {
        if (!blob) { toast('快照失败'); return; }
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'mathlab-' + (app.active() || 'shot') + '-' + Date.now() + '.png';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      }, 'image/png');
      toast('PNG 快照已生成');
      btnPng.blur();
    });

    /* ---------- 快捷键提示 ---------- */
    var hints = U.$('#hints');
    if (hints) hints.innerHTML = LAB.shortcuts.helpHTML();

    return hud;
  };

  return (LAB.hud = hud);
})();
