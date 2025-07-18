// Background script for AI Chat Extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Chat Extension installed');
});

// Handle messages from content script if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getApiKey') {
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
      sendResponse({ apiKey: result.geminiApiKey });
    });
    return true;
  }
  
  if (request.action === 'saveApiKey') {
    chrome.storage.sync.set({ geminiApiKey: request.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});