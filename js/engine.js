/*
 * 团子的喵生选择 —— 剧情引擎
 * 依赖 story.js 中的 CHARACTERS / SCENES / ENDINGS / ENDING_POSTSCRIPT
 */
(function () {
  'use strict';

  var SAVE_KEY = 'tuanzi_save_v1';
  var ENDING_KEY = 'tuanzi_endings_v1';
  var SPEED_KEY = 'tuanzi_speed_v1';
  var START_SCENE = 'p1';
  var SPEEDS = [{ label: '慢', ms: 60 }, { label: '中', ms: 35 }, { label: '快', ms: 15 }, { label: '瞬间', ms: 0 }];

  // 背景装饰：[emoji, left%, top%, 字号px]
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
  var PARTICLES = { rain: 'rain', snow: 'snow', heaven: 'sparkle' };

  var state = { gender: 'm', scene: null, stats: {} };
  var queue = [];
  var onQueueEnd = null;
  var typingTimer = null;
  var typingFull = '';
  var locked = false;
  var currentBg = null;
  var currentChars = [];
  var showCat = true;
  var speedIdx = 1;

  function $(sel) { return document.querySelector(sel); }

  /* ---------- 存储 ---------- */
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 隐私模式等 */ } }
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function removeKey(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }

  function save() {
    store(SAVE_KEY, { gender: state.gender, scene: state.scene, stats: state.stats });
  }
  function getSave() {
    var s = load(SAVE_KEY, null);
    return s && s.scene && SCENES[s.scene] ? s : null;
  }
  function getEndings() {
    var list = load(ENDING_KEY, []);
    return Array.isArray(list) ? list.filter(function (id) { return ENDINGS[id]; }) : [];
  }

  /* ---------- 文本 ---------- */
  function fmt(text) {
    return String(text).replace(/\{m:([^|}]*)\|f:([^}]*)\}/g, function (_, m, f) {
      return state.gender === 'f' ? f : m;
    });
  }
  function emojiOf(c) {
    if (!c || !c.emoji) return '';
    return typeof c.emoji === 'string' ? c.emoji : c.emoji[state.gender] || c.emoji.m;
  }

  /* ---------- 页面切换 ---------- */
  function showScreen(name) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.toggle('active', screens[i].id === 'screen-' + name);
    }
    if (name === 'title') refreshTitle();
    if (name === 'gallery') renderGallery();
  }

  function refreshTitle() {
    $('#btn-continue').hidden = !getSave();
    $('#gallery-count').textContent = '(' + getEndings().length + '/' + Object.keys(ENDINGS).length + ')';
  }

  /* ---------- 舞台 ---------- */
  function setBg(name) {
    if (!name || name === currentBg) return;
    currentBg = name;
    var bg = $('#bg');
    bg.className = 'bg bg-' + name;
    void bg.offsetWidth; // 重新触发动画
    bg.classList.add('fade-in');
    renderDecor(name);
  }

  function renderDecor(name) {
    var box = $('#decor');
    box.innerHTML = '';
    (DECOR[name] || []).forEach(function (d, i) {
      var s = document.createElement('span');
      s.className = 'd';
      s.textContent = d[0];
      s.style.left = d[1] + '%';
      s.style.top = d[2] + '%';
      s.style.fontSize = d[3] + 'px';
      s.style.animationDelay = (-i * 1.3) + 's';
      box.appendChild(s);
    });
    var type = PARTICLES[name];
    if (!type) return;
    var count = type === 'rain' ? 28 : 16;
    for (var i = 0; i < count; i++) {
      var p = document.createElement('span');
      p.className = 'p ' + type;
      if (type === 'snow') p.textContent = '❄';
      if (type === 'sparkle') p.textContent = '✦';
      p.style.left = (Math.random() * 100) + '%';
      p.style.fontSize = (10 + Math.random() * 10) + 'px';
      p.style.animationDuration = (type === 'rain' ? 0.8 + Math.random() * 0.6 : 6 + Math.random() * 6) + 's';
      p.style.animationDelay = (-Math.random() * 10) + 's';
      box.appendChild(p);
    }
  }

  function setChars(list, withCat) {
    showCat = withCat;
    var ids = (withCat ? ['cat'] : []).concat(list || []);
    if (ids.join(',') === currentChars.join(',')) return;
    var prev = currentChars;
    currentChars = ids;
    var box = $('#chars');
    box.innerHTML = '';
    ids.forEach(function (id) {
      var c = CHARACTERS[id];
      if (!c || !c.emoji) return;
      var d = document.createElement('div');
      d.className = 'char' + (id === 'cat' ? ' is-cat' : '');
      d.setAttribute('data-id', id);
      if (prev.indexOf(id) >= 0) d.style.animation = 'none'; // 已在场的角色不重复入场动画
      var e = document.createElement('div');
      e.className = 'char-emoji';
      e.textContent = emojiOf(c);
      var n = document.createElement('div');
      n.className = 'char-name';
      n.textContent = c.name;
      d.appendChild(e);
      d.appendChild(n);
      box.appendChild(d);
    });
  }

  function highlight(id) {
    var box = $('#chars');
    var nodes = box.querySelectorAll('.char');
    var found = false;
    for (var i = 0; i < nodes.length; i++) {
      var on = nodes[i].getAttribute('data-id') === id;
      nodes[i].classList.toggle('speaking', on);
      if (on) found = true;
    }
    box.classList.toggle('has-focus', found);
  }

  /* ---------- 台词 ---------- */
  function catSelf() { return currentChars.indexOf('human') >= 0 ? 'human' : 'cat'; }

  function speakerInfo(spk) {
    if (spk === 'narr') return { cls: 'narr', name: '', focus: null };
    if (spk === 'inner') return { cls: 'inner', name: '💭 团子（内心）', focus: catSelf() };
    var c = CHARACTERS[spk];
    var isSelf = spk === 'cat' || spk === 'human';
    return { cls: isSelf ? 'cat' : 'talk', name: c ? c.name : spk, focus: spk };
  }

  function showLine(spk, raw) {
    var info = speakerInfo(spk);
    $('#dialog').className = 'dialog ' + info.cls;
    var sp = $('#speaker');
    sp.textContent = info.name;
    sp.hidden = !info.name;
    highlight(info.focus);
    typeText(fmt(raw));
  }

  function typeText(t) {
    stopTyping();
    var chars = Array.from(t);
    var box = $('#text');
    var i = 0;
    typingFull = t;
    $('#next-indicator').classList.remove('show');
    var ms = SPEEDS[speedIdx].ms;
    if (ms === 0) { finishTyping(); return; }
    box.textContent = '';
    typingTimer = setInterval(function () {
      i++;
      box.textContent = chars.slice(0, i).join('');
      if (i >= chars.length) finishTyping();
    }, ms);
  }
  function stopTyping() {
    if (typingTimer) { clearInterval(typingTimer); typingTimer = null; }
  }
  function finishTyping() {
    stopTyping();
    $('#text').textContent = typingFull;
    $('#next-indicator').classList.add('show');
  }

  /* ---------- 流程 ---------- */
  function playLines(lines, done) {
    queue = (lines || []).slice();
    onQueueEnd = done;
    advance();
  }

  function advance() {
    while (queue.length) {
      var item = queue.shift();
      if (Array.isArray(item)) { showLine(item[0], item[1]); return; }
      if (item.bg) setBg(item.bg);
      if (item.chars) setChars(item.chars, item.cat !== undefined ? item.cat : showCat);
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

  function enterScene(id) {
    var sc = SCENES[id];
    if (!sc) { console.error('找不到场景：', id); showScreen('title'); return; }
    state.scene = id;
    save();
    setBg(sc.bg);
    setChars(sc.chars || [], !sc.noCat);
    playLines(sc.lines, function () { afterScene(sc); });
  }

  function afterScene(sc) {
    if (sc.ending) { showEnding(sc.ending); return; }
    if (sc.choices) { showChoices(sc.choices); return; }
    var next = resolveNext(sc.next);
    if (next) enterScene(next);
  }

  function onTap() {
    if (locked) return;
    if (typingTimer) { finishTyping(); return; }
    advance();
  }

  /* ---------- 选项 ---------- */
  function showChoices(list) {
    var box = $('#choices');
    box.innerHTML = '';
    box.style.bottom = $('#dialog').offsetHeight + 'px';
    list.forEach(function (c, idx) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice';
      b.style.animationDelay = (idx * 0.08) + 's';
      b.textContent = fmt(c.t);
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        choose(c);
      });
      box.appendChild(b);
    });
    box.hidden = false;
    locked = true;
    $('#next-indicator').classList.remove('show');
  }

  function choose(c) {
    var box = $('#choices');
    if (box.hidden) return;
    box.hidden = true;
    box.innerHTML = '';
    locked = false;
    applyFx(c.fx);
    var sc = SCENES[state.scene];
    var target = resolveNext(c.next || sc.next);
    playLines(c.lines, function () { if (target) enterScene(target); });
  }

  function applyFx(fx) {
    if (!fx) return;
    Object.keys(fx).forEach(function (k) {
      state.stats[k] = (state.stats[k] || 0) + fx[k];
      var c = CHARACTERS[k];
      if (c && fx[k] > 0) toast('💗 ' + c.name + ' 的羁绊 +' + fx[k]);
    });
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    $('#toast-area').appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2300);
  }

  /* ---------- 档案卡 ---------- */
  function showCard(id) {
    var c = CHARACTERS[id] || {};
    $('#card-emoji').textContent = emojiOf(c);
    $('#card-name').textContent = c.name || '';
    $('#card-tag').textContent = c.tag || '';
    $('#card-desc').textContent = c.desc || '';
    $('#card').hidden = false;
    locked = true;
  }
  function closeCard(ev) {
    ev.stopPropagation();
    $('#card').hidden = true;
    locked = false;
    advance();
  }

  /* ---------- 菜单 ---------- */
  function openMenu(ev) {
    ev.stopPropagation();
    $('#menu').hidden = false;
  }
  function closeMenu(ev) {
    if (ev) ev.stopPropagation();
    $('#menu').hidden = true;
  }
  function updateSpeedLabel() {
    $('#menu-speed').textContent = '文字速度：' + SPEEDS[speedIdx].label;
  }

  /* ---------- 结局 ---------- */
  function showEnding(id) {
    var e = ENDINGS[id];
    var got = getEndings();
    var isNew = got.indexOf(id) < 0;
    if (isNew) { got.push(id); store(ENDING_KEY, got); }
    removeKey(SAVE_KEY);
    stopTyping();

    $('#screen-ending').classList.toggle('heaven', !!e.special);
    $('#ending-new').hidden = !isNew;
    $('#ending-title').textContent = '「' + e.title + '」';
    $('#ending-route').textContent = e.route;
    $('#ending-desc').textContent = fmt(e.desc);
    $('#ending-ps').textContent = e.special ? '' : ENDING_POSTSCRIPT;
    $('#ending-ps').hidden = !!e.special;
    var total = Object.keys(ENDINGS).length;
    $('#ending-count').textContent = '已收集结局 ' + got.length + ' / ' + total +
      (got.length < total ? '　试试不同的选择吧～' : '　全部收集完成！');
    showScreen('ending');
  }

  function renderGallery() {
    var got = getEndings();
    var ids = Object.keys(ENDINGS);
    $('#gallery-progress').textContent = '已收集 ' + got.length + ' / ' + ids.length;
    var ul = $('#gallery-list');
    ul.innerHTML = '';
    ids.forEach(function (id) {
      var e = ENDINGS[id];
      var open = got.indexOf(id) >= 0;
      var li = document.createElement('li');
      li.className = 'gallery-item' + (open ? '' : ' locked') + (e.special ? ' special' : '');
      var r = document.createElement('div');
      r.className = 'gi-route';
      r.textContent = e.route;
      var t = document.createElement('div');
      t.className = 'gi-title';
      t.textContent = open ? e.title : '？？？？';
      var d = document.createElement('div');
      d.className = 'gi-desc';
      d.textContent = open ? fmt(e.desc) : (e.special ? '也许……不跟任何人走？' : '尚未解锁');
      li.appendChild(r);
      li.appendChild(t);
      li.appendChild(d);
      ul.appendChild(li);
    });
  }

  /* ---------- 开始 / 继续 ---------- */
  function resetStage() {
    stopTyping();
    queue = [];
    onQueueEnd = null;
    locked = false;
    currentBg = null;
    currentChars = [];
    showCat = true;
    $('#choices').hidden = true;
    $('#card').hidden = true;
    $('#menu').hidden = true;
    $('#text').textContent = '';
    $('#toast-area').innerHTML = '';
  }

  function startNew(gender) {
    state = { gender: gender === 'f' ? 'f' : 'm', scene: null, stats: {} };
    resetStage();
    showScreen('game');
    enterScene(START_SCENE);
  }

  function continueGame() {
    var s = getSave();
    if (!s) { refreshTitle(); return; }
    state = { gender: s.gender === 'f' ? 'f' : 'm', scene: s.scene, stats: s.stats || {} };
    resetStage();
    showScreen('game');
    enterScene(s.scene);
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    $('#btn-new').addEventListener('click', function () {
      if (getSave() && !window.confirm('开始新故事会覆盖当前存档，确定吗？')) return;
      showScreen('gender');
    });
    $('#btn-continue').addEventListener('click', continueGame);
    $('#btn-gallery').addEventListener('click', function () { showScreen('gallery'); });
    $('#btn-gender-back').addEventListener('click', function () { showScreen('title'); });
    var cards = document.querySelectorAll('.gender-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function () { startNew(this.getAttribute('data-gender')); });
    }

    $('#screen-game').addEventListener('click', onTap);
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
      showScreen('title');
    });

    $('#ending-again').addEventListener('click', function () { showScreen('title'); });
    $('#ending-gallery').addEventListener('click', function () { showScreen('gallery'); });
    $('#gallery-back').addEventListener('click', function () { showScreen('title'); });

    // 电脑上也能用空格 / 回车推进
    document.addEventListener('keydown', function (ev) {
      if (!$('#screen-game').classList.contains('active')) return;
      if (!$('#menu').hidden) return;
      if (ev.key === ' ' || ev.key === 'Enter') {
        if (!$('#card').hidden) { closeCard(ev); ev.preventDefault(); return; }
        if (locked) return; // 选项按钮自身处理回车
        ev.preventDefault();
        onTap();
      }
    });
  }

  function init() {
    var sp = load(SPEED_KEY, 1);
    speedIdx = typeof sp === 'number' && SPEEDS[sp] ? sp : 1;
    updateSpeedLabel();
    bind();
    showScreen('title');
  }

  // 暴露少量接口，方便调试
  window.TuanziGame = { state: function () { return state; }, goto: enterScene };

  init();
})();
