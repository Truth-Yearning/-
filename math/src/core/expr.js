/* MathLab core · 表达式解析器
   安全边界：纯解释执行（递归下降 + AST），不使用 eval / new Function；
   词法层只放行数字、标识符与有限运算符，任何其他字符直接拒绝。 */
(function () {
  'use strict';
  var LAB = window.LAB = window.LAB || {};

  var CONSTS = {
    pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: 1.618033988749895
  };
  var FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    exp: Math.exp, ln: Math.log, log: Math.log, log2: Math.log2, log10: Math.log10,
    sqrt: Math.sqrt, cbrt: Math.cbrt,
    abs: Math.abs, sign: Math.sign, floor: Math.floor, ceil: Math.ceil, round: Math.round,
    min: Math.min, max: Math.max, pow: Math.pow, hypot: Math.hypot,
    clamp: function (a, b, c) { return a < b ? b : (a > c ? c : a); },
    step: function (e, x) { return x < e ? 0 : 1; },
    smoothstep: function (a, b, x) {
      if (a === b) return x < a ? 0 : 1;
      var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    }
  };
  var BANNED = {
    eval: 1, Function: 1, constructor: 1, __proto__: 1, prototype: 1,
    window: 1, document: 1, globalThis: 1, this: 1, import: 1
  };
  var MAXLEN = 200, MAXNODES = 400;

  /* ---------- 词法 ---------- */
  function tokenize(src) {
    if (typeof src !== 'string') return { error: '表达式必须是字符串' };
    if (src.length > MAXLEN) return { error: '表达式太长（最多 ' + MAXLEN + ' 字符）', pos: MAXLEN };
    var toks = [], i = 0, n = src.length;
    while (i < n) {
      var c = src[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        var j = i, seenDot = false;
        while (j < n && /[0-9.]/.test(src[j])) {
          if (src[j] === '.') {
            if (seenDot) return { error: '数字里有多个小数点', pos: j };
            seenDot = true;
          }
          j++;
        }
        var num = parseFloat(src.slice(i, j));
        if (!isFinite(num)) return { error: '数字格式不对', pos: i };
        toks.push({ t: 'num', v: num, pos: i });
        i = j; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        var k = i;
        while (k < n && /[A-Za-z0-9_]/.test(src[k])) k++;
        toks.push({ t: 'id', v: src.slice(i, k), pos: i });
        i = k; continue;
      }
      if ('+-*/%^(),'.indexOf(c) >= 0) { toks.push({ t: 'op', v: c, pos: i }); i++; continue; }
      return { error: '不允许的字符 “' + c + '”', pos: i };
    }
    toks.push({ t: 'end', pos: n });
    return { toks: toks };
  }

  /* ---------- 语法（递归下降） ---------- */
  function parse(src) {
    var tk = tokenize(src);
    if (tk.error) return tk;
    var toks = tk.toks, p = 0, nodes = 0;

    function peek() { return toks[p]; }
    function next() { return toks[p++]; }
    function err(msg, tok) { return { error: msg, pos: (tok && tok.pos !== undefined) ? tok.pos : (p < toks.length ? toks[p].pos : src.length) }; }
    function chk() { nodes++; if (nodes > MAXNODES) throw err('表达式太复杂（节点数超限）', peek()); }
    function expectClose() {
      if (peek().t !== 'op' || peek().v !== ')') throw err('缺少右括号', peek());
      next();
    }
    function parseExpr() {
      var n = parseAdd();
      if (peek().t !== 'end') throw err('多余的输入 “' + (peek().v !== undefined ? peek().v : '?') + '”', peek());
      return n;
    }
    function parseAdd() {
      var l = parseMul();
      while (peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
        var op = next().v;
        var r = parseMul();
        l = { k: 'bin', op: op, l: l, r: r };
        chk();
      }
      return l;
    }
    function parseMul() {
      var l = parseUnary();
      while (peek().t === 'op' && (peek().v === '*' || peek().v === '/' || peek().v === '%')) {
        var op = next().v;
        var r = parseUnary();
        l = { k: 'bin', op: op, l: l, r: r };
        chk();
      }
      return l;
    }
    /* 幂比一元负号结合更紧：-2^2 = -(2^2)（数学惯例） */
    function parseUnary() {
      if (peek().t === 'op' && (peek().v === '-' || peek().v === '+')) {
        var op = next().v;
        return { k: 'un', op: op, arg: parseUnary() };
      }
      return parsePow();
    }
    function parsePow() {
      var base = parsePrimary();
      if (peek().t === 'op' && peek().v === '^') {
        next();
        var ex = parseUnary();               // 右结合：2^3^2 = 2^(3^2)
        base = { k: 'bin', op: '^', l: base, r: ex };
        chk();
      }
      return base;
    }
    function parsePrimary() {
      var t = next();
      if (t.t === 'num') return { k: 'num', v: t.v };
      if (t.t === 'id') {
        var name = t.v;
        if (BANNED[name]) throw err('不允许的名字 “' + name + '”', t);
        if (peek().t === 'op' && peek().v === '(') {
          next();
          var args = [];
          if (peek().t === 'op' && peek().v === ')') { next(); }
          else {
            args.push(parseAdd());
            while (peek().t === 'op' && peek().v === ',') { next(); args.push(parseAdd()); }
            expectClose();
          }
          chk();
          return { k: 'call', n: name, args: args };
        }
        return { k: 'var', n: name };
      }
      if (t.t === 'op' && t.v === '(') {
        var inner = parseAdd();
        expectClose();
        return inner;
      }
      throw err('意外的输入', t);
    }

    try {
      var ast = parseExpr();
      return { ok: true, ast: ast };
    } catch (e) {
      if (e && e.error) return { ok: false, error: e.error, pos: e.pos };
      return { ok: false, error: '表达式解析失败', pos: 0 };
    }
  }

  /* ---------- 求值 ---------- */
  function evaluate(n, vars) {
    switch (n.k) {
      case 'num': return n.v;
      case 'var':
        if (Object.prototype.hasOwnProperty.call(vars, n.n)) return vars[n.n];
        if (Object.prototype.hasOwnProperty.call(CONSTS, n.n)) return CONSTS[n.n];
        throw { error: '未定义的名字 “' + n.n + '”' };
      case 'un': {
        var v = evaluate(n.arg, vars);
        return n.op === '-' ? -v : v;
      }
      case 'bin': {
        var l = evaluate(n.l, vars), r = evaluate(n.r, vars);
        switch (n.op) {
          case '+': return l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/':
            if (r === 0) throw { error: '除以 0' };
            return l / r;
          case '%':
            if (r === 0) throw { error: '对 0 取模' };
            return l % r;
          case '^': {
            var w = Math.pow(l, r);
            if (!isFinite(w)) throw { error: '幂运算超出数值范围' };
            return w;
          }
        }
        throw { error: '未知运算符' };
      }
      case 'call': {
        var f = FUNCS[n.n];
        if (!f) throw { error: '未知函数 “' + n.n + '”' };
        var args = [];
        for (var i = 0; i < n.args.length; i++) args.push(evaluate(n.args[i], vars));
        var out = f.apply(null, args);
        if (typeof out !== 'number' || !isFinite(out)) throw { error: '函数 “' + n.n + '” 计算结果无效（可能超出定义域，如 ln 的负参数）' };
        return out;
      }
    }
    throw { error: '内部求值错误' };
  }
  function collect(n, set) {
    if (!set) set = {};
    if (n.k === 'var') set[n.n] = 1;
    else if (n.k === 'call') n.args.forEach(function (a) { collect(a, set); });
    else if (n.k === 'bin') { collect(n.l, set); collect(n.r, set); }
    else if (n.k === 'un') collect(n.arg, set);
    return set;
  }

  /* ---------- 对外 API ---------- */
  /* 遍历 AST：校验函数名（编译期报错，而不是求值期） */
  function validateCalls(n, out) {
    if (n.k === 'call') {
      if (!FUNCS[n.n]) {
        out.bad = n.n;
        return;
      }
      for (var i = 0; i < n.args.length; i++) validateCalls(n.args[i], out);
    } else if (n.k === 'bin') { validateCalls(n.l, out); validateCalls(n.r, out); }
    else if (n.k === 'un') validateCalls(n.arg, out);
  }
  function compile(src) {
    var r = parse(src);
    if (!r.ok) return { ok: false, error: r.error, pos: r.pos };
    var bad = { bad: null };
    validateCalls(r.ast, bad);
    if (bad.bad) return { ok: false, error: '未知函数 “' + bad.bad + '”', pos: 0 };
    return {
      ok: true,
      names: Object.keys(collect(r.ast)),
      eval: function (vars) { return evaluate(r.ast, vars || {}); },
      ast: r.ast
    };
  }
  function tryEval(src, vars) {
    var c = compile(src);
    if (!c.ok) return c;
    try {
      return { ok: true, value: c.eval(vars), names: c.names };
    } catch (e) {
      return { ok: false, error: (e && e.error) || '求值失败' };
    }
  }

  LAB.expr = {
    compile: compile,
    tryEval: tryEval,
    tokenize: tokenize,
    CONSTS: CONSTS,
    FUNCS: FUNCS,
    BANNED: BANNED,
    MAXLEN: MAXLEN
  };
})();
