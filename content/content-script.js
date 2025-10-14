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

// Strip markdown formatting from text (for copy/share)
function stripMarkdown(text) {
  if (!text) return '';
  
  let stripped = text;
  
  // Remove code blocks
  stripped = stripped.replace(/```[^`]*```/g, (match) => {
    return match.replace(/```/g, '').trim();
  });
  
  // Remove inline code backticks
  stripped = stripped.replace(/`([^`]+)`/g, '$1');
  
  // Remove links but keep text [text](url) -> text
  stripped = stripped.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove bold **text** or __text__
  stripped = stripped.replace(/\*\*(.+?)\*\*/g, '$1');
  stripped = stripped.replace(/__(.+?)__/g, '$1');
  
  // Remove italic *text* or _text_
  stripped = stripped.replace(/\*(.+?)\*/g, '$1');
  stripped = stripped.replace(/_(.+?)_/g, '$1');
  
  // Remove headers (# ## ### etc)
  stripped = stripped.replace(/^#{1,6}\s+(.+)$/gm, '$1');
  
  // Remove blockquote markers
  stripped = stripped.replace(/^>\s+/gm, '');
  
  // Remove horizontal rules
  stripped = stripped.replace(/^---$/gm, '');
  stripped = stripped.replace(/^\*\*\*$/gm, '');
  
  // Remove list markers (-, *, 1., etc) but keep the text
  stripped = stripped.replace(/^[\s]*[-*+]\s+/gm, '');
  stripped = stripped.replace(/^[\s]*\d+\.\s+/gm, '');
  
  return stripped.trim();
}

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
  
  // Lists (unordered) - handle nested bullets by indentation
  // First, handle indented sub-bullets (2+ spaces before *)
  text = text.replace(/^[ \t]{2,}\*\s+(.+)$/gm, '<subli>$1</subli>');
  text = text.replace(/^[ \t]{2,}-\s+(.+)$/gm, '<subli>$1</subli>');
  
  // Then handle top-level bullets
  text = text.replace(/^\*\s+(.+)$/gm, '<li>$1</li>');
  text = text.replace(/^-\s+(.+)$/gm, '<li>$1</li>');
  
  // Wrap sub-bullets in nested ul
  text = text.replace(/(<subli>.*<\/subli>\n?)+/g, '<ul class="nested">$&</ul>');
  text = text.replace(/<subli>/g, '<li>');
  text = text.replace(/<\/subli>/g, '</li>');
  
  // Wrap top-level lists in ul
  text = text.replace(/(<li>.*<\/li>(\n|<ul class="nested">.*<\/ul>\n?)*)+/g, '<ul>$&</ul>');
  
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
  
  // Clean up: Remove <br> tags between list items for tighter spacing
  text = text.replace(/<\/li><br><li>/g, '</li><li>');
  text = text.replace(/<\/li><br><\/ul>/g, '</li></ul>');
  text = text.replace(/<ul><br>/g, '<ul>');
  text = text.replace(/<br><ul/g, '<ul');
  
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
    this.streamingMessageId = null;
    this.messageCount = 0; // Track if this is first message
    this.init();
    this.setupMessageListener();
  }

  setupMessageListener() {
    // Listen for streaming chunks from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'GEMINI_STREAM_CHUNK') {
        this.handleStreamChunk(request.fullText);
      }
    });
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
      <div data-layer="linkedin AI Premium" class="linkedin-ai-chat-panel">
        <div data-layer="fixed chat bar" class="chat-input-bar">
          <div data-layer="overlay prompt input box" class="input-container">
            <div data-layer="flexbox" class="input-wrapper">
              <textarea data-layer="text input/placeholder" class="chat-input" id="chat-input" placeholder="Ask anything" rows="1" aria-label="Type your message"></textarea>
            </div>
            <button data-layer="dictate/mic button" class="mic-button" id="mic-btn" type="button" title="Voice input">
              <svg width="33" height="36" viewBox="0 0 33 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.5336 18.1924C22.8785 18.295 23.0755 18.6579 22.9728 19.0027L22.8943 19.2468C22.1048 21.5529 20.0283 23.2612 17.5208 23.5161L17.5217 24.6969H18.9111L19.0421 24.7102C19.3391 24.771 19.5627 25.0335 19.5627 25.3484C19.5627 25.6633 19.3391 25.9259 19.0421 25.9867L18.9111 26H14.8283C14.4686 25.9999 14.1767 25.7082 14.1767 25.3484C14.1767 24.9887 14.4686 24.697 14.8283 24.6969H16.2186L16.2176 23.5161C13.71 23.2612 11.6337 21.5529 10.8441 19.2468L10.7656 19.0027L10.7407 18.8726C10.7143 18.5707 10.903 18.2821 11.2048 18.1924C11.5066 18.1026 11.8217 18.2416 11.9645 18.509L12.0152 18.6306L12.0774 18.8248C12.7593 20.8164 14.6478 22.2474 16.8692 22.2474C19.1622 22.2473 21.1005 20.7228 21.7231 18.6306L21.7739 18.509C21.9168 18.2416 22.2318 18.1025 22.5336 18.1924ZM19.0757 13.5096C19.0757 12.2913 18.0884 11.3034 16.8702 11.3032C15.6517 11.3032 14.6637 12.2912 14.6637 13.5096V17.1838C14.6639 18.4021 15.6518 19.3894 16.8702 19.3894C18.0883 19.3892 19.0755 18.402 19.0757 17.1838V13.5096ZM20.3789 17.1838C20.3787 19.1217 18.808 20.6924 16.8702 20.6925C14.9321 20.6925 13.3607 19.1218 13.3605 17.1838V13.5096C13.3605 11.5715 14.932 10 16.8702 10C18.8082 10.0002 20.3789 11.5716 20.3789 13.5096V17.1838Z" fill="white" fill-opacity="0.95"/>
              </svg>
            </button>
            <button data-layer="send button greyed out when no text/image input" class="send-button" id="send-btn" type="button" title="Send message" disabled>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g opacity="0.5">
                  <rect width="36" height="36" rx="18" fill="white" fill-opacity="0.95"/>
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M14.5619 18.1299L16.8717 15.8202V23.3716C16.8717 23.9948 17.3769 24.5 18.0001 24.5C18.6233 24.5 19.1286 23.9948 19.1286 23.3716V15.8202L21.4383 18.1299C21.8789 18.5706 22.5934 18.5706 23.0341 18.1299C23.4748 17.6893 23.4748 16.9748 23.0341 16.5341L18.0001 11.5L12.966 16.5341C12.5253 16.9748 12.5253 17.6893 12.966 18.1299C13.4067 18.5706 14.1212 18.5706 14.5619 18.1299Z" fill="black"/>
                </g>
              </svg>
            </button>
          </div>
          <div data-layer="caption" class="chat-caption">AI can make mistakes. Check important info.</div>
        </div>
        <div data-layer="fixed navbar" class="chat-navbar">
          <div data-svg-wrapper data-layer="profile icon navbar" className="navbar-profile-icon" style="position: relative;">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="16" fill="white" fill-opacity="0.95"/>
              <path d="M23 15.99C23 16.38 22.7202 16.69 22.3505 16.73C19.4126 17.05 17.0642 19.41 16.7345 22.35C16.6945 22.72 16.3747 23 16.005 23H15.995C15.6253 23 15.3055 22.72 15.2655 22.35C14.9458 19.41 12.5874 17.06 9.64954 16.73C9.47067 16.7092 9.30569 16.6233 9.18594 16.4887C9.06619 16.3541 9.00002 16.1802 9 16C9 15.61 9.2798 15.3 9.64954 15.26C12.5874 14.94 14.9358 12.58 15.2555 9.65C15.2955 9.28 15.6153 9 15.985 9H16.005C16.3747 9 16.6945 9.28 16.7345 9.65C17.0542 12.59 19.4126 14.94 22.3505 15.27C22.7202 15.31 23 15.63 23 16V15.99Z" fill="#D07A00"/>
            </svg>
          </div>
          <div data-layer="AI Premium" class="navbar-title">AI Premium</div>
          <div data-layer="flexbox" class="navbar-actions">
            <div data-svg-wrapper data-layer="settings. clicking this opens chrome extension the existing popup settings." className="settings-button" id="chat-menu-btn" role="button" tabindex="0" aria-label="API key menu">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 17.5C10.7033 17.5 10.4133 17.412 10.1666 17.2472C9.91997 17.0824 9.72771 16.8481 9.61418 16.574C9.50065 16.2999 9.47094 15.9983 9.52882 15.7074C9.5867 15.4164 9.72956 15.1491 9.93934 14.9393C10.1491 14.7296 10.4164 14.5867 10.7074 14.5288C10.9983 14.4709 11.2999 14.5006 11.574 14.6142C11.8481 14.7277 12.0824 14.92 12.2472 15.1666C12.412 15.4133 12.5 15.7033 12.5 16C12.5 16.3978 12.342 16.7794 12.0607 17.0607C11.7794 17.342 11.3978 17.5 11 17.5ZM19.5 16C19.5 16.2967 19.588 16.5867 19.7528 16.8334C19.9176 17.08 20.1519 17.2723 20.426 17.3858C20.7001 17.4994 21.0017 17.5291 21.2926 17.4712C21.5836 17.4133 21.8509 17.2704 22.0607 17.0607C22.2704 16.8509 22.4133 16.5836 22.4712 16.2926C22.5291 16.0017 22.4994 15.7001 22.3858 15.426C22.2723 15.1519 22.08 14.9176 21.8334 14.7528C21.5867 14.588 21.2967 14.5 21 14.5C20.6022 14.5 20.2206 14.658 19.9393 14.9393C19.658 15.2206 19.5 15.6022 19.5 16ZM14.5 16C14.5 16.2967 14.588 16.5867 14.7528 16.8334C14.9176 17.08 15.1519 17.2723 15.426 17.3858C15.7001 17.4994 16.0017 17.5291 16.2926 17.4712C16.5836 17.4133 16.8509 17.2704 17.0607 17.0607C17.2704 16.8509 17.4133 16.5836 17.4712 16.2926C17.5291 16.0017 17.4994 15.7001 17.3858 15.426C17.2723 15.1519 17.08 14.9176 16.8334 14.7528C16.5867 14.588 16.2967 14.5 16 14.5C15.6022 14.5 15.2206 14.658 14.9393 14.9393C14.658 15.2206 14.5 15.6022 14.5 16Z" fill="white" fill-opacity="0.65"/>
              </svg>
            </div>
            <div data-svg-wrapper data-layer="new chat button. clears chat history and chats new chat in same place." className="new-chat-button" id="new-chat-btn" role="button" tabindex="0" aria-label="New chat">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.4998 11.0299C22.483 11.4065 22.3261 11.7632 22.0598 12.0299L16.6498 17.4999L13.4998 18.4999L14.4998 15.3799L19.9398 9.93994C20.1513 9.72852 20.4213 9.58518 20.7149 9.52833C21.0085 9.47147 21.3125 9.5037 21.5877 9.62087C21.8628 9.73804 22.0967 9.9348 22.2592 10.1859C22.4218 10.437 22.5055 10.7309 22.4998 11.0299ZM19.4998 19.4999C19.4998 19.7652 19.3944 20.0195 19.2069 20.207C19.0193 20.3946 18.765 20.4999 18.4998 20.4999H12.4998C12.2345 20.4999 11.9802 20.3946 11.7926 20.207C11.6051 20.0195 11.4998 19.7652 11.4998 19.4999V13.4999C11.4998 13.2347 11.6051 12.9804 11.7926 12.7928C11.9802 12.6053 12.2345 12.4999 12.4998 12.4999H15.4998V10.4999H12.4998C11.7041 10.4999 10.941 10.816 10.3784 11.3786C9.81583 11.9412 9.49976 12.7043 9.49976 13.4999V19.4999C9.49976 20.2956 9.81583 21.0586 10.3784 21.6213C10.941 22.1839 11.7041 22.4999 12.4998 22.4999H18.4998C19.2954 22.4999 20.0585 22.1839 20.6211 21.6213C21.1837 21.0586 21.4998 20.2956 21.4998 19.4999V16.4999H19.4998V19.4999Z" fill="white" fill-opacity="0.65"/>
              </svg>
            </div>
            <div data-svg-wrapper data-layer="close chat" className="close-chat-button" id="chat-close-btn" role="button" tabindex="0" aria-label="Close chat">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 11.41L17.41 16L22 20.59L20.59 22L16 17.41L11.41 22L10 20.59L14.59 16L10 11.41L11.41 10L16 14.59L20.59 10L22 11.41Z" fill="white" fill-opacity="0.65"/>
              </svg>
            </div>
          </div>
        </div>
        <div class="chat-viewport" id="chat-content" role="log" aria-live="polite" aria-label="Chat messages">
          <div class="chat-messages" id="chat-messages"></div>
          <div data-layer="auto layout" class="quick-actions-container" id="quick-actions">
            <div data-layer="summarize" class="quick-action" 
                 data-action="Summarize" 
                 data-backend-action="Write a human summary like you're telling your mom about this person. Focus on who they are as a person, what they're passionate about, and how to start a conversation with them. Focus on work, schools, personality, interests, and what makes them relatable.

Include: where they live/work, what they're into (hobbies, interests), their personality vibe, and conversation starters. Use normal words people actually say.

Format:
[One sentence about who they are as a person]

• [Emoji] [3-7 human, conversational points about their personality, interests, and how to connect with them]"

                 role="button" tabindex="0" aria-label="Summarize">
              <div data-layer="Summarize">Summarize</div>
            </div>
            <div data-layer="draft messages" class="quick-action" 
                 data-action="Draft messages" 
                 data-backend-action="Draft 2-3 natural, human messages I could send to connect with this person. Focus on genuine conversation starters based on shared interests, experiences, or just being friendly. Keep it casual and authentic - like how you'd actually talk to someone you want to get to know. Avoid sales-y language or trying to impress them."
                 role="button" tabindex="0" aria-label="Draft messages">
              <div data-layer="Draft messages">Draft messages</div>
            </div>
            <div data-layer="improve my profile (to better sell myself to this person)" class="quick-action" 
                 data-action="Improve my profile" 
                 data-backend-action="Look at my profile and this person's profile and suggest 3-5 ways I could make my profile more authentic and human. Focus on showing my personality, interests, and what I'm passionate about - not just my job title. Help me come across as someone people would want to have a conversation with, not just work with."
                 role="button" tabindex="0" aria-label="Improve my profile">
              <div data-layer="Improve my profile">Improve my profile</div>
            </div>
          </div>
        </div>
      </div>

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
    const menuBtn = document.getElementById('chat-menu-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const closeBtn = document.getElementById('chat-close-btn');

    const toggleDropdown = async () => {
      const dropdown = document.getElementById('api-key-dropdown');
      const apiKeyInput = document.getElementById('api-key-input');
      
      if (dropdown) {
        const isHidden = dropdown.style.display === 'none';
        
        if (isHidden) {
          // Load current API key when opening dropdown
          const { gemini_api_key } = await chrome.storage.sync.get(['gemini_api_key']);
          if (apiKeyInput && gemini_api_key) {
            apiKeyInput.value = gemini_api_key;
          }
          dropdown.style.display = 'block';
        } else {
          dropdown.style.display = 'none';
        }
      }
    };

    const handleNewChat = () => {
      // Clear chat messages
      const messagesContainer = document.getElementById('chat-messages');
      if (messagesContainer) {
        messagesContainer.innerHTML = '';
      }
      // Reset message count
      this.messageCount = 0;
      this.streamingMessageId = null;
    };

    const attachButtonHandlers = (element, handler) => {
      if (!element) return;
      element.addEventListener('click', handler);
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handler();
        }
      });
    };

    attachButtonHandlers(menuBtn, toggleDropdown);
    attachButtonHandlers(newChatBtn, handleNewChat);
    attachButtonHandlers(closeBtn, () => this.toggleChat());

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

    // Quick action buttons - delegate to container for dynamic suggestions
    const quickActionsContainer = document.getElementById('quick-actions');
    if (quickActionsContainer) {
      quickActionsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.quick-action');
        if (btn) {
          const displayText = btn.getAttribute('data-action');
          const backendText = btn.getAttribute('data-backend-action') || displayText;
          this.handleQuickAction(displayText, backendText);
        }
      });

      quickActionsContainer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const btn = e.target.closest('.quick-action');
          if (btn) {
            e.preventDefault();
            const displayText = btn.getAttribute('data-action');
            const backendText = btn.getAttribute('data-backend-action') || displayText;
            this.handleQuickAction(displayText, backendText);
          }
        }
      });
    }

    // Mic button - Web Speech API
    const micBtn = document.getElementById('mic-btn');
    let recognition = null;
    let isListening = false;
    
    // Check if browser supports Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        isListening = true;
        if (micBtn) {
          micBtn.style.opacity = '0.6';
          micBtn.setAttribute('title', 'Listening... Click to stop');
        }
      };
      
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        
        if (chatInput) {
          chatInput.value = transcript;
          chatInput.dispatchEvent(new Event('input'));
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isListening = false;
        if (micBtn) {
          micBtn.style.opacity = '1';
          micBtn.setAttribute('title', 'Voice input');
        }
      };
      
      recognition.onend = () => {
        isListening = false;
        if (micBtn) {
          micBtn.style.opacity = '1';
          micBtn.setAttribute('title', 'Voice input');
        }
      };
    }
    
    micBtn?.addEventListener('click', () => {
      if (!recognition) {
        alert('Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.');
        return;
      }
      
      if (isListening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    });
  }

  handleQuickAction(displayText, backendText) {
    const chatInput = document.getElementById('chat-input');
    
    // Show display text in input briefly, then send backend text to AI
    if (chatInput) {
      chatInput.value = displayText;
      chatInput.dispatchEvent(new Event('input'));
    }
    
    // Add user message with display text
    this.addMessage('user', displayText);
    
    // Clear input
    if (chatInput) {
      chatInput.value = '';
      chatInput.style.height = 'auto';
    }
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
      sendBtn.disabled = true;
    }
    
    // Send backend text to AI
    this.getAIResponse(backendText);
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
    if (!messagesContainer) return;

    if (role === 'user') {
      const bubble = document.createElement('div');
      bubble.setAttribute('data-layer', 'message bubble');
      bubble.className = 'message-bubble user-message';

      const textDiv = document.createElement('div');
      textDiv.setAttribute('data-layer', "example of user's text");
      textDiv.className = "user-message-text";
      textDiv.textContent = content;

      bubble.appendChild(textDiv);
      messagesContainer.appendChild(bubble);
      return;
    }

      const responseWrapper = document.createElement('div');
    responseWrapper.setAttribute('data-layer', 'flexbox');
    responseWrapper.className = 'ai-response-block';
      
      const textDiv = document.createElement('div');
    textDiv.setAttribute('data-layer', "this is an example of model's output. this is an example of model's output. this is an example of model's output.");
    textDiv.className = "ai-message-text markdown-content";
      textDiv.innerHTML = parseMarkdown(content);
      responseWrapper.appendChild(textDiv);
      
      const actionsDiv = document.createElement('div');
    actionsDiv.setAttribute('data-layer', 'quick actions');
    actionsDiv.className = 'ai-message-quick-actions';
      actionsDiv.innerHTML = `
      <div data-svg-wrapper data-layer="thumbs up icon" class="thumbs-up-icon" role="button" tabindex="0" aria-label="Like response">
        <svg width="13" height="15" viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10.8496 13.291L10.9775 13.2725C11.2908 13.225 11.5762 13.0659 11.7822 12.8252C11.9875 12.5854 12.1001 12.2804 12.0996 11.9648C12.0929 11.7399 12.0343 11.5195 11.9277 11.3213L11.8086 11.1006H12.0732C12.2309 11.0254 12.3736 10.923 12.4922 10.7959L12.6074 10.6533C12.8081 10.364 12.8865 10.0068 12.8242 9.66016C12.7618 9.3131 12.5639 9.00508 12.2744 8.80371L12.0947 8.67871L12.2764 8.55566C12.4537 8.43614 12.5992 8.27498 12.6992 8.08594C12.7992 7.89682 12.8506 7.68562 12.8496 7.47168V7.46973C12.8501 7.13338 12.7224 6.80969 12.4922 6.56445C12.2906 6.3497 12.024 6.20952 11.7354 6.16406L11.6104 6.15039H8.26367L8.32715 5.9541L8.60742 5.09375L8.6084 5.0918C8.81012 4.49914 8.91203 3.87703 8.91016 3.25098V2.08008C8.91008 1.57171 8.7092 1.08395 8.35156 0.722656C7.99373 0.361354 7.50749 0.155407 6.99902 0.150391H6.99707C6.59369 0.141709 6.19713 0.259295 5.86426 0.487305C5.53359 0.713814 5.28179 1.03799 5.14355 1.41406V1.41504L4.9834 1.92578L4.98047 1.93164C4.63277 2.88252 4.11529 3.76242 3.45312 4.52832V4.5293L1.20312 7.09961L1.1582 7.15039H0.150391V13.8506H1.32031L1.34766 13.8623L2.34766 14.2822H2.34863L2.35645 14.2861C3.10707 14.6568 3.93334 14.85 4.77051 14.8506H9.59375C9.93487 14.8366 10.2576 14.6904 10.4922 14.4424C10.7268 14.1943 10.8546 13.8639 10.8496 13.5225V13.291ZM1.84961 8.69043L1.89062 8.64746L4.72754 5.65137C5.44478 4.83235 6.02079 3.90098 6.43262 2.89551L6.59863 2.45996L6.77832 1.9502L6.80176 1.88574L6.86523 1.86035L6.91211 1.84766C6.9596 1.83875 7.00908 1.84255 7.05469 1.86035V1.86133C7.07518 1.86906 7.09481 1.87876 7.1123 1.8916L7.16211 1.94141C7.17625 1.96026 7.1873 1.98104 7.19531 2.00293L7.20996 2.07227V3.25098C7.20858 3.69423 7.13888 4.13475 7.00293 4.55664L7.00195 4.55762L5.9082 7.85059H10.7275L10.7529 7.86035C10.8095 7.88175 10.8614 7.91439 10.9043 7.95703C10.9473 7.99975 10.9802 8.05185 11.002 8.1084C11.0236 8.16476 11.0335 8.22487 11.0303 8.28516C11.027 8.34562 11.0111 8.40513 10.9834 8.45898L10.9756 8.47266L10.626 9.00586L10.9502 9.57617C11.0289 9.71188 11.0606 9.86983 11.04 10.0254C11.0194 10.1812 10.9475 10.3259 10.8359 10.4365L10.4707 10.8018L10.5479 11.2871L10.5488 11.2881C10.5722 11.4448 10.542 11.6053 10.4639 11.7432C10.3861 11.8803 10.2646 11.9872 10.1191 12.0479V12.0488L9.69434 12.2305L9.57422 12.6426C9.53249 12.7889 9.4437 12.9171 9.32227 13.0088C9.20067 13.1006 9.05272 13.1505 8.90039 13.1504H4.76953C4.20092 13.1492 3.64029 13.0181 3.12988 12.7676L1.93945 12.248L1.84961 12.209V8.69043Z" fill="white" fill-opacity="0.45" stroke="#0F0F0F" stroke-width="0.3"/>
        </svg>
      </div>
      <div data-svg-wrapper data-layer="thumbs down icon" class="thumbs-down-icon" role="button" tabindex="0" aria-label="Dislike response">
        <svg width="13" height="15" viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.15039 1.70947L2.02246 1.72803C1.70918 1.77544 1.42385 1.93462 1.21777 2.17529C1.0125 2.41506 0.899866 2.72009 0.900391 3.03564C0.907095 3.26054 0.965735 3.48102 1.07227 3.6792L1.19141 3.8999H0.926758C0.769064 3.97511 0.626378 4.07752 0.507812 4.20459L0.392578 4.34717C0.191866 4.63652 0.113519 4.99369 0.175781 5.34033C0.238163 5.68739 0.436115 5.99541 0.725586 6.19678L0.905273 6.32178L0.723633 6.44482C0.546266 6.56435 0.400819 6.7255 0.300781 6.91455C0.20075 7.10367 0.149382 7.31487 0.150391 7.52881V7.53076C0.14988 7.86711 0.277598 8.1908 0.507812 8.43604C0.709415 8.65079 0.976014 8.79096 1.26465 8.83643L1.38965 8.8501H4.73633L4.67285 9.04639L4.39258 9.90674L4.3916 9.90869C4.18988 10.5014 4.08797 11.1235 4.08984 11.7495V12.9204C4.08992 13.4288 4.2908 13.9165 4.64844 14.2778C5.00627 14.6391 5.49251 14.8451 6.00098 14.8501H6.00293C6.40631 14.8588 6.80287 14.7412 7.13574 14.5132C7.46641 14.2867 7.71821 13.9625 7.85645 13.5864V13.5854L8.0166 13.0747L8.01953 13.0688C8.36723 12.118 8.88471 11.2381 9.54688 10.4722V10.4712L11.7969 7.90088L11.8418 7.8501H12.8496V1.1499H11.6797L11.6523 1.13818L10.6523 0.718262H10.6514L10.6436 0.714355C9.89293 0.343659 9.06666 0.150528 8.22949 0.149902H3.40625C3.06513 0.163897 2.74244 0.310093 2.50781 0.558105C2.27318 0.806145 2.14543 1.13663 2.15039 1.47803V1.70947ZM11.1504 6.31006L11.1094 6.35303L8.27246 9.34912C7.55522 10.1681 6.97921 11.0995 6.56738 12.105L6.40137 12.5405L6.22168 13.0503L6.19824 13.1147L6.13477 13.1401L6.08789 13.1528C6.0404 13.1617 5.99092 13.1579 5.94531 13.1401V13.1392C5.92482 13.1314 5.90519 13.1217 5.8877 13.1089L5.83789 13.0591C5.82375 13.0402 5.8127 13.0195 5.80469 12.9976L5.79004 12.9282V11.7495C5.79142 11.3063 5.86112 10.8657 5.99707 10.4438L5.99805 10.4429L7.0918 7.1499H2.27246L2.24707 7.14014C2.19046 7.11874 2.13864 7.0861 2.0957 7.04346C2.05274 7.00074 2.0198 6.94864 1.99805 6.89209C1.9764 6.83573 1.96653 6.77562 1.96973 6.71533C1.97299 6.65487 1.98892 6.59535 2.0166 6.5415L2.02441 6.52783L2.37402 5.99463L2.0498 5.42432C1.97108 5.2886 1.93941 5.13066 1.95996 4.9751C1.98058 4.81928 2.05245 4.67462 2.16406 4.56396L2.5293 4.19873L2.45215 3.71338L2.45117 3.7124C2.42784 3.55568 2.45802 3.39517 2.53613 3.25732C2.61389 3.12017 2.73537 3.01329 2.88086 2.95264V2.95166L3.30566 2.77002L3.42578 2.35791C3.46751 2.21162 3.5563 2.08336 3.67773 1.9917C3.79933 1.89993 3.94728 1.85 4.09961 1.8501H8.23047C8.79908 1.85129 9.35971 1.98243 9.87012 2.23291L11.0605 2.75244L11.1504 2.7915V6.31006Z" fill="white" fill-opacity="0.45" stroke="#0F0F0F" stroke-width="0.3"/>
        </svg>
      </div>
      <div data-svg-wrapper data-layer="share icon" class="share-icon" role="button" tabindex="0" aria-label="Share response">
        <svg width="14" height="15" viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6.60391e-07 10.0461V9.88762C6.60391e-07 9.53703 0.284305 9.25269 0.634966 9.25269C0.985626 9.25269 1.26993 9.53703 1.26993 9.88762V10.0461C1.26993 10.7249 1.2708 11.196 1.3007 11.5622C1.33 11.9208 1.38426 12.1228 1.46108 12.2736L1.52821 12.3949C1.69654 12.6693 1.93812 12.8931 2.22657 13.0401L2.35058 13.0932C2.48785 13.1424 2.66879 13.1785 2.93799 13.2004C3.30417 13.2304 3.77519 13.2303 4.45407 13.2303H9.54595C10.2246 13.2303 10.6959 13.2304 11.062 13.2004C11.4204 13.1712 11.6226 13.1169 11.7734 13.0401L11.8946 12.972C12.169 12.8037 12.3929 12.562 12.5398 12.2736L12.593 12.1497C12.6421 12.0124 12.6782 11.8313 12.7002 11.5622C12.7301 11.196 12.73 10.7249 12.73 10.0461V9.88762C12.73 9.53712 13.0145 9.25289 13.3651 9.25269C13.7156 9.25269 14 9.53703 14 9.88762V10.0461C14 10.704 14.0006 11.2359 13.9655 11.6657C13.9342 12.0486 13.8721 12.3933 13.7343 12.7147L13.6709 12.8508C13.4174 13.3482 13.0317 13.7642 12.5585 14.0546L12.3506 14.171C11.9908 14.3544 11.6028 14.43 11.1654 14.4657C10.7356 14.5008 10.2038 14.5002 9.54595 14.5002H4.45407C3.79615 14.5002 3.26437 14.5008 2.83449 14.4657C2.45207 14.4345 2.10749 14.3731 1.78648 14.2354L1.65035 14.171C1.1528 13.9175 0.736038 13.5321 0.445691 13.0587L0.329141 12.8508C0.145852 12.4911 0.070234 12.103 0.0345063 11.6657C-0.000600882 11.2359 6.60391e-07 10.704 6.60391e-07 10.0461ZM6.3655 9.88762V2.66807L4.26666 4.7669C4.01876 5.0148 3.61673 5.0147 3.36876 4.7669C3.12081 4.51895 3.12081 4.11696 3.36876 3.869L6.55104 0.685795L6.64801 0.606539C6.7515 0.537605 6.87428 0.500244 7.00042 0.500244C7.16855 0.50033 7.33 0.566983 7.44897 0.685795L10.6322 3.869C10.8798 4.11693 10.8799 4.51904 10.6322 4.7669C10.3842 5.01486 9.98123 5.01486 9.73327 4.7669L7.63544 2.669V9.88762C7.63525 10.238 7.35091 10.5225 7.00042 10.5226C6.6499 10.5226 6.36566 10.2381 6.3655 9.88762Z" fill="white" fill-opacity="0.45"/>
        </svg>
      </div>
      <div data-svg-wrapper data-layer="share checkmark icon (show on successful copy for 2 seconds)" class="share-checkmark-icon" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M11.6683 1.07785C12.0594 1.34452 12.1604 1.87777 11.8937 2.26889L5.46514 11.6974C5.3214 11.9083 5.09109 12.0441 4.83703 12.0679C4.58288 12.0917 4.33137 12.0011 4.15089 11.8206L0.293771 7.96351C-0.0409577 7.6288 -0.0409577 7.08606 0.293771 6.75135C0.628509 6.41663 1.17121 6.41663 1.50595 6.75135L4.63156 9.87698L10.4773 1.30318C10.744 0.912059 11.2772 0.811174 11.6683 1.07785Z" fill="white" fill-opacity="0.45"/>
        </svg>
      </div>
      <div data-svg-wrapper data-layer="listen tts icon (speaks text without markdown)" class="tts-listen-icon" role="button" tabindex="0" aria-label="Listen to response">
        <svg width="19" height="15" viewBox="0 0 19 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M16.0922 3.38315C16.4463 3.1909 16.8892 3.3221 17.0814 3.67619C18.3474 6.00789 18.364 8.89689 17.125 11.2429C16.9369 11.5991 16.4956 11.7355 16.1393 11.5473C15.783 11.3592 15.6467 10.9178 15.8348 10.5615C16.8479 8.64324 16.8343 6.27895 15.7992 4.37239C15.6069 4.0183 15.7381 3.5754 16.0922 3.38315ZM12.7967 4.50944C13.1189 4.26746 13.5763 4.33246 13.8182 4.65461C15.0035 6.23261 15.0741 8.44808 13.9925 10.0976C13.7716 10.4346 13.3194 10.5286 12.9824 10.3077C12.6455 10.0868 12.5515 9.63446 12.7724 9.29756C13.5207 8.15642 13.4716 6.62245 12.6516 5.5309C12.4096 5.20875 12.4746 4.75143 12.7967 4.50944Z" fill="white" fill-opacity="0.45"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M7.69821 0.98323C8.86803 -0.0890977 10.7545 0.740746 10.7545 2.32769V12.6728C10.7545 14.2597 8.86803 15.0896 7.69821 14.0172L5.36392 11.8774H2.5C1.11929 11.8774 0 10.7581 0 9.37743V5.623C0 4.24229 1.11929 3.123 2.5 3.123H5.36392L7.69821 0.98323ZM8.68411 2.0588C8.91808 1.84433 9.29539 2.01031 9.29539 2.32769V12.6728C9.29539 12.9901 8.91808 13.1561 8.68411 12.9417L6.14066 10.6102C6.00611 10.4868 5.83022 10.4184 5.6477 10.4184H2.45908C1.90679 10.4184 1.45908 9.97064 1.45908 9.41835V5.58208C1.45908 5.02979 1.90679 4.58208 2.45908 4.58208H5.6477C5.83022 4.58208 6.00611 4.51365 6.14066 4.39032L8.68411 2.0588Z" fill="white" fill-opacity="0.45"/>
        </svg>
      </div>
      <div data-svg-wrapper data-layer="stop TTS icon that replaces TTS when its talking" class="tts-stop-icon" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M0.0427246 7.50024C0.0427246 3.63425 3.17673 0.500244 7.04272 0.500244C10.9087 0.500244 14.0427 3.63425 14.0427 7.50024C14.0427 11.3662 10.9087 14.5002 7.04272 14.5002C3.17673 14.5002 0.0427246 11.3662 0.0427246 7.50024ZM5.29272 5.05024C4.90613 5.05024 4.59272 5.36365 4.59272 5.75024V9.25024C4.59272 9.63685 4.90613 9.95024 5.29272 9.95024H8.79272C9.17933 9.95024 9.49272 9.63685 9.49272 9.25024V5.75024C9.49272 5.36365 9.17933 5.05024 8.79272 5.05024H5.29272Z" fill="white" fill-opacity="0.45"/>
        </svg>
      </div>
    `;

      responseWrapper.appendChild(actionsDiv);
    messagesContainer.appendChild(responseWrapper);

    const shareIcon = actionsDiv.querySelector('.share-icon');
    const shareCheckmark = actionsDiv.querySelector('.share-checkmark-icon');
    const listenIcon = actionsDiv.querySelector('.tts-listen-icon');
    const stopIcon = actionsDiv.querySelector('.tts-stop-icon');
    
    // Share functionality: try Web Share API, fallback to copy
    const handleShare = async () => {
      const plainText = stripMarkdown(content); // Remove markdown formatting
      
      if (navigator.share) {
        // Web Share API available
        try {
          await navigator.share({
            text: plainText,
            title: 'AI Response'
          });
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Share failed:', err);
          }
        }
      } else {
        // Fallback: copy to clipboard and show checkmark
        try {
          await navigator.clipboard.writeText(plainText);
          if (shareIcon) shareIcon.style.display = 'none';
          if (shareCheckmark) shareCheckmark.style.display = 'flex';
          setTimeout(() => {
            if (shareIcon) shareIcon.style.display = 'flex';
            if (shareCheckmark) shareCheckmark.style.display = 'none';
          }, 2000);
        } catch (err) {
          console.error('Copy failed:', err);
        }
      }
    };

    if (shareCheckmark) {
      shareCheckmark.style.display = 'none';
    }
    if (stopIcon) {
      stopIcon.style.display = 'none';
    }

    const handleKeyActivation = (event, handler) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handler();
      }
    };

    if (shareIcon) {
      shareIcon.addEventListener('click', handleShare);
      shareIcon.addEventListener('keydown', (event) => handleKeyActivation(event, handleShare));
    }

    // Thumbs up/down handlers (placeholders for future implementation)
    const thumbsUpIcon = actionsDiv.querySelector('.thumbs-up-icon');
    const thumbsDownIcon = actionsDiv.querySelector('.thumbs-down-icon');
    
    if (thumbsUpIcon) {
      thumbsUpIcon.addEventListener('click', () => console.log('Thumbs up clicked'));
      thumbsUpIcon.addEventListener('keydown', (event) => handleKeyActivation(event, () => console.log('Thumbs up')));
    }
    
    if (thumbsDownIcon) {
      thumbsDownIcon.addEventListener('click', () => console.log('Thumbs down clicked'));
      thumbsDownIcon.addEventListener('keydown', (event) => handleKeyActivation(event, () => console.log('Thumbs down')));
    }

    const toggleTTSState = (listening) => {
      if (!listenIcon || !stopIcon) return;
      listenIcon.style.display = listening ? 'none' : 'flex';
      stopIcon.style.display = listening ? 'flex' : 'none';
    };

    let currentUtterance = null;

    const startTTS = () => {
      if (!window.speechSynthesis) {
        console.error('TTS not supported');
        return;
      }

      // Stop any ongoing speech
      window.speechSynthesis.cancel();

      // Get plain text content (no markdown)
      const plainText = content;
      
      currentUtterance = new SpeechSynthesisUtterance(plainText);
      currentUtterance.rate = 1.0;
      currentUtterance.pitch = 1.0;
      currentUtterance.volume = 1.0;
      
      currentUtterance.onstart = () => {
        toggleTTSState(true);
      };
      
      currentUtterance.onend = () => {
        toggleTTSState(false);
        currentUtterance = null;
      };
      
      currentUtterance.onerror = () => {
        toggleTTSState(false);
        currentUtterance = null;
      };
      
      window.speechSynthesis.speak(currentUtterance);
    };

    const stopTTS = () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      toggleTTSState(false);
      currentUtterance = null;
    };

    if (listenIcon) {
      listenIcon.addEventListener('click', startTTS);
      listenIcon.addEventListener('keydown', (event) => handleKeyActivation(event, startTTS));
    }

    if (stopIcon) {
      stopIcon.addEventListener('click', stopTTS);
      stopIcon.addEventListener('keydown', (event) => handleKeyActivation(event, stopTTS));
    }
  }

  handleStreamChunk(fullText) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    // Remove thinking indicator on first chunk
    const thinkingIndicator = document.getElementById('thinking-indicator');
    if (thinkingIndicator) {
      thinkingIndicator.remove();
    }

    // Find or create streaming message element
    let streamingMessage = document.getElementById(this.streamingMessageId);
    
    if (!streamingMessage) {
      // Create new streaming message container
      const responseWrapper = document.createElement('div');
      responseWrapper.setAttribute('data-layer', 'flexbox');
      responseWrapper.className = 'ai-response-block';
      this.streamingMessageId = `streaming-msg-${Date.now()}`;
      responseWrapper.id = this.streamingMessageId;
      
      const textDiv = document.createElement('div');
      textDiv.setAttribute('data-layer', "this is an example of model's output. this is an example of model's output. this is an example of model's output.");
      textDiv.className = "ai-message-text markdown-content";
      textDiv.id = `${this.streamingMessageId}-text`;
      
      responseWrapper.appendChild(textDiv);
      messagesContainer.appendChild(responseWrapper);
      
      streamingMessage = responseWrapper;
    }

    // Update text content with streaming text
    const textDiv = document.getElementById(`${this.streamingMessageId}-text`);
    if (textDiv) {
      textDiv.innerHTML = parseMarkdown(fullText);
    }
  }

  async getAIResponse(userMessage, retryCount = 0) {
    const MAX_RETRIES = 2;
    
    // Show thinking indicator
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const thinkingWrapper = document.createElement('div');
    thinkingWrapper.id = 'thinking-indicator';
    thinkingWrapper.setAttribute('data-layer', 'flexbox');
    thinkingWrapper.className = 'thinking-block';

    const thinkingText = document.createElement('div');
    thinkingText.setAttribute('data-layer', 'Thinking...');
    thinkingText.className = "thinking-text";
    thinkingText.textContent = 'Thinking...';

    thinkingWrapper.appendChild(thinkingText);
    messagesContainer.appendChild(thinkingWrapper);

    // Reset streaming message ID for new message
    this.streamingMessageId = null;

    try {
      const { gemini_api_key } = await chrome.storage.sync.get(['gemini_api_key']);
      
      if (!gemini_api_key) {
        document.getElementById('thinking-indicator')?.remove();
        this.addMessage('assistant', 'API key not found. Please configure it in settings.');
        return;
      }
      
      // Prepare context with profile data
      const context = await this.prepareContext(userMessage);
      
      // Call Gemini API with streaming via background script
      chrome.runtime.sendMessage({
        type: 'GEMINI_STREAM_REQUEST',
        apiKey: gemini_api_key,
        message: context
      }, (response) => {
        // Remove thinking indicator if still present
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
          // Streaming complete - add action buttons to the message
          this.finalizeStreamingMessage(response.text);
          
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

  async generateFollowUpSuggestions(aiResponse) {
    // Generate 2-5 word follow-up responses based on AI's message
    try {
      const { gemini_api_key } = await chrome.storage.sync.get(['gemini_api_key']);
      if (!gemini_api_key) return null;

      const prompt = `Based on this AI response, generate 3 very short (2-5 words each) follow-up questions or statements that a user would naturally say next. These should be conversational and feel like what the user would actually type. Return ONLY a JSON array of strings, no other text.

