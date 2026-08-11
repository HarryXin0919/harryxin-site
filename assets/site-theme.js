(function () {
  'use strict';

  var STORAGE_KEY = 'harryxin-theme';
  var root = document.documentElement;
  var systemQuery = null;

  try {
    systemQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
  } catch (error) {}

  function isTheme(value) {
    return value === 'light' || value === 'dark';
  }

  function readStoredTheme() {
    var value = null;
    try { value = localStorage.getItem(STORAGE_KEY); } catch (error) {}
    return isTheme(value) ? value : null;
  }

  function systemTheme() {
    return systemQuery && systemQuery.matches ? 'light' : 'dark';
  }

  function dataValue(node, theme, fallback) {
    if (!node) return fallback;
    return node.getAttribute(theme === 'light' ? 'data-theme-light' : 'data-theme-dark') || fallback;
  }

  function updateChrome(theme) {
    var themeColor = document.getElementById('theme-color');
    var favicon = document.getElementById('site-favicon');
    var color = dataValue(themeColor, theme, theme === 'light' ? '#f3f5ef' : '#080b0a');
    var icon = dataValue(
      favicon,
      theme,
      theme === 'light'
        ? '/assets/hx-logo-icon-v6-xbridge-day.svg?v=7'
        : '/assets/hx-logo-icon-v6-xbridge.svg?v=7'
    );

    if (themeColor) themeColor.setAttribute('content', color);
    if (favicon) favicon.setAttribute('href', icon);

    var brands = document.querySelectorAll('[data-logo-night][data-logo-day]');
    for (var i = 0; i < brands.length; i += 1) {
      brands[i].setAttribute('src', theme === 'light'
        ? brands[i].getAttribute('data-logo-day')
        : brands[i].getAttribute('data-logo-night'));
    }
  }

  function updateControls(theme) {
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < toggles.length; i += 1) {
      var toggle = toggles[i];
      var light = theme === 'light';
      toggle.setAttribute('aria-pressed', String(light));
      toggle.setAttribute('aria-label', light
        ? 'Daylight theme. Switch to night / 白昼模式，切换到夜间'
        : 'Night theme. Switch to daylight / 夜间模式，切换到白昼');
      toggle.setAttribute('title', light ? 'Switch to night theme' : 'Switch to daylight theme');

      var label = toggle.querySelector('[data-theme-label]');
      if (label) label.textContent = light ? 'DAY' : 'NIGHT';

      var moon = toggle.querySelector('[data-theme-icon="moon"]');
      var sun = toggle.querySelector('[data-theme-icon="sun"]');
      setIconVisibility(moon, !light);
      setIconVisibility(sun, light);
    }
  }

  /* SVG elements do not consistently implement HTMLElement.hidden on older
     iOS/WebKit builds, so keep both the attribute and an explicit display. */
  function setIconVisibility(icon, visible) {
    if (!icon) return;
    if (visible) icon.removeAttribute('hidden');
    else icon.setAttribute('hidden', '');
    icon.style.display = visible ? 'block' : 'none';
  }

  function applyTheme(theme, options) {
    options = options || {};
    theme = isTheme(theme) ? theme : systemTheme();

    if (options.transition) {
      root.classList.add('theme-transition');
      window.clearTimeout(window.__hxThemeTransitionTimer);
      window.__hxThemeTransitionTimer = window.setTimeout(function () {
        root.classList.remove('theme-transition');
      }, 520);
    }

    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    updateChrome(theme);
    updateControls(theme);

    if (options.persist) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (error) {}
    }

    return theme;
  }

  function preferredTheme() {
    return readStoredTheme() || systemTheme();
  }

  function bindControls() {
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < toggles.length; i += 1) {
      toggles[i].addEventListener('click', function () {
        var current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        applyTheme(current === 'light' ? 'dark' : 'light', { persist: true, transition: true });
      });
    }
  }

  bindControls();
  applyTheme(isTheme(root.getAttribute('data-theme')) ? root.getAttribute('data-theme') : preferredTheme());

  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY) return;
    applyTheme(isTheme(event.newValue) ? event.newValue : systemTheme());
  });

  window.addEventListener('pageshow', function () {
    applyTheme(preferredTheme());
  });

  if (systemQuery) {
    var handleSystemChange = function (event) {
      if (!readStoredTheme()) applyTheme(event.matches ? 'light' : 'dark');
    };
    if (systemQuery.addEventListener) systemQuery.addEventListener('change', handleSystemChange);
    else if (systemQuery.addListener) systemQuery.addListener(handleSystemChange);
  }

  window.HXSiteTheme = {
    apply: applyTheme,
    current: function () { return root.getAttribute('data-theme'); }
  };
})();
