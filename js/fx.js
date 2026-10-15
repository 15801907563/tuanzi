/*
 * 团子的喵生选择 —— 粒子特效（Canvas）
 *
 *   var fx = new FX(canvasElement);
 *   fx.setAmbient('rain')               持续氛围：dust / dustlight / rain / snow / sparkle / leaves /
 *                                        petals / firework / glitter / bokeh / null
 *   fx.burst('hearts', x, y, n)         一次性爆发：hearts / confetti / sparkle / stars
 *   fx.onLightning = function () {}     雨天打闪时回调（让舞台闪白）
 *
 * 只用 transform 无关的 2D 绘制，粒子数量按屏幕面积缩放，后台/隐藏时自动暂停。
 */
var FX = (function () {
  'use strict';

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function heart(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.3);
    ctx.bezierCurveTo(0, 0, -s * 0.5, -s * 0.05, -s * 0.5, s * 0.3);
    ctx.bezierCurveTo(-s * 0.5, s * 0.6, 0, s * 0.8, 0, s);
    ctx.bezierCurveTo(0, s * 0.8, s * 0.5, s * 0.6, s * 0.5, s * 0.3);
    ctx.bezierCurveTo(s * 0.5, -s * 0.05, 0, 0, 0, s * 0.3);
    ctx.fill();
  }
  function star(ctx, r) {
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4, rr = i % 2 ? r * 0.28 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  var AMBIENT = {
    dust:      { n: 38, make: function (w, h) { return { x: rnd(0, w), y: rnd(0, h), r: rnd(0.8, 2.6), vx: rnd(-6, 6), vy: rnd(-14, -3), a: rnd(0.25, 0.8), ph: rnd(0, TAU), c: pick(['255,236,190', '255,248,225', '255,214,150']) }; } },
    dustlight: { n: 16, make: function (w, h) { return { x: rnd(0, w), y: rnd(0, h), r: rnd(0.8, 2), vx: rnd(-4, 4), vy: rnd(-8, -2), a: rnd(0.15, 0.45), ph: rnd(0, TAU), c: '255,255,255' }; } },
    rain:      { n: 110, make: function (w, h, init) { return { x: rnd(-40, w), y: init ? rnd(-h, h) : rnd(-60, -10), len: rnd(14, 30), v: rnd(900, 1400), a: rnd(0.18, 0.45) }; } },
    snow:      { n: 70, make: function (w, h, init) { return { x: rnd(0, w), y: init ? rnd(-h, h) : rnd(-20, -5), r: rnd(1, 3.6), v: rnd(22, 65), ph: rnd(0, TAU), sw: rnd(10, 30), a: rnd(0.55, 0.95) }; } },
    sparkle:   { n: 46, make: function (w, h) { return { x: rnd(0, w), y: rnd(0, h), r: rnd(2, 6), vy: rnd(-18, -5), ph: rnd(0, TAU), sp: rnd(1.5, 4), c: pick(['255,230,140', '255,200,230', '255,255,255', '200,230,255']) }; } },
    leaves:    { n: 14, make: function (w, h, init) { return { x: rnd(0, w), y: init ? rnd(-h, h) : rnd(-40, -10), s: rnd(5, 10), v: rnd(30, 70), ph: rnd(0, TAU), rot: rnd(0, TAU), vr: rnd(-2, 2), c: pick(['126,170,70', '170,190,80', '214,170,60', '196,120,50']) }; } },
    petals:    { n: 28, make: function (w, h, init) { return { x: rnd(0, w), y: init ? rnd(-h, h) : rnd(-40, -10), s: rnd(4, 8), v: rnd(35, 80), ph: rnd(0, TAU), rot: rnd(0, TAU), vr: rnd(-3, 3), c: pick(['255,183,197', '255,214,224', '255,240,245', '255,200,150']) }; } },
    glitter:   { n: 50, make: function (w, h, init) { return { x: rnd(0, w), y: init ? rnd(-h, h) : rnd(-30, -5), s: rnd(3, 6), v: rnd(50, 120), ph: rnd(0, TAU), rot: rnd(0, TAU), vr: rnd(-6, 6), c: pick(['255,215,90', '255,120,170', '120,200,255', '255,255,255', '180,140,255']) }; } },
    bokeh:     { n: 14, make: function (w, h) { return { x: rnd(0, w), y: rnd(0, h * 0.75), r: rnd(10, 34), vx: rnd(-5, 5), vy: rnd(-4, 4), a: rnd(0.05, 0.16), ph: rnd(0, TAU), c: pick(['255,210,140', '140,180,255', '255,160,200']) }; } },
    firework:  { n: 18, make: function (w, h) { return { x: rnd(0, w), y: rnd(0, h), r: rnd(0.8, 2), vx: rnd(-5, 5), vy: rnd(-10, -3), a: rnd(0.3, 0.8), ph: rnd(0, TAU), c: '255,210,120' }; } }
  };

  function FXC(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0; this.h = 0; this.dpr = 1;
    this.mode = null;
    this.items = [];
    this.bursts = [];
    this.running = false;
    this.last = 0;
    this.nextBoom = 0;
    this.nextBolt = 0;
    this.onLightning = null;
    var self = this;
    this._loop = function (t) { self.frame(t); };
    window.addEventListener('resize', function () { self.resize(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) self.wake(); });
  }

  FXC.prototype.resize = function () {
    var r = this.c.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height;
    this.c.width = Math.round(r.width * this.dpr);
    this.c.height = Math.round(r.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return true;
  };

  FXC.prototype.density = function (n) {
    var k = Math.max(0.5, Math.min(1.4, (this.w * this.h) / (390 * 560)));
    return Math.round(n * k * (REDUCED ? 0.3 : 1));
  };

  FXC.prototype.setAmbient = function (mode) {
    if (mode === this.mode && this.items.length) { this.wake(); return; }
    this.mode = mode;
    this.items = [];
    this.resize();
    var def = AMBIENT[mode];
    if (def && this.w) {
      for (var i = 0, n = this.density(def.n); i < n; i++) this.items.push(def.make(this.w, this.h, true));
    }
    this.nextBoom = performance.now() + 900;
    this.nextBolt = performance.now() + rnd(4000, 9000);
    this.wake();
  };

  FXC.prototype.clear = function () { this.mode = null; this.items = []; this.bursts = []; };

  FXC.prototype.burst = function (kind, x, y, n) {
    if (!this.w) this.resize();
    n = n || (kind === 'confetti' ? 60 : kind === 'hearts' ? 14 : 26);
    if (REDUCED) n = Math.ceil(n / 3);
    for (var i = 0; i < n; i++) {
      var a = rnd(0, TAU), sp;
      if (kind === 'hearts') {
        this.bursts.push({ k: 'heart', x: x + rnd(-20, 20), y: y + rnd(-10, 10), vx: rnd(-40, 40), vy: rnd(-160, -70), s: rnd(9, 18), life: 0, max: rnd(1.4, 2.2), ph: rnd(0, TAU), c: pick(['255,92,138', '255,140,170', '255,190,205']) });
      } else if (kind === 'confetti') {
        sp = rnd(250, 620);
        this.bursts.push({ k: 'rect', x: x, y: y, vx: Math.cos(a) * sp * 0.7, vy: -Math.abs(Math.sin(a)) * sp - 120, s: rnd(4, 8), rot: rnd(0, TAU), vr: rnd(-12, 12), g: 620, life: 0, max: rnd(1.6, 2.6), c: pick(['255,107,107', '255,193,77', '88,199,255', '126,217,87', '200,120,255', '255,255,255']) });
      } else if (kind === 'stars' || kind === 'sparkle') {
        sp = rnd(60, 260);
        this.bursts.push({ k: 'star', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: rnd(3, 8), g: kind === 'stars' ? 120 : -20, life: 0, max: rnd(0.9, 1.7), c: pick(['255,230,140', '255,255,255', '255,200,230']) });
      } else if (kind === 'boom') {
        sp = rnd(90, 230);
        var col = this._boomColor;
        this.bursts.push({ k: 'dot', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: rnd(1.4, 2.6), g: 90, drag: 0.985, life: 0, max: rnd(1.1, 1.8), c: col });
      }
    }
    this.wake();
  };

  FXC.prototype.wake = function () {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._loop);
  };

  FXC.prototype.frame = function (t) {
    if (document.hidden || !this.c.offsetParent) { this.running = false; return; }
    if (!this.w || this.c.width !== Math.round(this.w * this.dpr)) this.resize();
    var dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    var ctx = this.ctx, w = this.w, h = this.h, i, p;
    ctx.clearRect(0, 0, w, h);
    var def = AMBIENT[this.mode];
    var mode = this.mode;

    // 烟花：定时在上半屏炸开
    if (mode === 'firework' && t > this.nextBoom) {
      this._boomColor = pick(['255,90,90', '255,200,80', '255,140,220', '120,220,255', '170,255,140']);
      this.burst('boom', rnd(w * 0.15, w * 0.85), rnd(h * 0.08, h * 0.4), 46);
      this.nextBoom = t + rnd(1300, 2600);
    }
    // 雨天打闪
    if (mode === 'rain' && t > this.nextBolt) {
      this.nextBolt = t + rnd(6000, 13000);
      if (this.onLightning) this.onLightning();
    }

    for (i = 0; i < this.items.length; i++) {
      p = this.items[i];
      switch (mode) {
        case 'dust': case 'dustlight': case 'firework':
          p.x += p.vx * dt; p.y += p.vy * dt; p.ph += dt * 1.5;
          if (p.y < -5 || p.x < -5 || p.x > w + 5) { p.x = rnd(0, w); p.y = h + 5; }
          ctx.fillStyle = 'rgba(' + p.c + ',' + (p.a * (0.55 + 0.45 * Math.sin(p.ph))).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
          break;
        case 'bokeh':
          p.x += p.vx * dt; p.y += p.vy * dt; p.ph += dt * 0.6;
          if (p.x < -40) p.x = w + 40; if (p.x > w + 40) p.x = -40;
          if (p.y < -40) p.y = h * 0.75; if (p.y > h * 0.8) p.y = -30;
          var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          var al = (p.a * (0.6 + 0.4 * Math.sin(p.ph))).toFixed(3);
          g.addColorStop(0, 'rgba(' + p.c + ',' + al + ')');
          g.addColorStop(1, 'rgba(' + p.c + ',0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
          break;
        case 'rain':
          p.y += p.v * dt; p.x += p.v * 0.18 * dt;
          if (p.y > h + 30) { this.items[i] = def.make(w, h, false); continue; }
          ctx.strokeStyle = 'rgba(200,220,255,' + p.a + ')';
          ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.len * 0.18, p.y - p.len); ctx.stroke();
          break;
        case 'snow':
          p.y += p.v * dt; p.ph += dt;
          var sx = p.x + Math.sin(p.ph) * p.sw;
          if (p.y > h + 10) { this.items[i] = def.make(w, h, false); continue; }
          ctx.fillStyle = 'rgba(255,255,255,' + p.a + ')';
          ctx.beginPath(); ctx.arc(sx, p.y, p.r, 0, TAU); ctx.fill();
          break;
        case 'sparkle':
          p.y += p.vy * dt; p.ph += dt * p.sp;
          if (p.y < -10) { p.y = h + 10; p.x = rnd(0, w); }
          var tw = Math.max(0, Math.sin(p.ph));
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ph * 0.2);
          ctx.fillStyle = 'rgba(' + p.c + ',' + (0.25 + 0.75 * tw).toFixed(3) + ')';
          star(ctx, p.r * (0.5 + 0.5 * tw));
          ctx.restore();
          break;
        case 'leaves': case 'petals': case 'glitter':
          p.y += p.v * dt; p.ph += dt * 1.6; p.rot += p.vr * dt;
          var lx = p.x + Math.sin(p.ph) * (mode === 'glitter' ? 8 : 26);
          if (p.y > h + 20) { this.items[i] = def.make(w, h, false); continue; }
          ctx.save(); ctx.translate(lx, p.y); ctx.rotate(p.rot);
          ctx.scale(1, Math.abs(Math.cos(p.ph)) * 0.8 + 0.2);
          ctx.fillStyle = 'rgba(' + p.c + ',0.9)';
          if (mode === 'glitter') ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
          else { ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.5, 0, 0, TAU); ctx.fill(); }
          ctx.restore();
          break;
      }
    }

    for (i = this.bursts.length - 1; i >= 0; i--) {
      p = this.bursts[i];
      p.life += dt;
      if (p.life >= p.max) { this.bursts.splice(i, 1); continue; }
      var k = 1 - p.life / p.max;
      if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.k === 'heart') {
        ctx.translate(Math.sin(p.life * 5 + p.ph) * 6, 0);
        var sc = Math.min(1, p.life * 5);
        ctx.scale(sc, sc);
        ctx.fillStyle = 'rgba(' + p.c + ',' + k.toFixed(3) + ')';
        ctx.translate(0, -p.s / 2);
        heart(ctx, p.s);
      } else if (p.k === 'rect') {
        p.rot += p.vr * dt;
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.rot * 1.7));
        ctx.fillStyle = 'rgba(' + p.c + ',' + Math.min(1, k * 2).toFixed(3) + ')';
        ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s / 1.5);
      } else if (p.k === 'star') {
        ctx.rotate(p.life * 3);
        ctx.fillStyle = 'rgba(' + p.c + ',' + k.toFixed(3) + ')';
        star(ctx, p.s * (0.4 + k * 0.6));
      } else {
        ctx.fillStyle = 'rgba(' + p.c + ',' + k.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(0, 0, p.s, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    if (!this.items.length && !this.bursts.length && mode !== 'firework') {
      this.running = false;
      return;
    }
    requestAnimationFrame(this._loop);
  };

  return FXC;
})();
