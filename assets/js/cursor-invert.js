(function () {
  var mq;
  try {
    mq = window.matchMedia("(hover: hover) and (pointer: fine)");
  } catch (e) {
    return;
  }

  var el = null;
  var onMove;
  var onBlur;
  var onDocOut;

  function enable() {
    if (document.getElementById("cursor-invert")) return;

    el = document.createElement("div");
    el.id = "cursor-invert";
    el.className = "cursor-invert";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    document.documentElement.classList.add("has-cursor-invert");

    onMove = function (e) {
      el.style.left = e.clientX + "px";
      el.style.top = e.clientY + "px";
      el.classList.add("cursor-invert--on");
    };

    onBlur = function () {
      el.classList.remove("cursor-invert--on");
    };

    onDocOut = function (e) {
      if (e.relatedTarget == null && e.clientY <= 0) {
        el.classList.remove("cursor-invert--on");
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("blur", onBlur);
    document.addEventListener("mouseout", onDocOut);
  }

  function disable() {
    var node = document.getElementById("cursor-invert");
    if (onMove) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("mouseout", onDocOut);
      onMove = onBlur = onDocOut = null;
    }
    if (node) node.remove();
    el = null;
    document.documentElement.classList.remove("has-cursor-invert");
  }

  function sync() {
    if (mq.matches) enable();
    else disable();
  }

  sync();
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", sync);
  } else if (typeof mq.addListener === "function") {
    mq.addListener(sync);
  }
})();
