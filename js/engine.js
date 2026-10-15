/*
 * 团子的喵生选择 —— 剧情引擎 + 演出系统
 * 依赖：story.js（CHARACTERS / SCENES / ENDINGS / ENDING_POSTSCRIPT）、assets.js（ASSETS / Assets）、fx.js（FX）
 *
 * 演出层次（从外到内）：
 *   转场遮罩（淡出 / 眨眼 / 圆形收缩 / 白光） → 镜头（推近说话人） → 背景（交叉淡化 + 缓慢推拉）
 *   → 光效 + 粒子 → 角色（入场 / 离场 / 呼吸 / 说话 / 表情气泡 / 姿态切换） → 对话框（逐字浮现）
 */
(function () {
  'use strict';

  var SAVE_KEY = 'tuanzi_save_v1';
  var ENDING_KEY = 'tuanzi_endings_v1';
  var SPEED_KEY = 'tuanzi_speed_v1';
  var START_SCENE = 'p1';
  var SPEEDS = [{ label: '慢', ms: 55 }, { label: '中', ms: 32 }, { label: '快', ms: 14 }, { label: '瞬间', ms: 0 }];
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= 演出配置 ================= */

  // 没有背景图时的 emoji 摆件（有图会自动隐藏）
  var DECOR = {
    home:     [['☀️', 80, 6, 46], ['🪴', 6, 40, 40], ['🧶', 84, 40, 30]],
    dusk:     [['🌇', 78, 8, 44], ['🍲', 8, 36, 34]],
    hospital: [['🏥', 78, 6, 44], ['💊', 10, 12, 26], ['🌷', 8, 40, 34]],
    shop:     [['🦴', 8, 10, 28], ['🐟', 80, 14, 30], ['🧶', 86, 40, 30], ['🐾', 12, 40, 26]],
    night:    [['🌙', 80, 6, 40], ['⭐', 14, 10, 18], ['⭐', 58, 18, 14], ['💻', 8, 40, 34]],
    room:     [['🪟', 76, 6, 38], ['🌡️', 10, 12, 28], ['🛋️', 82, 40, 36]],
    cafe:     [['☕', 10, 10, 34], ['🧁', 82, 14, 30], ['🪴', 86, 40, 36]],
    studio:   [['💡', 10, 8, 34], ['📱', 82, 12, 30], ['🍿', 84, 40, 30], ['📦', 8, 40, 32]],
    stage:    [['✨', 12, 8, 28], ['🎬', 82, 10, 34], ['📸', 10, 38, 30], ['🌟', 86, 36, 26]],
    oldhouse: [['🍇', 10, 6, 36], ['🏮', 82, 8, 30], ['📻', 84, 40, 32]],
    park:     [['🌳', 6, 10, 48], ['🚲', 80, 10, 34], ['♟️', 86, 40, 30]],
    newyear:  [['🧧', 10, 10, 32], ['🏮', 82, 6, 38], ['🧨', 86, 40, 28]],
    luxury:   [['🏙️', 78, 6, 44], ['🌃', 10, 10, 30]],
    rain:     [['🌧️', 78, 6, 40]],
    snow:     [['🏥', 78, 6, 40]],
    heaven:   [['☁️', 4, 8, 52], ['☁️', 68, 20, 44], ['🕊️', 80, 4, 30], ['🌈', 20, 26, 36]]
  };

  // 每个背景的氛围粒子 + 光效
  var AMBIENT = {
    home: 'dust', dusk: 'dust', hospital: 'dustlight', shop: 'dust', night: 'bokeh', room: 'dustlight',
    cafe: 'dust', studio: 'dust', stage: 'glitter', oldhouse: 'leaves', park: 'leaves', newyear: 'firework',
    luxury: 'bokeh', rain: 'rain', snow: 'snow', heaven: 'sparkle'
  };
  var LIGHT = {
    home: 'sun', dusk: 'warm', hospital: 'soft', shop: 'sun', night: 'cool', room: 'soft', cafe: 'warm',
    studio: 'soft', stage: 'spot', oldhouse: 'sun', park: 'sun', newyear: 'warm', luxury: 'cool',
    rain: 'cool', snow: 'cool', heaven: 'rays'
  };

  // 进入场景时的转场方式（没写的：同背景直接接，换背景就交叉淡化）
  var TRANSITIONS = {
    p2: 'fade', p3: 'fade', shop1: 'iris',
    v2_intro: 'blink', v3_intro: 'blink', v4_intro: 'blink',
    lin_r1: 'iris', su_r1: 'iris', zhang_r1: 'iris', gu_r1: 'iris', wait_r1: 'fade',
    lin_r2: 'fade', lin_r3: 'fade', su_r2: 'fade', su_r3: 'fade', zhang_r2: 'fade', zhang_r3: 'fade',
    gu_r2: 'fade', gu_r3: 'fade', wait_r2: 'fade', wait_r3: 'fade', wait_r4: 'slow', wait_r5: 'slow',
    lin_end_a: 'iris', lin_end_b: 'iris', su_end_a: 'iris', su_end_b: 'iris',
    zhang_end_a: 'iris', zhang_end_b: 'iris', gu_end_a: 'iris', gu_end_b: 'iris',
    heaven_1: 'heaven', heaven_end: 'white'
  };

  // 场景开头左上角浮现的地点 / 时间字幕
  var CAPTIONS = {
    p1: '奶奶家 · 午后', p2: '奶奶家 · 傍晚', p3: '医院', shop1: '「毛球驿站」宠物店',
    v2_intro: '第二天', v3_intro: '第三天 · 傍晚', v4_intro: '第四天',
    lin_r1: '林默的出租屋', lin_r2: '一个周六', lin_r3: '三个月后', lin_end_a: '半年后', lin_end_b: '后来',
    su_r1: '糖糖的秘密基地', su_r2: '深夜', su_r3: '半年后', su_end_a: '一年后', su_end_b: '毕业以后',
    zhang_r1: '张大爷家的小院', zhang_r2: '公园 · 象棋角', zhang_r3: '春节', zhang_end_a: '后来', zhang_end_b: '后来',
    gu_r1: '顾晚的公寓', gu_r2: '一个月后', gu_r3: '雨夜', gu_end_a: '一年后', gu_end_b: '后来',
    wait_r1: '「毛球驿站」', wait_r2: '每个礼拜六', wait_r3: '冬天', wait_r4: '很多年以后', wait_r5: '第十八年的春天',
    heaven_1: '？？？', heaven_2: '天堂'
  };

  // 旁白里提到谁，表情和动作就落在谁身上
  var ALIASES = {
    lin: ['林默', '小林'], su: ['糖糖'], zhang: ['大爷', '老头'], gu: ['顾晚', '律师'], grandma: ['奶奶'],
    li: ['李阿姨'], oldli: ['李阿姨'], duoduo: ['朵朵'], son: ['儿子'], neighbor: ['对门阿姨'],
    human: ['少年', '姑娘'], cat: ['团子', '猫', '橘猫', '毛球']
  };

  // 名牌颜色
  var NAME_COLORS = {
    cat: '#f0a23a', human: '#f08a3a', grandma: '#c9774a', li: '#d9822b', oldli: '#b97a4a',
    lin: '#4f74b3', su: '#e3589a', zhang: '#5d8a4e', gu: '#3a4256', neighbor: '#9a6fb0',
    duoduo: '#f27aa8', son: '#5a6a80', voice: '#8a8aa0'
  };

  // 文本 → 表情气泡 + 动作。按顺序匹配，命中第一条就停
  var CUES = [
    { re: /哈——|哈—/,                         emote: '💢', rx: 'shake' },
    { re: /哭|眼泪|泪|眼睛就红|声音在发抖|发抖/,  emote: '💧', rx: 'tremble' },
    { re: /僵住|吓得|愣住|愣了|一屁股坐/,        emote: '❗', rx: 'jump' },
    { re: /！！|!!|？！|！？|？？/,              emote: '❗', rx: 'hop' },
    { re: /生气|抗议|记仇|不服|嫌弃/,            emote: '💢', rx: 'shake' },
    { re: /耳朵却红了|害羞|脸红/,                emote: '💕', rx: 'pop' },
    { re: /哈哈|大笑|噗|笑了|笑着|笑起来|嘴角/,   emote: '♪',  rx: 'bounce' },
    { re: /呼噜|睡着|打盹|好困|困了|入睡/,        emote: '💤', rx: null },
    { re: /喜欢|好暖和|蹭|抱着|抱起|盖章|信任|谢谢/, emote: '💗', rx: 'pop' },
    { re: /^喵|喵。|喵！|喵？|喵嗷/,              emote: '🎵', rx: 'hop' },
    { re: /[？?]$/,                             emote: '❓', rx: 'tilt' },
    { re: /^……|……$/,                           emote: '…',  rx: null }
  ];
  var STAGE_CUES = [
    { re: /哐当|啪嗒|砸|轰|撞得/, fx: 'shake' },
    { re: /咔嚓|闪光灯/,          fx: 'flash' }
  ];

  /* ================= 状态 ================= */

  var state = { gender: 'm', scene: null, stats: {} };
  var queue = [];
  var onQueueEnd = null;
  var typing = null;          // { timer, chars, i, box }
  var locked = false;         // 选项 / 档案卡打开中
  var busy = false;           // 转场中
  var speedIdx = 1;
  var showCat = true;
  var currentChars = [];
  var charEls = {};           // id -> { el, focus, react, talk, body, x, file }
  var catPose = null;
  var currentBg = null;
  var bgKey = null;
  var bgToken = 0;
  var bgFront = 'a';
  var stageFx, titleFx, endingFx;
  var lastSpeaker = null;
  var captionTimer = null;
  var enterDelay = 0;         // 转场遮罩揭开时角色再入场

  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, REDUCED ? Math.min(ms, 60) : ms); }); }
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* 部分浏览器禁止 */ } }
  function restart(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }

  /* ================= 存储 ================= */

  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 隐私模式 */ } }
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function removeKey(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  function save() { store(SAVE_KEY, { gender: state.gender, scene: state.scene, stats: state.stats }); }
  function getSave() { var s = load(SAVE_KEY, null); return s && s.scene && SCENES[s.scene] ? s : null; }
  function getEndings() {
    var list = load(ENDING_KEY, []);
    return Array.isArray(list) ? list.filter(function (id) { return ENDINGS[id]; }) : [];
  }

  /* ================= 文本工具 ================= */

  function fmt(text) {
    return String(text).replace(/\{m:([^|}]*)\|f:([^}]*)\}/g, function (_, m, f) { return state.gender === 'f' ? f : m; });
  }
  function emojiOf(c) {
    if (!c || !c.emoji) return '';
    return typeof c.emoji === 'string' ? c.emoji : c.emoji[state.gender] || c.emoji.m;
  }

  /* ================= 转场 ================= */

  // 盖上遮罩 → 回调里换内容 → 揭开
  function transition(type, swap) {
    var tr = $('#transition');
    if (!type || REDUCED) { swap(); return Promise.resolve(); }
    var cls = 'tr-' + type;
    var cover = { fade: 420, slow: 1100, blink: 360, iris: 560, white: 700, heaven: 1500 }[type] || 420;
    var hold = { slow: 500, blink: 160, heaven: 600, white: 200 }[type] || 120;
    busy = true;
    tr.className = 'transition ' + cls;
    void tr.offsetWidth;
    tr.classList.add('in');
    return wait(cover).then(function () {
      swap();
      return wait(hold);
    }).then(function () {
      tr.classList.remove('in');
      tr.classList.add('out');
      return wait(cover);
    }).then(function () {
      tr.className = 'transition';
      busy = false;
    });
  }

  function showScreen(name) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.toggle('active', screens[i].id === 'screen-' + name);
    if (name === 'title') enterTitle();
    if (name === 'gallery') renderGallery();
    if (name === 'game') { measureStage(); stageFx.wake(); }
  }
  function goScreen(name, type) { return transition(type || 'fade', function () { showScreen(name); }); }

  /* ================= 舞台尺寸 ================= */

  function measureStage() {
    var st = $('#stage');
    var r = st.getBoundingClientRect();
    if (!r.height) return;
    var dlg = $('#dialog');
    var dh = dlg.offsetHeight + (parseFloat(getComputedStyle(dlg).bottom) || 0);
    var scr = $('#screen-game');
    scr.style.setProperty('--sh', r.height + 'px');
    scr.style.setProperty('--sw', r.width + 'px');
    scr.style.setProperty('--dh', dh + 'px');
    Object.keys(charEls).forEach(function (k) { placeChar(charEls[k]); });
    stageFx.resize();
  }

  /* ================= 背景 ================= */

  function setBg(name, sceneId, instant) {
    if (!name) return;
    var alias = (ASSETS.sceneBg && sceneId) ? ASSETS.sceneBg[sceneId] : null;
    var key = name + '|' + (alias || '');
    if (key === bgKey) return;
    bgKey = key;

    if (name !== currentBg) {
      currentBg = name;
      var bg = $('#bg');
      bg.className = 'bg bg-' + name;
      renderDecor(name);
      $('#light').className = 'light light-' + (LIGHT[name] || 'none');
      $('#stage').setAttribute('data-bg', name);
      stageFx.setAmbient(AMBIENT[name] || null);
    }

    var token = ++bgToken;
    Assets.bg(name, sceneId, function (url) {
      if (token !== bgToken) return;
      var front = $('#bg-' + bgFront), back = $('#bg-' + (bgFront === 'a' ? 'b' : 'a'));
      if (!url) {
        front.classList.remove('show'); back.classList.remove('show');
        $('#decor').classList.remove('has-art');
        return;
      }
      $('#decor').classList.add('has-art');
      var im = new Image();
      im.onload = im.onerror = function () {
        if (token !== bgToken) return;
        // 新图放到后面那层，淡入后成为前层（交叉淡化）
        back.style.backgroundImage = 'url("' + url + '")';
        back.classList.remove('show', 'kb');
        void back.offsetWidth;
        back.classList.toggle('instant', !!instant);
        back.classList.add('show', 'kb');
        front.classList.remove('show');
        bgFront = bgFront === 'a' ? 'b' : 'a';
      };
      im.src = url;
    });
  }

  function renderDecor(name) {
    var box = $('#decor');
    box.innerHTML = '';
    (DECOR[name] || []).forEach(function (d, i) {
      var s = el('span', 'd', d[0]);
      s.style.left = d[1] + '%';
      s.style.top = d[2] + '%';
      s.style.fontSize = d[3] + 'px';
      s.style.animationDelay = (-i * 1.3) + 's';
      box.appendChild(s);
    });
  }

  function showCaption(id) {
    var text = CAPTIONS[id];
    var box = $('#location');
    clearTimeout(captionTimer);
    if (!text) { box.classList.remove('show'); return; }
    box.innerHTML = '';
    var line = el('span', 'loc-line');
    Array.from(text).forEach(function (ch, i) {
      var s = el('span', 'loc-ch', ch);
      s.style.animationDelay = (0.25 + i * 0.05) + 's';
      line.appendChild(s);
    });
    box.appendChild(line);
    restart(box, 'show');
    captionTimer = setTimeout(function () { box.classList.remove('show'); }, 3200);
  }

  /* ================= 角色 ================= */

  function slots(ids) {
    var humans = ids.filter(function (i) { return i !== 'cat'; });
    var hasCat = ids.indexOf('cat') >= 0;
    var pos = {};
    var withCat = { 0: [], 1: [66], 2: [52, 79], 3: [44, 64, 84] };
    var noCat = { 0: [], 1: [50], 2: [32, 68], 3: [22, 50, 78] };
    var table = hasCat ? withCat : noCat;
    var xs = table[Math.min(3, humans.length)] || [];
    humans.forEach(function (id, i) { pos[id] = xs[i] != null ? xs[i] : 50 + i * 10; });
    if (hasCat) pos.cat = humans.length === 0 ? 50 : humans.length === 1 ? 28 : 20;
    return pos;
  }

  function setChars(list, withCat, sceneId) {
    showCat = withCat;
    var ids = (withCat ? ['cat'] : []).concat(list || []).filter(function (id) { return CHARACTERS[id] && CHARACTERS[id].emoji; });
    var pos = slots(ids);

    Object.keys(charEls).forEach(function (id) { if (ids.indexOf(id) < 0) removeChar(id); });

    ids.forEach(function (id, order) {
      var c = charEls[id];
      var x = pos[id];
      if (!c) {
        c = createChar(id, x, order);
        charEls[id] = c;
      } else {
        c.el.classList.remove('rx-dash', 'rx-ascend');
      }
      c.slotX = x;
      placeChar(c);
      c.el.style.zIndex = id === 'cat' ? 6 : 3 + order;
      // 同一个人物在不同场景可能换立绘（病床上的奶奶、老年团子、结局里的笑脸）
      if (!(id === 'cat' && catPose)) {
        Assets.sprite(id, sceneId, function (url) { setSprite(id, url); });
      }
    });
    currentChars = ids;
  }

  // 按槽位摆放，但保证立绘不出屏（宽的姿态、站在边上的人会被往里推）
  function placeChar(c) {
    var x = c.slotX;
    var sw = $('#stage').clientWidth;
    var sp = c.body.querySelector('.char-sprite:not(.swap-out)') || c.body.firstChild;
    var w = sp ? sp.offsetWidth : 0;
    if (sw && w) {
      var half = (w / 2) / sw * 100 + 1;
      x = Math.max(half, Math.min(100 - half, x));
    }
    c.x = x;
    c.el.style.setProperty('--x', x.toFixed(1) + '%');
    c.el.classList.toggle('flip-emote', x > 60);
  }

  function createChar(id, x, order) {
    var ch = CHARACTERS[id];
    var root = el('div', 'char' + (id === 'cat' ? ' is-cat' : ''));
    root.setAttribute('data-id', id);
    root.style.setProperty('--x', x + '%');
    root.style.setProperty('--enter-from', x < 45 ? '-60px' : x > 55 ? '60px' : '0px');
    root.style.animationDelay = (enterDelay + order * 0.09) + 's';
    var shadow = el('div', 'char-shadow');
    var focus = el('div', 'char-focus');
    var react = el('div', 'char-react');
    var talk = el('div', 'char-talk');
    var body = el('div', 'char-body');
    body.style.animationDelay = (-Math.random() * 3) + 's';
    var emoji = el('div', 'char-emoji', emojiOf(ch));
    body.appendChild(emoji);
    talk.appendChild(body);
    react.appendChild(talk);
    focus.appendChild(react);
    var name = el('div', 'char-name', ch.name);
    name.style.background = NAME_COLORS[id] || '#f39c4a';
    var emote = el('div', 'emote');
    root.appendChild(shadow);
    root.appendChild(focus);
    focus.appendChild(name);
    focus.appendChild(emote);
    $('#chars').appendChild(root);
    return { el: root, focus: focus, react: react, talk: talk, body: body, emote: emote, x: x, slotX: x, file: null };
  }

  function removeChar(id) {
    var c = charEls[id];
    if (!c) return;
    delete charEls[id];
    c.el.classList.add('leaving');
    setTimeout(function () { if (c.el.parentNode) c.el.parentNode.removeChild(c.el); }, 520);
  }

  function setSprite(id, url, withPop) {
    var c = charEls[id];
    if (!c || !url) return;
    var name = Assets.nameOf(url);
    if (c.file === name) return;
    var first = !c.file;
    c.file = name;
    var img = new Image();
    img.className = 'char-sprite';
    img.alt = '';
    img.decoding = 'async';
    img.onload = function () {
      if (charEls[id] !== c || c.file !== name) return;
      var wide = img.naturalWidth / img.naturalHeight > 1.02;
      c.el.classList.toggle('wide', wide);
      c.el.classList.toggle('framed', (ASSETS.framed || []).indexOf(name) >= 0);
      c.el.style.setProperty('--s', (ASSETS.spriteScale && ASSETS.spriteScale[name]) || 1);
      c.el.classList.add('has-sprite');
      var old = c.body.querySelectorAll('.char-sprite, .char-emoji');
      c.body.appendChild(img);
      if (first) {
        for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
      } else {
        // 新姿态叠在上面淡入，旧的稍后移除
        img.classList.add('swap-in');
        for (var j = 0; j < old.length; j++) old[j].classList.add('swap-out');
        setTimeout(function () {
          for (var k = 0; k < old.length; k++) if (old[k].parentNode) old[k].parentNode.removeChild(old[k]);
          img.classList.remove('swap-in');
        }, 320);
        if (withPop) react(id, 'pop');
      }
      placeChar(c);
    };
    img.src = url;
  }

  function setCatPose(file) {
    if (!charEls.cat) return;
    if (Assets.hasRule('cat', state.scene)) return; // 老年团子等专属立绘不切
    if (file === catPose) return;
    catPose = file;
    Assets.spriteFile(file || ASSETS.charFile.cat, function (url) { setSprite('cat', url, true); });
  }

  function poseFor(text) {
    var poses = ASSETS.catPoses || [];
    for (var i = 0; i < poses.length; i++) if (poses[i].re.test(text)) return poses[i].file;
    return null;
  }

  function react(id, rx) {
    var c = charEls[id];
    if (!c || !rx || REDUCED) return;
    var cls = 'rx-' + rx;
    c.react.className = 'char-react';
    void c.react.offsetWidth;
    c.react.classList.add(cls);
  }

  function emote(id, icon) {
    var c = charEls[id];
    if (!c || !icon) return;
    c.emote.textContent = icon;
    restart(c.emote, 'show');
  }

  // 一直保持的状态动作（倒下、升天、睡去……），换场景时清掉
  function pose(id, cls) {
    var c = charEls[id];
    if (!c) return;
    c.el.classList.add('rx-' + cls);
  }

  function highlight(id, talking) {
    var any = false;
    Object.keys(charEls).forEach(function (k) {
      var on = k === id;
      charEls[k].el.classList.toggle('speaking', on);
      charEls[k].el.classList.toggle('talking', on && !!talking);
      if (on) any = true;
    });
    $('#chars').classList.toggle('has-focus', any);
    focusCam(any ? charEls[id].x : null, id);
  }

  function setTalking(on) {
    Object.keys(charEls).forEach(function (k) {
      if (!on) charEls[k].el.classList.remove('talking');
    });
  }

  function focusCam(x, id) {
    var cam = $('#cam');
    if (x == null || REDUCED) { cam.style.transform = ''; return; }
    var dx = (50 - x) * 0.14;
    var zoom = id === 'cat' || id === 'human' ? 1.06 : 1.045;
    cam.style.transform = 'translateX(' + dx.toFixed(2) + '%) scale(' + zoom + ')';
  }

  // 角色头顶附近在粒子画布里的坐标
  function charPoint(id, yk) {
    var cv = $('#stage-fx').getBoundingClientRect();
    var c = charEls[id];
    if (!c) return { x: cv.width / 2, y: cv.height * 0.45 };
    var r = (c.body.querySelector('.char-sprite, .char-emoji') || c.body).getBoundingClientRect();
    return { x: r.left + r.width / 2 - cv.left, y: r.top + r.height * (yk == null ? 0.2 : yk) - cv.top };
  }

  /* ================= 舞台效果 ================= */

  function stageFxRun(name, opt) {
    opt = opt || {};
    var stage = $('#stage');
    switch (name) {
      case 'shake':
        restart(stage, 'shake');
        vibrate(30);
        break;
      case 'flash':
        restart($('#flash'), 'flash-quick');
        break;
      case 'bolt':
        restart($('#flash'), 'flash-bolt');
        setTimeout(function () { restart(stage, 'shake-soft'); }, 120);
        break;
      case 'bloom':
        restart($('#flash'), 'flash-bloom');
        break;
      case 'heartbeat':
        $('#vignette').classList.toggle('heartbeat', opt.on !== false);
        break;
      case 'burst':
        var p = opt.who ? charPoint(opt.who, 0.3) : { x: stage.clientWidth / 2, y: stage.clientHeight * 0.4 };
        stageFx.burst(opt.kind || 'sparkle', p.x, p.y);
        break;
      case 'fall': case 'dash': case 'ascend': case 'fadeaway':
        if (name === 'ascend') {
          var a = charPoint(opt.who, 0.5);
          setTimeout(function () { stageFx.burst('sparkle', a.x, a.y, 40); }, 600);
        }
        pose(opt.who, name);
        break;
    }
  }

  /* ================= 台词 ================= */

  function catSelf() { return currentChars.indexOf('human') >= 0 ? 'human' : 'cat'; }

  function speakerInfo(spk) {
    if (spk === 'narr') return { cls: 'narr', name: '', focus: null };
    if (spk === 'inner') return { cls: 'inner', name: '💭 团子（内心）', focus: catSelf() };
    var c = CHARACTERS[spk];
    var isSelf = spk === 'cat' || spk === 'human';
    return { cls: isSelf ? 'cat' : 'talk', name: c ? c.name : spk, focus: spk, color: NAME_COLORS[spk] };
  }

  // 旁白里提到的第一个在场角色
  function mentioned(text) {
    var best = null, bestIdx = 1e9;
    currentChars.forEach(function (id) {
      (ALIASES[id] || []).forEach(function (a) {
        var i = text.indexOf(a);
        if (i >= 0 && i < bestIdx) { bestIdx = i; best = id; }
      });
    });
    return best;
  }

  function showLine(spk, raw) {
    var text = fmt(raw);
    var info = speakerInfo(spk);
    var dlg = $('#dialog');
    var changed = spk !== lastSpeaker;
    lastSpeaker = spk;

    dlg.className = 'dialog ' + info.cls;
    if (changed) restart(dlg, 'bump');
    var sp = $('#speaker');
    sp.textContent = info.name;
    sp.hidden = !info.name;
    sp.style.background = info.color || '';
    if (changed && info.name) restart(sp, 'pop');

    $('#tint').classList.toggle('on', spk === 'inner');

    // 表情、动作、姿态
    var target = info.focus || (spk === 'narr' ? mentioned(text) : null);
    var stageTarget = info.focus;
    highlight(stageTarget, spk !== 'narr' && spk !== 'inner');
    if (target) {
      for (var i = 0; i < CUES.length; i++) {
        var cue = CUES[i];
        if (cue.re.test(text)) {
          if (cue.re.source.indexOf('喵') >= 0 && target !== 'cat') continue;
          emote(target, cue.emote);
          react(target, cue.rx);
          break;
        }
      }
      if (!CUES.some(function (c) { return c.re.test(text); }) && spk !== 'narr' && spk !== 'inner') react(target, 'nod');
    }
    if (spk === 'narr' || spk === 'inner' || spk === 'cat') {
      var ps = poseFor(text);
      if (ps && (spk !== 'narr' || target === 'cat' || /团子|猫/.test(text))) setCatPose(ps);
    }
    STAGE_CUES.forEach(function (s) { if (spk === 'narr' && s.re.test(text)) stageFxRun(s.fx); });

    typeText(text, /！！|!!|？！/.test(text));
  }

  function delayAfter(ch, base) {
    if ('。！？!?…'.indexOf(ch) >= 0) return base * 7;
    if ('，、；：,;'.indexOf(ch) >= 0) return base * 3.5;
    if (ch === '—') return base * 2;
    return base;
  }

  function typeText(t, jitter) {
    stopTyping();
    var box = $('#text');
    box.innerHTML = '';
    box.classList.toggle('jitter', !!jitter);
    $('#next-indicator').classList.remove('show');
    var chars = Array.from(t);
    var base = SPEEDS[speedIdx].ms;
    typing = { chars: chars, i: 0, box: box, timer: null };
    if (!base) { finishTyping(); return; }
    function tick() {
      if (!typing) return;
      var ch = typing.chars[typing.i++];
      var s = el('span', 'ch', ch);
      if (jitter && !REDUCED) s.style.animationDelay = '0s,' + (-Math.random()).toFixed(2) + 's';
      box.appendChild(s);
      if (typing.i >= typing.chars.length) { finishTyping(); return; }
      typing.timer = setTimeout(tick, delayAfter(ch, base));
    }
    tick();
  }
  function stopTyping() {
    if (typing && typing.timer) clearTimeout(typing.timer);
    typing = null;
  }
  function finishTyping() {
    if (typing) {
      var rest = typing.chars.slice(typing.i).join('');
      if (rest) typing.box.appendChild(el('span', 'ch rest', rest));
      if (typing.timer) clearTimeout(typing.timer);
    }
    typing = null;
    setTalking(false);
    $('#next-indicator').classList.add('show');
  }

  /* ================= 流程 ================= */

  function playLines(lines, done) {
    queue = (lines || []).slice();
    onQueueEnd = done;
    advance();
  }

  function advance() {
    while (queue.length) {
      var item = queue.shift();
      if (Array.isArray(item)) { showLine(item[0], item[1]); return; }
      if (item.bg) setBg(item.bg, state.scene);
      if (item.chars) setChars(item.chars, item.cat !== undefined ? item.cat : showCat, state.scene);
      if (item.fx) stageFxRun(item.fx, item);
      if (item.card) { showCard(item.card); return; }
    }
    var cb = onQueueEnd;
    onQueueEnd = null;
    if (cb) cb();
  }

  function resolveNext(n) {
    if (!n) return null;
    if (typeof n === 'string') return n;
    return (state.stats[n.stat] || 0) >= n.gte ? n.a : n.b;
  }

  function clearPoses() {
    Object.keys(charEls).forEach(function (k) {
      charEls[k].el.classList.remove('rx-fall', 'rx-dash', 'rx-ascend', 'rx-fadeaway');
    });
  }

  function enterScene(id, noTransition) {
    var sc = SCENES[id];
    if (!sc) { console.error('找不到场景：', id); showScreen('title'); return; }
    var type = noTransition ? null : (TRANSITIONS[id] || null);
    state.scene = id;
    save();
    Assets.warmNext(id);

    function setup() {
      clearPoses();
      catPose = null;
      $('#tint').classList.remove('on');
      if (type && type !== 'blink') {
        // 大转场：舞台清空重建
        Object.keys(charEls).forEach(function (k) { var c = charEls[k]; if (c.el.parentNode) c.el.parentNode.removeChild(c.el); });
        charEls = {};
      }
      setBg(sc.bg, id, !!(type || noTransition));
      enterDelay = (type || noTransition) ? 0.4 : 0;
      setChars(sc.chars || [], !sc.noCat, id);
      enterDelay = 0;
      highlight(null);
    }

    transition(type, setup).then(function () {
      showCaption(id);
      playLines(sc.lines, function () { afterScene(sc); });
    });
  }

  function afterScene(sc) {
    if (sc.ending) { showEnding(sc.ending); return; }
    if (sc.choices) { showChoices(sc.choices); return; }
    var next = resolveNext(sc.next);
    if (next) enterScene(next);
  }

  function onTap() {
    if (locked || busy) return;
    if (typing) { finishTyping(); return; }
    advance();
  }

  function ripple(ev) {
    if (REDUCED) return;
    var box = $('#ripples');
    var r = $('#screen-game').getBoundingClientRect();
    var d = el('span', 'ripple', '🐾');
    d.style.left = (ev.clientX - r.left) + 'px';
    d.style.top = (ev.clientY - r.top) + 'px';
    d.style.setProperty('--rot', (Math.random() * 40 - 20).toFixed(0) + 'deg');
    box.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 700);
  }

  /* ================= 选项 ================= */

  function showChoices(list) {
    var box = $('#choices');
    box.innerHTML = '';
    box.appendChild(el('div', 'choices-title', '团子决定……'));
    list.forEach(function (c, idx) {
      var b = el('button', 'choice');
      b.type = 'button';
      b.style.animationDelay = (0.08 + idx * 0.09) + 's';
      b.appendChild(el('span', 'choice-text', fmt(c.t)));
      if (c.fx) b.classList.add('has-fx');
      b.addEventListener('click', function (ev) { ev.stopPropagation(); choose(c, b); });
      box.appendChild(b);
    });
    box.hidden = false;
    locked = true;
    setTalking(false);
    highlight(catSelf());
    $('#next-indicator').classList.remove('show');
  }

  function choose(c, btn) {
    var box = $('#choices');
    if (box.hidden || box.classList.contains('closing')) return;
    vibrate(12);
    box.classList.add('closing');
    btn.classList.add('picked');
    var r = btn.getBoundingClientRect(), cv = $('#stage-fx').getBoundingClientRect();
    stageFx.burst('stars', r.left + r.width / 2 - cv.left, r.top + r.height / 2 - cv.top, 22);

    var p = poseFor(fmt(c.t));
    setTimeout(function () {
      box.hidden = true;
      box.classList.remove('closing');
      box.innerHTML = '';
      locked = false;
      if (p) setCatPose(p);
      applyFx(c.fx);
      var sc = SCENES[state.scene];
      var target = resolveNext(c.next || sc.next);
      playLines(c.lines, function () { if (target) enterScene(target); });
    }, REDUCED ? 0 : 430);
  }

  function applyFx(fx) {
    if (!fx) return;
    Object.keys(fx).forEach(function (k) {
      state.stats[k] = (state.stats[k] || 0) + fx[k];
      var c = CHARACTERS[k];
      if (!c || fx[k] <= 0) return;
      toast(c.name, fx[k], state.stats[k], NAME_COLORS[k]);
      if (charEls[k]) {
        var pt = charPoint(k, 0.25);
        stageFx.burst('hearts', pt.x, pt.y, 8 + fx[k] * 4);
        emote(k, '💗');
        react(k, 'bounce');
      }
    });
  }

  function toast(name, add, total, color) {
    var t = el('div', 'toast');
    var hearts = '';
    for (var i = 0; i < Math.min(8, total); i++) hearts += '♥';
    t.appendChild(el('span', 'toast-heart', '💗'));
    var label = el('span', 'toast-name', name);
    if (color) label.style.color = color;
    t.appendChild(label);
    t.appendChild(el('span', 'toast-plus', '羁绊 +' + add));
    t.appendChild(el('span', 'toast-meter', hearts));
    $('#toast-area').appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
  }

  /* ================= 档案卡 ================= */

  function showCard(id) {
    var c = CHARACTERS[id] || {};
    var photo = $('#card-emoji');
    photo.innerHTML = '';
    photo.textContent = emojiOf(c);
    Assets.sprite(id, state.scene, function (url) {
      if (!url) return;
      var im = new Image();
      im.alt = '';
      im.className = 'card-img';
      im.src = url;
      photo.textContent = '';
      photo.appendChild(im);
    });
    $('#card-name').textContent = c.name || '';
    $('#card-tag').textContent = c.tag || '';
    $('#card-desc').textContent = c.desc || '';
    var ov = $('#card');
    ov.hidden = false;
    restart(ov, 'enter');
    locked = true;
  }
  function closeCard(ev) {
    ev.stopPropagation();
    var ov = $('#card');
    if (ov.classList.contains('leave')) return;
    ov.classList.add('leave');
    setTimeout(function () {
      ov.hidden = true;
      ov.classList.remove('leave', 'enter');
      locked = false;
      advance();
    }, REDUCED ? 0 : 280);
  }

  /* ================= 菜单 ================= */

  function openMenu(ev) { ev.stopPropagation(); $('#menu').hidden = false; }
  function closeMenu(ev) { if (ev) ev.stopPropagation(); $('#menu').hidden = true; }
  function updateSpeedLabel() { $('#menu-speed').textContent = '文字速度：' + SPEEDS[speedIdx].label; }

  /* ================= 结局 ================= */

  function showEnding(id) {
    var e = ENDINGS[id];
    var got = getEndings();
    var isNew = got.indexOf(id) < 0;
    if (isNew) { got.push(id); store(ENDING_KEY, got); }
    removeKey(SAVE_KEY);
    stopTyping();

    var scr = $('#screen-ending');
    var art = $('#ending-art');
    var wrap = $('#ending-art-wrap');
    wrap.classList.remove('loaded');
    art.removeAttribute('src');
    Assets.ending(id, function (url) {
      if (!url) return;
      art.onload = function () { wrap.classList.add('loaded'); };
      art.src = url;
      $('#ending-art-blur').style.backgroundImage = 'url("' + url + '")';
    });

    scr.classList.toggle('heaven', !!e.special);
    $('#ending-new').hidden = !isNew;
    var title = $('#ending-title');
    title.innerHTML = '';
    Array.from('「' + e.title + '」').forEach(function (ch, i) {
      var s = el('span', 'et-ch', ch);
      s.style.animationDelay = (0.9 + i * 0.07) + 's';
      title.appendChild(s);
    });
    $('#ending-route').textContent = e.route;
    $('#ending-desc').textContent = fmt(e.desc);
    $('#ending-ps').textContent = e.special ? '' : ENDING_POSTSCRIPT;
    $('#ending-ps').hidden = !!e.special;
    var total = Object.keys(ENDINGS).length;
    $('#ending-count').textContent = '已收集结局 ' + got.length + ' / ' + total +
      (got.length < total ? '　试试不同的选择吧～' : '　全部收集完成！');

    stageFx.clear();
    goScreen('ending', e.special ? 'white' : 'slow').then(function () {
      restart(scr, 'play');
      endingFx.setAmbient(e.special ? 'sparkle' : 'petals');
      setTimeout(function () {
        var r = title.getBoundingClientRect(), cv = $('#ending-fx').getBoundingClientRect();
        endingFx.burst(isNew ? 'confetti' : 'stars', r.left + r.width / 2 - cv.left, r.top + r.height / 2 - cv.top, isNew ? 80 : 30);
        if (isNew) vibrate([20, 40, 20]);
      }, REDUCED ? 0 : 1500);
    });
  }

  function renderGallery() {
    var got = getEndings();
    var ids = Object.keys(ENDINGS);
    $('#gallery-progress').textContent = '已收集 ' + got.length + ' / ' + ids.length;
    var ul = $('#gallery-list');
    ul.innerHTML = '';
    ids.forEach(function (id, idx) {
      var e = ENDINGS[id];
      var open = got.indexOf(id) >= 0;
      var li = el('li', 'gallery-item' + (open ? '' : ' locked') + (e.special ? ' special' : ''));
      li.style.animationDelay = (idx * 0.06) + 's';
      var thumb = el('div', 'gi-thumb', open ? '' : '🔒');
      if (open) {
        Assets.ending(id, function (url) {
          if (!url) { thumb.textContent = '🐱'; return; }
          thumb.style.backgroundImage = 'url("' + url + '")';
          li.addEventListener('click', function () { openViewer(url); });
        });
      }
      var info = el('div', 'gi-info');
      info.appendChild(el('div', 'gi-route', e.route));
      info.appendChild(el('div', 'gi-title', open ? e.title : '？？？？'));
      info.appendChild(el('div', 'gi-desc', open ? fmt(e.desc) : (e.special ? '也许……不跟任何人走？' : '尚未解锁')));
      li.appendChild(thumb);
      li.appendChild(info);
      ul.appendChild(li);
    });
  }

  function openViewer(url) {
    var v = $('#viewer');
    $('#viewer-img').src = url;
    v.hidden = false;
    restart(v, 'enter');
  }

  /* ================= 标题页 ================= */

  function enterTitle() {
    $('#btn-continue').hidden = !getSave();
    $('#gallery-count').textContent = '(' + getEndings().length + '/' + Object.keys(ENDINGS).length + ')';
    restart($('#screen-title'), 'play');
    titleFx.setAmbient('dust');
  }

  function buildTitle() {
    var t = $('#title-text');
    var text = t.textContent;
    t.textContent = '';
    t.setAttribute('aria-label', text);
    Array.from(text).forEach(function (ch, i) {
      var s = el('span', 'tt-ch', ch);
      s.setAttribute('aria-hidden', 'true');
      s.style.animationDelay = (0.35 + i * 0.08) + 's, ' + (1.6 + i * 0.12) + 's';
      t.appendChild(s);
    });
  }

  function loadUiArt() {
    Assets.ui('title', function (url) {
      if (!url) return;
      var im = new Image();
      im.onload = function () {
        var bgEl = $('#title-bg');
        bgEl.style.backgroundImage = 'url("' + url + '")';
        bgEl.classList.add('loaded');
        $('#screen-title').classList.add('has-art');
      };
      im.src = url;
    });
    ['m', 'f'].forEach(function (g) {
      Assets.ui('gender_' + g, function (url) {
        if (!url) return;
        var holder = document.querySelector('.gender-card[data-gender="' + g + '"] .g-emoji');
        if (!holder) return;
        var img = el('img', 'g-sprite');
        img.alt = '';
        img.src = url;
        holder.textContent = '';
        holder.appendChild(img);
      });
    });
  }

  /* ================= 开始 / 继续 ================= */

  function resetStage() {
    stopTyping();
    queue = [];
    onQueueEnd = null;
    locked = false;
    busy = false;
    currentBg = null;
    bgKey = null;
    bgToken++;
    catPose = null;
    lastSpeaker = null;
    $('#bg-a').classList.remove('show');
    $('#bg-b').classList.remove('show');
    Object.keys(charEls).forEach(function (k) { var c = charEls[k]; if (c.el.parentNode) c.el.parentNode.removeChild(c.el); });
    charEls = {};
    currentChars = [];
    showCat = true;
    $('#cam').style.transform = '';
    $('#tint').classList.remove('on');
    $('#vignette').className = 'vignette';
    $('#choices').hidden = true;
    $('#card').hidden = true;
    $('#menu').hidden = true;
    $('#text').innerHTML = '';
    $('#speaker').hidden = true;
    $('#toast-area').innerHTML = '';
  }

  function begin(sceneId) {
    resetStage();
    // 遮罩盖住时就把第一幕摆好，揭开时直接看到画面
    var tr = transition('iris', function () {
      showScreen('game');
      enterScene(sceneId, true);
    });
    return tr;
  }

  function startNew(gender, card) {
    state = { gender: gender === 'f' ? 'f' : 'm', scene: null, stats: {} };
    Assets.setGender(state.gender);
    Assets.warmCatPoses();
    if (card) card.classList.add('chosen');
    setTimeout(function () { begin(START_SCENE); }, REDUCED ? 0 : 380);
  }

  function continueGame() {
    var s = getSave();
    if (!s) { enterTitle(); return; }
    state = { gender: s.gender === 'f' ? 'f' : 'm', scene: s.scene, stats: s.stats || {} };
    Assets.setGender(state.gender);
    Assets.warmCatPoses();
    begin(s.scene);
  }

  /* ================= 事件绑定 ================= */

  function bind() {
    $('#btn-new').addEventListener('click', function () {
      if (getSave() && !window.confirm('开始新故事会覆盖当前存档，确定吗？')) return;
      goScreen('gender', 'fade');
    });
    $('#btn-continue').addEventListener('click', continueGame);
    $('#btn-gallery').addEventListener('click', function () { goScreen('gallery', 'fade'); });
    $('#btn-gender-back').addEventListener('click', function () { goScreen('title', 'fade'); });
    var cards = document.querySelectorAll('.gender-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function () {
        if (busy) return;
        busy = true;
        startNew(this.getAttribute('data-gender'), this);
      });
    }

    // 标题页：点一下画面会冒小爱心
    $('#screen-title').addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('button')) return;
      var cv = $('#title-fx').getBoundingClientRect();
      titleFx.burst('hearts', ev.clientX - cv.left, ev.clientY - cv.top, 6);
    });

    var game = $('#screen-game');
    game.addEventListener('click', onTap);
    game.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('button, .overlay')) return;
      ripple(ev);
    });
    $('#btn-menu').addEventListener('click', openMenu);
    $('#card').addEventListener('click', closeCard);
    $('#menu').addEventListener('click', function (ev) { if (ev.target === this) closeMenu(ev); else ev.stopPropagation(); });
    $('#menu-resume').addEventListener('click', closeMenu);
    $('#menu-speed').addEventListener('click', function (ev) {
      ev.stopPropagation();
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      store(SPEED_KEY, speedIdx);
      updateSpeedLabel();
    });
    $('#menu-title').addEventListener('click', function (ev) {
      closeMenu(ev);
      stopTyping();
      goScreen('title', 'fade');
    });

    $('#ending-again').addEventListener('click', function () { endingFx.clear(); goScreen('title', 'fade'); });
    $('#ending-gallery').addEventListener('click', function () { endingFx.clear(); goScreen('gallery', 'fade'); });
    $('#gallery-back').addEventListener('click', function () { goScreen('title', 'fade'); });
    $('#viewer').addEventListener('click', function () { this.hidden = true; });
    // 结局页点上方插画区域：看大图
    document.querySelector('.ending-scroll').addEventListener('click', function (ev) {
      var src = $('#ending-art').getAttribute('src');
      if (ev.target === this && src) openViewer(src);
    });

    window.addEventListener('resize', measureStage);

    document.addEventListener('keydown', function (ev) {
      if (!$('#screen-game').classList.contains('active')) return;
      if (!$('#menu').hidden) return;
      if (ev.key === ' ' || ev.key === 'Enter') {
        if (!$('#card').hidden) { closeCard(ev); ev.preventDefault(); return; }
        if (locked) return;
        ev.preventDefault();
        onTap();
      }
    });
  }

  function init() {
    var sp = load(SPEED_KEY, 1);
    speedIdx = typeof sp === 'number' && SPEEDS[sp] ? sp : 1;
    stageFx = new FX($('#stage-fx'));
    titleFx = new FX($('#title-fx'));
    endingFx = new FX($('#ending-fx'));
    stageFx.onLightning = function () { stageFxRun('bolt'); };
    updateSpeedLabel();
    buildTitle();
    bind();
    loadUiArt();
    Assets.warmScene(START_SCENE);
    showScreen('title');
  }

  // 调试接口
  window.TuanziGame = {
    state: function () { return state; },
    goto: function (id) { enterScene(id); },
    isBusy: function () { return busy || locked || !!typing; }
  };

  init();
})();