AI Response: "${aiResponse.substring(0, 500)}"

Example format: ["Tell me more", "What about skills?", "Draft a message"]`;

      // Call Gemini API directly for suggestions (non-streaming, quick response)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemini_api_key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 100
            }
          })
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      // Parse JSON array from response
      const match = text.match(/\[.*\]/s);
      if (!match) return null;

      const suggestions = JSON.parse(match[0]);
      return Array.isArray(suggestions) ? suggestions.slice(0, 3) : null;
    } catch (error) {
      console.error('Error generating follow-up suggestions:', error);
      return null;
    }
  }

  updateQuickActions(suggestions) {
    const quickActionsContainer = document.getElementById('quick-actions');
    if (!quickActionsContainer) return;

    // Clear existing actions
    quickActionsContainer.innerHTML = '';

    // Add new suggestions
    suggestions.forEach((suggestion, index) => {
      const actionDiv = document.createElement('div');
      actionDiv.className = `quick-action suggestion-${index}`;
      actionDiv.setAttribute('data-action', suggestion);
      actionDiv.setAttribute('role', 'button');
      actionDiv.setAttribute('tabindex', '0');
      actionDiv.setAttribute('aria-label', suggestion);

      const textDiv = document.createElement('div');
      textDiv.textContent = suggestion;
      actionDiv.appendChild(textDiv);

      quickActionsContainer.appendChild(actionDiv);
    });
  }

  finalizeStreamingMessage(content) {
    if (!this.streamingMessageId) return;
    
    const streamingMessage = document.getElementById(this.streamingMessageId);
    if (!streamingMessage) return;

    // Add action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.setAttribute('data-layer', 'quick actions');
    actionsDiv.className = 'ai-message-quick-actions';
    actionsDiv.innerHTML = `
      <div data-svg-wrapper data-layer="thumbs up icon" class="thumbs-up-icon" role="button" tabindex="0" aria-label="Like response">
        <svg width="13" height="15" viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10.8496 13.291L10.9775 13.2725C11.2908 13.225 11.5762 13.0659 11.7822 12.8252C11.9875 12.5854 12.1001 12.2804 12.0996 11.9648C12.0929 11.7399 12.0343 11.5195 11.9277 11.3213L11.8086 11.1006H12.0732C12.2309 11.0254 12.3736 10.923 12.4922 10.7959L12.6074 10.6533C12.8081 10.364 12.8865 10.0068 12.8242 9.66016C12.7618 9.3131 12.5639 9.00508 12.2744 8.80371L12.0947 8.67871L12.2764 8.55566C12.4537 8.43614 12.5992 8.27498 12.6992 8.08594C12.7992 7.89682 12.8506 7.68562 12.8496 7.47168V7.46973C12.8501 7.13338 12.7224 6.80969 12.4922 6.56445C12.2906 6.3497 12.024 6.20952 11.7354 6.16406L11.6104 6.15039H8.26367L8.32715 5.9541L8.60742 5.09375L8.6084 5.0918C8.81012 4.49914 8.91203 3.87703 8.91016 3.25098V2.08008C8.91008 1.57171 8.7092 1.08395 8.35156 0.722656C7.99373 0.361354 7.50749 0.155407 6.99902 0.150391H6.99707C6.59369 0.141709 6.19713 0.259295 5.86426 0.487305C5.53359 0.713814 5.28179 1.03799 5.14355 1.41406V1.41504L4.9834 1.92578L4.98047 1.93164C4.63277 2.88252 4.11529 3.76242 3.45312 4.52832V4.5293L1.20312 7.09961L1.1582 7.15039H0.150391V13.8506H1.32031L1.34766 13.8623L2.34766 14.2822H2.34863L2.35645 14.2861C3.10707 14.6568 3.93334 14.85 4.77051 14.8506H9.59375C9.93487 14.8366 10.2576 14.6904 10.4922 14.4424C10.7268 14.1943 10.8546 13.8639 10.8496 13.5225V13.291ZM1.84961 8.69043L1.89062 8.64746L4.72754 5.65137C5.44478 4.83235 6.02079 3.90098 6.43262 2.89551L6.59863 2.45996L6.77832 1.9502L6.80176 1.88574L6.86523 1.86035L6.91211 1.84766C6.9596 1.83875 7.00908 1.84255 7.05469 1.86035V1.86133C7.07518 1.86906 7.09481 1.87876 7.1123 1.8916L7.16211 1.94141C7.17625 1.96026 7.1873 1.98104 7.19531 2.00293L7.20996 2.07227V3.25098C7.20858 3.69423 7.13888 4.13475 7.00293 4.55664L7.00195 4.55762L5.9082 7.85059H10.7275L10.7529 7.86035C10.8095 7.88175 10.8614 7.91439 10.9043 7.95703C10.9473 7.99975 10.9802 8.05185 11.002 8.1084C11.0236 8.16476 11.0335 8.22487 11.0303 8.28516C11.027 8.34562 11.0111 8.40513 10.9834 8.45898L10.9756 8.47266L10.626 9.00586L10.9502 9.57617C11.0289 9.71188 11.0606 9.86983 11.04 10.0254C11.0194 10.1812 10.9475 10.3259 10.8359 10.4365L10.4707 10.8018L10.5479 11.2871L10.5488 11.2881C10.5722 11.4448 10.542 11.6053 10.4639 11.7432C10.3861 11.8803 10.2646 11.9872 10.1191 12.0479V12.0488L9.69434 12.2305L9.57422 12.6426C9.53249 12.7889 9.4437 12.9171 9.32227 13.0088C9.20067 13.1006 9.05272 13.1505 8.90039 13.1504H4.76953C4.20092 13.1492 3.64029 13.0181 3.12988 12.7676L1.93945 12.248L1.84961 12.209V8.69043Z" fill="white" fill-opacity="0.45" stroke="#0F0F0F" stroke-width="0.3"/>
        </svg>
      </div>
      <div data-svg-wrapper data-layer="thumbs down icon" class="thumbs-down-icon" role="button" tabindex="0" aria-label="Dislike response">
        <svg width="13" height="15" viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.15039 1.70947L2.02246 1.72803C1.70918 1.77544 1.42385 1.93462 1.21777 2.17529C1.0125 2.41506 0.899866 2.72009 0.900391 3.03564C0.907095 3.26054 0.965735 3.48102 1.07227 3.6792L1.19141 3.8999H0.926758C0.769064 3.97511 0.626378 4.07752 0.507812 4.20459L0.392578 4.34717C0.191866 4.63652 0.113519 4.99369 0.175781 5.34033C0.238163 5.68739 0.436115 5.99541 0.725586 6.19678L0.905273 6.32178L0.723633 6.44482C0.546266 6.56435 0.400819 6.7255 0.300781 6.91455C0.20075 7.10367 0.149382 7.31487 0.150391 7.52881V7.53076C0.14988 7.86711 0.277598 8.1908 0.507812 8.43604C0.709415 8.65079 0.976014 8.79096 1.26465 8.83643L1.38965 8.8501H4.73633L4.67285 9.04639L4.39258 9.90674L4.3916 9.90869C4.18988 10.5014 4.08797 11.1235 4.08984 11.7495V12.9204C4.08992 13.4288 4.2908 13.9165 4.64844 14.2778C5.00627 14.6391 5.49251 14.8451 6.00098 14.8501H6.00293C6.40631 14.8588 6.80287 14.7412 7.13574 14.5132C7.46641 14.2867 7.71821 13.9625 7.85645 13.5864V13.5854L8.0166 13.0747L8.01953 13.0688C8.36723 12.118 8.88471 11.2381 9.54688 10.4722V10.4712L11.7969 7.90088L11.8418 7.8501H12.8496V1.1499H11.6797L11.6523 1.13818L10.6523 0.718262H10.6514L10.6436 0.714355C9.89293 0.343659 9.06666 0.150528 8.22949 0.149902H3.40625C3.06513 0.163897 2.74244 0.310093 2.50781 0.558105C2.27318 0.806145 2.14543 1.13663 2.15039 1.47803V1.70947ZM11.1504 6.31006L11.1094 6.35303L8.27246 9.34912C7.55522 10.1681 6.97921 11.0995 6.56738 12.105L6.40137 12.5405L6.22168 13.0503L6.19824 13.1147L6.13477 13.1401L6.08789 13.1528C6.0404 13.1617 5.99092 13.1579 5.94531 13.1401V13.1392C5.92482 13.1314 5.90519 13.1217 5.8877 13.1089L5.83789 13.0591C5.82375 13.0402 5.8127 13.0195 5.80469 12.9976L5.79004 12.9282V11.7495C5.79142 11.3063 5.86112 10.8657 5.99707 10.4438L5.99805 10.4429L7.0918 7.1499H2.27246L2.24707 7.14014C2.19046 7.11874 2.13864 7.0861 2.0957 7.04346C2.05274 7.00074 2.0198 6.94864 1.99805 6.89209C1.9764 6.83573 1.96653 6.77562 1.96973 6.71533C1.97299 6.65487 1.98892 6.59535 2.0166 6.5415L2.02441 6.52783L2.37402 5.99463L2.0498 5.42432C1.97108 5.2886 1.93941 5.13066 1.95996 4.9751C1.98058 4.81928 2.05245 4.67462 2.16406 4.56396L2.5293 4.19873L2.45215 3.71338L2.45117 3.7124C2.42784 3.55568 2.45802 3.39517 2.53613 3.25732C2.61389 3.12017 2.73537 3.01329 2.88086 2.95264V2.95166L3.30566 2.77002L3.42578 2.35791C3.46751 2.21162 3.5563 2.08336 3.67773 1.9917C3.79933 1.89993 3.94728 1.85 4.09961 1.8501H8.23047C8.79908 1.85129 9.35971 1.98243 9.87012 2.23291L11.0605 2.75244L11.1504 2.7915V6.31006Z" fill="white" fill-opacity="0.45" stroke="#0F0F0F" stroke-width="0.3"/>
        </svg>
      </div>
      <div data-svg-wrapper data-layer="share icon" class="share-icon" role="button" tabindex="0" aria-label="Share response">
        <svg width="14" height="15" viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6.60391e-07 10.0461V9.88762C6.60391e-07 9.53703 0.284305 9.25269 0.634966 9.25269C0.985626 9.25269 1.26993 9.53703 1.26993 9.88762V10.0461C1.26993 10.7249 1.2708 11.196 1.3007 11.5622C1.33 11.9208 1.38426 12.1228 1.46108 12.2736L1.52821 12.3949C1.69654 12.6693 1.93812 12.8931 2.22657 13.0401L2.35058 13.0932C2.48785 13.1424 2.66879 13.1785 2.93799 13.2004C3.30417 13.2304 3.77519 13.2303 4.45407 13.2303H9.54595C10.2246 13.2303 10.6959 13.2304 11.062 13.2004C11.4204 13.1712 11.6226 13.1169 11.7734 13.0401L11.8946 12.972C12.169 12.8037 12.3929 12.562 12.5398 12.2736L12.593 12.1497C12.6421 12.0124 12.6782 11.8313 12.7002 11.5622C12.7301 11.196 12.73 10.7249 12.73 10.0461V9.88762C12.73 9.53712 13.0145 9.25289 13.3651 9.25269C13.7156 9.25269 14 9.53703 14 9.88762V10.0461C14 10.704 14.0006 11.2359 13.9655 11.6657C13.9342 12.0486 13.8721 12.3933 13.7343 12.7147L13.6709 12.8508C13.4174 13.3482 13.0317 13.7642 12.5585 14.0546L12.3506 14.171C11.9908 14.3544 11.6028 14.43 11.1654 14.4657C10.7356 14.5008 10.2038 14.5002 9.54595 14.5002H4.45407C3.79615 14.5002 3.26437 14.5008 2.83449 14.4657C2.45207 14.4345 2.10749 14.3731 1.78648 14.2354L1.65035 14.171C1.1528 13.9175 0.736038 13.5321 0.445691 13.0587L0.329141 12.8508C0.145852 12.4911 0.070234 12.103 0.0345063 11.6657C-0.000600882 11.2359 6.60391e-07 10.704 6.60391e-07 10.0461ZM6.3655 9.88762V2.66807L4.26666 4.7669C4.01876 5.0148 3.61673 5.0147 3.36876 4.7669C3.12081 4.51895 3.12081 4.11696 3.36876 3.869L6.55104 0.685795L6.64801 0.606539C6.7515 0.537605 6.87428 0.500244 7.00042 0.500244C7.16855 0.50033 7.33 0.566983 7.44897 0.685795L10.6322 3.869C10.8798 4.11693 10.8799 4.51904 10.6322 4.7669C10.3842 5.01486 9.98123 5.01486 9.73327 4.7669L7.63544 2.669V9.88762C7.63525 10.238 7.35091 10.5225 7.00042 10.5226C6.6499 10.5226 6.36566 10.2381 6.3655 9.88762Z" fill="white" fill-opacity="0.45"/>
        </svg>
      </div>
      <div data-svg-wrapper data-layer="share checkmark icon (show on successful copy for 2 seconds)" class="share-checkmark-icon" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M11.6683 1.07785C12.0594 1.34452 12.1604 1.87777 11.8937 2.26889L5.46514 11.6974C5.3214 11.9083 5.09109 12.0441 4.83703 12.0679C4.58288 12.0917 4.33137 12.0011 4.15089 11.8206L0.293771 7.96351C-0.0409577 7.6288 -0.0409577 7.08606 0.293771 6.75135C0.628509 6.41663 1.17121 6.41663 1.50595 6.75135L4.63156 9.87698L10.4773 1.30318C10.744 0.912059 11.2772 0.811174 11.6683 1.07785Z" fill="white" fill-opacity="0.45"/>
        </svg>
      </div>
      <div data-svg-wrapper data-layer="listen tts icon (speaks text without markdown)" class="tts-listen-icon" role="button" tabindex="0" aria-label="Listen to response">
        <svg width="19" height="15" viewBox="0 0 19 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M16.0922 3.38315C16.4463 3.1909 16.8892 3.3221 17.0814 3.67619C18.3474 6.00789 18.364 8.89689 17.125 11.2429C16.9369 11.5991 16.4956 11.7355 16.1393 11.5473C15.783 11.3592 15.6467 10.9178 15.8348 10.5615C16.8479 8.64324 16.8343 6.27895 15.7992 4.37239C15.6069 4.0183 15.7381 3.5754 16.0922 3.38315ZM12.7967 4.50944C13.1189 4.26746 13.5763 4.33246 13.8182 4.65461C15.0035 6.23261 15.0741 8.44808 13.9925 10.0976C13.7716 10.4346 13.3194 10.5286 12.9824 10.3077C12.6455 10.0868 12.5515 9.63446 12.7724 9.29756C13.5207 8.15642 13.4716 6.62245 12.6516 5.5309C12.4096 5.20875 12.4746 4.75143 12.7967 4.50944Z" fill="white" fill-opacity="0.45"/>
          <path fill-rule="evenodd" clip-rule="evenodd" d="M7.69821 0.98323C8.86803 -0.0890977 10.7545 0.740746 10.7545 2.32769V12.6728C10.7545 14.2597 8.86803 15.0896 7.69821 14.0172L5.36392 11.8774H2.5C1.11929 11.8774 0 10.7581 0 9.37743V5.623C0 4.24229 1.11929 3.123 2.5 3.123H5.36392L7.69821 0.98323ZM8.68411 2.0588C8.91808 1.84433 9.29539 2.01031 9.29539 2.32769V12.6728C9.29539 12.9901 8.91808 13.1561 8.68411 12.9417L6.14066 10.6102C6.00611 10.4868 5.83022 10.4184 5.6477 10.4184H2.45908C1.90679 10.4184 1.45908 9.97064 1.45908 9.41835V5.58208C1.45908 5.02979 1.90679 4.58208 2.45908 4.58208H5.6477C5.83022 4.58208 6.00611 4.51365 6.14066 4.39032L8.68411 2.0588Z" fill="white" fill-opacity="0.45"/>
        </svg>
      </div>
      <div data-svg-wrapper data-layer="stop TTS icon that replaces TTS when its talking" class="tts-stop-icon" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M0.0427246 7.50024C0.0427246 3.63425 3.17673 0.500244 7.04272 0.500244C10.9087 0.500244 14.0427 3.63425 14.0427 7.50024C14.0427 11.3662 10.9087 14.5002 7.04272 14.5002C3.17673 14.5002 0.0427246 11.3662 0.0427246 7.50024ZM5.29272 5.05024C4.90613 5.05024 4.59272 5.36365 4.59272 5.75024V9.25024C4.59272 9.63685 4.90613 9.95024 5.29272 9.95024H8.79272C9.17933 9.95024 9.49272 9.63685 9.49272 9.25024V5.75024C9.49272 5.36365 9.17933 5.05024 8.79272 5.05024H5.29272Z" fill="white" fill-opacity="0.45"/>
        </svg>
      </div>
    `;

    streamingMessage.appendChild(actionsDiv);

    // Attach event listeners to action buttons
    this.attachMessageActionListeners(actionsDiv, content);
    
    // Generate and display follow-up suggestions
    this.generateFollowUpSuggestions(content).then(suggestions => {
      if (suggestions && suggestions.length > 0) {
        this.updateQuickActions(suggestions);
      }
    });
    
    // Clear streaming message ID
    this.streamingMessageId = null;
  }

  attachMessageActionListeners(actionsDiv, content) {
    const shareIcon = actionsDiv.querySelector('.share-icon');
    const shareCheckmark = actionsDiv.querySelector('.share-checkmark-icon');
    const listenIcon = actionsDiv.querySelector('.tts-listen-icon');
    const stopIcon = actionsDiv.querySelector('.tts-stop-icon');

    // Share functionality: try Web Share API, fallback to copy
    const handleShare = async () => {
      const plainText = stripMarkdown(content); // Remove markdown formatting
      
      if (navigator.share) {
        // Web Share API available
        try {
          await navigator.share({
            text: plainText,
            title: 'AI Response'
          });
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Share failed:', err);
          }
        }
      } else {
        // Fallback: copy to clipboard and show checkmark
        try {
          await navigator.clipboard.writeText(plainText);
          if (shareIcon) shareIcon.style.display = 'none';
          if (shareCheckmark) shareCheckmark.style.display = 'flex';
          setTimeout(() => {
            if (shareIcon) shareIcon.style.display = 'flex';
            if (shareCheckmark) shareCheckmark.style.display = 'none';
          }, 2000);
        } catch (err) {
          console.error('Copy failed:', err);
        }
      }
    };

    if (shareCheckmark) shareCheckmark.style.display = 'none';
    if (stopIcon) stopIcon.style.display = 'none';

    const handleKeyActivation = (event, handler) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handler();
      }
    };

    if (shareIcon) {
      shareIcon.addEventListener('click', handleShare);
      shareIcon.addEventListener('keydown', (event) => handleKeyActivation(event, handleShare));
    }

    // Thumbs up/down handlers (placeholders for future implementation)
    const thumbsUpIcon = actionsDiv.querySelector('.thumbs-up-icon');
    const thumbsDownIcon = actionsDiv.querySelector('.thumbs-down-icon');
    
    if (thumbsUpIcon) {
      thumbsUpIcon.addEventListener('click', () => console.log('Thumbs up clicked'));
      thumbsUpIcon.addEventListener('keydown', (event) => handleKeyActivation(event, () => console.log('Thumbs up')));
    }
    
    if (thumbsDownIcon) {
      thumbsDownIcon.addEventListener('click', () => console.log('Thumbs down clicked'));
      thumbsDownIcon.addEventListener('keydown', (event) => handleKeyActivation(event, () => console.log('Thumbs down')));
    }

    const toggleTTSState = (listening) => {
      if (!listenIcon || !stopIcon) return;
      listenIcon.style.display = listening ? 'none' : 'flex';
      stopIcon.style.display = listening ? 'flex' : 'none';
    };

    let currentUtterance = null;

    const startTTS = () => {
      if (!window.speechSynthesis) {
        console.error('TTS not supported');
        return;
      }
      window.speechSynthesis.cancel();
      currentUtterance = new SpeechSynthesisUtterance(content);
      currentUtterance.rate = 1.0;
      currentUtterance.pitch = 1.0;
      currentUtterance.volume = 1.0;
      currentUtterance.onstart = () => toggleTTSState(true);
      currentUtterance.onend = () => {
        toggleTTSState(false);
        currentUtterance = null;
      };
      currentUtterance.onerror = () => {
        toggleTTSState(false);
        currentUtterance = null;
      };
      window.speechSynthesis.speak(currentUtterance);
    };

    const stopTTS = () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      toggleTTSState(false);
      currentUtterance = null;
    };

    if (listenIcon) {
      listenIcon.addEventListener('click', startTTS);
      listenIcon.addEventListener('keydown', (event) => handleKeyActivation(event, startTTS));
    }

    if (stopIcon) {
      stopIcon.addEventListener('click', stopTTS);
      stopIcon.addEventListener('keydown', (event) => handleKeyActivation(event, stopTTS));
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

  async generateProfileSummary(profile) {
    try {
      const { gemini_api_key } = await chrome.storage.sync.get(['gemini_api_key']);
      if (!gemini_api_key) return null;

      const prompt = `Analyze this LinkedIn profile HTML and create a concise, professional summary. Focus on key achievements, skills, and background. Keep it under 200 words and make it easy to understand. Be specific and highlight what makes this person unique.

