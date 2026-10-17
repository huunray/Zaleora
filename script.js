/* Zaleora landing page — behaviour */
(function () {
  "use strict";
  window.__zaleoraReady = true; // cancels the reveal safety net in <head>

  /* ──────────────────────────────────────────────────────────────────────
     Waitlist endpoint: the Google Apps Script web app URL (ends in /exec)
     that writes signups to the Google Sheet. Setup steps are at the top of
     google-apps-script/waitlist.gs. It receives a POST whose body is JSON:
       { "name": "Ada Obi", "email": "name@example.com", "source": "zaleora-landing", "company": "" }
     While this is empty the form validates and shows the success state, but
     NOTHING IS SAVED — set it before the page goes live.
     ────────────────────────────────────────────────────────────────────── */
  var WAITLIST_ENDPOINT = "https://script.google.com/macros/s/AKfycbzH58uj6wiez7j9O4qyCFi3GRPDzyl9De_eiPYDpWKh5t-QbTyPNVPV7iFzmWwiyEK1/exec";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ── Footer year ─────────────────────────────────────────────────────── */
  var year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  /* ── Nav: solid background after scrolling, mobile menu ──────────────── */
  var nav = $("#nav");
  var toggle = $("#navToggle");
  var menu = $("#navMenu");

  function onScroll() {
    nav.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function setMenu(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
  }
  toggle.addEventListener("click", function () {
    setMenu(toggle.getAttribute("aria-expanded") !== "true");
  });
  menu.addEventListener("click", function (e) {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      toggle.focus();
    }
  });
  window.matchMedia("(min-width: 1024px)").addEventListener("change", function (e) {
    if (e.matches) setMenu(false);
  });

  /* ── Active section in the nav ───────────────────────────────────────── */
  var spyLinks = $$("[data-spy]");
  if ("IntersectionObserver" in window && spyLinks.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        spyLinks.forEach(function (a) {
          a.classList.toggle("is-active", a.dataset.spy === entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["ecosystem", "ai", "about"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spy.observe(el);
    });
    // Clear the highlight when back in the hero / problem / waitlist.
    ["top", "vision", "waitlist"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) spyLinks.forEach(function (a) { a.classList.remove("is-active"); });
      }, { rootMargin: "-45% 0px -50% 0px" }).observe(el);
    });
  }

  /* ── Reveal on scroll ────────────────────────────────────────────────── */
  var revealEls = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var revealer = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealEls.forEach(function (el) { revealer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ── Ecosystem card stack: cards ease back as the next one slides over ── */
  var stackCards = $(".stack-card");
  if (stackCards.length > 1 && !reduceMotion) {
    var stackTicking = false;
    var updateStack = function () {
      stackTicking = false;
      stackCards.forEach(function (card, i) {
        var next = stackCards[i + 1];
        if (!next) return;
        var stickTop = parseFloat(getComputedStyle(card).top) || 0;
        var h = card.offsetHeight;
        var p = Math.min(1, Math.max(0, (stickTop + h - next.getBoundingClientRect().top) / h));
        card.style.transform = p > 0 ? "scale(" + (1 - 0.05 * p).toFixed(4) + ")" : "";
      });
    };
    var requestStack = function () {
      if (!stackTicking) { stackTicking = true; requestAnimationFrame(updateStack); }
    };
    window.addEventListener("scroll", requestStack, { passive: true });
    window.addEventListener("resize", requestStack);
    updateStack();
  }

  /* ── Scattered tools → one connected hub ─────────────────────────────── */
  var frag = $("#frag");
  if (frag) {
    if ("IntersectionObserver" in window && !reduceMotion) {
      var fragObs = new IntersectionObserver(function (entries, obs) {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        setTimeout(function () { frag.classList.add("is-connected"); }, 650);
      }, { threshold: 0.55 });
      fragObs.observe(frag);
    } else {
      frag.classList.add("is-connected");
    }
  }

  /* ── Final CTA: the card fan opens as it scrolls into view ─────────── */
  var fan = $("#cardFan");
  if (fan) {
    if ("IntersectionObserver" in window && !reduceMotion) {
      var fanObs = new IntersectionObserver(function (entries, obs) {
        if (!entries[0].isIntersecting) return;
        fan.classList.add("is-open");
        obs.disconnect();
      }, { threshold: 0.25 });
      fanObs.observe(fan);
    } else {
      fan.classList.add("is-open");
    }
  }

  /* ── Waitlist ────────────────────────────────────────────────────────── */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function sendToEndpoint(name, email, company) {
    if (!WAITLIST_ENDPOINT) {
      console.info("[Zaleora] No WAITLIST_ENDPOINT set in script.js — signup for %s <%s> was NOT saved.", name, email);
      return new Promise(function (resolve) { setTimeout(resolve, 600); });
    }
    // Sent as text/plain: Apps Script can't answer the CORS preflight a JSON content type would trigger.
    return fetch(WAITLIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ name: name, email: email, source: "zaleora-landing", company: company })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Request failed with status " + res.status);
        return res.json();
      })
      .then(function (body) {
        if (!body || !body.ok) throw new Error("Signup rejected: " + (body && body.error));
      });
  }

  /* ── Waitlist modal: every CTA and inline email form opens it ─────────── */
  var modal = $("#waitlistModal");
  if (modal && typeof modal.showModal === "function") {
    var modalForm = $("#waitlistModalForm");
    var nameInput = $("#wlName");
    var emailInput = $("#wlEmail");
    var modalSubmit = $("button[type=submit]", modalForm);
    var modalLabel = $(".wl-form__label", modalForm);
    var modalStatus = $(".wl-form__status", modalForm);
    var idleLabel = modalLabel.textContent;
    var formView = $("[data-view=form]", modal);
    var doneView = $("[data-view=done]", modal);
    var doneTitle = $("#wlDoneTitle");
    var joined = false;
    var lastTrigger = null;
    var downOnBackdrop = false;

    var setFieldError = function (input, message) {
      input.setAttribute("aria-invalid", message ? "true" : "false");
      document.getElementById(input.getAttribute("aria-describedby")).textContent = message;
    };

    var openModal = function (trigger) {
      lastTrigger = trigger;
      document.documentElement.classList.add("modal-open");
      modal.showModal();
      if (joined) doneTitle.focus();
      else (nameInput.value.trim() ? emailInput : nameInput).focus();
    };

    modal.addEventListener("close", function () {
      document.documentElement.classList.remove("modal-open");
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
    });

    // Close on the backdrop (only when the press started there, so drag-selecting text doesn't close it).
    modal.addEventListener("pointerdown", function (e) { downOnBackdrop = e.target === modal; });
    modal.addEventListener("click", function (e) {
      if ((e.target === modal && downOnBackdrop) || e.target.closest("[data-modal-close]")) modal.close();
    });

    $$("[data-cta]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        openModal(a);
      });
    });

    [nameInput, emailInput].forEach(function (input) {
      input.addEventListener("input", function () {
        if (input.getAttribute("aria-invalid") === "true") setFieldError(input, "");
        modalStatus.textContent = "";
      });
    });

    modalForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = nameInput.value.trim().replace(/\s+/g, " ");
      var email = emailInput.value.trim();

      setFieldError(nameInput, name ? "" : "Please enter your name.");
      setFieldError(emailInput, EMAIL_RE.test(email) ? "" : "Please enter a valid email address.");
      var firstInvalid = $("[aria-invalid=true]", modalForm);
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      modalStatus.textContent = "";
      modalSubmit.disabled = true;
      modalLabel.textContent = "Joining…";

      sendToEndpoint(name, email, $("#wlCompany").value)
        .then(function () {
          joined = true;
          $("[data-first-name]", modal).textContent = ", " + name.split(" ")[0];
          formView.hidden = true;
          doneView.hidden = false;
          doneTitle.focus();
        })
        .catch(function () {
          modalStatus.textContent = "Something went wrong. Please try again in a moment.";
        })
        .then(function () {
          modalSubmit.disabled = false;
          modalLabel.textContent = idleLabel;
        });
    });
  }
})();
