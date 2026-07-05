const DEFAULT_STATE = { globalEnabled: true, disabledDomains: [] };

function getStoredState() {
  return chrome.storage.sync.get(DEFAULT_STATE);
}

function isEnabledFor(state, hostname) {
  return state.globalEnabled && !state.disabledDomains.includes(hostname);
}

async function updateIconForTab(tabId, hostname) {
  const state = await getStoredState();
  const enabled = isEnabledFor(state, hostname);
  const size = enabled ? 'on' : 'off';
  try {
    await chrome.action.setIcon({
      tabId,
      path: {
        16: `icons/icon-${size}-16.png`,
        32: `icons/icon-${size}-32.png`,
        48: `icons/icon-${size}-48.png`,
        128: `icons/icon-${size}-128.png`,
      },
    });
  } catch (e) {
    // Tab may have been closed/navigated away before the update landed.
  }
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
}

async function broadcastToMatchingTabs(hostname, enabled) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url || hostnameFromUrl(tab.url) !== hostname) continue;
    chrome.tabs.sendMessage(tab.id, { type: 'APPLY_STATE', enabled }).catch(() => {});
    updateIconForTab(tab.id, hostname);
  }
}

async function broadcastGlobalChange(state) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url) continue;
    const hostname = hostnameFromUrl(tab.url);
    const enabled = isEnabledFor(state, hostname);
    chrome.tabs.sendMessage(tab.id, { type: 'APPLY_STATE', enabled }).catch(() => {});
    updateIconForTab(tab.id, hostname);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    getStoredState().then((state) => {
      sendResponse({ enabled: isEnabledFor(state, message.hostname) });
    });
    return true;
  }

  if (message.type === 'TOGGLE_GLOBAL') {
    getStoredState().then(async (state) => {
      const newState = { ...state, globalEnabled: !state.globalEnabled };
      await chrome.storage.sync.set(newState);
      await broadcastGlobalChange(newState);
      sendResponse(newState);
    });
    return true;
  }

  if (message.type === 'TOGGLE_DOMAIN') {
    getStoredState().then(async (state) => {
      const domain = message.hostname;
      const disabledDomains = state.disabledDomains.includes(domain)
        ? state.disabledDomains.filter((d) => d !== domain)
        : [...state.disabledDomains, domain];
      const newState = { ...state, disabledDomains };
      await chrome.storage.sync.set(newState);
      await broadcastToMatchingTabs(domain, isEnabledFor(newState, domain));
      sendResponse(newState);
    });
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    updateIconForTab(tabId, hostnameFromUrl(tab.url));
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url) updateIconForTab(tabId, hostnameFromUrl(tab.url));
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-global') return;
  const state = await getStoredState();
  const newState = { ...state, globalEnabled: !state.globalEnabled };
  await chrome.storage.sync.set(newState);
  await broadcastGlobalChange(newState);
});
