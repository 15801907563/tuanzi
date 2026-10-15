/*
 * 团子的喵生选择 —— 图片资源层
 *
 * 规则：有图用图，没图自动回退到 CSS 渐变 / emoji。缺图不会报错，游戏永远可运行。
 * 用法：把图片按下面的路径丢进 img/ 目录就行，不用改任何代码。
 *
 *   img/bg/<背景名>.jpg       16 个背景名 = story.js 里各场景的 bg 字段
 *   img/char/<文件名>.png     透明背景立绘，主体底部对齐画布下边缘
 *   img/end/<结局id>.jpg      结局插画，9 个 id = story.js 里 ENDINGS 的键
 *   img/ui/title.jpg          标题页主视觉
 *   img/ui/gender_m.png       性别选择卡片（公猫）
 *   img/ui/gender_f.png       性别选择卡片（母猫）
 *
 * 扩展名按下面 ext 的顺序依次尝试，jpg / webp / png 都认。
 */
var ASSETS = {

  // 总开关。设 false 就强制全部走渐变+emoji，方便对比效果
  enabled: true,

  base: 'img/',

  ext: {
    bg:   ['webp', 'jpg', 'png'],
    char: ['webp', 'png'],
    end:  ['webp', 'jpg', 'png'],
    ui:   ['webp', 'jpg', 'png']
  },

  /*
   * 已有文件清单（相对 base 的路径）。列了之后只认列表里的文件，不发探测请求，
   * 微信里加载更快、控制台也没有 404。
   * 以后新增图片：要么把文件名加进来，要么把 manifest 改成 null 回到自动探测。
   * 原图备份在 art_src/，img/ 里是压缩后的 WebP（人物已抠成透明底）。
   */
  manifest: [
    'bg/cafe.webp', 'bg/dusk.webp', 'bg/heaven.webp', 'bg/home.webp', 'bg/hospital.webp', 'bg/luxury.webp',
    'bg/newyear.webp', 'bg/night.webp', 'bg/oldhouse.webp', 'bg/park.webp', 'bg/rain.webp', 'bg/room.webp',
    'bg/shop.webp', 'bg/snow.webp', 'bg/stage.webp', 'bg/studio.webp',
    'char/cat_belly.webp', 'char/cat_carry.webp', 'char/cat_hiss.webp', 'char/cat_idle.webp', 'char/cat_knead.webp',
    'char/cat_old.webp', 'char/cat_paw.webp', 'char/cat_sleep.webp', 'char/cat_tilt.webp',
    'char/duoduo.webp', 'char/grandma_bed.webp', 'char/grandma_heaven.webp', 'char/grandma_home.webp',
    'char/gu.webp', 'char/gu_soft.webp', 'char/human_f.webp', 'char/human_m.webp', 'char/li.webp', 'char/li_old.webp',
    'char/lin.webp', 'char/lin_smile.webp', 'char/neighbor.webp', 'char/son.webp', 'char/su.webp', 'char/su_cry.webp',
    'char/zhang.webp', 'char/zhang_softsmile.webp',
    'end/gu_a.webp', 'end/gu_b.webp', 'end/heaven_m.webp', 'end/heaven_f.webp', 'end/lin_a.webp', 'end/lin_b.webp',
    'end/su_a.webp', 'end/su_b.webp', 'end/zhang_a.webp', 'end/zhang_b.webp',
    'ui/title.webp'
  ],

  /*
   * 立绘显示方式
   *   scale : 相对“标准成人身高”的比例（小孩矮、半身像要缩）
   *   framed: 带背景的照片式立绘（比如病床上的奶奶），用相框样式展示，不抠图
   */
  spriteScale: {
    duoduo: 0.6, grandma_home: 0.8, grandma_heaven: 0.8, li: 0.6, li_old: 0.6,
    zhang: 0.86, zhang_softsmile: 0.86, neighbor: 0.82, su: 0.86, su_cry: 0.86,
    gu: 0.9, gu_soft: 0.9, lin: 0.92, lin_smile: 0.92, son: 0.9, human_m: 0.88, human_f: 0.86
  },
  framed: ['grandma_bed'],

  /*
   * 团子的姿态：选项或旁白里出现这些字眼，团子就自动换成对应的立绘。
   * 顺序即优先级。下一幕开始时恢复默认姿态。
   */
  catPoses: [
    { file: 'cat_hiss',  re: /哈——|虎牙|炸毛|哈气/ },
    { file: 'cat_belly', re: /肚皮|躺平|四脚朝天|装死|打了个滚|打个滚|翻个身|摊成/ },
    { file: 'cat_sleep', re: /团成一团|打起小呼噜|呼噜呼噜|入睡|打盹|继续睡|睡着|窝里一躺|蜷/ },
    { file: 'cat_knead', re: /踩奶|踩，踩|踩着/ },
    { file: 'cat_carry', re: /叼/ },
    { file: 'cat_paw',   re: /爪子|握手|右爪|肉垫|按在|盖章|扒拉|拍飞|拍倒/ },
    { file: 'cat_tilt',  re: /歪头|眨眼|眨巴|盯着|对视|挺起胸/ }
  ],

  // 每个角色的默认立绘文件名（不含扩展名）。{g} 会替换成 m / f
  charFile: {
    cat:      'cat_idle',
    human:    'human_{g}',
    grandma:  'grandma_home',
    li:       'li',
    oldli:    'li_old',
    lin:      'lin',
    su:       'su',
    zhang:    'zhang',
    gu:       'gu',
    neighbor: 'neighbor',
    duoduo:   'duoduo',
    son:      'son'
  },

  /*
   * 按场景或背景自动换立绘。命中规则就优先用这张，
   * 这张图还没出的话，自动退回上面的默认立绘。
   * 所以你可以只出 grandma_home.png，病床和天堂的版本以后再补。
   */
  poseRules: {
    grandma: [
      { bg: ['hospital', 'snow'], file: 'grandma_bed' },
      { bg: ['heaven'],           file: 'grandma_heaven' }
    ],
    cat: [
      { scene: ['wait_r5'], file: 'cat_old' }
    ],
    lin:   [ { scene: ['lin_end_a', 'lin_end_b'],       file: 'lin_smile' } ],
    su:    [ { scene: ['su_r2'],                        file: 'su_cry' } ],
    zhang: [ { scene: ['zhang_end_a', 'zhang_end_b'],   file: 'zhang_softsmile' } ],
    gu:    [ { scene: ['gu_r3', 'gu_end_a', 'gu_end_b'], file: 'gu_soft' } ]
  },

  /*
   * 给单独某一幕换背景图（场景id: 文件名）。没这张图就退回该场景的通用背景。
   * 下面两条是之前提到的复用冲突：night 同时当林默出租屋和糖糖卧室，
   * home 同时当序章窗台和十八年后的午后。想拆开就出这两张图，不想拆就别管。
   */
  sceneBg: {
    su_r2:   'night_su',
    wait_r5: 'home_shop'
  }
};


