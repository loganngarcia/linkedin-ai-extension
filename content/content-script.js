// LinkedIn AI Premium Extension - Content Script
// Injects AI button and manages chat interface
// 
// Key Features:
// - AI button injection with smart container detection (avoids sticky headers)
// - Markdown rendering for AI responses (bold, italic, headers, code, lists, tables)
// - Chat positioned on left side (8px from left), touching bottom
// - Welcome section stays visible at top (doesn't disappear after first message)
// - No auto-scroll (user controls scroll position)
// - User's own profile data (name & photo) shown in messages instead of generic "You"
// - Persistent chat history per profile with auto-loading
// - Hover effects: 4% white fill + #A5D4FE color | Click: 8% white fill

// Simple markdown parser (no external dependencies)
// Supports: headers, bold, italic, code blocks, inline code, links, lists, blockquotes, hr, tables
function parseMarkdown(text) {
  if (!text) return '';
  
  // Escape HTML first
  text = text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;');
  
  // Headers (# ## ### #### ##### ######)
  text = text.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  text = text.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  text = text.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  text = text.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  
  // Bold (**text** or __text__)
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // Italic (*text* or _text_)
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Code blocks (```code```)
  text = text.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
  
  // Inline code (`code`)
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  
  // Lists (unordered)
  text = text.replace(/^\*\s+(.+)$/gm, '<li>$1</li>');
  text = text.replace(/^-\s+(.+)$/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Lists (ordered)
  text = text.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  
  // Blockquotes
  text = text.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Horizontal rule
  text = text.replace(/^---$/gm, '<hr>');
  text = text.replace(/^\*\*\*$/gm, '<hr>');
  
  // Line breaks (preserve newlines)
  text = text.replace(/\n\n/g, '</p><p>');
  text = text.replace(/\n/g, '<br>');
  
  // Wrap in paragraph if not already in block element
  if (!text.match(/^<(h[1-6]|ul|ol|pre|blockquote|table)/)) {
    text = '<p>' + text + '</p>';
  }
  
  return text;
}

class LinkedInAI {
  constructor() {
    this.chatOpen = false;
    this.chatCollapsed = false;
    this.currentProfile = null;
    this.init();
  }

  async init() {
    // Wait for LinkedIn to load
    await this.waitForLinkedInLoad();
    
    // Inject AI button
    this.injectAIButton();
    
    // Listen for profile changes
    this.observeProfileChanges();
  }

  waitForLinkedInLoad() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // Try multiple selectors for LinkedIn UI variations
        const profileActions = this.findProfileActionsContainer();
        if (profileActions) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 10000);
    });
  }

  findProfileActionsContainer() {
    console.log('LinkedIn AI: Searching for action buttons container...');
    
    // Strategy 1: Find a container that has 2-5 buttons (typical action button group)
    // BUT EXCLUDE sticky header containers
    const allDivs = document.querySelectorAll('div');
    
    for (const div of allDivs) {
      // Skip if this is a sticky header (contains "sticky" in class name)
      const className = div.className || '';
      if (className.includes('sticky') || className.includes('Sticky')) {
        console.log('LinkedIn AI: Skipping sticky header:', div);
        continue;
      }
      
      // Count direct button children
      const buttons = Array.from(div.children).filter(child => child.tagName === 'BUTTON');
      
      // LinkedIn profile actions typically have 2-5 buttons in a row
      if (buttons.length >= 2 && buttons.length <= 5) {
        // Check if any button has a common action keyword
        const hasActionButton = buttons.some(btn => {
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          const text = btn.textContent.trim().toLowerCase();
          return ariaLabel.includes('message') || 
                 ariaLabel.includes('connect') || 
                 ariaLabel.includes('follow') ||
                 ariaLabel.includes('more') ||
                 text.includes('message') ||
                 text.includes('follow') ||
                 text.includes('more');
        });
        
        if (hasActionButton) {
          console.log('LinkedIn AI: Found button container with', buttons.length, 'buttons:', div);
          console.log('LinkedIn AI: Container classes:', className);
          console.log('LinkedIn AI: Buttons:', buttons.map(b => b.textContent.trim() || b.getAttribute('aria-label')));
          return div;
        }
      }
    }
    
    // Strategy 2: Find any button with common LinkedIn action keywords (skip sticky headers)
    const actionKeywords = ['message', 'connect', 'follow', 'more', 'view my'];
    const allButtons = document.querySelectorAll('button');
    
    for (const button of allButtons) {
      // Skip if button is in sticky header
      const isInSticky = button.closest('[class*="sticky"], [class*="Sticky"]');
      if (isInSticky) {
        continue;
      }
      
      const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
      const text = button.textContent.trim().toLowerCase();
      
      const hasKeyword = actionKeywords.some(keyword => 
        ariaLabel.includes(keyword) || text.includes(keyword)
      );
      
      if (hasKeyword && button.parentElement) {
        console.log('LinkedIn AI: Found action button:', button.textContent.trim() || ariaLabel);
        const container = button.parentElement;
        console.log('LinkedIn AI: Using parent container:', container);
        console.log('LinkedIn AI: Container classes:', container.className);
        return container;
      }
    }
    
    console.log('LinkedIn AI: No suitable container found');
    return null;
  }

  injectAIButton() {
    // Check for any existing button (with or without wrapper)
    const existingButton = document.getElementById('linkedin-ai-button');
    if (existingButton && existingButton.isConnected) {
      console.log('LinkedIn AI: Button already exists and is connected');
      return;
    }

    const profileActions = this.findProfileActionsContainer();
    if (!profileActions) {
      console.log('LinkedIn AI: Could not find profile actions container, retrying in 2s...');
      setTimeout(() => this.injectAIButton(), 2000);
      return;
    }

    const aiButton = this.createAIButton();
    
    // DON'T use a wrapper - inject the button directly like LinkedIn's native buttons
    aiButton.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin: 0 4px !important;
      flex-shrink: 0 !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 999999 !important;
      position: relative !important;
    `;
    
    // Find the last button in the container to insert after it
    const lastButton = Array.from(profileActions.children).filter(el => el.tagName === 'BUTTON').pop();
    
    if (lastButton) {
      console.log('LinkedIn AI: Inserting after last button:', lastButton);
      lastButton.parentNode.insertBefore(aiButton, lastButton.nextSibling);
    } else {
      console.log('LinkedIn AI: Appending to container');
      profileActions.appendChild(aiButton);
    }
    
    console.log('LinkedIn AI: Button injected successfully!');
    console.log('LinkedIn AI: Button element:', aiButton);
    console.log('LinkedIn AI: Parent container:', profileActions);
    
    // Check if it's actually visible
    setTimeout(() => {
      const btn = document.getElementById('linkedin-ai-button');
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const styles = window.getComputedStyle(btn);
        console.log('LinkedIn AI: ✓ Button visibility check:', {
          visible: rect.width > 0 && rect.height > 0,
          display: styles.display,
          visibility: styles.visibility,
          opacity: styles.opacity,
          width: rect.width + 'px',
          height: rect.height + 'px',
          top: rect.top + 'px',
          left: rect.left + 'px'
        });
        
        // Make it flash red briefly so user can see it
        btn.style.background = 'red !important';
        setTimeout(() => {
          btn.style.background = 'transparent !important';
        }, 1000);
      } else {
        console.error('LinkedIn AI: ✗ Button not found in DOM after injection!');
      }
    }, 500);
  }

  createAIButton() {
    const button = document.createElement('button');
    button.id = 'linkedin-ai-button';
    button.className = 'linkedin-ai-button';
    button.setAttribute('aria-label', 'Open AI Premium chat assistant');
    button.setAttribute('title', 'AI Premium - Ask questions about this profile');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M14 6.99C14 7.38 13.7202 7.69 13.3505 7.73C10.4126 8.05 8.06424 10.41 7.73448 13.35C7.6945 13.72 7.37473 14 7.005 14H6.995C6.62527 14 6.3055 13.72 6.26553 13.35C5.94575 10.41 3.58744 8.06 0.649536 7.73C0.470669 7.70916 0.305686 7.62329 0.185936 7.48871C0.0661869 7.35412 1.67801e-05 7.1802 0 7C0 6.61 0.2798 6.3 0.649536 6.26C3.58744 5.94 5.93576 3.58 6.25553 0.65C6.2955 0.28 6.61527 0 6.98501 0H7.005C7.37473 0 7.6945 0.28 7.73448 0.65C8.05425 3.59 10.4126 5.94 13.3505 6.27C13.7202 6.31 14 6.63 14 7V6.99Z" fill="#71B7FB"/>
      </svg>
      <span>AI</span>
    `;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleChat();
    });

    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleChat();
      }
    });

    return button;
  }

  async toggleChat() {
    if (!this.chatOpen) {
      // Check for API key first
      const { gemini_api_key } = await chrome.storage.sync.get(['gemini_api_key']);
      if (!gemini_api_key) {
        this.showAPIKeySetup();
        return;
      }

      // Scrape profile data
      const profileData = await this.scrapeProfile();
      this.currentProfile = profileData;

      // Create chat interface
      this.createChatInterface();
      this.chatOpen = true;
    } else {
      const chatContainer = document.getElementById('linkedin-ai-chat');
      if (chatContainer) {
        chatContainer.remove();
      }
      this.chatOpen = false;
    }
  }

  createChatInterface() {
    const existingChat = document.getElementById('linkedin-ai-chat');
    if (existingChat) existingChat.remove();

    const chatContainer = document.createElement('div');
    chatContainer.id = 'linkedin-ai-chat';
    chatContainer.className = 'linkedin-ai-chat-container';
    
    chatContainer.innerHTML = `
      <div class="linkedin-ai-chat">
        <!-- Fixed Navbar -->
        <div class="chat-navbar">
          <div class="navbar-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="16" fill="white" fill-opacity="0.95"/>
              <path d="M23 15.99C23 16.38 22.7202 16.69 22.3505 16.73C19.4126 17.05 17.0642 19.41 16.7345 22.35C16.6945 22.72 16.3747 23 16.005 23H15.995C15.6253 23 15.3055 22.72 15.2655 22.35C14.9458 19.41 12.5874 17.06 9.64954 16.73C9.47067 16.7092 9.30569 16.6233 9.18594 16.4887C9.06619 16.3541 9.00002 16.1802 9 16C9 15.61 9.2798 15.3 9.64954 15.26C12.5874 14.94 14.9358 12.58 15.2555 9.65C15.2955 9.28 15.6153 9 15.985 9H16.005C16.3747 9 16.6945 9.28 16.7345 9.65C17.0542 12.59 19.4126 14.94 22.3505 15.27C22.7202 15.31 23 15.63 23 16V15.99Z" fill="#D07A00"/>
            </svg>
          </div>
          <div class="navbar-title">AI Premium</div>
          <div class="navbar-controls">
            <button class="navbar-btn" id="chat-menu-btn" title="Menu">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 17.5C10.7033 17.5 10.4133 17.412 10.1666 17.2472C9.91997 17.0824 9.72771 16.8481 9.61418 16.574C9.50065 16.2999 9.47094 15.9983 9.52882 15.7074C9.5867 15.4164 9.72956 15.1491 9.93934 14.9393C10.1491 14.7296 10.4164 14.5867 10.7074 14.5288C10.9983 14.4709 11.2999 14.5006 11.574 14.6142C11.8481 14.7277 12.0824 14.92 12.2472 15.1666C12.412 15.4133 12.5 15.7033 12.5 16C12.5 16.3978 12.342 16.7794 12.0607 17.0607C11.7794 17.342 11.3978 17.5 11 17.5ZM19.5 16C19.5 16.2967 19.588 16.5867 19.7528 16.8334C19.9176 17.08 20.1519 17.2723 20.426 17.3858C20.7001 17.4994 21.0017 17.5291 21.2926 17.4712C21.5836 17.4133 21.8509 17.2704 22.0607 17.0607C22.2704 16.8509 22.4133 16.5836 22.4712 16.2926C22.5291 16.0017 22.4994 15.7001 22.3858 15.426C22.2723 15.1519 22.08 14.9176 21.8334 14.7528C21.5867 14.588 21.2967 14.5 21 14.5C20.6022 14.5 20.2206 14.658 19.9393 14.9393C19.658 15.2206 19.5 15.6022 19.5 16ZM14.5 16C14.5 16.2967 14.588 16.5867 14.7528 16.8334C14.9176 17.08 15.1519 17.2723 15.426 17.3858C15.7001 17.4994 16.0017 17.5291 16.2926 17.4712C16.5836 17.4133 16.8509 17.2704 17.0607 17.0607C17.2704 16.8509 17.4133 16.5836 17.4712 16.2926C17.5291 16.0017 17.4994 15.7001 17.3858 15.426C17.2723 15.1519 17.08 14.9176 16.8334 14.7528C16.5867 14.588 16.2967 14.5 16 14.5C15.6022 14.5 15.2206 14.658 14.9393 14.9393C14.658 15.2206 14.5 15.6022 14.5 16Z" fill="white" fill-opacity="0.65"/>
              </svg>
            </button>
            <button class="navbar-btn" id="chat-collapse-btn" title="Collapse">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 9H15V15H9V13H11.59L8 9.41L9.41 8L13 11.59V9ZM20.41 19H23V17H17V23H19V20.41L22.59 24L24 22.59L20.41 19Z" fill="white" fill-opacity="0.65"/>
              </svg>
            </button>
            <button class="navbar-btn" id="chat-close-btn" title="Close">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 11.41L17.41 16L22 20.59L20.59 22L16 17.41L11.41 22L10 20.59L14.59 16L10 11.41L11.41 10L16 14.59L20.59 10L22 11.41Z" fill="white" fill-opacity="0.65"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Chat Content - Scrollable -->
        <div class="chat-content" id="chat-content">
          <div class="chat-messages" id="chat-messages" role="log" aria-live="polite" aria-label="Chat messages"></div>
        </div>

        <!-- Fixed Input Bar at Bottom -->
        <div class="chat-input-container">
          <!-- Quick Actions (suggested prompts) -->
          <div class="quick-actions" id="quick-actions">
            <button class="quick-action-btn" data-action="Summarize">Summarize</button>
            <button class="quick-action-btn" data-action="Draft messages">Draft messages</button>
            <button class="quick-action-btn" data-action="Improve my profile">Improve my profile</button>
          </div>

          <!-- Input Box -->
          <div class="input-box-wrapper">
            <div class="input-field">
              <textarea 
                id="chat-input" 
                placeholder="Ask anything" 
                rows="1"
                aria-label="Type your message"
              ></textarea>
            </div>
            <button class="mic-btn" id="mic-btn" title="Voice input">
              <svg width="33" height="36" viewBox="0 0 33 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.5336 18.1924C22.8785 18.295 23.0755 18.6579 22.9728 19.0027L22.8943 19.2468C22.1048 21.5529 20.0283 23.2612 17.5208 23.5161L17.5217 24.6969H18.9111L19.0421 24.7102C19.3391 24.771 19.5627 25.0335 19.5627 25.3484C19.5627 25.6633 19.3391 25.9259 19.0421 25.9867L18.9111 26H14.8283C14.4686 25.9999 14.1767 25.7082 14.1767 25.3484C14.1767 24.9887 14.4686 24.697 14.8283 24.6969H16.2186L16.2176 23.5161C13.71 23.2612 11.6337 21.5529 10.8441 19.2468L10.7656 19.0027L10.7407 18.8726C10.7143 18.5707 10.903 18.2821 11.2048 18.1924C11.5066 18.1026 11.8217 18.2416 11.9645 18.509L12.0152 18.6306L12.0774 18.8248C12.7593 20.8164 14.6478 22.2474 16.8692 22.2474C19.1622 22.2473 21.1005 20.7228 21.7231 18.6306L21.7739 18.509C21.9168 18.2416 22.2318 18.1025 22.5336 18.1924ZM19.0757 13.5096C19.0757 12.2913 18.0884 11.3034 16.8702 11.3032C15.6517 11.3032 14.6637 12.2912 14.6637 13.5096V17.1838C14.6639 18.4021 15.6518 19.3894 16.8702 19.3894C18.0883 19.3892 19.0755 18.402 19.0757 17.1838V13.5096ZM20.3789 17.1838C20.3787 19.1217 18.808 20.6924 16.8702 20.6925C14.9321 20.6925 13.3607 19.1218 13.3605 17.1838V13.5096C13.3605 11.5715 14.932 10 16.8702 10C18.8082 10.0002 20.3789 11.5716 20.3789 13.5096V17.1838Z" fill="white" fill-opacity="0.95"/>
              </svg>
            </button>
            <button class="send-btn-icon" id="send-btn" disabled title="Send message">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="36" height="36" rx="18" fill="white" fill-opacity="0.95"/>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M14.5619 18.1299L16.8717 15.8202V23.3716C16.8717 23.9948 17.3769 24.5 18.0001 24.5C18.6233 24.5 19.1286 23.9948 19.1286 23.3716V15.8202L21.4383 18.1299C21.8789 18.5706 22.5934 18.5706 23.0341 18.1299C23.4748 17.6893 23.4748 16.9748 23.0341 16.5341L18.0001 11.5L12.966 16.5341C12.5253 16.9748 12.5253 17.6893 12.966 18.1299C13.4067 18.5706 14.1212 18.5706 14.5619 18.1299Z" fill="black"/>
                </svg>
              </button>
            </div>

          <!-- Caption -->
          <div class="input-caption">
            <span class="caption-text">AI can make mistakes, check important info. </span>
            <a href="https://www.linkedin.com/help/linkedin/answer/a1655947" target="_blank" class="caption-link">Learn more</a>
          </div>
        </div>
      </div>

      <!-- API Key Setup Dropdown -->
      <div class="api-key-dropdown" id="api-key-dropdown" style="display: none;">
        <div class="dropdown-header">API Key Settings</div>
        <input type="password" id="api-key-input" placeholder="Enter Gemini API Key" />
        <div class="dropdown-actions">
          <button class="dropdown-btn" id="save-api-key">Save</button>
          <button class="dropdown-btn secondary" id="get-api-key">Get API Key</button>
        </div>
      </div>
    `;

    document.body.appendChild(chatContainer);
    this.attachChatEventListeners();
    this.loadChatHistory();
  }

  attachChatEventListeners() {
    // Close button
    document.getElementById('chat-close-btn')?.addEventListener('click', () => {
      this.toggleChat();
    });

    // Collapse button
    document.getElementById('chat-collapse-btn')?.addEventListener('click', () => {
      const chat = document.querySelector('.linkedin-ai-chat');
      chat?.classList.toggle('collapsed');
      this.chatCollapsed = !this.chatCollapsed;
    });

    // Menu button (API key dropdown)
    document.getElementById('chat-menu-btn')?.addEventListener('click', () => {
      const dropdown = document.getElementById('api-key-dropdown');
      if (dropdown) {
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      }
    });

    // API key actions
    document.getElementById('save-api-key')?.addEventListener('click', async () => {
      const apiKeyInput = document.getElementById('api-key-input');
      const apiKey = apiKeyInput?.value;
      if (apiKey) {
        await chrome.storage.sync.set({ gemini_api_key: apiKey });
        const dropdown = document.getElementById('api-key-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        if (apiKeyInput) apiKeyInput.value = '';
        alert('API key saved successfully!');
      }
    });

    document.getElementById('get-api-key')?.addEventListener('click', () => {
      window.open('https://aistudio.google.com/app/apikey', '_blank');
    });

    // Send button
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');

    // Auto-resize textarea
    chatInput?.addEventListener('input', () => {
      // Reset height to calculate new height
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
      
      // Enable/disable send button
      if (chatInput.value.trim()) {
        sendBtn.disabled = false;
      } else {
        sendBtn.disabled = true;
      }
    });

    sendBtn?.addEventListener('click', () => {
      if (!sendBtn.disabled) {
      this.sendMessage();
      }
    });

    chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (chatInput.value.trim()) {
        this.sendMessage();
        }
      }
    });

    // Quick action buttons
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (chatInput && action) {
        chatInput.value = action;
        chatInput.dispatchEvent(new Event('input'));
        this.sendMessage();
        }
      });
    });

    // Mic button (placeholder for voice input)
    document.getElementById('mic-btn')?.addEventListener('click', () => {
      console.log('Voice input not yet implemented');
      // Future: Implement Web Speech API
    });
  }

  async sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const message = chatInput?.value.trim();
    if (!message) return;

    // Clear input and reset height
    if (chatInput) {
    chatInput.value = '';
      chatInput.style.height = 'auto';
    }
    if (sendBtn) {
      sendBtn.disabled = true;
    }

    // Add user message
    this.addMessage('user', message);

    // Get AI response
    await this.getAIResponse(message);
  }

  async addMessage(role, content) {
    const messagesContainer = document.getElementById('chat-messages');
    
    const messageDiv = document.createElement('div');

    if (role === 'user') {
      // User message bubble
      messageDiv.className = 'message-bubble';
      messageDiv.textContent = content;
    } else {
      // AI response with action icons
      const responseWrapper = document.createElement('div');
      responseWrapper.className = 'ai-response';
      
      const textDiv = document.createElement('div');
      textDiv.className = 'markdown-content';
      textDiv.innerHTML = parseMarkdown(content);
      responseWrapper.appendChild(textDiv);
      
      // Add action icons (copy, TTS, etc.)
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'response-actions';
      actionsDiv.innerHTML = `
        <button class="action-icon copy-icon" title="Copy">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M5.6 0C4.4402 0 3.5 0.940205 3.5 2.1V3.5H2.1C0.940205 3.5 0 4.4402 0 5.6V11.9C0 13.0598 0.940205 14 2.1 14H8.4C9.55983 14 10.5 13.0598 10.5 11.9V10.5H11.9C13.0598 10.5 14 9.55983 14 8.4V2.1C14 0.940205 13.0598 0 11.9 0H5.6ZM10.5 5.6C10.5 4.4402 9.55983 3.5 8.4 3.5H4.9V2.1C4.9 1.7134 5.2134 1.4 5.6 1.4H11.9C12.2866 1.4 12.6 1.7134 12.6 2.1V8.4C12.6 8.78661 12.2866 9.1 11.9 9.1H10.5V5.6ZM1.4 5.6C1.4 5.2134 1.7134 4.9 2.1 4.9H8.4C8.78661 4.9 9.1 5.2134 9.1 5.6V11.9C9.1 12.2866 8.78661 12.6 8.4 12.6H2.1C1.7134 12.6 1.4 12.2866 1.4 11.9V5.6Z" fill="white" fill-opacity="0.45"/>
            </svg>
        </button>
        <button class="action-icon tts-icon" title="Listen" style="display: none;">
          <svg width="19" height="14" viewBox="0 0 19 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M16.0922 2.88291C16.4463 2.69066 16.8892 2.82185 17.0814 3.17595C18.3474 5.50765 18.364 8.39665 17.125 10.7426C16.9369 11.0989 16.4956 11.2352 16.1393 11.0471C15.783 10.8589 15.6467 10.4176 15.8348 10.0612C16.8479 8.143 16.8343 5.7787 15.7992 3.87214C15.6069 3.51805 15.7381 3.07516 16.0922 2.88291ZM12.7967 4.0092C13.1189 3.76722 13.5763 3.83221 13.8182 4.15436C15.0035 5.73237 15.0741 7.94783 13.9925 9.59741C13.7716 9.93431 13.3194 10.0283 12.9824 9.80744C12.6455 9.58654 12.5515 9.13422 12.7724 8.79732C13.5207 7.65618 13.4716 6.1222 12.6516 5.03066C12.4096 4.70851 12.4746 4.25118 12.7967 4.0092Z" fill="white" fill-opacity="0.45"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M7.69821 0.482986C8.86803 -0.589342 10.7545 0.240502 10.7545 1.82745V12.1725C10.7545 13.7595 8.86803 14.5894 7.69821 13.517L5.36392 11.3772H2.5C1.11929 11.3772 0 10.2579 0 8.87719V5.12275C0 3.74204 1.11929 2.62275 2.5 2.62275H5.36392L7.69821 0.482986ZM8.68411 1.55855C8.91808 1.34408 9.29539 1.51006 9.29539 1.82745V12.1725C9.29539 12.4899 8.91808 12.6559 8.68411 12.4414L6.14066 10.1099C6.00611 9.98654 5.83022 9.91811 5.6477 9.91811H2.45908C1.90679 9.91811 1.45908 9.4704 1.45908 8.91811V5.08183C1.45908 4.52955 1.90679 4.08183 2.45908 4.08183H5.6477C5.83022 4.08183 6.00611 4.01341 6.14066 3.89007L8.68411 1.55855Z" fill="white" fill-opacity="0.45"/>
          </svg>
        </button>
      `;
      responseWrapper.appendChild(actionsDiv);
      
      // Add copy functionality
      const copyBtn = actionsDiv.querySelector('.copy-icon');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(content);
        copyBtn.innerHTML = `
          <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M11.6683 0.57774C12.0594 0.844412 12.1604 1.37766 11.8937 1.76878L5.46514 11.1973C5.3214 11.4082 5.09109 11.544 4.83703 11.5678C4.58288 11.5916 4.33137 11.501 4.15089 11.3205L0.293771 7.4634C-0.0409577 7.12869 -0.0409577 6.58595 0.293771 6.25124C0.628509 5.91653 1.17121 5.91653 1.50595 6.25124L4.63156 9.37688L10.4773 0.803072C10.744 0.411952 11.2772 0.311067 11.6683 0.57774Z" fill="white" fill-opacity="0.45"/>
          </svg>
        `;
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M5.6 0C4.4402 0 3.5 0.940205 3.5 2.1V3.5H2.1C0.940205 3.5 0 4.4402 0 5.6V11.9C0 13.0598 0.940205 14 2.1 14H8.4C9.55983 14 10.5 13.0598 10.5 11.9V10.5H11.9C13.0598 10.5 14 9.55983 14 8.4V2.1C14 0.940205 13.0598 0 11.9 0H5.6ZM10.5 5.6C10.5 4.4402 9.55983 3.5 8.4 3.5H4.9V2.1C4.9 1.7134 5.2134 1.4 5.6 1.4H11.9C12.2866 1.4 12.6 1.7134 12.6 2.1V8.4C12.6 8.78661 12.2866 9.1 11.9 9.1H10.5V5.6ZM1.4 5.6C1.4 5.2134 1.7134 4.9 2.1 4.9H8.4C8.78661 4.9 9.1 5.2134 9.1 5.6V11.9C9.1 12.2866 8.78661 12.6 8.4 12.6H2.1C1.7134 12.6 1.4 12.2866 1.4 11.9V5.6Z" fill="white" fill-opacity="0.45"/>
            </svg>
      `;
        }, 2000);
      });
      
      messageDiv = responseWrapper;
    }

    messagesContainer.appendChild(messageDiv);
  }

  async getAIResponse(userMessage, retryCount = 0) {
    const MAX_RETRIES = 2;
    
    // Show thinking indicator
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'thinking-text';
    thinkingDiv.id = 'thinking-indicator';
    thinkingDiv.textContent = 'Thinking...';
    document.getElementById('chat-messages').appendChild(thinkingDiv);

    try {
      const { gemini_api_key } = await chrome.storage.sync.get(['gemini_api_key']);
      
      if (!gemini_api_key) {
        document.getElementById('thinking-indicator')?.remove();
        this.addMessage('assistant', 'API key not found. Please configure it in settings.');
        return;
      }
      
      // Prepare context with profile data
      const context = await this.prepareContext(userMessage);
      
      // Call Gemini API via background script
      chrome.runtime.sendMessage({
        type: 'GEMINI_REQUEST',
        apiKey: gemini_api_key,
        message: context
      }, (response) => {
        // Remove thinking indicator
        document.getElementById('thinking-indicator')?.remove();
        
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          if (retryCount < MAX_RETRIES) {
            setTimeout(() => this.getAIResponse(userMessage, retryCount + 1), 1000);
          } else {
            this.addMessage('assistant', '⚠️ Connection error. Please check your internet and try again.');
          }
          return;
        }
        
        if (response && response.error) {
          console.error('API error:', response.error);
          
          // Handle specific error types
          if (response.error.includes('API key')) {
            this.addMessage('assistant', '⚠️ Invalid API key. Please update it in settings.');
          } else if (response.error.includes('quota') || response.error.includes('limit')) {
            this.addMessage('assistant', '⚠️ API quota exceeded. Please try again later or check your quota at aistudio.google.com');
          } else if (retryCount < MAX_RETRIES) {
            setTimeout(() => this.getAIResponse(userMessage, retryCount + 1), 1000);
          } else {
            this.addMessage('assistant', '⚠️ Sorry, I encountered an error. Please try again later.');
          }
        } else if (response && response.text) {
          this.addMessage('assistant', response.text);
          
          // Save message to storage
          this.saveMessageToStorage(userMessage, response.text);
        } else {
          this.addMessage('assistant', '⚠️ Received empty response. Please try again.');
        }
      });
    } catch (error) {
      console.error('Error getting AI response:', error);
      document.getElementById('thinking-indicator')?.remove();
      
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => this.getAIResponse(userMessage, retryCount + 1), 1000);
      } else {
        this.addMessage('assistant', '⚠️ An unexpected error occurred. Please refresh and try again.');
      }
    }
  }

  async saveMessageToStorage(userMessage, aiResponse) {
    try {
      const profileHash = this.hashProfile(window.location.href);
      const timestamp = new Date().toISOString();
      
      const result = await chrome.storage.local.get(['chats']);
      const chats = result.chats || {};
      
      if (!chats[profileHash]) {
        chats[profileHash] = {
          profile: this.currentProfile,
          messages: [],
          lastActive: timestamp
        };
      }
      
      chats[profileHash].messages.push(
        {
          id: `msg_${Date.now()}_user`,
          role: 'user',
          content: userMessage,
          timestamp
        },
        {
          id: `msg_${Date.now()}_ai`,
          role: 'assistant',
          content: aiResponse,
          timestamp
        }
      );
      
      // Keep only last 50 messages
      if (chats[profileHash].messages.length > 50) {
        chats[profileHash].messages = chats[profileHash].messages.slice(-50);
      }
      
      chats[profileHash].lastActive = timestamp;
      
      await chrome.storage.local.set({ chats });
    } catch (error) {
      console.error('Error saving chat to storage:', error);
    }
  }

  async prepareContext(userMessage) {
    // Get user's own profile data for context
    const { user_profile } = await chrome.storage.sync.get(['user_profile']);
    
    let contextMessage = '';
    
    // Add comprehensive user profile context if available
    if (user_profile) {
      contextMessage += `=== YOUR PROFILE (Person asking this question) ===\n`;
      contextMessage += `Name: ${user_profile.name || 'User'}\n`;
      if (user_profile.headline) contextMessage += `Headline: ${user_profile.headline}\n`;
      if (user_profile.location) contextMessage += `Location: ${user_profile.location}\n`;
      
      if (user_profile.about) {
        contextMessage += `\nAbout: ${user_profile.about}\n`;
      }
      
      // Add experience
      if (user_profile.experience && user_profile.experience.length > 0) {
        contextMessage += `\nExperience:\n`;
        user_profile.experience.slice(0, 5).forEach(exp => {
          contextMessage += `- ${exp.title}${exp.company ? ' at ' + exp.company : ''}${exp.duration ? ' (' + exp.duration + ')' : ''}\n`;
        });
      }
      
      // Add education
      if (user_profile.education && user_profile.education.length > 0) {
        contextMessage += `\nEducation:\n`;
        user_profile.education.slice(0, 3).forEach(edu => {
          contextMessage += `- ${edu.school}${edu.degree ? ': ' + edu.degree : ''}\n`;
        });
      }
      
      // Add skills
      if (user_profile.skills && user_profile.skills.length > 0) {
        contextMessage += `\nTop Skills: ${user_profile.skills.slice(0, 10).join(', ')}\n`;
      }
      
      // Add certifications
      if (user_profile.certifications && user_profile.certifications.length > 0) {
        contextMessage += `\nCertifications: ${user_profile.certifications.slice(0, 5).join(', ')}\n`;
      }
      
      contextMessage += `\n`;
    }
    
    // Add the profile being viewed
    if (!this.currentProfile) {
      return contextMessage + userMessage;
    }

    contextMessage += `=== PROFILE BEING VIEWED ===\n`;
    contextMessage += `Name: ${this.currentProfile.name}\n`;
    contextMessage += `Headline: ${this.currentProfile.headline || 'Not available'}\n`;
    contextMessage += `Location: ${this.currentProfile.location || 'Not available'}\n`;
    if (this.currentProfile.about) {
      contextMessage += `About: ${this.currentProfile.about}\n`;
    }

    contextMessage += `\n=== USER QUESTION ===\n${userMessage}\n\n`;
    contextMessage += `Provide a helpful, professional response. Use the information about the user asking (your profile) to give personalized advice and context-aware suggestions.`;

    return contextMessage;
  }

  async scrapeProfile() {
    try {
      // Use the LinkedInScraper utility
      if (typeof LinkedInScraper !== 'undefined') {
        return await LinkedInScraper.scrapeProfile();
      }
      
      // Fallback basic scraping
      const profile = {
        name: '',
        headline: '',
        location: '',
        about: '',
        url: window.location.href,
        scrapedAt: new Date().toISOString()
      };

      const nameEl = document.querySelector('h1.text-heading-xlarge, h1.inline');
      if (nameEl) profile.name = nameEl.textContent.trim();

      const headlineEl = document.querySelector('.text-body-medium.break-words, .top-card-layout__headline');
      if (headlineEl) profile.headline = headlineEl.textContent.trim();

      const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words, .top-card__subline-item');
      if (locationEl) profile.location = locationEl.textContent.trim();

      const aboutEl = document.querySelector('.display-flex.ph5.pv3 > div > span[aria-hidden="true"]');
      if (aboutEl) profile.about = aboutEl.textContent.trim();

      return profile;
    } catch (error) {
      console.error('Error scraping profile:', error);
      return {
        name: 'Unknown',
        url: window.location.href,
        error: 'Failed to scrape profile data',
        scrapedAt: new Date().toISOString()
      };
    }
  }

  async loadChatHistory() {
    // Load existing chat history for this profile
    const profileHash = this.hashProfile(window.location.href);
    const result = await chrome.storage.local.get(['chats']);
    const chats = result.chats || {};
    
    if (chats[profileHash]) {
      const chat = chats[profileHash];
      // Display messages
      chat.messages.forEach(msg => {
        this.addMessage(msg.role, msg.content);
      });
    }
  }

  hashProfile(url) {
    // Simple hash function for profile URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showAPIKeySetup() {
    const modal = document.createElement('div');
    modal.className = 'api-key-modal';
    modal.innerHTML = `
      <div class="api-key-modal-content">
        <h2>Connect Your Gemini API</h2>
        <p>Get your free API key from Google AI Studio</p>
        <input type="password" id="modal-api-key-input" placeholder="Paste your API key here" />
        <div class="modal-actions">
          <button id="modal-save-key">Save & Continue</button>
          <button id="modal-get-key">Get API Key</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('modal-save-key').addEventListener('click', async () => {
      const apiKey = document.getElementById('modal-api-key-input').value;
      if (apiKey) {
        await chrome.storage.sync.set({ gemini_api_key: apiKey });
        modal.remove();
        this.toggleChat();
      }
    });

    document.getElementById('modal-get-key').addEventListener('click', () => {
      window.open('https://aistudio.google.com/app/apikey', '_blank');
    });
  }

  observeProfileChanges() {
    let lastUrl = window.location.href;
    let checkCount = 0;
    
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      
      // Profile navigation detected
      if (currentUrl !== lastUrl && currentUrl.includes('/in/')) {
        lastUrl = currentUrl;
        console.log('LinkedIn AI: Profile navigation detected:', currentUrl);
        
        // Remove old button
        const oldButton = document.getElementById('linkedin-ai-button');
        if (oldButton) {
          console.log('LinkedIn AI: Removing old button');
          oldButton.remove();
        }
        
        // Inject new button
        setTimeout(() => this.injectAIButton(), 1000);
        
        // If chat is open, switch context
        if (this.chatOpen) {
          this.scrapeProfile().then(profile => {
            this.currentProfile = profile;
            const notification = document.createElement('div');
            notification.className = 'profile-switch-notification';
            notification.textContent = `Switched to ${profile.name}'s profile`;
            const chatEl = document.getElementById('linkedin-ai-chat');
            if (chatEl) {
              chatEl.appendChild(notification);
              setTimeout(() => notification.remove(), 3000);
            }
          });
        }
      }
      
      // Re-inject button if it disappears (LinkedIn removes it)
      // Only check every 10 mutations to reduce overhead
      checkCount++;
      if (checkCount % 10 === 0 && window.location.href.includes('/in/')) {
        const button = document.getElementById('linkedin-ai-button');
        if (!button || !button.isConnected) {
          console.log('LinkedIn AI: Button was removed by LinkedIn, re-injecting...');
          setTimeout(() => this.injectAIButton(), 500);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new LinkedInAI());
} else {
  new LinkedInAI();
}

// Debug helper - expose to window for manual testing
window.LinkedInAI_Debug = {
  findContainer: () => {
    const ai = new LinkedInAI();
    const container = ai.findProfileActionsContainer();
    if (container) {
      console.log('Found container:', container);
      container.style.border = '2px solid red';
      return container;
    } else {
      console.log('No container found. Trying all possible selectors:');
      const selectors = [
        '.pv-top-card-v2-ctas',
        '.pvs-profile-actions',
        '.artdeco-card__actions',
        '[data-view-name="profile-topcard-actions"]',
        '.pv-top-card-v2-section__actions',
        'button[aria-label*="Message"]',
        'button[aria-label*="Connect"]'
      ];
      selectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) console.log(`✓ Found: ${sel}`, el);
        else console.log(`✗ Not found: ${sel}`);
      });
    }
  },
  injectButton: () => {
    const ai = new LinkedInAI();
    ai.injectAIButton();
  }
};

