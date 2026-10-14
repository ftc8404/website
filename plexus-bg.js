// Site-wide plexus backdrop: faint white nodes + hairlines on black.
// Dependency-free 2D canvas, fixed behind all content. Single static frame
// under prefers-reduced-motion. On the homepage the opaque WebGL hero
// covers this canvas; hero.js announces that with a "hero-live" event and
// this loop stops until a fallback says the hero is gone.
(function () {
  var cv = document.createElement("canvas");
  cv.id = "bg-plexus";
  cv.setAttribute("aria-hidden", "true");
  document.body.prepend(cv);
  var ctx = cv.getContext("2d");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mobile = window.matchMedia("(max-width: 760px)").matches;
  var COUNT = mobile ? 45 : 90;
  var LINK = mobile ? 130 : 150;
  var LINK2 = LINK * LINK;
  var W = 0, H = 0, nodes = [];
  var heroLive = false, pageHidden = false, rafId = 0;
  var debug = /(?:[?&])debug(?:[=&]|$)/.test(location.search);
  if (debug) window.__bgDraws = 0;
  // Eight prebuilt alphas. Setting strokeStyle from a fresh string every
  // segment was a per-frame allocation on top of the pair walk.
  var strokes = [];
  for (var s = 0; s < 8; s++) {
    strokes.push("rgba(255,255,255," + (0.09 * (1 - s / 8)).toFixed(3) + ")");
  }
  var dotStyle = "rgba(255,255,255,0.38)";

  function build() {
    W = cv.width = Math.floor(window.innerWidth);
    H = cv.height = Math.floor(window.innerHeight);
    nodes = [];
    for (var i = 0; i < COUNT; i++) {
      nodes.push({
        x: Math.random() * (W + 200) - 100,
        y: Math.random() * (H + 200) - 100,
        vx: (Math.random() - 0.5) * 0.02,
        vy: (Math.random() - 0.5) * 0.02,
        tw: Math.random() * Math.PI * 2,
        label: "",
      });
    }
  }
  build();
  var rT = null;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(build, 200);
  });

  // Grid is rebuilt with the canvas. Cell == link distance, so pairs only
  // live in neighboring cells.
  var cols = 1, rows = 1, head = new Int32Array(1), next = new Int32Array(COUNT);
  function linkCells() {
    cols = Math.max(1, Math.ceil((W + 2 * LINK) / LINK));
    rows = Math.max(1, Math.ceil((H + 2 * LINK) / LINK));
    var n = cols * rows;
    if (head.length < n) head = new Int32Array(n);
    else head.fill(-1);
    head.fill(-1);
    for (var i = 0; i < nodes.length; i++) {
      var q = nodes[i];
      var cx = Math.max(0, Math.min(cols - 1, ((q.x + LINK) / LINK) | 0));
      var cy = Math.max(0, Math.min(rows - 1, ((q.y + LINK) / LINK) | 0));
      var id = cy * cols + cx;
      next[i] = head[id];
      head[id] = i;
    }
  }

  function draw(t) {
    rafId = 0;
    if (heroLive || pageHidden) return;
    if (debug) window.__bgDraws++;
    ctx.clearRect(0, 0, W, H);
    var i, j;
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!reduced) {
        if (n.fx === undefined) { n.fx = n.x; n.fy = n.y; }
        n.fx += n.vx;
        n.fy += n.vy;
        n.x = Math.round(n.fx * 100) / 100;
        n.y = Math.round(n.fy * 100) / 100;
        if (n.x < -110) n.x = W + 100;
        if (n.x > W + 110) n.x = -100;
        if (n.y < -110) n.y = H + 100;
        if (n.y > H + 110) n.y = -100;
      }
    }
    linkCells();
    ctx.lineWidth = 1;
    ctx.beginPath();
    var bucket = -1;
    for (i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      var ix = Math.max(0, Math.min(cols - 1, ((a.x + LINK) / LINK) | 0));
      var iy = Math.max(0, Math.min(rows - 1, ((a.y + LINK) / LINK) | 0));
      for (var ox = -1; ox <= 1; ox++) {
        var cx = ix + ox;
        if (cx < 0 || cx >= cols) continue;
        for (var oy = -1; oy <= 1; oy++) {
          var cy = iy + oy;
          if (cy < 0 || cy >= rows) continue;
          j = head[cy * cols + cx];
          while (j >= 0) {
            if (j > i) {
              var b = nodes[j];
              var dx = a.x - b.x, dy = a.y - b.y;
              var d2 = dx * dx + dy * dy;
              if (d2 < LINK2) {
                var d = Math.sqrt(d2);
                var bi = (d / LINK * 8) | 0;
                if (bi > 7) bi = 7;
                if (bi !== bucket) {
                  ctx.stroke();
                  ctx.beginPath();
                  ctx.strokeStyle = strokes[bi];
                  bucket = bi;
                }
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
              }
            }
            j = next[j];
          }
        }
      }
    }
    ctx.stroke();
    for (i = 0; i < nodes.length; i++) {
      var p = nodes[i];
      var tw = reduced ? 0.35 : 0.3 + 0.1 * Math.sin(t / 1600 + p.tw);
      ctx.fillStyle = "rgba(255,255,255," + tw.toFixed(3) + ")";
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillStyle = dotStyle;
    for (i = 0; i < nodes.length; i++) {
      var q = nodes[i];
      var label = "(" + q.x.toFixed(2) + "," + q.y.toFixed(2) + ")";
      q.label = label;
      ctx.fillText(label, q.x + 6, q.y - 6);
    }
    if (!reduced && !heroLive && !pageHidden) rafId = requestAnimationFrame(draw);
  }

  function poke() {
    pageHidden = document.hidden;
    if (reduced || heroLive || pageHidden) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      return;
    }
    if (!rafId) rafId = requestAnimationFrame(draw);
  }
  window.addEventListener("hero-live", function (e) {
    heroLive = !!(e.detail && e.detail.live);
    poke();
  });
  document.addEventListener("visibilitychange", poke);
  if (reduced) draw(0);
  else poke();
})();
