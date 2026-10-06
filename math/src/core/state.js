/* MathLab core · 状态与分享编码
   状态树（监听 + 快照）+ JSON → URL-safe 压缩串（LZ77-lite over UTF-16） */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};

  /* ---------- 状态树 ---------- */
  function create(defaults, onChange) {
    var data = JSON.parse(JSON.stringify(defaults || {}));
    var listeners = [];
    function notify(key) {
      listeners.forEach(function (f) {
        try { f(key); } catch (e) { /* 监听器异常不得打断渲染 */ }
      });
    }
    var api = {
      get: function (k) { return k === undefined ? data : data[k]; },
      set: function (k, v) {
        var a = JSON.stringify(data[k]), b = JSON.stringify(v);
        if (a !== b) { data[k] = v; notify(k); }
      },
      patch: function (obj) {
        var changed = false;
        for (var k in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, k)) {
            var a = JSON.stringify(data[k]), b = JSON.stringify(obj[k]);
            if (a !== b) { data[k] = obj[k]; changed = true; }
          }
        }
        if (changed) notify('*');
      },
      listen: function (f) {
        listeners.push(f);
        return function () {
          var i = listeners.indexOf(f);
          if (i >= 0) listeners.splice(i, 1);
        };
      },
      snapshot: function () { return JSON.parse(JSON.stringify(data)); },
      /* 只接收已知键、容忍类型差异；返回 false 表示输入完全不可用 */
      load: function (obj) {
        if (!obj || typeof obj !== 'object') return false;
        var ok = false;
        for (var k in data) {
          if (Object.prototype.hasOwnProperty.call(data, k) && k in obj && obj[k] !== undefined) {
            data[k] = obj[k]; ok = true;
          }
        }
        notify('*');
        return ok;
      },
      reset: function () {
        data = JSON.parse(JSON.stringify(defaults));
        notify('*');
      }
    };
    if (onChange) api.listen(onChange);
    return api;
  }

  /* ---------- LZ77-lite（UTF-16 码元） ----------
     字面量段：标记字节 0..126（长度 = v+1），后跟相应数量的码元。
     匹配段：u16 标记 0x8000 | ((len-3)<<11) | offset —— bit15 标志位，bit11–14 长度（len 3..18），bit0–10 偏移（≤2047）。 */
  var MIN_MATCH = 3, MAX_MATCH = 18, WINDOW = 2047;
  function compressToU16(str) {
    var codes = new Uint16Array(str.length);
    for (var i = 0; i < str.length; i++) codes[i] = str.charCodeAt(i) & 0xFFFF;
    var out = [];
    var n = str.length, i = 0, litStart = 0;
    function flushLits(upto) {
      while (litStart < upto) {
        var run = Math.min(127, upto - litStart);
        out.push(run - 1);                                  // 0..126 → 长度 1..127
        for (var k = 0; k < run; k++) out.push(codes[litStart + k]);
        litStart += run;
      }
    }
    while (i < n) {
      var bestL = 0, bestO = 0;
      var jmin = Math.max(0, i - WINDOW);
      for (var j = i - 1; j >= jmin; j--) {
        var l = 0;
        while (l < MAX_MATCH && i + l < n && codes[j + l] === codes[i + l]) l++;
        if (l > bestL) { bestL = l; bestO = i - j; }
        if (l >= MAX_MATCH) break;
      }
      if (bestL >= MIN_MATCH) {
        flushLits(i);
        out.push(0x8000 | ((bestL - MIN_MATCH) << 11) | bestO);
        i += bestL;
        litStart = i;
      } else {
        i++;
      }
    }
    flushLits(n);
    return new Uint16Array(out);
  }
  function decompressFromU16(u16) {
    var out = [];
    var i = 0, guard = 0;
    while (i < u16.length && guard < u16.length * 40) {
      guard++;
      var v = u16[i];
      if (v <= 127) {
        var run = v + 1;
        for (var k = 1; k <= run && i + k < u16.length; k++) out.push(u16[i + k]);
        i += 1 + run;
      } else {
        var offset = v & 0x7FF;
        var ml = ((v >> 11) & 0xF) + MIN_MATCH;
        for (var m = 0; m < ml; m++) {
          var idx = out.length - offset;
          if (idx < 0) return null;                          // 损坏数据保护
          out.push(out[idx]);
        }
        i += 1;
      }
    }
    // 分块 String.fromCharCode 避免参数个数限制
    var s = '';
    for (var c = 0; c < out.length; c += 0x8000) {
      s += String.fromCharCode.apply(null, out.slice(c, Math.min(c + 0x8000, out.length)));
    }
    return s;
  }
  /* u16 → 字节（小端，保证跨平台一致） */
  function u16ToBytes(u16) {
    var bytes = new Uint8Array(u16.length * 2);
    for (var i = 0; i < u16.length; i++) {
      bytes[2 * i] = u16[i] & 0xFF;
      bytes[2 * i + 1] = (u16[i] >> 8) & 0xFF;
    }
    return bytes;
  }
  function bytesToU16(bytes) {
    var u16 = new Uint16Array(bytes.length >> 1);
    for (var i = 0; i < u16.length; i++) u16[i] = bytes[2 * i] | (bytes[2 * i + 1] << 8);
    return u16;
  }
  function bytesToB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, Array.prototype.slice.call(bytes, i, Math.min(i + 0x8000, bytes.length)));
    }
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64ToBytes(b64) {
    try {
      var pad = b64.replace(/-/g, '+').replace(/_/g, '/');
      while (pad.length % 4) pad += '=';
      var bin = atob(pad);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xFF;
      return bytes;
    } catch (e) {
      return null;
    }
  }
  var COMPRESS_LIMIT = 6000, DECODE_LIMIT = 200000;

  function strToU16(str) {
    var u = new Uint16Array(str.length);
    for (var i = 0; i < str.length; i++) u[i] = str.charCodeAt(i) & 0xFFFF;
    return u;
  }
  function encode(obj) {
    try {
      var json = JSON.stringify(obj);
      if (json === undefined) return null;
      if (json.length > COMPRESS_LIMIT) return 'r' + bytesToB64(u16ToBytes(strToU16(json)));
      return 'c' + bytesToB64(u16ToBytes(compressToU16(json)));
    } catch (e) {
      return null;
    }
  }
  function decode(str) {
    if (!str || str.length > DECODE_LIMIT) return null;
    try {
      var raw = null;
      var bytes = b64ToBytes(str.slice(1));
      if (!bytes) return null;
      var u16 = bytesToU16(bytes);
      if (str.charAt(0) === 'c') raw = decompressFromU16(u16);
      else if (str.charAt(0) === 'r') raw = u16ToString(u16);
      else return null;
      if (raw === null || typeof raw !== 'string') return null;
      var obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : null;
    } catch (e) {
      return null;
    }
  }
  function u16ToString(u16) {
    var s = '';
    for (var c = 0; c < u16.length; c += 0x8000) {
      s += String.fromCharCode.apply(null, Array.prototype.slice.call(u16, c, Math.min(c + 0x8000, u16.length)));
    }
    return s;
  }

  LAB.state = { create: create, encode: encode, decode: decode };
})();
