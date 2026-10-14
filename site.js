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
// Disabled under reduced motion. Touch scrolling is already smooth, and a
// preventDefault wheel hijack there fights the intro, so coarse pointers
// keep the browser's own scroll.
//
// Chromium applies `html { scroll-behavior: smooth }` to scrollTo() when
// the behavior is "auto", so a per-frame lerp stacked a second animation
// and the synchronous scroll event (raf already cleared) snapped `target`
// back to the in-between position. The page then barely moved. Jumps here
// are instant; CSS smooth-scroll stays for anchor links only.
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;
  var target = window.scrollY, current = target, raf = 0, animating = false;
  function jump(y) {
    window.scrollTo({ left: 0, top: y, behavior: "instant" });
  }
  function tick() {
    current += (target - current) * 0.12;
    if (Math.abs(target - current) < 0.5) {
      current = target;
      jump(current);
      animating = false;
      raf = 0;
      return;
    }
    jump(current);
    raf = requestAnimationFrame(tick);
  }
  window.addEventListener("wheel", function (e) {
    if (e.ctrlKey || e.metaKey) return; // leave pinch-zoom alone
    var max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    var dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= window.innerHeight;
    target = Math.max(0, Math.min(max, target + dy * 1.1));
    if (!raf) {
      animating = true;
      raf = requestAnimationFrame(tick);
    }
    e.preventDefault();
  }, { passive: false });
  function stopTo(y) {
    animating = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    target = current = y;
  }
  window.addEventListener("scroll", function () {
    if (!animating) {
      target = current = window.scrollY;
      return;
    }
    // Scrollbar or keyboard moved the page out from under the lerp.
    if (Math.abs(window.scrollY - current) > 2) stopTo(window.scrollY);
  }, { passive: true });
  window.addEventListener("touchstart", function () {
    stopTo(window.scrollY);
  }, { passive: true });
  window.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k === " " || k === "ArrowUp" || k === "ArrowDown" || k === "PageUp" || k === "PageDown" || k === "Home" || k === "End") {
      stopTo(window.scrollY);
    }
  }, { passive: true });
})();

// Scroll hint: a quiet pill that surfaces after 6s without scrolling and
// hides on the next scroll, wheel, touch, or key. Only on pages that can
// actually scroll. All pages share this file, so all pages get the hint.
(function () {
  var hint = document.createElement("div");
  hint.className = "scroll-hint";
  hint.setAttribute("aria-hidden", "true");
  var label = document.createElement("span");
  label.textContent = "scroll";
  var chev = document.createElement("i");
  hint.appendChild(label);
  hint.appendChild(chev);
  document.body.appendChild(hint);
  var timer = 0, visible = false;
  function pageable() {
    return document.documentElement.scrollHeight > window.innerHeight + 60;
  }
  function show() {
    if (!visible && pageable()) {
      visible = true;
      hint.classList.add("show");
    }
  }
  function hide() {
    visible = false;
    hint.classList.remove("show");
  }
  function arm() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(show, 6000);
  }
  ["wheel", "touchmove", "keydown", "scroll"].forEach(function (ev) {
    window.addEventListener(ev, function () { hide(); arm(); }, { passive: true });
  });
  arm();
})();
