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
