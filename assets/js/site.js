/**
 * Portfolio UI — vanilla JS.
 *
 * Responsibilities:
 * - Full-page sections: sync `.side-nav` / `.outer-nav` with `.main-content > li`
 * - Input: wheel (accumulated), keyboard ↑/↓, touch swipe on `#viewport`, nav clicks, header CTA
 * - Hamburger: toggles `.perspective--modalview` + animation classes; wheel is disabled while open
 * - Works area: three-slot carousel (left/center/right) via `.slider--prev` / `.slider--next`
 * - Contact: floating labels on `.work-request--information` inputs (blur + `has-value`)
 *
 * Custom events (document): `portfolio:nav-modal-opened`, `portfolio:nav-modal-closed` — reset wheel lock.
 */
(function () {
  "use strict";

  // --- Small DOM helpers (no external deps) ---

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  /** True while the 3D full-screen nav is open — using instead outer-nav.is-vis (can desync). */
  function isFullPageNavModalOpen() {
    var p = qs(".perspective");
    return !!(p && p.classList.contains("perspective--modalview"));
  }

  /** Map WheelEvent to pixels (handles deltaMode for lines/pages). */
  function normalizeWheelDeltaY(e) {
    var dy = e.deltaY !== undefined ? e.deltaY : 0;
    if (e.deltaMode === 1) dy *= 16;
    if (e.deltaMode === 2) dy *= 400;
    return dy;
  }

  // --- Section index: keep side + outer nav lists in sync with active section ---

  function updateNavs(nextPos) {
    qsa(".side-nav li").forEach(function (el) {
      el.classList.remove("is-active");
    });
    qsa(".outer-nav li").forEach(function (el) {
      el.classList.remove("is-active");
    });
    var side = qsa(".side-nav li");
    var outer = qsa(".outer-nav li");
    if (side[nextPos]) side[nextPos].classList.add("is-active");
    if (outer[nextPos]) outer[nextPos].classList.add("is-active");
  }

  /**
   * Show one `.main-content > li`, add transition hints (next/prev), toggle header CTA on middle sections.
   */
  function updateContent(curPos, nextPos, lastItem) {
    var main = qs(".main-content");
    if (!main) return;

    qsa(".main-content > li").forEach(function (li) {
      li.classList.remove("section--is-active");
    });
    var nextLi = main.children[nextPos];
    if (nextLi) nextLi.classList.add("section--is-active");

    qsa(".main-content > li > *").forEach(function (inner) {
      inner.classList.remove("section--next", "section--prev");
    });

    if (
      (curPos === lastItem && nextPos === 0) ||
      (curPos === 0 && nextPos === lastItem)
    ) {
      qsa(".main-content > li > *").forEach(function (inner) {
        inner.classList.remove("section--next", "section--prev");
      });
    } else if (curPos < nextPos) {
      var curLi = main.children[curPos];
      if (curLi && curLi.firstElementChild) {
        curLi.firstElementChild.classList.add("section--next");
      }
    } else {
      var curLi2 = main.children[curPos];
      if (curLi2 && curLi2.firstElementChild) {
        curLi2.firstElementChild.classList.add("section--prev");
      }
    }

    var cta = qs(".header--cta");
    if (cta) {
      if (nextPos !== 0 && nextPos !== lastItem) cta.classList.add("is-active");
      else cta.classList.remove("is-active");
    }
  }

  /**
   * One vertical “step”: from wheel direction (number), keydown (38/40), or swipe pseudo-events.
   * Wraps at first/last section.
   */
  function updateHelper(param) {
    var side = qs(".side-nav");
    if (!side) return;

    var active = qs(".side-nav .is-active");
    var items = qsa(".side-nav li");
    var curPos = active ? items.indexOf(active) : 0;
    var lastItem = items.length - 1;
    var nextPos = 0;

    var down =
      (param && param.type === "swipeup") ||
      (param && param.keyCode === 40) ||
      (typeof param === "number" && param > 0);

    var up =
      (param && param.type === "swipedown") ||
      (param && param.keyCode === 38) ||
      (typeof param === "number" && param < 0);

    if (down) {
      if (curPos !== lastItem) {
        nextPos = curPos + 1;
        updateNavs(nextPos);
        updateContent(curPos, nextPos, lastItem);
      } else {
        nextPos = 0;
        updateNavs(nextPos);
        updateContent(curPos, nextPos, lastItem);
      }
    } else if (up) {
      if (curPos !== 0) {
        nextPos = curPos - 1;
        updateNavs(nextPos);
        updateContent(curPos, nextPos, lastItem);
      } else {
        nextPos = lastItem;
        updateNavs(nextPos);
        updateContent(curPos, nextPos, lastItem);
      }
    }
  }

  // --- Delegated clicks on `.side-nav` / `.outer-nav` ---

  function bindNavClicks() {
    function onNavClick(e) {
      var li = e.target.closest("li");
      if (!li || li.classList.contains("is-active")) return;

      var parent = li.parentElement;
      if (!parent) return;

      var siblings = qsa("li", parent);
      var curActive = qs(".is-active", parent);
      var curPos = curActive ? siblings.indexOf(curActive) : 0;
      var nextPos = siblings.indexOf(li);
      var lastItem = siblings.length - 1;

      updateNavs(nextPos);
      updateContent(curPos, nextPos, lastItem);
    }

    var sideNav = qs(".side-nav");
    var outerNav = qs(".outer-nav");
    if (sideNav) sideNav.addEventListener("click", onNavClick);
    if (outerNav) outerNav.addEventListener("click", onNavClick);
  }

  /** Header “Contact” jumps to the last section (same index as last nav item). */
  function bindCta() {
    qsa(".cta").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var side = qs(".side-nav");
        if (!side) return;
        var items = qsa(".side-nav li");
        var curActive = qs(".side-nav .is-active");
        var curPos = curActive ? items.indexOf(curActive) : 0;
        var lastItem = items.length - 1;
        var nextPos = lastItem;
        updateNavs(nextPos);
        updateContent(curPos, nextPos, lastItem);
      });
    });
  }

  /**
   * Wheel/trackpad: prevent default document scroll; accumulate deltaY until threshold, then one section change.
   * Idle reset clears partial accumulation; lock prevents rapid double-fires. Modal open skips handling.
   */
  function bindWheel() {
    var sectionChangeLocked = false;
    var lockTimer = null;
    var accumY = 0;
    var accumIdleTimer = null;

    var ACCUM_THRESHOLD = 50;
    var LOCK_MS = 400;
    var ACCUM_IDLE_RESET_MS = 180;

    function resetAccumOnly() {
      accumY = 0;
    }

    function resetWheelState() {
      accumY = 0;
      sectionChangeLocked = false;
      clearTimeout(lockTimer);
      clearTimeout(accumIdleTimer);
    }

    function onWheel(e) {
      if (isFullPageNavModalOpen()) {
        resetWheelState();
        return;
      }

      e.preventDefault();

      if (sectionChangeLocked) {
        return;
      }

      var dy = normalizeWheelDeltaY(e);

      clearTimeout(accumIdleTimer);
      accumIdleTimer = setTimeout(resetAccumOnly, ACCUM_IDLE_RESET_MS);

      accumY += dy;

      if (Math.abs(accumY) < ACCUM_THRESHOLD) {
        return;
      }

      var direction = accumY > 0 ? 1 : -1;
      accumY = 0;

      sectionChangeLocked = true;
      clearTimeout(lockTimer);
      lockTimer = setTimeout(function () {
        sectionChangeLocked = false;
      }, LOCK_MS);

      updateHelper(direction);
    }

    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("portfolio:nav-modal-closed", resetWheelState);
    document.addEventListener("portfolio:nav-modal-opened", resetWheelState);
  }

  /** Arrow up/down mirror one vertical section step (same as wheel). */
  function bindKeyboard() {
    document.addEventListener(
      "keydown",
      function (e) {
        if (isFullPageNavModalOpen()) {
          return;
        }
        if (e.keyCode === 38 || e.keyCode === 40) {
          e.preventDefault();
          updateHelper(e);
        }
      },
      false
    );
  }

  /** Simple swipe on `#viewport`: large vertical delta maps to swipeup/swipedown for `updateHelper`. */
  function bindTouchSwipe() {
    var viewport = qs("#viewport");
    if (!viewport) return;

    var startY = null;

    viewport.addEventListener(
      "touchstart",
      function (e) {
        if (e.changedTouches && e.changedTouches[0]) {
          startY = e.changedTouches[0].clientY;
        }
      },
      { passive: true }
    );

    viewport.addEventListener(
      "touchend",
      function (e) {
        if (startY == null || !e.changedTouches || !e.changedTouches[0]) return;
        if (isFullPageNavModalOpen()) {
          startY = null;
          return;
        }
        var endY = e.changedTouches[0].clientY;
        var dy = endY - startY;
        startY = null;
        if (Math.abs(dy) < 50) return;
        if (dy < 0) {
          updateHelper({ type: "swipeup" });
        } else {
          updateHelper({ type: "swipedown" });
        }
      },
      { passive: true }
    );
  }

  /**
   * Hamburger opens 3D perspective overlay; return button or outer-nav item closes it.
   * Dispatches custom events so `bindWheel` can reset accumulation/lock.
   */
  function bindOuterNav() {
    var perspective = qs(".perspective");
    var toggle = qs(".header--nav-toggle");
    var returnEl = qs(".outer-nav--return");
    var outerNav = qs(".outer-nav");

    if (toggle && perspective) {
      toggle.addEventListener("click", function () {
        perspective.classList.add("perspective--modalview");
        setTimeout(function () {
          perspective.classList.add("effect-rotate-left--animate");
        }, 25);
        if (outerNav) {
          qsa(".outer-nav li", outerNav).forEach(function (li) {
            li.classList.add("is-vis");
          });
          outerNav.classList.add("is-vis");
        }
        if (returnEl) returnEl.classList.add("is-vis");
        toggle.setAttribute("aria-expanded", "true");
        document.dispatchEvent(new CustomEvent("portfolio:nav-modal-opened"));
      });
    }

    function close() {
      if (!perspective) return;
      perspective.classList.remove("effect-rotate-left--animate");
      setTimeout(function () {
        perspective.classList.remove("perspective--modalview");
      }, 400);
      if (outerNav) {
        qsa(".outer-nav li", outerNav).forEach(function (li) {
          li.classList.remove("is-vis");
        });
        outerNav.classList.remove("is-vis");
      }
      if (returnEl) returnEl.classList.remove("is-vis");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      document.dispatchEvent(new CustomEvent("portfolio:nav-modal-closed"));
    }

    if (returnEl) returnEl.addEventListener("click", close);
    if (outerNav) {
      outerNav.addEventListener("click", function (e) {
        if (e.target.closest("li")) close();
      });
    }
  }

  /**
   * Portfolio carousel: three visible slots (left/center/right classes). Prev/next shift indices and wrap at ends.
   */
  function bindWorkSlider() {
    var lockup = qs(".work--lockup");
    if (!lockup) return;

    lockup.addEventListener("click", function (e) {
      var btn = e.target.closest(".slider--prev, .slider--next");
      if (!btn) return;

      var slider = qs(".slider", lockup);
      if (!slider) return;

      var curLeft = qs(".slider--item-left", slider);
      var curCenter = qs(".slider--item-center", slider);
      var curRight = qs(".slider--item-right", slider);
      var items = qsa(".slider--item", slider);
      var totalWorks = items.length;

      var curLeftPos = curLeft ? items.indexOf(curLeft) : 0;
      var curCenterPos = curCenter ? items.indexOf(curCenter) : 0;
      var curRightPos = curRight ? items.indexOf(curRight) : 0;

      var leftEls = qsa(".slider--item-left", slider);
      var centerEls = qsa(".slider--item-center", slider);
      var rightEls = qsa(".slider--item-right", slider);
      var left = leftEls[0];
      var center = centerEls[0];
      var right = rightEls[0];

      function nextSlide() {
        if (
          curLeftPos < totalWorks - 1 &&
          curCenterPos < totalWorks - 1 &&
          curRightPos < totalWorks - 1
        ) {
          if (left) {
            left.classList.remove("slider--item-left");
            left.nextElementSibling &&
              left.nextElementSibling.classList.add("slider--item-left");
          }
          if (center) {
            center.classList.remove("slider--item-center");
            center.nextElementSibling &&
              center.nextElementSibling.classList.add("slider--item-center");
          }
          if (right) {
            right.classList.remove("slider--item-right");
            right.nextElementSibling &&
              right.nextElementSibling.classList.add("slider--item-right");
          }
        } else {
          if (curLeftPos === totalWorks - 1) {
            items.forEach(function (el) {
              el.classList.remove("slider--item-left");
            });
            if (items[0]) items[0].classList.add("slider--item-left");
            if (center) {
              center.classList.remove("slider--item-center");
              center.nextElementSibling &&
                center.nextElementSibling.classList.add("slider--item-center");
            }
            if (right) {
              right.classList.remove("slider--item-right");
              right.nextElementSibling &&
                right.nextElementSibling.classList.add("slider--item-right");
            }
          } else if (curCenterPos === totalWorks - 1) {
            if (left) {
              left.classList.remove("slider--item-left");
              left.nextElementSibling &&
                left.nextElementSibling.classList.add("slider--item-left");
            }
            items.forEach(function (el) {
              el.classList.remove("slider--item-center");
            });
            if (items[0]) items[0].classList.add("slider--item-center");
            if (right) {
              right.classList.remove("slider--item-right");
              right.nextElementSibling &&
                right.nextElementSibling.classList.add("slider--item-right");
            }
          } else {
            if (left) {
              left.classList.remove("slider--item-left");
              left.nextElementSibling &&
                left.nextElementSibling.classList.add("slider--item-left");
            }
            if (center) {
              center.classList.remove("slider--item-center");
              center.nextElementSibling &&
                center.nextElementSibling.classList.add("slider--item-center");
            }
            items.forEach(function (el) {
              el.classList.remove("slider--item-right");
            });
            if (items[0]) items[0].classList.add("slider--item-right");
          }
        }
      }

      function prevSlide() {
        if (curLeftPos !== 0 && curCenterPos !== 0 && curRightPos !== 0) {
          if (left) {
            left.classList.remove("slider--item-left");
            left.previousElementSibling &&
              left.previousElementSibling.classList.add("slider--item-left");
          }
          if (center) {
            center.classList.remove("slider--item-center");
            center.previousElementSibling &&
              center.previousElementSibling.classList.add("slider--item-center");
          }
          if (right) {
            right.classList.remove("slider--item-right");
            right.previousElementSibling &&
              right.previousElementSibling.classList.add("slider--item-right");
          }
        } else {
          if (curLeftPos === 0) {
            items.forEach(function (el) {
              el.classList.remove("slider--item-left");
            });
            if (items[items.length - 1])
              items[items.length - 1].classList.add("slider--item-left");
            if (center) {
              center.classList.remove("slider--item-center");
              center.previousElementSibling &&
                center.previousElementSibling.classList.add("slider--item-center");
            }
            if (right) {
              right.classList.remove("slider--item-right");
              right.previousElementSibling &&
                right.previousElementSibling.classList.add("slider--item-right");
            }
          } else if (curCenterPos === 0) {
            if (left) {
              left.classList.remove("slider--item-left");
              left.previousElementSibling &&
                left.previousElementSibling.classList.add("slider--item-left");
            }
            items.forEach(function (el) {
              el.classList.remove("slider--item-center");
            });
            if (items[items.length - 1])
              items[items.length - 1].classList.add("slider--item-center");
            if (right) {
              right.classList.remove("slider--item-right");
              right.previousElementSibling &&
                right.previousElementSibling.classList.add("slider--item-right");
            }
          } else {
            if (left) {
              left.classList.remove("slider--item-left");
              left.previousElementSibling &&
                left.previousElementSibling.classList.add("slider--item-left");
            }
            if (center) {
              center.classList.remove("slider--item-center");
              center.previousElementSibling &&
                center.previousElementSibling.classList.add("slider--item-center");
            }
            items.forEach(function (el) {
              el.classList.remove("slider--item-right");
            });
            if (items[items.length - 1])
              items[items.length - 1].classList.add("slider--item-right");
          }
        }
      }

      if (btn.classList.contains("slider--next")) nextSlide();
      else prevSlide();
    });
  }

  /** Floating labels: toggle `has-value` from input content; `scrollTo(0,0)` avoids iOS oddities on blur. */
  function bindWorkRequestLabels() {
    qsa(".work-request--information input").forEach(function (input) {
      input.addEventListener("blur", function () {
        if (input.value === "") input.classList.remove("has-value");
        else input.classList.add("has-value");
        window.scrollTo(0, 0);
      });
    });
  }

  // --- Boot: all listeners after DOM ready ---

  ready(function () {
    bindNavClicks();
    bindCta();
    bindWheel();
    bindKeyboard();
    bindTouchSwipe();
    bindOuterNav();
    bindWorkSlider();
    bindWorkRequestLabels();
  });
})();
