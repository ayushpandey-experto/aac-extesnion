const SUPABASE_URL = 'https://isyxnxvaitseqqkbqaua.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // full anon key

// Content script for AI Chat Assistant
class AIChatExtension {
  constructor() {
    this.isOpen = false;
    this.apiKey = null;
    this.isLicensed = false;
    this.chatHistory = [];
    this.selectedFunction = 'optimize_prompt';
    this.isFunctionTrayOpen = true;
    this.isTemplatesPanelOpen = false;
    this.init();
  }

  async init() {
    await this.checkLicenseStatus();

    this.createChatButton();
    this.createChatBox();
    this.attachEventListeners();

    this.loadApiKey();
    this.updatePinnedFunctionPill();
    this.renderTemplates();
    
    // Setup enhanced input validation and animations
    this.setupInputValidation();
    this.addShakeAnimation();
    
    // Listen for license status changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.licenseValid) {
            this.isLicensed = changes.licenseValid.newValue;
        }
    });
  }

  async checkLicenseStatus() {
    const data = await chrome.storage.local.get([
        'licenseValid', 
        'licenseEmail', 
        'licenseKey',
        'lastVerificationMonth', 
        'lastVerificationYear'
    ]);
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (data.licenseValid && 
        data.licenseEmail && 
        data.licenseKey && 
        data.lastVerificationYear !== undefined && 
        data.lastVerificationMonth !== undefined) {
        
        // Check if it's a new month (require re-verification)
        if (currentYear > data.lastVerificationYear || 
            (currentYear === data.lastVerificationYear && currentMonth > data.lastVerificationMonth)) {
            // It's a new month, re-verification is required
            this.isLicensed = false;
            await chrome.storage.local.set({ licenseValid: false });
        } else {
            // Still the same month, license is valid
            this.isLicensed = true;
        }
    } else {
        // No valid license or missing email/key found
        this.isLicensed = false;
    }
  }

// FIXED LICENSE VALIDATION PART OF CONTENT.JS
// Replace the handleLicenseActivation method in your content.js with this:

