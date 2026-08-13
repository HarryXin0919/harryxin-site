(function () {
  "use strict";

  var detailDepth = 0;
  var pendingDetailDepth = null;

  function cameFromPortfolio() {
    if (!document.referrer || window.history.length < 2) return false;

    try {
      var referrer = new URL(document.referrer);
      return referrer.origin === window.location.origin
        && (referrer.pathname === "/" || referrer.pathname === "/index.html");
    } catch (_) {
      return false;
    }
  }

  var portfolioEntry = cameFromPortfolio();

  function markDetailEntry(depth) {
    if (!portfolioEntry || !window.history.replaceState) return;
    var state = window.history.state || {};
    var nextState = {};
    for (var key in state) {
      if (Object.prototype.hasOwnProperty.call(state, key)) nextState[key] = state[key];
    }
    nextState.hxWorkDetail = true;
    nextState.hxWorkDepth = depth;
    window.history.replaceState(nextState, "", window.location.href);
  }

  markDetailEntry(detailDepth);

  window.addEventListener("hashchange", function () {
    if (!portfolioEntry) return;
    var state = window.history.state;
    if (pendingDetailDepth !== null) {
      detailDepth = pendingDetailDepth;
      pendingDetailDepth = null;
      markDetailEntry(detailDepth);
    } else if (state && state.hxWorkDetail && Number.isFinite(state.hxWorkDepth)) {
      detailDepth = Math.max(0, state.hxWorkDepth);
    }
  });

  document.addEventListener("click", function (event) {
    var hashLink = event.target.closest && event.target.closest('a[href^="#"]');
    if (portfolioEntry && hashLink && !event.defaultPrevented && event.button === 0
      && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      pendingDetailDepth = detailDepth + 1;
    }

    var link = event.target.closest && event.target.closest("[data-work-back]");
    if (!link || event.defaultPrevented || event.button > 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    if (portfolioEntry) {
      event.preventDefault();
      if (detailDepth > 0 && typeof window.history.go === "function") {
        window.history.go(-(detailDepth + 1));
      } else {
        window.history.back();
      }
    }
  });
})();
