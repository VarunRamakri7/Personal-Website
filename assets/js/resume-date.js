(function () {
  var el = document.querySelector(".resume-masthead__date");
  if (!el) return;

  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, "0");
  var d = String(now.getDate()).padStart(2, "0");
  el.setAttribute("datetime", y + "-" + m + "-" + d);
  el.textContent = now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
})();
