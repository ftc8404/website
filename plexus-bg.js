// Site-wide plexus backdrop: faint white nodes + hairlines on black.
// Dependency-free 2D canvas, fixed behind all content. Single static frame
// under prefers-reduced-motion.
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
  var W = 0, H = 0, nodes = [];

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
      });
    }
  }
  build();
  var rT = null;
  window.addEventListener("resize", function () {
    clearTimeout(rT);
    rT = setTimeout(build, 200);
  });

  function draw(t) {
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
    ctx.lineWidth = 1;
    for (i = 0; i < nodes.length; i++) {
      for (j = i + 1; j < nodes.length; j++) {
        var a = nodes[i], b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK) {
          ctx.strokeStyle = "rgba(255,255,255," + (0.09 * (1 - d / LINK)).toFixed(3) + ")";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    for (i = 0; i < nodes.length; i++) {
      var p = nodes[i];
      var tw = reduced ? 0.35 : 0.3 + 0.1 * Math.sin(t / 1600 + p.tw);
      ctx.fillStyle = "rgba(255,255,255," + tw.toFixed(3) + ")";
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    for (i = 0; i < nodes.length; i++) {
      var q = nodes[i];
      ctx.fillText("(" + q.x.toFixed(2) + "," + q.y.toFixed(2) + ")", q.x + 6, q.y - 6);
    }
    if (!reduced) requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
