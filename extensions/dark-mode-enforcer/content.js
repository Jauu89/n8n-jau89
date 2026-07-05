(() => {
  const STYLE_ID = '__dark-mode-enforcer-style__';

  const CSS = `
    html {
      filter: invert(1) hue-rotate(180deg) !important;
      background: #fff !important;
    }
    img, video, picture, canvas, iframe,
    [style*="background-image"], [style*="background:url"] {
      filter: invert(1) hue-rotate(180deg) !important;
    }
  `;

  function applyDark() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function removeDark() {
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  }

  function setState(enabled) {
    if (enabled) applyDark();
    else removeDark();
  }

  chrome.runtime.sendMessage({ type: 'GET_STATE', hostname: location.hostname }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response) setState(response.enabled);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'APPLY_STATE') {
      setState(message.enabled);
    }
  });
})();
