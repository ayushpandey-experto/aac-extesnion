// Background script for AI Chat Extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Chat Extension installed');
  chrome.storage.local.set({ licenseValid: false });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // ✅ Fetch saved Gemini API key
  if (request.action === 'getApiKey') {
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
      sendResponse({ apiKey: result.geminiApiKey });
    });
    return true;
  }

  // ✅ Save Gemini API key
  if (request.action === 'saveApiKey') {
    chrome.storage.sync.set({ geminiApiKey: request.apiKey }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // ✅ License validation using Supabase
  if (request.action === 'validateLicense') {
    const enteredKey = request.licenseKey.trim();

    fetch(`https://isyxnxvaitseqqkbqaua.supabase.co/rest/v1/licenses?key=eq.${enteredKey}&select=is_active`, {
      method: 'GET',
      headers: {
        apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXhueHZhaXRzZXFxa2JxYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTc5ODcsImV4cCI6MjA2ODM5Mzk4N30.KM_i8O2r2R2j25vl4Dt8CMDpWqkYgQ7aIkOTUhXEcRQ',
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXhueHZhaXRzZXFxa2JxYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTc5ODcsImV4cCI6MjA2ODM5Mzk4N30.KM_i8O2r2R2j25vl4Dt8CMDpWqkYgQ7aIkOTUhXEcRQ'
      }
    })
    .then(res => res.json())
    .then(data => {
      const isValid = data.length > 0 && data[0].is_active;
      if (isValid) {
        const now = new Date();
        // Store the month and year of the successful validation.
        chrome.storage.local.set({
          licenseValid: true,
          licenseKey: enteredKey,
          lastVerificationMonth: now.getMonth(), // Store current month (0-11)
          lastVerificationYear: now.getFullYear() // Store current year
        });
      }
      sendResponse({ valid: isValid });
    })
    .catch(() => {
      sendResponse({ valid: false });
    });

    return true; // Needed to keep sendResponse async
  }
});