var Assets = (function () {
  'use strict';

  var DIRS = { bg: 'bg/', char: 'char/', end: 'end/', ui: 'ui/' };
  var cache = {};     // 候选组 -> 命中的 url 或 null
  var waiting = {};   // 探测中的回调队列
  var manifestSet = null;
  var gender = 'm';

  function noop() {}

  function fill(name) { return String(name).replace('{g}', gender); }

  function norm(p) { return String(p).replace(/^\.?\//, ''); }

  function buildManifest() {
    if (manifestSet || !ASSETS.manifest) return;
    manifestSet = {};
    ASSETS.manifest.forEach(function (p) {
      var v = norm(p);
      manifestSet[v] = true;
      // 清单里写 'bg/shop.jpg' 或 'img/bg/shop.jpg' 都认
      if (v.indexOf(norm(ASSETS.base)) !== 0) manifestSet[norm(ASSETS.base + v)] = true;
    });
  }

  // 把若干候选文件名（不含扩展名）展开成完整 url 列表
  function candidates(kind, names) {
    var exts = ASSETS.ext[kind] || ['png'];
    var dir = DIRS[kind] || '';
    var out = [];
    names.forEach(function (n) {
      if (!n) return;
      exts.forEach(function (ext) { out.push(ASSETS.base + dir + n + '.' + ext); });
    });
    return out;
  }

  // 依次尝试候选，第一个能加载的就是结果；全都没有则返回 null
  function resolve(urls, cb) {
    if (!ASSETS.enabled || !urls.length) { cb(null); return; }

    var key = urls.join('|');
    if (key in cache) { cb(cache[key]); return; }

    if (ASSETS.manifest) {
      buildManifest();
      var hit = null;
      for (var i = 0; i < urls.length; i++) {
        if (manifestSet[norm(urls[i])]) { hit = urls[i]; break; }
      }
      cache[key] = hit;
      cb(hit);
      return;
    }

    if (waiting[key]) { waiting[key].push(cb); return; }
    waiting[key] = [cb];

    var idx = 0;
    function finish(url) {
      cache[key] = url;
      var list = waiting[key];
      delete waiting[key];
      list.forEach(function (f) { try { f(url); } catch (e) { /* 单个回调出错不影响其他 */ } });
    }
    function step() {
      if (idx >= urls.length) { finish(null); return; }
      var url = urls[idx++];
      var im = new Image();
      im.onload = function () { if (im.naturalWidth) finish(url); else step(); };
      im.onerror = step;
      im.src = url;
    }
    step();
  }

  function bgNames(name, sceneId) {
    var alias = sceneId && ASSETS.sceneBg ? ASSETS.sceneBg[sceneId] : null;
    return [alias, name];
  }

  function charNames(id, sceneId) {
    var names = [];
    var rules = ASSETS.poseRules ? ASSETS.poseRules[id] : null;
    var sc = (typeof SCENES !== 'undefined' && sceneId) ? SCENES[sceneId] : null;
    var bg = sc ? sc.bg : null;
    if (rules) {
      rules.forEach(function (r) {
        var byScene = r.scene && sceneId && r.scene.indexOf(sceneId) >= 0;
        var byBg = r.bg && bg && r.bg.indexOf(bg) >= 0;
        if (byScene || byBg) names.push(fill(r.file));
      });
    }
    if (ASSETS.charFile[id]) names.push(fill(ASSETS.charFile[id]));
    return names;
  }

  // 真正把图下载进浏览器缓存（清单模式下 resolve 不发请求，所以要单独拉）
  var preloaded = {};
  function preload(url) {
    if (!url || preloaded[url]) return;
    var im = new Image();
    im.decoding = 'async';
    im.src = url;
    preloaded[url] = im;
  }
  function warmUrl(cb) { return function (url) { preload(url); if (cb) cb(url); }; }

  // 预热：提前把某一幕会用到的图塞进浏览器缓存，避免切场景时闪一下
  function warmScene(id) {
    var sc = (typeof SCENES !== 'undefined') ? SCENES[id] : null;
    if (!sc) return;
    var w = warmUrl();
    resolve(candidates('bg', bgNames(sc.bg, id)), w);
    (sc.lines || []).forEach(function (l) { if (!Array.isArray(l) && l.bg) resolve(candidates('bg', [l.bg]), w); });
    if (sc.ending) resolve(candidates('end', [sc.ending + '_' + gender, sc.ending]), w);

    var ids = (sc.noCat ? [] : ['cat']).concat(sc.chars || []);
    (sc.lines || []).forEach(function (l) {
      if (!Array.isArray(l) && l.chars) ids = ids.concat(l.chars);
    });
    var seen = {};
    ids.forEach(function (c) {
      if (!c || seen[c]) return;
      seen[c] = 1;
      resolve(candidates('char', charNames(c, id)), w);
    });
  }

  // 预热当前场景的所有下一跳（含各个选项的去向）
  function warmNext(id) {
    var sc = (typeof SCENES !== 'undefined') ? SCENES[id] : null;
    if (!sc) return;
    var targets = {};
    function add(n) {
      if (!n) return;
      if (typeof n === 'string') { targets[n] = 1; return; }
      add(n.a); add(n.b);
    }
    add(sc.next);
    (sc.choices || []).forEach(function (c) { add(c.next || sc.next); });
    Object.keys(targets).forEach(warmScene);
  }

  return {
    setGender: function (g) { gender = g === 'f' ? 'f' : 'm'; },
    bg:      function (name, sceneId, cb) { resolve(candidates('bg', bgNames(name, sceneId)), cb); },
    sprite:  function (id, sceneId, cb) { resolve(candidates('char', charNames(id, sceneId)), cb); },
    spriteFile: function (name, cb) { resolve(candidates('char', [fill(name)]), cb); },
    // 结局插画优先找带性别后缀的版本（heaven_m / heaven_f），没有再用通用的
    ending:  function (id, cb) { resolve(candidates('end', [id + '_' + gender, id]), cb); },
    ui:      function (name, cb) { resolve(candidates('ui', [name]), cb); },
    // 场景规则里是否给这个角色指定了专属立绘（有的话就不做姿态切换，比如老年团子）
    hasRule: function (id, sceneId) { return charNames(id, sceneId).length > 1; },
    nameOf:  function (url) { return url ? url.split('/').pop().replace(/\.[a-z]+$/i, '') : ''; },
    preload: preload,
    warmCatPoses: function () {
      (ASSETS.catPoses || []).forEach(function (p) { resolve(candidates('char', [p.file]), warmUrl()); });
    },
    warmScene: warmScene,
    warmNext: warmNext
  };
})();
