(function () {
  'use strict';

  var root = document.documentElement;
  var control = document.querySelector('[data-lang-toggle]');
  var storageKey = 'lang';

  function normalize(value) {
    return value === 'zh' ? 'zh' : 'en';
  }

  function readLanguage() {
    var value = null;
    try { value = localStorage.getItem(storageKey); } catch (error) {}
    if (value === 'en' || value === 'zh') return value;
    return /^zh\b/i.test(navigator.language || '') ? 'zh' : 'en';
  }

  function applyLanguage(value, persist) {
    var language = normalize(value);
    var chinese = language === 'zh';
    root.setAttribute('lang', chinese ? 'zh-Hans' : 'en');

    if (control) {
      control.setAttribute('aria-pressed', String(chinese));
      control.setAttribute('aria-label', chinese ? 'Switch to English' : '切换到简体中文');
      var label = control.querySelector('.language-current');
      if (label) label.textContent = chinese ? 'EN' : '中';
    }

    if (persist) {
      try { localStorage.setItem(storageKey, language); } catch (error) {}
    }
  }

  if (control) {
    control.addEventListener('click', function () {
      applyLanguage(root.lang.toLowerCase().indexOf('zh') === 0 ? 'en' : 'zh', true);
    });
  }

  window.addEventListener('storage', function (event) {
    if (event.key === storageKey) applyLanguage(event.newValue, false);
  });

  window.addEventListener('pageshow', function () {
    applyLanguage(readLanguage(), false);
  });

  applyLanguage(readLanguage(), false);
})();
