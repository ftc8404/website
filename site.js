// Shared: active nav, footer year, reveal-on-scroll (motion-safe).
(function () {
  var path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("nav.main a").forEach(function (a) {
    if (a.getAttribute("href") === path) a.setAttribute("aria-current", "page");
  });
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
  // If the 3D intro never boots (blocked CDN), don't trap the chrome hidden.
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (!document.querySelector("#gl canvas")) {
        document.body.classList.add("intro-done");
        document.body.classList.remove("in-intro");
      }
    }, 6000);
  });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.style.opacity = "1";
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".card").forEach(function (el) {
    el.style.opacity = "0";
    el.style.transition = "opacity .5s ease";
    io.observe(el);
  });
})();

// Buttery wheel scrolling: eased window scroll that still uses the real
// scrollbar, so sticky scenes, anchors, and keyboard/touch stay native.
// Disabled under reduced motion; touch scrolling is already smooth.
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var target = window.scrollY, current = target, raf = 0;
  function tick() {
    raf = 0;
    current += (target - current) * 0.12;
    if (Math.abs(target - current) < 0.5) {
      current = target;
      window.scrollTo(0, current);
      return;
    }
    window.scrollTo(0, current);
    raf = requestAnimationFrame(tick);
  }
  window.addEventListener("wheel", function (e) {
    if (e.ctrlKey) return; // leave pinch-zoom alone
    var max = document.documentElement.scrollHeight - window.innerHeight;
    target = Math.max(0, Math.min(max, target + e.deltaY * 1.1));
    if (!raf) raf = requestAnimationFrame(tick);
    e.preventDefault();
  }, { passive: false });
  window.addEventListener("scroll", function () {
    if (!raf) target = current = window.scrollY;
  });
})();
