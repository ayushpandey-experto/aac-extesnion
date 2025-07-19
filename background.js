// Background script for AI Chat Extension
// BULLETPROOF SOLUTION - Will work with any setup

chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Chat Extension installed');
  chrome.storage.local.set({ licenseValid: false });
});

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

  if (request.action === 'validateLicense') {
    validateLicenseBulletproof(request.email, request.licenseKey, sendResponse);
    return true;
  }
});

async function validateLicenseBulletproof(email, licenseKey, sendResponse) {
  const enteredEmail = email.trim().toLowerCase();
  const enteredKey = licenseKey.trim();

  console.log('🔥 BULLETPROOF LICENSE VALIDATION STARTING');
  console.log('📧 Email:', enteredEmail);
  console.log('🔑 Key:', enteredKey);

  const baseUrl = 'https://isyxnxvaitseqqkbqaua.supabase.co';
  const headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXhueHZhaXRzZXFxa2JxYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTc5ODcsImV4cCI6MjA2ODM5Mzk4N30.KM_i8O2r2R2j25vl4Dt8CMDpWqkYgQ7aIkOTUhXEcRQ',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeXhueHZhaXRzZXFxa2JxYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4MTc5ODcsImV4cCI6MjA2ODM5Mzk4N30.KM_i8O2r2R2j25vl4Dt8CMDpWqkYgQ7aIkOTUhXEcRQ',
    'Content-Type': 'application/json'
  };

  // Try all possible table name variations
  const tableVariations = [
    'licenses%20verification',   // URL encoded space
    'licenses verification',     // Raw space
    'licenses_verification',     // Underscore
    'license_verification',      // Singular
    'licenses',                  // Just licenses
    'verification'               // Just verification
  ];

  for (const tableName of tableVariations) {
    try {
      console.log(`\n🎯 Trying table: "${tableName}"`);
      
      const apiUrl = `${baseUrl}/rest/v1/${tableName}?select=*`;
      console.log('🌐 URL:', apiUrl);
      
      const response = await fetch(apiUrl, { 
        method: 'GET',
        headers: headers 
      });

      console.log('📡 Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📦 Raw data received:', data);
        console.log('📊 Record count:', data.length);

        if (data.length > 0) {
          console.log('📋 First record structure:', data[0]);
          console.log('🏗️ Available columns:', Object.keys(data[0]));

          // Try to find a match with flexible column names and values
          const match = data.find(record => {
            const recordEmail = record.email || record.user_email || record.customer_email || '';
            const recordKey = record.key || record.license_key || record.license || record.code || '';
            const recordActive = record.is_active || record.active || record.status || record.enabled;

            const emailMatch = recordEmail.toString().toLowerCase().trim() === enteredEmail;
            const keyMatch = recordKey.toString().trim() === enteredKey;
            const activeMatch = recordActive === true || recordActive === 'true' || recordActive === 1 || recordActive === '1' || recordActive === 'active' || recordActive === 'enabled';

            console.log(`🔍 Checking record:`, {
              recordEmail: recordEmail,
              recordKey: recordKey,
              recordActive: recordActive,
              emailMatch: emailMatch,
              keyMatch: keyMatch,
              activeMatch: activeMatch,
              overallMatch: emailMatch && keyMatch && activeMatch
            });

            return emailMatch && keyMatch && activeMatch;
          });

          if (match) {
            console.log('🎉 LICENSE FOUND AND VALID!');
            console.log('✅ Matching record:', match);

            // Save validation
            const now = new Date();
            chrome.storage.local.set({
              licenseValid: true,
              licenseKey: enteredKey,
              licenseEmail: enteredEmail,
              lastVerificationMonth: now.getMonth(),
              lastVerificationYear: now.getFullYear(),
              validationTable: tableName
            });

            sendResponse({ valid: true });
            return;
          } else {
            console.log(`❌ No match found in table "${tableName}"`);
            console.log('📝 Available emails in this table:');
            data.forEach((record, index) => {
              const recordEmail = record.email || record.user_email || record.customer_email || 'NO_EMAIL';
              const recordKey = record.key || record.license_key || record.license || record.code || 'NO_KEY';
              const recordActive = record.is_active || record.active || record.status || record.enabled;
              console.log(`   ${index + 1}. ${recordEmail} / ${recordKey} / ${recordActive}`);
            });
          }
        } else {
          console.log(`⚠️ Table "${tableName}" is empty`);
        }
      } else {
        console.log(`❌ Table "${tableName}" not accessible: ${response.status} ${response.statusText}`);
        if (response.status === 404) {
          console.log('   → Table does not exist');
        } else if (response.status === 401 || response.status === 403) {
          console.log('   → Permission denied');
        }
      }
    } catch (error) {
      console.log(`💥 Error with table "${tableName}":`, error.message);
    }
  }

  // If we get here, no table worked
  console.log('🚫 VALIDATION FAILED - NO VALID LICENSE FOUND');
  console.log('💡 Possible issues:');
  console.log('   1. Table name is different than expected');
  console.log('   2. Row Level Security is blocking access');
  console.log('   3. API key lacks permissions');
  console.log('   4. Email/key combination does not exist');
  console.log('   5. Record is not marked as active');

  sendResponse({ valid: false });
}