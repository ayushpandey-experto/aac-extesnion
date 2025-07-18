// Content script for AI Chat Assistant
class AIChatExtension {
  constructor() {
    this.isOpen = false;
    this.apiKey = null;
    this.chatHistory = [];
    this.selectedFunction = 'optimize_prompt';
    this.isFunctionTrayOpen = true;
    this.isTemplatesPanelOpen = false; // NEW: State for templates panel
    this.init();
  }

  async init() {
    // Load settings and create UI elements based on them
    chrome.storage.sync.get({isChatButtonEnabled:true}, (result) => {
      if (result.isChatButtonEnabled) {
        this.createChatButton();
      }
    });
    this.createChatBox();
    this.attachEventListeners();
    await this.loadApiKey();
    this.updatePinnedFunctionPill(); // Set the initial pinned function display
    this.renderTemplates(); // NEW: Render templates on init
  }

  createChatButton() {
    // Prevent creating multiple buttons
    if (document.getElementById('ai-chat-button')) return;

    const button = document.createElement('div');
    button.id = 'ai-chat-button';
    button.style.display = 'flex'; // Ensure it's visible when created
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

    // NEW: Template panel event listeners
    document.getElementById('ai-templates-btn').addEventListener('click', () => this.toggleTemplatesPanel());
    document.getElementById('ai-templates-close-btn').addEventListener('click', () => this.toggleTemplatesPanel());


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

    // NEW: Auto-hide function tray on input
    document.getElementById('ai-chat-input').addEventListener('input', () => {
        if (this.isFunctionTrayOpen) {
            this.toggleFunctionTray();
        }
    });

    // NEW: Toggle function tray when clicking the pinned function pill
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

     // NEW: Event listener for copying JSON from templates panel
    document.getElementById('ai-template-list').addEventListener('click', async (e) => {
        const copyBtn = e.target.closest('.ai-template-copy-btn');
        if (copyBtn) {
            const jsonUrl = copyBtn.getAttribute('data-url');
            try {
                const res = await fetch(jsonUrl);
                const jsonText = await res.text();
                await navigator.clipboard.writeText(jsonText);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => copyBtn.textContent = 'Copy JSON', 2000);
            } catch (err) {
                copyBtn.textContent = 'Failed';
                console.error("Failed to copy JSON:", err);
            }
        }
    });
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

  // NEW: Toggle Templates Panel with Animation
  toggleTemplatesPanel() {
    this.isTemplatesPanelOpen = !this.isTemplatesPanelOpen;
    const mainContent = document.getElementById('ai-main-content');
    const templatesPanel = document.getElementById('ai-templates-panel');

    // Remove all animation classes before starting a new animation
    mainContent.classList.remove('slide-in-left', 'slide-out-left');
    templatesPanel.classList.remove('slide-in-right', 'slide-out-right');


    if (this.isTemplatesPanelOpen) {
        templatesPanel.classList.remove('is-hidden');
        mainContent.classList.add('slide-out-left');
        templatesPanel.classList.add('slide-in-right');

    } else {
        mainContent.classList.add('slide-in-left');
        templatesPanel.classList.add('slide-out-right');
         // Hide the templates panel after the animation is complete
        setTimeout(() => {
            templatesPanel.classList.add('is-hidden');
        }, 300); // Match animation duration
    }
    // Also close settings if open
    document.getElementById('ai-settings-panel').style.display = 'none';
  }

  updatePinnedFunctionPill() {
      const container = document.getElementById('ai-pinned-function-container');
      const functionButton = document.querySelector(`.ai-function-btn[data-function="${this.selectedFunction}"]`);
      if (!functionButton) return;

      const prettyName = functionButton.textContent;
      // Make the pill a button so it's clearly clickable
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
    // Ensure chat content is visible after restart
    if (this.isTemplatesPanelOpen) {
        this.toggleTemplatesPanel();
    }
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    const chatBox = document.getElementById('ai-chat-box');
    chatBox.className = this.isOpen ? 'ai-chat-open' : 'ai-chat-closed';
    // When closing, ensure templates panel is also hidden and chat is visible
    if (!this.isOpen && this.isTemplatesPanelOpen) {
        this.toggleTemplatesPanel();
    }
  }

  toggleSettings() {
    const settingsPanel = document.getElementById('ai-settings-panel');
    const isVisible = settingsPanel.style.display === 'block';
    settingsPanel.style.display = isVisible ? 'none' : 'block';

    // When opening settings, ensure templates panel is hidden
    if (!isVisible && this.isTemplatesPanelOpen) {
        this.toggleTemplatesPanel();
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

  // NEW: Templates Data
  templates = [
    {
      "title": "Youtube to LinkedIn Post",
      "description": "Auto-post a LinkedIn update when a new YouTube video is published.",
      "json_url": "https://raw.githubusercontent.com/ayushpandey-experto/aac-extesnion/refs/heads/main/19__Youtube_to_Linkedin_Post_n8n.json?token=GHSAT0AAAAAADGSQVPN6FCNBDCPP5YQYJWM2DY7NEQ"
    }
  ];

  // NEW: Render Templates Function
  renderTemplates() {
    const container = document.getElementById('ai-template-list');
    if (!container) return; // Ensure container exists

    container.innerHTML = ''; // Clear existing templates
    this.templates.forEach(t => {
      const div = document.createElement('div');
      div.className = 'ai-template-item'; // Use a class for styling
      div.innerHTML = `
        <strong class="template-title">${t.title}</strong>
        <p class="template-description">${t.description}</p>
        <button class="ai-template-copy-btn" data-url="${t.json_url}">Copy JSON</button>
      `;
      container.appendChild(div);
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