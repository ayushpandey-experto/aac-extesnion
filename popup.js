document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggleChatButton');

  // Load and set the current state of the toggle
  chrome.storage.sync.get({isChatButtonEnabled: true}, (result) => {
    toggle.checked = result.isChatButtonEnabled;
  });

  // Listen for changes and update storage/content script
  toggle.addEventListener('change', () => {
    const isEnabled = toggle.checked;
    chrome.storage.sync.set({ isChatButtonEnabled: isEnabled });

    // Notify the active tab to show/hide the button immediately
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleChatButtonVisibility',
          visible: isEnabled
        });
      }
    });
  });
});