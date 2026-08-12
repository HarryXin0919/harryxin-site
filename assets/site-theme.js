(function () {
  'use strict';

  var STORAGE_KEY = 'harryxin-theme';
  var root = document.documentElement;
  var systemQuery = null;

  try {
    systemQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
  } catch (error) {}

  function isThemeMode(value) {
    return value === 'system' || value === 'light' || value === 'dark';
  }

  function readStoredTheme() {
    var value = null;
    try { value = localStorage.getItem(STORAGE_KEY); } catch (error) {}
    return isThemeMode(value) ? value : 'system';
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

  function updateControls(theme, mode) {
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

    var choices = document.querySelectorAll('[data-settheme]');
    for (var c = 0; c < choices.length; c += 1) {
      var selected = choices[c].getAttribute('data-settheme') === mode;
      choices[c].setAttribute('aria-checked', String(selected));
      choices[c].setAttribute('aria-pressed', String(selected));
      if (choices[c].getAttribute('role') === 'radio') choices[c].setAttribute('tabindex', selected ? '0' : '-1');
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

  function applyTheme(mode, options) {
    options = options || {};
    mode = isThemeMode(mode) ? mode : 'system';
    var theme = mode === 'system' ? systemTheme() : mode;

    if (options.transition) {
      root.classList.add('theme-transition');
      window.clearTimeout(window.__hxThemeTransitionTimer);
      window.__hxThemeTransitionTimer = window.setTimeout(function () {
        root.classList.remove('theme-transition');
      }, 520);
    }

    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-mode', mode);
    root.style.colorScheme = theme;
    updateChrome(theme);
    updateControls(theme, mode);

    if (options.persist) {
      try { localStorage.setItem(STORAGE_KEY, mode); } catch (error) {}
    }

    return theme;
  }

  function preferredTheme() {
    return readStoredTheme();
  }

  function bindControls() {
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < toggles.length; i += 1) {
      toggles[i].addEventListener('click', function () {
        var current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        applyTheme(current === 'light' ? 'dark' : 'light', { persist: true, transition: true });
      });
    }

    var choices = document.querySelectorAll('[data-settheme]');
    for (var c = 0; c < choices.length; c += 1) {
      choices[c].addEventListener('click', function () {
        applyTheme(this.getAttribute('data-settheme'), { persist: true, transition: true });
      });
      choices[c].addEventListener('keydown', function (event) {
        var key = event.key;
        if (key !== 'ArrowLeft' && key !== 'ArrowUp' && key !== 'ArrowRight' && key !== 'ArrowDown' && key !== 'Home' && key !== 'End') return;
        event.preventDefault();
        var current = Array.prototype.indexOf.call(choices, this);
        var next = current;
        if (key === 'Home') next = 0;
        else if (key === 'End') next = choices.length - 1;
        else if (key === 'ArrowLeft' || key === 'ArrowUp') next = (current - 1 + choices.length) % choices.length;
        else next = (current + 1) % choices.length;
        choices[next].focus();
        applyTheme(choices[next].getAttribute('data-settheme'), { persist: true, transition: true });
      });
    }
  }

  bindControls();
  applyTheme(isThemeMode(root.getAttribute('data-theme-mode')) ? root.getAttribute('data-theme-mode') : preferredTheme());

  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY) return;
    applyTheme(isThemeMode(event.newValue) ? event.newValue : 'system');
  });

  window.addEventListener('pageshow', function () {
    applyTheme(preferredTheme());
  });

  if (systemQuery) {
    var handleSystemChange = function (event) {
      if (readStoredTheme() === 'system') applyTheme('system');
    };
    if (systemQuery.addEventListener) systemQuery.addEventListener('change', handleSystemChange);
    else if (systemQuery.addListener) systemQuery.addListener(handleSystemChange);
  }

  window.HXSiteTheme = {
    apply: applyTheme,
    current: function () { return root.getAttribute('data-theme'); },
    mode: function () { return root.getAttribute('data-theme-mode') || 'system'; }
  };
})();
