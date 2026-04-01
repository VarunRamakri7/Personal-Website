/**
 * Home: slide-out Projects (left) and Information (right) drawers.
 */
(function () {
  "use strict";

  var body = document.body;
  var backdrop = document.getElementById("backdrop");
  var panelProjects = document.getElementById("panel-projects");
  var panelInfo = document.getElementById("panel-information");
  var btnProjects = document.getElementById("btn-projects");
  var btnInformation = document.getElementById("btn-information");

  function openPanel(which) {
    var projectsOpen = which === "projects";
    if (projectsOpen) {
      panelInfo.hidden = true;
      panelInfo.classList.remove("drawer--open");
      btnInformation.setAttribute("aria-expanded", "false");
      panelProjects.hidden = false;
      requestAnimationFrame(function () {
        panelProjects.classList.add("drawer--open");
      });
      btnProjects.setAttribute("aria-expanded", "true");
    } else {
      panelProjects.hidden = true;
      panelProjects.classList.remove("drawer--open");
      btnProjects.setAttribute("aria-expanded", "false");
      panelInfo.hidden = false;
      requestAnimationFrame(function () {
        panelInfo.classList.add("drawer--open");
      });
      btnInformation.setAttribute("aria-expanded", "true");
    }
    backdrop.hidden = false;
    requestAnimationFrame(function () {
      backdrop.classList.add("backdrop--visible");
    });
    body.classList.add("drawer-active");
    var closeBtn = projectsOpen
      ? panelProjects.querySelector("[data-close]")
      : panelInfo.querySelector("[data-close]");
    if (closeBtn) closeBtn.focus();
  }

  function closePanels() {
    panelProjects.classList.remove("drawer--open");
    panelInfo.classList.remove("drawer--open");
    backdrop.classList.remove("backdrop--visible");
    body.classList.remove("drawer-active");
    btnProjects.setAttribute("aria-expanded", "false");
    btnInformation.setAttribute("aria-expanded", "false");
    function hideAfterTransition() {
      panelProjects.hidden = true;
      panelInfo.hidden = true;
      backdrop.hidden = true;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hideAfterTransition();
    } else {
      window.setTimeout(hideAfterTransition, 400);
    }
  }

  function onBackdropClick() {
    closePanels();
  }

  function onKeydown(e) {
    if (e.key === "Escape" && body.classList.contains("drawer-active")) {
      e.preventDefault();
      closePanels();
    }
  }

  if (btnProjects) {
    btnProjects.addEventListener("click", function () {
      if (body.classList.contains("drawer-active") && panelProjects.classList.contains("drawer--open")) {
        closePanels();
      } else {
        openPanel("projects");
      }
    });
  }

  if (btnInformation) {
    btnInformation.addEventListener("click", function () {
      if (body.classList.contains("drawer-active") && panelInfo.classList.contains("drawer--open")) {
        closePanels();
      } else {
        openPanel("information");
      }
    });
  }

  document.querySelectorAll("[data-close]").forEach(function (el) {
    el.addEventListener("click", closePanels);
  });

  if (backdrop) backdrop.addEventListener("click", onBackdropClick);
  document.addEventListener("keydown", onKeydown);
})();
