"""Smallest focused regression check: every page serves and every local
image it references resolves. Stdlib only. Usage:
python3 tests/check_site.py [base_url]  (default http://localhost:8404)
"""
import re
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8404"
PAGES = ["index.html", "robots.html", "team.html", "awards.html", "contact.html"]
IMG_RE = re.compile(r'<img[^>]+src="([^"]+)"')
JS_RE = re.compile(r'<script[^>]+src="([^"]+)"')


def get(path):
    with urllib.request.urlopen(BASE + "/" + path, timeout=10) as r:
        assert r.status == 200, f"{path}: HTTP {r.status}"
        return r.read().decode("utf-8", "replace")


def main():
    failures = []
    for page in PAGES:
        try:
            html = get(page)
        except Exception as e:  # noqa: BLE001
            failures.append(f"{page}: {e}")
            continue
        for src in IMG_RE.findall(html) + JS_RE.findall(html):
            if src.startswith(("http", "data:")):
                continue
            try:
                get(src)
            except Exception as e:  # noqa: BLE001
                failures.append(f"{page} -> {src}: {e}")
    # Intro chrome gate: header must be hidden from first paint, so the
    # inline js-intro marker and its CSS gate must both exist.
    try:
        index = get("index.html")
        css = get("styles.css")
        if 'document.documentElement.className += " js-intro"' not in index:
            failures.append("index.html: missing js-intro first-paint marker")
        if "html.js-intro body:not(.intro-done)" not in css:
            failures.append("styles.css: missing js-intro chrome gate")
        if "position: fixed; top: 0; left: 0; right: 0;" not in css:
            failures.append("styles.css: intro chrome must leave the flow (no top gap)")
        # No layout may change at the intro boundary: banner lives below the
        # hero on index, and the chrome reveal is latched with hysteresis.
        if '<body class="home">' not in index:
            failures.append("index.html: body must carry .home for fixed chrome")
        for page in PAGES:
            if "interest-banner" in get(page):
                failures.append(f"{page}: recruitment banner must be gone")
        logo = get("assets/logo.svg")
        import xml.etree.ElementTree as ET
        try:
            root = ET.fromstring(logo)
        except ET.ParseError as e:
            failures.append(f"assets/logo.svg: invalid XML: {e}")
            root = None
        if root is not None:
            if not root.tag.endswith("svg"):
                failures.append("assets/logo.svg: root must be <svg>")
            if root.get("viewBox") != "0 0 500 500":
                failures.append("assets/logo.svg: viewBox must be 0 0 500 500")
            paths = [el for el in root.iter() if el.tag.endswith("path")]
            if not any("C" in (p.get("d") or "") for p in paths):
                failures.append("assets/logo.svg: needs smooth curve data (no C commands)")
            for p in paths:
                try:
                    w = float((p.get("stroke-width") or "0").strip())
                except ValueError:
                    w = 0
                if w >= 5:
                    failures.append("assets/logo.svg: fat stroked segments are not a logo trace")
        hero = get("hero.js")
        if 'toggle("in-intro"' in hero:
            failures.append("hero.js: chrome reveal must be latched, not toggled")
        if "p < 0.985" not in hero or "p >= 0.999" not in hero:
            failures.append("hero.js: chrome reveal needs hysteresis band")
        # Beams must yield brightness at the finale instead of stacking into
        # clipped glare: the blue shaft tapers as the logo condenses.
        if "(1 - logoIn" not in hero:
            failures.append("hero.js: blue beam must taper as the logo reveals")
        # The 2D backdrop must not couple to scroll (modulo parallax snaps),
        # and the intro's own 3D field must continue past the stage.
        bg = get("plexus-bg.js")
        if "scrollY" in bg:
            failures.append("plexus-bg.js: backdrop must not follow scroll")
        if "overRaw" not in hero or "logoIn * (1 - om)" not in hero:
            failures.append("hero.js: 3D plexus must persist past the stage")
        if "OutputPass" not in hero:
            failures.append("hero.js: composer needs OutputPass (tone map beams)")
        # Fallback must say why (reduced-motion vs exception) or Windows
        # failures can't be diagnosed from the outside.
        if "__heroFallbackReason" not in hero:
            failures.append("hero.js: fallback must record its reason")
        # Owner decision: the intro always plays; fleet-default
        # reduced-motion must never gate it again.
        if "prefers-reduced-motion" in hero:
            failures.append("hero.js: intro must not gate on reduced-motion")
        # The fox reveal must play out slowly across the dive, not pop.
        if "sstep(p, 0.78, 1.0)" not in hero:
            failures.append("hero.js: logo reveal window must be the slow one")
        # Perf: links rebuild on alternate frames, points outside the
        # camera frustum are skipped (not deleted).
        if "linkFrame" not in hero or "Frustum" not in hero:
            failures.append("hero.js: lazy link/point evaluation missing")
        # Beams must billboard (one surface each) and every page shares
        # the idle scroll hint.
        if "makeBasis" not in hero:
            failures.append("hero.js: beams must be camera billboards")
        site = get("site.js")
        if "scroll-hint" not in site:
            failures.append("site.js: idle scroll hint missing")
        # Mouse/trackpad wheel scrolling is eased. Touch stays native.
        if "e.deltaY" not in site or "passive: false" not in site:
            failures.append("site.js: eased wheel scrolling missing")
        if "(pointer: coarse)" not in site:
            failures.append("site.js: wheel easing must not hijack touch")
        # The WebGL hero tells the 2D backdrop when it is covering the page,
        # and both loops stop while the tab is hidden.
        if 'CustomEvent("hero-live"' not in hero:
            failures.append("hero.js: must dispatch hero-live")
        if "document.hidden" not in hero:
            failures.append("hero.js: must pause while the tab is hidden")
        perf_at = hero.find("window.__perf")
        debug_at = hero.rfind("if (debug)", 0, perf_at if perf_at >= 0 else 0)
        if perf_at < 0 or debug_at < 0 or perf_at - debug_at > 600:
            failures.append("hero.js: __perf must be debug-gated")
        beat_at = hero.find('get("beat")')
        beat_debug = hero.rfind("if (debug)", 0, beat_at if beat_at >= 0 else 0)
        if beat_at < 0 or beat_debug < 0 or beat_at - beat_debug > 200:
            failures.append("hero.js: ?beat= preview must be debug-gated")
        if "hero-live" not in bg:
            failures.append("plexus-bg.js: must follow hero-live")
        if "visibilitychange" not in bg:
            failures.append("plexus-bg.js: must pause while hidden")
        draws_at = bg.find("window.__bgDraws")
        if draws_at >= 0:
            draws_debug = bg.rfind("debug", 0, draws_at)
            if draws_debug < 0 or draws_at - draws_debug > 250:
                failures.append("plexus-bg.js: __bgDraws must be debug-gated")
    except Exception as e:  # noqa: BLE001
        failures.append(f"chrome gate: {e}")
    if failures:
        print("FAIL")
        print("\n".join(failures))
        sys.exit(1)
    print(f"OK: {len(PAGES)} pages, all local images and scripts resolve")


if __name__ == "__main__":
    main()