Profile HTML:
${profile.dom}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gemini_api_key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 300
            }
          })
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return summary || null;
    } catch (error) {
      console.error('Error generating profile summary:', error);
      return null;
    }
  }

  async prepareContext(userMessage) {
    // Get user's own profile data for context
    const { user_profile } = await chrome.storage.sync.get(['user_profile']);
    
    let contextMessage = '';
    
    // Add user profile context if available (DOM or parsed data)
    if (user_profile) {
      contextMessage += `=== YOUR PROFILE (Person asking this question) ===\n`;
      
      if (user_profile.dom) {
        // Use DOM if available
        contextMessage += `${user_profile.dom}\n\n`;
      } else {
        // Fallback to parsed data (for backward compatibility)
        contextMessage += `Name: ${user_profile.name || 'User'}\n`;
        if (user_profile.headline) contextMessage += `Headline: ${user_profile.headline}\n`;
        if (user_profile.location) contextMessage += `Location: ${user_profile.location}\n`;
        if (user_profile.about) contextMessage += `\nAbout: ${user_profile.about}\n`;
      }
    }
    
    // Add the profile being viewed
    if (!this.currentProfile) {
      return contextMessage + userMessage;
    }

    contextMessage += `=== PROFILE BEING VIEWED ===\n`;
    
    // Use AI-generated summary if available, otherwise use DOM
    if (this.currentProfile.aiSummary) {
      contextMessage += this.currentProfile.aiSummary + '\n';
    } else if (this.currentProfile.dom) {
      contextMessage += this.currentProfile.dom + '\n';
    } else {
      // Fallback to basic info
      contextMessage += `Name: ${this.currentProfile.name}\n`;
    }

    contextMessage += `\n=== USER QUESTION ===\n${userMessage}\n\n`;
    contextMessage += `Provide a helpful, professional response. Use the information about the user asking (your profile) to give personalized advice and context-aware suggestions.`;

    return contextMessage;
  }

  async scrapeProfile() {
    try {
      const profileHash = this.hashProfile(window.location.href);
      
      // Check if we already have a summary for this profile
      const result = await chrome.storage.local.get(['profile_summaries']);
      const summaries = result.profile_summaries || {};
      
      if (summaries[profileHash] && summaries[profileHash].summary) {
        // Use cached summary
        const cached = summaries[profileHash];
        const profile = cached.profile;
        profile.aiSummary = cached.summary;
        return profile;
      }
      
      // Use the LinkedInScraper utility
      let profile;
      if (typeof LinkedInScraper !== 'undefined') {
        profile = await LinkedInScraper.scrapeProfile();
      } else {
        // Fallback basic scraping - capture DOM
        profile = {
          name: '',
          url: window.location.href,
          scrapedAt: new Date().toISOString(),
          dom: ''
        };

        const nameEl = document.querySelector('h1.text-heading-xlarge, h1.inline');
        if (nameEl) profile.name = nameEl.textContent.trim();

        // Capture main profile DOM
        const mainContent = document.querySelector('main.scaffold-layout__main') || 
                           document.querySelector('main') || 
                           document.querySelector('.scaffold-layout__detail');
        
        if (mainContent) {
          const clone = mainContent.cloneNode(true);
          clone.querySelectorAll('script, style, link, noscript').forEach(el => el.remove());
          clone.querySelectorAll('[style*="display: none"], [style*="display:none"]').forEach(el => el.remove());
          profile.dom = clone.innerHTML;
        } else {
          profile.dom = document.body.innerHTML;
        }
      }

      // Generate and store AI summary
      const summary = await this.generateProfileSummary(profile);
      if (summary) {
        profile.aiSummary = summary;
        // Store in chrome.storage for persistence
        summaries[profileHash] = {
          summary: summary,
          profile: profile,
          timestamp: new Date().toISOString()
        };
        await chrome.storage.local.set({ profile_summaries: summaries });
      }

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
    const results = await chrome.storage.local.get(['chats', 'profile_summaries']);
    const chats = results.chats || {};
    const summaries = results.profile_summaries || {};
    
    if (chats[profileHash] && chats[profileHash].messages.length > 0) {
      // Display existing chat messages
      const chat = chats[profileHash];
      chat.messages.forEach(msg => {
        this.addMessage(msg.role, msg.content);
      });
    } else if (summaries[profileHash] && summaries[profileHash].summary) {
      // No chat history - show AI summary as first message
      this.addMessage('assistant', summaries[profileHash].summary);
      
      // Save summary as first message in chat history
      const timestamp = new Date().toISOString();
      if (!chats[profileHash]) {
        chats[profileHash] = {
          profile: this.currentProfile,
          messages: [],
          lastActive: timestamp
        };
      }
      chats[profileHash].messages.push({
        id: `msg_${Date.now()}_ai_summary`,
        role: 'assistant',
        content: summaries[profileHash].summary,
        timestamp
      });
      await chrome.storage.local.set({ chats });
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

