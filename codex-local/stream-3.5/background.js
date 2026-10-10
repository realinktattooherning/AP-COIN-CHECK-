'use strict';

// Call open directly from the toolbar gesture, before awaiting any other API.
// A persistent side panel keeps the screenshot and monitoring session alive.
chrome.action.onClicked.addListener((tab) => {
  const openWindow = () => chrome.windows.create({
    url: chrome.runtime.getURL('screen.html'),
    type: 'popup', width: 470, height: 880
  }).catch(error => console.error('Cannot open stream scanner', error));
  if (!chrome.sidePanel?.open || !Number.isInteger(tab?.windowId)) {
    return openWindow();
  }
  return chrome.sidePanel.open({windowId: tab.windowId}).catch(openWindow);
});