handleLicenseActivation() {
    const emailInput = document.getElementById('ai-license-email-input');
    const keyInput = document.getElementById('ai-license-key-input');
    const email = emailInput.value.trim();
    const key = keyInput.value.trim();
    const statusDiv = document.getElementById('ai-license-status');
    const activateBtn = document.getElementById('ai-activate-license-btn');
    
    // Clear previous states
    this.clearInputValidation();
    statusDiv.style.display = 'none';
    statusDiv.className = 'license-status-modern';

    // SIMPLIFIED validation - just check if fields have values
    let hasErrors = false;

    if (!email) {
        this.showInputError(emailInput, 'Please enter your email address.');
        hasErrors = true;
    } else if (!this.isValidEmail(email)) {
        this.showInputError(emailInput, 'Please enter a valid email address.');
        hasErrors = true;
    } else {
        this.showInputSuccess(emailInput);
    }

    if (!key) {
        this.showInputError(keyInput, 'Please enter your license key.');
        hasErrors = true;
    } else {
        // REMOVED the length check - accept any key length
        this.showInputSuccess(keyInput);
    }

    if (hasErrors) {
        return;
    }

    // Start loading state
    this.setButtonLoading(activateBtn, true);
    this.showStatus('Validating your license...', 'loading');

    // Add debug logging
    console.log('🚀 Sending license validation request');
    console.log('📧 Email:', email);
    console.log('🔑 Key:', key);

    // Send validation request
    chrome.runtime.sendMessage({ 
        action: 'validateLicense', 
        email: email,
        licenseKey: key 
    }, (response) => {
        console.log('📦 Validation response received:', response);
        
        this.setButtonLoading(activateBtn, false);
        
        if (response && response.valid) {
            console.log('✅ License validation successful!');
            this.setButtonSuccess(activateBtn);
            this.showStatus('✨ License activated successfully! Welcome aboard!', 'success');
            this.isLicensed = true;

            // Celebrate with confetti effect
            this.triggerSuccessAnimation();

            setTimeout(() => {
                document.getElementById('ai-license-panel').style.display = 'none';
                document.getElementById('ai-main-content').style.display = 'flex';
                this.restartChat();
            }, 2000);
        } else {
            console.log('❌ License validation failed');
            this.showStatus('❌ Invalid email or license key. Please check your credentials and try again.', 'error');
            this.setButtonError(activateBtn);
        }
    });
}

  // Input validation helpers
  clearInputValidation() {
      const inputs = ['ai-license-email-input', 'ai-license-key-input'];
      inputs.forEach(id => {
          const input = document.getElementById(id);
          if (input) {
              const wrapper = input.parentElement;
              wrapper.classList.remove('valid', 'error');
          }
      });
  }

  showInputError(input, message) {
      const wrapper = input.parentElement;
      wrapper.classList.remove('valid');
      wrapper.classList.add('error');
      
      // Add shake animation
      input.style.animation = 'shake 0.5s ease-in-out';
      setTimeout(() => {
          input.style.animation = '';
      }, 500);
  }

  showInputSuccess(input) {
      const wrapper = input.parentElement;
      wrapper.classList.remove('error');
      wrapper.classList.add('valid');
  }

  // Status message helpers
  showStatus(message, type) {
      const statusDiv = document.getElementById('ai-license-status');
      if (statusDiv) {
          statusDiv.textContent = message;
          statusDiv.className = `license-status-modern ${type}`;
          statusDiv.style.display = 'block';
      }
  }

  // Button state helpers
  setButtonLoading(button, loading) {
      if (loading) {
          button.classList.add('loading');
          button.disabled = true;
      } else {
          button.classList.remove('loading');
          button.disabled = false;
      }
  }

  setButtonSuccess(button) {
      button.classList.remove('loading');
      button.classList.add('success');
      button.disabled = true;
  }

  setButtonError(button) {
      button.classList.remove('loading', 'success');
      button.disabled = false;
      
      // Add error shake
      button.style.animation = 'shake 0.5s ease-in-out';
      setTimeout(() => {
          button.style.animation = '';
      }, 500);
  }

  // Success animation
  triggerSuccessAnimation() {
      // Create temporary success overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(16, 185, 129, 0.1);
          z-index: 10003;
          pointer-events: none;
          animation: successFlash 0.6s ease-out;
      `;
      
      document.body.appendChild(overlay);
      
      setTimeout(() => {
          overlay.remove();
      }, 600);
  }

  // Enhanced email validation
  isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email) && email.length <= 254;
  }

  // Real-time input validation
  setupInputValidation() {
      // Use setTimeout to ensure elements exist
      setTimeout(() => {
          const emailInput = document.getElementById('ai-license-email-input');
          const keyInput = document.getElementById('ai-license-key-input');
          
          if (!emailInput || !keyInput) return;

          // Email input validation
          emailInput.addEventListener('blur', () => {
              const email = emailInput.value.trim();
              if (email) {
                  if (this.isValidEmail(email)) {
                      this.showInputSuccess(emailInput);
                  } else {
                      this.showInputError(emailInput);
                  }
              }
          });

          emailInput.addEventListener('input', () => {
              const wrapper = emailInput.parentElement;
              if (wrapper.classList.contains('error') || wrapper.classList.contains('valid')) {
                  wrapper.classList.remove('error', 'valid');
              }
          });

          // License key input validation
          keyInput.addEventListener('blur', () => {
              const key = keyInput.value.trim();
              if (key) {
                  if (key.length >= 10) {
                      this.showInputSuccess(keyInput);
                  } else {
                      this.showInputError(keyInput);
                  }
              }
          });

          keyInput.addEventListener('input', () => {
              const wrapper = keyInput.parentElement;
              if (wrapper.classList.contains('error') || wrapper.classList.contains('valid')) {
                  wrapper.classList.remove('error', 'valid');
              }
          });

          // Enter key support
          const handleEnterKey = (e) => {
              if (e.key === 'Enter') {
                  e.preventDefault();
                  this.handleLicenseActivation();
              }
          };

          emailInput.addEventListener('keydown', handleEnterKey);
          keyInput.addEventListener('keydown', handleEnterKey);
      }, 100);
  }

  // Add shake animation CSS
  addShakeAnimation() {
      if (!document.getElementById('shake-animation-style')) {
          const style = document.createElement('style');
          style.id = 'shake-animation-style';
          style.textContent = `
              @keyframes shake {
                  0%, 100% { transform: translateX(0); }
                  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                  20%, 40%, 60%, 80% { transform: translateX(5px); }
              }
              @keyframes successFlash {
                  0% { opacity: 0; }
                  50% { opacity: 1; }
                  100% { opacity: 0; }
              }
          `;
          document.head.appendChild(style);
      }
  }

  createChatButton() {
    if (document.getElementById('ai-chat-button')) return;

    const button = document.createElement('div');
    button.id = 'ai-chat-button';
    button.style.display = 'flex';
    button.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
      </svg>
    `;

    button.addEventListener('click', () => this.toggleChat());
    document.body.appendChild(button);
  }

  createChatBox() {
    const chatBox = document.createElement('div');
    chatBox.id = 'ai-chat-box';
    chatBox.className = 'ai-chat-closed';

    chatBox.innerHTML = `
      <div class="ai-chat-header">
        <div class="ai-chat-title">AI Assistant</div>
        <div class="ai-chat-controls">
          <button id="ai-templates-btn" class="ai-btn-icon" title="Templates">📋</button>
          <button id="ai-function-toggle-btn" class="ai-btn-icon" title="Toggle Functions">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <button id="ai-restart-btn" class="ai-btn-icon" title="Restart Chat">🔄</button>
          <button id="ai-settings-btn" class="ai-btn-icon" title="Settings">⚙️</button>
          <button id="ai-close-btn" class="ai-btn-icon" title="Close">×</button>
        </div>
      </div>

      <div class="ai-chat-content">
        <div id="ai-main-content" class="ai-panel">
            <div id="ai-function-buttons" class="ai-function-buttons">
              <button class="ai-function-btn active" data-function="optimize_prompt">Optimize Prompt</button>
              <button class="ai-function-btn" data-function="generate_prompt">Generate Prompt</button>
              <button class="ai-function-btn" data-function="generate_json">Generate JSON</button>
              <button class="ai-function-btn" data-function="generate_curl">Generate cURL</button>
              <button class="ai-function-btn" data-function="generate_code">Generate Code</button>
              <button class="ai-function-btn" data-function="fix_json">Fix JSON</button>
              <button class="ai-function-btn" data-function="explain_code">Explain Code</button>
            </div>

            <div class="ai-chat-messages" id="ai-chat-messages">
              <div class="ai-message ai-message-system">
                Welcome! Select a function and enter your prompt below.
              </div>
            </div>

            <div id="ai-pinned-function-container"></div>

            <div class="ai-chat-input-container">
              <textarea id="ai-chat-input" placeholder="Enter your prompt here..." rows="3"></textarea>
              <button id="ai-send-btn" class="ai-btn-send">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
                </svg>
              </button>
            </div>
        </div>

        <div id="ai-templates-panel" class="ai-panel is-hidden">
            <div class="ai-templates-header">
                <h3>Templates</h3>
                <button id="ai-templates-close-btn" class="ai-btn-icon">×</button>
            </div>
            <div id="ai-template-list" class="ai-template-list"></div>
        </div>

        <div class="ai-license-panel" id="ai-license-panel">
          <div class="ai-license-container">
            <!-- Header Section -->
            <div class="ai-license-header-modern">
              <div class="license-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <circle cx="12" cy="16" r="1"></circle>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h2 class="license-title">Activate Your License</h2>
              <p class="license-subtitle">Unlock all premium features with your license key</p>
            </div>

            <!-- Form Section -->
            <div class="ai-license-form">
              <!-- Email Input Group -->
              <div class="input-group">
                <label class="input-label">Email Address</label>
                <div class="input-wrapper">
                  <div class="input-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                  </div>
                  <input type="email" id="ai-license-email-input" placeholder="Enter your email address" required>
                  <div class="input-validation-icon"></div>
                </div>
              </div>

              <!-- License Key Input Group -->
              <div class="input-group">
                <label class="input-label">License Key</label>
                <div class="input-wrapper">
                  <div class="input-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
                    </svg>
                  </div>
                  <input type="text" id="ai-license-key-input" placeholder="Enter your license key" required>
                  <div class="input-validation-icon"></div>
                </div>
              </div>

              <!-- Status Message -->
              <div id="ai-license-status" class="license-status-modern"></div>

              <!-- Action Buttons -->
              <div class="license-actions">
                <button id="ai-activate-license-btn" class="btn-primary-modern">
                  <span class="btn-text">Activate License</span>
                  <div class="btn-loader">
                    <div class="loader-spinner"></div>
                  </div>
                  <div class="btn-success-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20,6 9,17 4,12"></polyline>
                    </svg>
                  </div>
                </button>
                
                <button id="ai-get-license-btn" class="btn-secondary-modern">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15,3 21,3 21,9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                  Get a License
                </button>
              </div>
            </div>

            <!-- Features Preview -->
            <div class="features-preview">
              <div class="features-title">What you'll get:</div>
              <div class="features-list">
                <div class="feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                  </svg>
                  <span>Advanced AI Functions</span>
                </div>
                <div class="feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                  </svg>
                  <span>Premium Templates</span>
                </div>
                <div class="feature-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                  </svg>
                  <span>Priority Support</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="ai-settings-panel" id="ai-settings-panel">
        <div class="ai-settings-header">
          <h3>Settings</h3>
          <button id="ai-settings-close" class="ai-btn-icon">×</button>
        </div>
        <div class="ai-settings-content">
          <div class="ai-form-group">
            <label for="ai-api-key">Gemini API Key:</label>
            <input type="password" id="ai-api-key" placeholder="Enter your Gemini API key">
            <button id="ai-test-api" class="ai-btn-test">Test API Key</button>
          </div>
          <div id="ai-api-status" class="ai-api-status"></div>
        </div>
      </div>
    `;

    document.body.appendChild(chatBox);
  }

  attachEventListeners() {
    document.getElementById('ai-close-btn').addEventListener('click', () => this.toggleChat());
    document.getElementById('ai-restart-btn').addEventListener('click', () => this.restartChat());
    document.getElementById('ai-settings-btn').addEventListener('click', () => this.toggleSettings());
    document.getElementById('ai-function-toggle-btn').addEventListener('click', () => this.toggleFunctionTray());
    document.getElementById('ai-settings-close').addEventListener('click', () => this.toggleSettings());

    document.getElementById('ai-templates-btn').addEventListener('click', () => this.toggleTemplatesPanel());
    document.getElementById('ai-templates-close-btn').addEventListener('click', () => this.toggleTemplatesPanel());

    // License Panel Listeners
    document.getElementById('ai-activate-license-btn').addEventListener('click', () => this.handleLicenseActivation());
    document.getElementById('ai-get-license-btn').addEventListener('click', () => {
        window.open('https://www.skool.com/ai-automation-club', '_blank');
    });

    document.querySelectorAll('.ai-function-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.selectFunction(e.target.dataset.function));
    });

    document.getElementById('ai-send-btn').addEventListener('click', () => this.sendMessage());

    document.getElementById('ai-chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    document.getElementById('ai-chat-input').addEventListener('input', () => {
        if (this.isFunctionTrayOpen) {
            this.toggleFunctionTray();
        }
    });

    document.getElementById('ai-pinned-function-container').addEventListener('click', (e) => {
        if (e.target.closest('.ai-function-btn')) {
            this.toggleFunctionTray();
        }
    });

    document.getElementById('ai-test-api').addEventListener('click', () => this.testApiKey());

    document.getElementById('ai-chat-messages').addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.ai-action-btn-copy');
      if (copyBtn) {
        const messageDiv = copyBtn.closest('.ai-message-ai');
        this.copyResponse(messageDiv.dataset.rawContent, copyBtn);
      }

      const fullscreenBtn = e.target.closest('.ai-action-btn-fullscreen');
      if (fullscreenBtn) {
        const messageDiv = fullscreenBtn.closest('.ai-message-ai');
        const functionName = messageDiv.dataset.functionName;
        this.openFullscreen(messageDiv.dataset.rawContent, functionName);
      }
    });

    const templateList = document.getElementById('ai-template-list');
    templateList.addEventListener('click', async (e) => {
        const copyBtn = e.target.closest('.ai-template-copy-btn');
        if (copyBtn) {
            const jsonUrl = copyBtn.getAttribute('data-url');
            try {
                const response = await fetch(jsonUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const jsonText = await response.text();
                await navigator.clipboard.writeText(jsonText);
                
                copyBtn.textContent = '✅ Copied!';
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.textContent = 'Copy JSON';
                    copyBtn.classList.remove('copied');
                }, 2000);
            } catch (err) {
                copyBtn.textContent = 'Failed';
                console.error("Failed to copy JSON:", err);
            }
        }

        const guideBtn = e.target.closest('.ai-template-guide-btn');
        if (guideBtn) {
            const guideUrl = guideBtn.getAttribute('data-url');
            if (guideUrl) {
                window.open(guideUrl, '_blank');
            }
        }

        const categoryHeader = e.target.closest('.ai-template-category-header');
        if (categoryHeader) {
            const currentCategory = categoryHeader.parentElement;
            const isActive = currentCategory.classList.contains('active');

            document.querySelectorAll('.ai-template-category.active').forEach(cat => {
                if (cat !== currentCategory) {
                    cat.classList.remove('active');
                }
            });

            if (!isActive) {
                currentCategory.classList.add('active');
            } else {
                currentCategory.classList.remove('active');
            }
        }
    });

    // Setup enhanced input validation
    this.setupInputValidation();
  }

  toggleFunctionTray() {
    this.isFunctionTrayOpen = !this.isFunctionTrayOpen;
    const functionTray = document.getElementById('ai-function-buttons');
    const toggleButton = document.getElementById('ai-function-toggle-btn');
    if (this.isFunctionTrayOpen) {
      functionTray.classList.remove('functions-hidden');
      toggleButton.classList.remove('rotated');
    } else {
      functionTray.classList.add('functions-hidden');
      toggleButton.classList.add('rotated');
    }
  }

  toggleTemplatesPanel() {
    this.isTemplatesPanelOpen = !this.isTemplatesPanelOpen;
    const mainContent = document.getElementById('ai-main-content');
    const templatesPanel = document.getElementById('ai-templates-panel');

    mainContent.classList.remove('slide-in-left', 'slide-out-left');
    templatesPanel.classList.remove('slide-in-right', 'slide-out-right');


    if (this.isTemplatesPanelOpen) {
        templatesPanel.classList.remove('is-hidden');
        document.getElementById('ai-license-panel').style.display = 'none';
        mainContent.classList.add('slide-out-left');
        templatesPanel.classList.add('slide-in-right');

    } else {
        mainContent.classList.add('slide-in-left');
        templatesPanel.classList.add('slide-out-right');
        setTimeout(() => {
            templatesPanel.classList.add('is-hidden');
        }, 300);
    }
    document.getElementById('ai-settings-panel').style.display = 'none';
  }

  updatePinnedFunctionPill() {
      const container = document.getElementById('ai-pinned-function-container');
      const functionButton = document.querySelector(`.ai-function-btn[data-function="${this.selectedFunction}"]`);
      if (!functionButton) return;

      const prettyName = functionButton.textContent;
      container.innerHTML = `<button class="ai-function-btn active">${prettyName}</button>`;
      container.style.display = 'block';
  }

  restartChat() {
    this.chatHistory = [];
    const messagesContainer = document.getElementById('ai-chat-messages');
    messagesContainer.innerHTML = `
      <div class="ai-message ai-message-system">
        Chat restarted. Select a function and enter your prompt below.
      </div>
    `;
    document.getElementById('ai-pinned-function-container').style.display = 'none';
    if (!this.isFunctionTrayOpen) {
      this.toggleFunctionTray();
    }
    if (this.isTemplatesPanelOpen) {
        this.toggleTemplatesPanel();
    }
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    const chatBox = document.getElementById('ai-chat-box');
    chatBox.className = this.isOpen ? 'ai-chat-open' : 'ai-chat-closed';

    if (this.isOpen) {
        if (!this.isLicensed) {
            // Show license panel if not licensed
            document.getElementById('ai-main-content').style.display = 'none';
            document.getElementById('ai-templates-panel').classList.add('is-hidden');
            document.getElementById('ai-settings-panel').style.display = 'none';
            document.getElementById('ai-license-panel').style.display = 'flex';
        } else {
            // Show main content if licensed
            document.getElementById('ai-main-content').style.display = 'flex';
            document.getElementById('ai-license-panel').style.display = 'none';
        }
    } else {
        if (this.isTemplatesPanelOpen) this.toggleTemplatesPanel();
        if (document.getElementById('ai-settings-panel').style.display === 'block') this.toggleSettings();
    }
  }

  toggleSettings() {
    const settingsPanel = document.getElementById('ai-settings-panel');
    const isVisible = settingsPanel.style.display === 'block';
    settingsPanel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        document.getElementById('ai-main-content').style.display = 'flex';
        if (this.isTemplatesPanelOpen) this.toggleTemplatesPanel();
    } else {
        document.getElementById('ai-main-content').style.display = 'none';
    }
  }

  selectFunction(functionName) {
    this.selectedFunction = functionName;
    document.querySelectorAll('.ai-function-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-function="${functionName}"]`).classList.add('active');
    this.updatePinnedFunctionPill();
  }

  async loadApiKey() {
    const data = await chrome.storage.sync.get('geminiApiKey');
    if (data.geminiApiKey) {
      this.apiKey = data.geminiApiKey;
      document.getElementById('ai-api-key').value = this.apiKey;
    }
  }

  async saveApiKey(apiKey) {
    await chrome.storage.sync.set({ geminiApiKey: apiKey });
    this.apiKey = apiKey;
  }

  async testApiKey() {
    const apiKey = document.getElementById('ai-api-key').value.trim();
    const statusDiv = document.getElementById('ai-api-status');

    if (!apiKey) {
      statusDiv.innerHTML = '<span class="error">Please enter an API key</span>';
      return;
    }

    statusDiv.innerHTML = '<span class="loading">Testing API key...</span>';

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Hello, this is a test.' }]
          }]
        })
      });

      if (response.ok) {
        statusDiv.innerHTML = '<span class="success">✓ API key is valid!</span>';
        await this.saveApiKey(apiKey);
      } else {
        const error = await response.json();
        statusDiv.innerHTML = `<span class="error">✗ Invalid API key</span>`;
      }
    } catch (error) {
      statusDiv.innerHTML = '<span class="error">✗ Error testing API key</span>';
    }
  }

  getPromptForFunction(userInput) {
    const prompts = {
        optimize_prompt: `You are an expert prompt engineer. Your task is to optimize the given prompt to make it more effective and clear. Original prompt: ${userInput}`,
        generate_prompt: `You are an expert prompt engineer. Create a comprehensive AI prompt based on this description: ${userInput}`,
        generate_code: `You are an expert n8n developer. Create JavaScript code for an n8n Code node based on this description: ${userInput}`,
        generate_json: `Create a JSON structure based on this description: ${userInput}`,
        generate_curl: `Convert this HTTP request configuration to a cURL command: ${userInput}`,
        fix_json: `Fix the JSON syntax errors in this text: ${userInput}`,
        explain_code: `You are an expert code analyst. Explain this code clearly: ${userInput}`
    };

    return prompts[this.selectedFunction] || prompts.optimize_prompt;
  }

  async sendMessage() {
    const input = document.getElementById('ai-chat-input');
    const userInput = input.value.trim();
    if (!userInput) return;

    if (!this.apiKey) {
      this.addMessage('error', 'Please configure your API key in settings first.');
      this.toggleSettings();
      return;
    }

    if (this.isFunctionTrayOpen) {
        this.toggleFunctionTray();
    }

    this.addMessage('user', userInput);
    this.chatHistory.push({ role: 'user', content: userInput, function: this.selectedFunction });
    input.value = '';

    const relevantHistory = this.chatHistory.filter(msg => msg.function === this.selectedFunction);

    const conversationHistory = relevantHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    if(relevantHistory.filter(m => m.role === 'user').length === 1) {
        const lastMessageIndex = conversationHistory.length - 1;
        conversationHistory[lastMessageIndex].parts[0].text = this.getPromptForFunction(userInput);
    }

    try {
      this.addMessage('loading', 'Thinking...');

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: conversationHistory
        })
      });

      this.removeLoadingMessage();

      if (response.ok) {
        const data = await response.json();
        const aiResponse = data.candidates[0].content.parts[0].text;
        this.addMessage('ai', aiResponse);
        this.chatHistory.push({ role: 'assistant', content: aiResponse, function: this.selectedFunction });
      } else {
        const errorData = await response.json();
        this.addMessage('error', `Error: ${errorData.error?.message || 'Unknown error occurred'}`);
      }
    } catch (error) {
      this.removeLoadingMessage();
      this.addMessage('error', `Network error: ${error.message}`);
    }
  }

  addMessage(type, content) {
    const messagesContainer = document.getElementById('ai-chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ai-message-${type}`;

    if (type === 'ai') {
        messageDiv.dataset.rawContent = content;
        messageDiv.dataset.functionName = this.selectedFunction;

        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = content;
        pre.appendChild(code);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'ai-response-actions';
        actionsDiv.innerHTML = `
          <button class="ai-action-btn ai-action-btn-copy" title="Copy">📋</button>
          <button class="ai-action-btn ai-action-btn-fullscreen" title="Fullscreen">🔍</button>
        `;

        messageDiv.appendChild(pre);
        messageDiv.appendChild(actionsDiv);
    } else if (type === 'user') {
        const functionButton = document.querySelector(`.ai-function-btn[data-function="${this.selectedFunction}"]`);
        const functionName = functionButton ? functionButton.textContent : 'Prompt';

        const escapedContent = document.createElement('div');
        escapedContent.textContent = content;

        messageDiv.innerHTML = `
          <div class="message-function-tag">${functionName}</div>
          <div class="message-content">${escapedContent.innerHTML}</div>
        `;
    } else {
        messageDiv.textContent = content;
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  removeLoadingMessage() {
    const loadingMessage = document.querySelector('.ai-message-loading');
    if (loadingMessage) {
      loadingMessage.remove();
    }
  }

  copyResponse(content, buttonElement) {
    navigator.clipboard.writeText(content).then(() => {
      const originalText = buttonElement.textContent;
      buttonElement.textContent = 'Copied!';
      buttonElement.style.background = '#28a745';
      setTimeout(() => {
        buttonElement.textContent = originalText;
        buttonElement.style.background = '';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      buttonElement.textContent = 'Failed!';
    });
  }

  openFullscreen(content, functionName) {
    const existingModal = document.querySelector('.ai-fullscreen-modal');
    if (existingModal) existingModal.remove();

    const functionDetailsMap = {
      'optimize_prompt': { title: 'Optimized Prompt', button: 'Copy Optimized Prompt' },
      'generate_prompt': { title: 'Generated Prompt', button: 'Copy Generated Prompt' },
      'generate_json': { title: 'Generated JSON', button: 'Copy Generated JSON' },
      'generate_curl': { title: 'Generated cURL', button: 'Copy Generated cURL' },
      'generate_code': { title: 'Generated Code', button: 'Copy Generated Code' },
      'fix_json': { title: 'Fixed JSON', button: 'Copy Fixed JSON' },
      'explain_code': { title: 'Code Explanation', button: 'Copy Explanation' },
    };

    const details = functionDetailsMap[functionName] || { title: 'AI Response', button: 'Copy Response' };

    const modal = document.createElement('div');
    modal.className = 'ai-fullscreen-modal';

    modal.innerHTML = `
        <div class="ai-fullscreen-content-new">
            <div class="ai-fullscreen-header-new">
                <span class="title">${details.title}</span>
                <button class="ai-btn-icon close-fullscreen-btn" title="Close">×</button>
            </div>
            <div class="ai-fullscreen-body-new">
                <textarea id="fullscreen-editor"></textarea>
            </div>
            <div class="ai-fullscreen-footer-new">
                <button id="fullscreen-copy-btn" class="ai-fullscreen-action-btn">${details.button}</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const editor = document.getElementById('fullscreen-editor');
    editor.value = content;

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    modal.querySelector('.close-fullscreen-btn').addEventListener('click', () => {
      modal.remove();
    });

    const copyBtn = modal.querySelector('#fullscreen-copy-btn');
    copyBtn.addEventListener('click', () => {
      const editedContent = editor.value;
      this.copyResponse(editedContent, copyBtn);
    });

    editor.focus();
  }

  templatesData = [
    {
        category: "n8n Integration",
        templates: [
            {
              "title": "Youtube to LinkedIn Post",
              "description": "Auto-post a LinkedIn update when a new YouTube video is published.",
              "json_url": "https://raw.githubusercontent.com/ayushpandey-experto/aac-extesnion/refs/heads/main/19__Youtube_to_ Linkedin_Post_n8n.json",
              "guide_url": "https://www.skool.com/ai-automation-club/classroom/12d3fc65?md=4160344c83984f1fb2a82eaa7627d85c"
            },
            {
              "title": "Telegram Bot Trick for Everyday Use",
              "description": "A versatile Telegram bot for daily tasks and reminders.",
              "json_url": "https://raw.githubusercontent.com/n8n-io/n8n-workflows/master/community/Telegram-Bot-trick-for-everyday-use.json",
              "guide_url": "https://www.skool.com/ai-automation-club/classroom/12d3fc65?md=d80b47d4d524478593175e1ba3e4f388"
            }
        ]
    },
    {
        category: "AI Voice Agent",
        templates: [
            {
                "title": "Retell AI Outbound Call with n8n",
                "description": "Automate outbound voice calls using Retell AI for interactive experiences.",
                "json_url": "https://raw.githubusercontent.com/ayushpandey-experto/aac-extesnion/refs/heads/main/27__Retell_Voice_agent_outbound_n8n.json",
                "guide_url": "https://www.skool.com/ai-automation-club/classroom/12d3fc65?md=b235af209f2946d990d98fbc707d8e6d"
            }
        ]
    },
    {
        category: "Social Media Automation",
        templates: [
            {
                "title": "YouTube Trigger in n8n",
                "description": "Use RSS feeds to trigger workflows when a new YouTube video is posted.",
                "json_url": "https://raw.githubusercontent.com/ayushpandey-experto/aac-extesnion/refs/heads/main/20__Youtube_RSS_feed_subscription.json",
                "guide_url": "https://www.skool.com/ai-automation-club/classroom/12d3fc65?md=aa06728d12b44448a3e05fcbf8c96f88"
            },
            {
                "title": "Video Creation Using VEO3 in n8n",
                "description": "Automate video generation by integrating the VEO3 API with n8n.",
                "json_url": "https://raw.githubusercontent.com/ayushpandey-experto/aac-extesnion/refs/heads/main/19__VEO3_video_creation_using_n8n%20(1).json",
                "guide_url": "https://www.skool.com/ai-automation-club/classroom/12d3fc65?md=42e3575905f5447f883553d16d50e734"
            },
            {
                "title": "n8n Instagram Posting (no third party service)",
                "description": "Directly post images to Instagram from n8n without external services.",
                "json_url": "https://raw.githubusercontent.com/ayushpandey-experto/aac-extesnion/refs/heads/main/17__Post_to_instagram_using_n8n.json",
                "guide_url": "https://www.skool.com/ai-automation-club/classroom/12d3fc65?md=49f15857fbe541fdaba4d9c24b31ae40"
            },
            {
                "title": "Instagram Comment Auto Reply",
                "description": "Automatically reply to comments on your Instagram posts using n8n.",
                "json_url": "https://raw.githubusercontent.com/ayushpandey-experto/aac-extesnion/refs/heads/main/24__n8n_insta_dm_reply.json",
                "guide_url": "#" // Placeholder URL
            },
            {
                "title": "Whatsapp through Twilio",
                "description": "Send and receive WhatsApp messages by integrating Twilio with n8n.",
                "json_url": "https://raw.githubusercontent.com/ayushpandey-experto/aac-extesnion/refs/heads/main/26__n8n_twillio_whatsapp.json",
                "guide_url": "#" // Placeholder URL
            }
        ]
    },
    {
        category: "Lead Automation",
        templates: [
            {
                "title": "LinkedIn Lead Scraping Automation",
                "description": "Extract valuable lead data from LinkedIn profiles based on URLs.",
                "json_url": "https://raw.githubusercontent.com/ayushpandey-experto/aac-extesnion/refs/heads/main/22__Linkedin_URL_Scrape_using_n8n%20(1).json",
                "guide_url": "https://www.skool.com/ai-automation-club/classroom/12d3fc65?md=8006e81ecc5c468ca486c7920f1d07ad"
            },
            {
                "title": "LinkedIn Profile & Post Scraper Workflow",
                "description": "Scrape detailed information from LinkedIn profiles and their posts.",
                "json_url": "https://raw.githubusercontent.com/ayushpandey-experto/aac-extesnion/refs/heads/main/21__Linkedin_Profile_info___Post_Scrapper_using_n8n.json",
                "guide_url": "https://www.skool.com/ai-automation-club/classroom/12d3fc65?md=a37936623c134528811e8996f3214204"
            }
        ]
    }
  ];
  renderTemplates() {
    const container = document.getElementById('ai-template-list');
    if (!container) return;

    container.innerHTML = '';
    this.templatesData.forEach((cat, index) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'ai-template-category';

        if (index === 0) {
            categoryDiv.classList.add('active');
        }

        const header = document.createElement('div');
        header.className = 'ai-template-category-header';
        header.innerHTML = `
            <span>${cat.category}</span>
            <span class="arrow">›</span>
        `;
        categoryDiv.appendChild(header);

        const templateContent = document.createElement('div');
        templateContent.className = 'ai-template-list-inner';

        if (cat.templates.length > 0) {
            cat.templates.forEach(t => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'ai-template-item';
                itemDiv.innerHTML = `
                    <strong class="template-title">${t.title}</strong>
                    <p class="template-description">${t.description}</p>
                    <div class="ai-template-buttons-wrapper">
                        <button class="ai-template-copy-btn" data-url="${t.json_url}">Copy JSON</button>
                        <button class="ai-template-guide-btn" data-url="${t.guide_url}">Step by Step Guide</button>
                    </div>
                `;
                templateContent.appendChild(itemDiv);
            });
        } else {
            templateContent.innerHTML = '<p class="no-templates">No templates in this category yet.</p>';
        }
        categoryDiv.appendChild(templateContent);
        container.appendChild(categoryDiv);
    });
  }
}

let aiChatInstance = null;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

function initialize() {
  if (window.aiChatExtension) return;
  aiChatInstance = new AIChatExtension();
  window.aiChatExtension = aiChatInstance;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleChatButtonVisibility') {
      const button = document.getElementById('ai-chat-button');
      if (request.visible) {
        if (!button) {
          aiChatInstance.createChatButton();
        } else {
          button.style.display = 'flex';
        }
      } else {
        if (button) {
          button.style.display = 'none';
        }
      }
      sendResponse({status: "ok"});
    } else if (request.action === 'openChat') {
      aiChatInstance.toggleChat();
      sendResponse({status: "ok"});
    }
    return true;
  });
}