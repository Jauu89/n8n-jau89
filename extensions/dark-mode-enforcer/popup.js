const globalToggle = document.getElementById('global-toggle');
const domainRow = document.getElementById('domain-row');
const domainToggle = document.getElementById('domain-toggle');
const domainName = document.getElementById('domain-name');

let currentHostname = '';

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
}

function render(state) {
  globalToggle.checked = state.globalEnabled;
  domainRow.hidden = !state.globalEnabled;
  domainToggle.checked = state.disabledDomains.includes(currentHostname);
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentHostname = tab && tab.url ? hostnameFromUrl(tab.url) : '';
  domainName.textContent = currentHostname || 'este sitio';

  const state = await chrome.storage.sync.get({ globalEnabled: true, disabledDomains: [] });
  render(state);
}

globalToggle.addEventListener('change', async () => {
  const newState = await chrome.runtime.sendMessage({ type: 'TOGGLE_GLOBAL' });
  render(newState);
});

domainToggle.addEventListener('change', async () => {
  const newState = await chrome.runtime.sendMessage({
    type: 'TOGGLE_DOMAIN',
    hostname: currentHostname,
  });
  render(newState);
});

init();
