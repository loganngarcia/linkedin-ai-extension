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

/**
 * Convert HTML content to a PNG image blob using SVG foreignObject and Canvas
 * 
 * WHY THIS APPROACH:
 * - We need to convert HTML (with CSS styling) to an image for sharing
 * - Canvas alone can't render complex HTML/CSS (like flexbox, custom fonts)
 * - SVG foreignObject allows embedding HTML within SVG, which Canvas can render
 * - Data URLs avoid CORS issues that would "taint" the canvas
 * 
 * HOW IT WORKS:
 * 1. Wrap HTML in SVG foreignObject for proper CSS rendering
 * 2. Encode as data URL to avoid external resource loading issues
 * 3. Load SVG as Image object (browser renders the HTML/CSS)
 * 4. Draw Image onto Canvas (converts to raster)
 * 5. Export Canvas as PNG blob for sharing
 */
async function htmlToImage(htmlContent) {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting HTML to image conversion...');
      
      // Create SVG wrapper with foreignObject to render HTML/CSS properly
      // foreignObject allows embedding HTML/DOM elements within SVG
      // This is crucial for rendering complex CSS like flexbox, custom fonts, etc.
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="320" height="480">
          <foreignObject width="320" height="480">
            <div xmlns="http://www.w3.org/1999/xhtml" style="width: 320px; height: 480px; margin: 0; padding: 0;">
              ${htmlContent}
            </div>
          </foreignObject>
        </svg>
      `;
      
      console.log('SVG created, encoding as data URL...');
      
      // Create Image object to load the SVG
      // Using data URL instead of blob URL to avoid CORS/taint issues
      const img = new Image();
      
      // Add timeout to detect if SVG foreignObject isn't supported
      // Some browsers/contexts may not support foreignObject rendering
      const timeout = setTimeout(() => {
        reject(new Error('Image load timeout - SVG foreignObject may not be supported'));
      }, 5000);
      
      // Success handler: SVG loaded and rendered successfully
      img.onload = () => {
        clearTimeout(timeout);
        console.log('SVG image loaded successfully');
        
        // Create canvas to convert the rendered SVG to raster image
        const canvas = document.createElement('canvas');
        canvas.width = 320;  // Fixed width for share sheet
        canvas.height = 480; // Fixed height for share sheet
        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        
        // Draw white background first (SVG might have transparent areas)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 320, 480);
        
        // Draw the rendered SVG image onto canvas
        // This converts the vector SVG to raster PNG
        ctx.drawImage(img, 0, 0, 320, 480);
        
        console.log('Canvas created, converting to blob...');
        
        // Convert canvas to PNG blob for sharing
        // Quality 0.95 provides good compression while maintaining quality
        canvas.toBlob((blob) => {
          if (blob) {
            console.log('Blob created successfully:', blob.size, 'bytes');
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        }, 'image/png', 0.95);
      };
      
      // Error handler: SVG failed to load (foreignObject not supported, etc.)
      img.onerror = (error) => {
        clearTimeout(timeout);
        console.error('SVG image load error:', error);
        reject(new Error('Failed to load SVG image: ' + error));
      };
      
      // Set crossOrigin to prevent canvas tainting
      // This ensures the canvas can be exported as blob
      img.crossOrigin = 'anonymous';
      
      // Encode SVG as data URL to avoid external resource loading
      // Data URLs are treated as same-origin, preventing CORS issues
      const svgData = encodeURIComponent(svg);
      img.src = 'data:image/svg+xml;charset=utf-8,' + svgData;
      
    } catch (error) {
      console.error('htmlToImage error:', error);
      reject(error);
    }
  });
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
    this.currentAudio = null;
    this.currentUtterance = null;
    this.currentTTSMessageId = null;
    // Store last user message for share sheet functionality
    // This allows us to include the user's question in the shared image
    this.lastUserMessage = null;
    // Track clicked quick actions to avoid suggesting them again
    this.clickedActions = new Set();
    this.init();
    this.setupMessageListener();
  }

  setupMessageListener() {
    // Listen for streaming chunks from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'GEMINI_STREAM_CHUNK') {
        this.handleStreamChunk(request.fullText);
      }
      
      if (request.type === 'GEMINI_TTS_AUDIO') {
        this.handleTTSAudio(request.audioData, request.text);
      }
      
      if (request.type === 'GEMINI_TTS_AUDIO_URL') {
        this.handleTTSAudioURL(request.audioUrl, request.text);
      }
    });
  }

  async init() {
    // Wait for LinkedIn to load
    await this.waitForLinkedInLoad();
    
    // Inject the AI button
    this.injectAIButton();
    
    // Inject the AI Premium section
    this.injectAIPremiumSection();
    
    // Listen for profile changes
    this.observeProfileChanges();
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

  /**
   * PRIMARY AI ACCESS METHOD - Injects the AI Premium section
   * 
   * WHY THIS IS THE PRIMARY METHOD:
   * - More prominent and discoverable than the small AI button
   * - Provides context about what the AI can do (summarize, draft messages, etc.)
   * - Matches LinkedIn's native UI patterns
   * - Better user experience with clear call-to-actions
   * 
   * PLACEMENT STRATEGY:
   * - Appears right after the profile header (top card with photo/connect buttons)
   * - Before main content sections (About, Experience, etc.)
   * - Handles profiles with/without intermediate cards (Open to work, etc.)
   */
  injectAIPremiumSection() {
    // Prevent duplicate injections
    if (document.getElementById('linkedin-ai-premium-section')) {
      console.log('LinkedIn AI: Premium section already exists');
      return;
    }

    // Only show on individual profile pages (not company pages or feed)
    // Regex matches: linkedin.com/in/username/ or linkedin.com/in/username
    if (!window.location.href.match(/linkedin\.com\/in\/[^/]+\/?$/)) {
      console.log('LinkedIn AI: Not a profile page, skipping premium section');
      return;
    }

    // Extract the profile owner's first name for personalization
    const profileName = this.extractProfileName();
    if (!profileName) {
      console.log('LinkedIn AI: Could not extract profile name, retrying in 2s...');
      // Retry after DOM has more time to load
      setTimeout(() => this.injectAIPremiumSection(), 2000);
      return;
    }

    // Find where to insert the section - this is the tricky part
    // Must be after top card but before main content, handling various LinkedIn layouts
    const insertionPoint = this.findPremiumSectionInsertionPoint();
    if (!insertionPoint) {
      console.log('LinkedIn AI: Could not find insertion point, retrying in 2s...');
      // Retry in case LinkedIn is still loading sections
      setTimeout(() => this.injectAIPremiumSection(), 2000);
      return;
    }

    // Create the premium section with the profile name
    const premiumSection = this.createAIPremiumSection(profileName);
    
    // Insert before the target section (so it appears above it)
    insertionPoint.parentNode.insertBefore(premiumSection, insertionPoint);
    
    console.log('LinkedIn AI: Premium section injected successfully!');
  }

  /**
   * Extract the profile owner's first name for personalization
   * 
   * WHY FIRST NAME ONLY:
   * - More personal and friendly ("Ask anything about John" vs "Ask anything about John Smith")
   * - Shorter text fits better in the UI
   * - Matches common conversational patterns
   * 
   * SELECTOR STRATEGY:
   * - Try multiple selectors as LinkedIn changes their DOM structure
   * - Fallback from most specific to most general
   * - Handle different LinkedIn UI variations
   */
  extractProfileName() {
    // LinkedIn uses different selectors for profile names across their UI variations
    const selectors = [
      'h1.text-heading-xlarge',           // Most common current selector
      'h1.inline.t-24.v-align-middle.break-words',  // Older LinkedIn versions
      'h1.top-card-layout__title',        // Alternative layout
      '.pv-top-card--list li:first-child' // Fallback selector
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const fullName = element.textContent.trim();
        // Extract first name only for personalization
        const firstName = fullName.split(' ')[0];
        return firstName;
      }
    }

    return '';
  }

  /**
   * CRITICAL FUNCTION: Find where to insert the AI Premium section
   * 
   * THE CHALLENGE:
   * LinkedIn profiles have inconsistent layouts:
   * - Some have just: [Top Card] → [About/Experience]
   * - Others have: [Top Card] → [Open to work] → [Volunteer] → [About/Experience]
   * - We need to insert AFTER the top card but BEFORE main content
   * 
   * STRATEGY:
   * 1. Find the top card (profile photo + action buttons)
   * 2. Look for the first substantial content section after it
   * 3. Skip small intermediate cards (badges, "Open to work", etc.)
   * 4. Use multiple fallback strategies for reliability
   */
  findPremiumSectionInsertionPoint() {
    // Get the main content area (where all profile sections live)
    const mainContent = document.querySelector('main.scaffold-layout__main') || 
                       document.querySelector('main');
    
    if (!mainContent) return null;

    // Get all potential sections that could be insertion points
    // LinkedIn uses these selectors for profile sections
    const allSections = Array.from(mainContent.querySelectorAll('section.artdeco-card, div.pvs-list__outer-container'));
    
    if (allSections.length === 0) return null;
    
    // STEP 1: Find the top card index
    // The top card contains the profile photo, name, and Connect/Message buttons
    let topCardIndex = -1;
    for (let i = 0; i < allSections.length; i++) {
      const section = allSections[i];
      const classes = section.className || '';
      
      // Top card identification criteria:
      // - Has specific CSS classes
      // - Contains action buttons (Connect, Message, Follow, "Open to")
      if (classes.includes('pv-top-card') || 
          classes.includes('top-card') ||
          section.querySelector('button[aria-label*="Connect"]') ||
          section.querySelector('button[aria-label*="Message"]') ||
          section.querySelector('button[aria-label*="Follow"]') ||
          section.querySelector('button[aria-label*="Open to"]')) {
        topCardIndex = i;
        break;
      }
    }
    
    // STEP 2: Find first substantial content section after top card
    if (topCardIndex >= 0) {
      // Look through sections that come after the top card
      for (let i = topCardIndex + 1; i < allSections.length; i++) {
        const section = allSections[i];
        const classes = section.className || '';
        const rect = section.getBoundingClientRect();
        
        // Skip small intermediate cards (height < 80px)
        // These are usually badges like "Open to work", volunteering, etc.
        if (rect.height < 80) {
          continue;
        }
        
        // Skip if it's still part of the top card area
        if (classes.includes('pv-top-card') || classes.includes('top-card')) {
          continue;
        }
        
        // Found the first real content section!
        return section;
      }
    }
    
    // STEP 3: Fallback strategies if index-based search fails
    const contentSectionSelectors = [
      'section[data-view-name="profile-card"]', // About section
      'section.pv-profile-card:not(.pv-top-card)', // Profile cards but not top card
      'div.pvs-list__outer-container',  // Experience, Education, etc.
    ];
    
    for (const selector of contentSectionSelectors) {
      const section = mainContent.querySelector(selector);
      if (section) {
        return section;
      }
    }

    // STEP 4: Last resort - insert before second section
    // This handles edge cases where our logic doesn't work
    if (allSections.length >= 2) {
      return allSections[1];
    }

    return null;
  }

  /**
   * Create the AI Premium section HTML structure
   * 
   * DESIGN PHILOSOPHY:
   * - Matches LinkedIn's native card design patterns
   * - Dark theme to blend with LinkedIn's UI
   * - Clear hierarchy: Logo → Title → Description → Actions
   * - Interactive elements with hover states
   * 
   * STYLING DECISIONS:
   * - Background: #1D1F21 (slightly lighter than LinkedIn's #1A2024)
   * - Border: 1px solid rgba(255, 255, 255, 0.02) (subtle definition)
   * - Border radius: 8px (matches LinkedIn's card radius)
   * - Margin: 7px top (creates perfect spacing from profile card)
   */
  createAIPremiumSection(profileName) {
    const section = document.createElement('div');
    section.id = 'linkedin-ai-premium-section';
    section.setAttribute('data-layer', 'profile section');
    section.className = 'ai-premium-section';
    
    // Inline styles for reliability (avoids CSS conflicts)
    section.style.cssText = `
      width: 100%;
      max-width: 804px;
      padding: 24px;
      background: #1D1F21;
      overflow: hidden;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.02);
      flex-direction: column;
      justify-content: flex-start;
      align-items: flex-start;
      gap: 16px;
      display: inline-flex;
      margin-top: 7px;
      margin-bottom: 0px;
      box-sizing: border-box;
    `;

    // Create inner structure
    section.innerHTML = `
      <div data-layer="flexbox" class="ai-premium-content" style="align-self: stretch; flex-direction: column; justify-content: flex-start; align-items: flex-start; gap: 12px; display: flex;">
        <div data-layer="flexbox" class="ai-premium-header" style="align-self: stretch; flex-direction: column; justify-content: flex-start; align-items: flex-start; gap: 8px; display: flex;">
          <div data-svg-wrapper data-layer="ai premium logo" class="ai-premium-logo">
            <svg width="79" height="8" viewBox="0 0 79 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g opacity="0.9">
                <path d="M8.04633 7.56C8.32771 7.27897 8.48598 6.89769 8.48633 6.5V1.5C8.48633 1.10218 8.32829 0.720644 8.04699 0.43934C7.76568 0.158035 7.38415 0 6.98633 0H1.98633C1.58864 0.000350104 1.20736 0.158615 0.926328 0.44L8.04633 7.56Z" fill="#F8C77E"/>
                <path d="M0.926328 0.44C0.644943 0.721035 0.486678 1.10231 0.486328 1.5V6.5C0.486328 6.89782 0.644363 7.27936 0.925668 7.56066C1.20697 7.84196 1.5885 8 1.98633 8H6.98633C7.38402 7.99965 7.76529 7.84138 8.04633 7.56L0.926328 0.44Z" fill="#E7A33E"/>
                <path d="M17.1913 0.1H14.4863V7.9H15.9363V5.16H17.1713C18.9313 5.16 19.8563 4.01 19.8563 2.62C19.8563 1.23 18.9863 0.1 17.1913 0.1ZM16.9863 3.935H15.9363V1.335H16.9863C17.3092 1.28934 17.637 1.37378 17.8977 1.56973C18.1583 1.76569 18.3305 2.05714 18.3763 2.38C18.3838 2.46317 18.3838 2.54683 18.3763 2.63C18.3858 2.79355 18.3629 2.95737 18.3089 3.11205C18.2549 3.26673 18.1709 3.40923 18.0618 3.53139C17.9526 3.65356 17.8204 3.75298 17.6728 3.82395C17.5251 3.89493 17.3649 3.93606 17.2013 3.945C17.1295 3.94622 17.0577 3.94288 16.9863 3.935ZM29.1113 2.435C29.1113 1.105 28.1613 0.1 26.5163 0.1H23.4863V7.9H24.9313V4.8H26.0663L27.8963 7.9H29.5463L27.5463 4.59C28.012 4.45893 28.4207 4.17636 28.7077 3.78697C28.9948 3.39758 29.1439 2.9236 29.1313 2.44L29.1113 2.435ZM26.3563 3.61H24.9313V1.335H26.3013C27.1263 1.335 27.6413 1.76 27.6413 2.475C27.6413 3.19 27.1813 3.61 26.3563 3.61ZM33.1763 0.1H38.9013V1.35H34.6213V3.31H37.3413V4.545H34.6213V6.65H38.9013V7.9H33.1763V0.1ZM48.4463 0.1H50.4463V7.9H48.9863V1.9L47.2163 5.77H45.9163L44.1563 1.925V7.925H42.7413V0.1H44.8563L46.5963 4.125L48.4463 0.1ZM54.8063 0.1H56.2513V7.9H54.8063V0.1ZM65.0463 0.1H66.4863V5.5C66.4863 6.9 65.4863 8 63.5263 8C61.5663 8 60.5613 6.895 60.5613 5.5V0.1H61.9863V5.395C61.9863 6.105 62.4313 6.73 63.4863 6.73C64.5413 6.73 65.0213 6.105 65.0213 5.395L65.0463 0.1ZM78.4863 0.1V7.9H77.0363V1.9L75.2663 5.77H73.9313L72.1713 1.9V7.9H70.7563V0.1H72.8713L74.6113 4.125L76.4563 0.125L78.4863 0.1Z" fill="white"/>
              </g>
            </svg>
          </div>
          <div data-layer="Ask anything about [name]" class="ai-premium-title" style="align-self: stretch; color: rgba(255, 255, 255, 0.90); font-size: 20px; font-family: 'SF Pro', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; font-weight: 600; line-height: 20px; word-wrap: break-word;">Ask anything about ${profileName}</div>
        </div>
        <div data-layer="description" class="ai-premium-description" style="align-self: stretch; justify-content: center; display: flex; flex-direction: column; color: rgba(255, 255, 255, 0.90); font-size: 14px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; font-weight: 400; line-height: 14px; word-wrap: break-word;">I'd be great to connect, based on your skills, experience, and chances of hearing back</div>
      </div>
      <div data-layer="flexbox" class="ai-premium-actions" style="align-self: stretch; justify-content: flex-start; align-items: flex-start; gap: 8px; display: inline-flex; flex-wrap: wrap;">
        <div data-svg-wrapper data-layer="open ai" class="ai-premium-open-btn" id="ai-premium-open-btn" style="cursor: pointer;" role="button" tabindex="0" aria-label="Open AI Premium chat">
          <svg width="33" height="32" viewBox="0 0 33 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0.986328" y="0.5" width="31" height="31" rx="15.5" stroke="white" stroke-opacity="0.75"/>
            <path d="M23.4863 15.99C23.4863 16.38 23.2065 16.69 22.8368 16.73C19.8989 17.05 17.5506 19.41 17.2208 22.35C17.1808 22.72 16.8611 23 16.4913 23H16.4813C16.1116 23 15.7918 22.72 15.7519 22.35C15.4321 19.41 13.0738 17.06 10.1359 16.73C9.957 16.7092 9.79201 16.6233 9.67226 16.4887C9.55252 16.3541 9.48634 16.1802 9.48633 16C9.48633 15.61 9.76613 15.3 10.1359 15.26C13.0738 14.94 15.4221 12.58 15.7419 9.65C15.7818 9.28 16.1016 9 16.4713 9H16.4913C16.8611 9 17.1808 9.28 17.2208 9.65C17.5406 12.59 19.8989 14.94 22.8368 15.27C23.2065 15.31 23.4863 15.63 23.4863 16V15.99Z" fill="#F19F22"/>
          </svg>
        </div>
        <div data-layer="summarize" class="ai-premium-action-pill" data-action="Summarize" style="height: 32px; padding-left: 16px; padding-right: 16px; padding-top: 10px; padding-bottom: 10px; overflow: hidden; border-radius: 50px; outline: 1px rgba(255, 255, 255, 0.75) solid; outline-offset: -1px; justify-content: center; align-items: center; gap: 4px; display: flex; cursor: pointer; transition: all 150ms ease;" role="button" tabindex="0" aria-label="Summarize">
          <div data-layer="Summarize" style="color: rgba(255, 255, 255, 0.75); font-size: 16px; font-family: 'SF Pro', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; font-weight: 590; word-wrap: break-word;">Summarize</div>
        </div>
        <div data-layer="draft messages" class="ai-premium-action-pill" data-action="Draft messages" style="height: 32px; padding-left: 16px; padding-right: 16px; padding-top: 10px; padding-bottom: 10px; overflow: hidden; border-radius: 50px; outline: 1px rgba(255, 255, 255, 0.75) solid; outline-offset: -1px; justify-content: center; align-items: center; gap: 4px; display: flex; cursor: pointer; transition: all 150ms ease;" role="button" tabindex="0" aria-label="Draft messages">
          <div data-layer="Draft messages" style="color: rgba(255, 255, 255, 0.75); font-size: 16px; font-family: 'SF Pro', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; font-weight: 590; word-wrap: break-word;">Draft messages</div>
        </div>
        <div data-layer="improve my profile" class="ai-premium-action-pill" data-action="Improve my profile" style="height: 32px; padding-left: 16px; padding-right: 16px; padding-top: 10px; padding-bottom: 10px; overflow: hidden; border-radius: 50px; outline: 1px rgba(255, 255, 255, 0.75) solid; outline-offset: -1px; justify-content: center; align-items: center; gap: 4px; display: flex; cursor: pointer; transition: all 150ms ease;" role="button" tabindex="0" aria-label="Improve my profile">
          <div data-layer="Improve my profile" style="color: rgba(255, 255, 255, 0.75); font-size: 16px; font-family: 'SF Pro', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; font-weight: 590; word-wrap: break-word;">Improve my profile</div>
        </div>
      </div>
    `;

    // EVENT HANDLERS: Open AI Button (sparkle icon)
    // This is the primary way users access the AI chat
    const openAIBtn = section.querySelector('#ai-premium-open-btn');
    if (openAIBtn) {
      openAIBtn.addEventListener('click', () => {
        if (!this.chatOpen) {
          // Chat is closed - open it
          this.toggleChat();
        } else if (this.chatCollapsed) {
          // Chat is collapsed - expand it
          this.toggleChatCollapse();
        }
        // If chat is open and expanded, do nothing (already accessible)
      });

      // Keyboard accessibility
      openAIBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!this.chatOpen) {
            this.toggleChat();
          } else if (this.chatCollapsed) {
            this.toggleChatCollapse();
          }
        }
      });

      // Visual feedback on hover
      openAIBtn.addEventListener('mouseenter', () => {
        openAIBtn.style.opacity = '0.8';
      });
      openAIBtn.addEventListener('mouseleave', () => {
        openAIBtn.style.opacity = '1';
      });
    }

    // EVENT HANDLERS: Quick Action Pills
    // These provide instant access to common AI tasks
    const actionPills = section.querySelectorAll('.ai-premium-action-pill');
    actionPills.forEach(pill => {
      const action = pill.getAttribute('data-action');
      
      pill.addEventListener('click', () => {
        // SMART CHAT MANAGEMENT:
        // - If chat is closed: open it, then trigger action
        // - If chat is collapsed: expand it, then trigger action  
        // - If chat is open: trigger action immediately
        
        if (!this.chatOpen) {
          // Chat is closed - open it first
          this.toggleChat().then(() => {
            // Wait for chat to fully render before triggering action
            setTimeout(() => {
              this.triggerPremiumSectionAction(action);
            }, 300);
          });
        } else if (this.chatCollapsed) {
          // Chat is collapsed - expand it first
          this.toggleChatCollapse();
          setTimeout(() => {
            this.triggerPremiumSectionAction(action);
          }, 150);
        } else {
          // Chat is open and expanded - trigger action immediately
          this.triggerPremiumSectionAction(action);
        }
      });

      // Keyboard accessibility (same logic as click)
      pill.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!this.chatOpen) {
            this.toggleChat().then(() => {
              setTimeout(() => {
                this.triggerPremiumSectionAction(action);
              }, 300);
            });
          } else if (this.chatCollapsed) {
            this.toggleChatCollapse();
            setTimeout(() => {
              this.triggerPremiumSectionAction(action);
            }, 150);
          } else {
            this.triggerPremiumSectionAction(action);
          }
        }
      });

      // VISUAL FEEDBACK: Hover and active states
      // Provides clear interaction feedback
      pill.addEventListener('mouseenter', () => {
        pill.style.background = 'rgba(255, 255, 255, 0.08)';
      });
      pill.addEventListener('mouseleave', () => {
        pill.style.background = 'transparent';
      });

      // Active state (when pressed)
      pill.addEventListener('mousedown', () => {
        pill.style.background = 'rgba(255, 255, 255, 0.12)';
      });
      pill.addEventListener('mouseup', () => {
        pill.style.background = 'rgba(255, 255, 255, 0.08)';
      });
    });

    return section;
  }

  /**
   * Execute the selected quick action from the AI Premium section
   * 
   * HOW IT WORKS:
   * 1. Maps the clicked action to a specific AI prompt
   * 2. Uses the same handleQuickAction method as the chat interface
   * 3. Provides consistent behavior across all AI access points
   * 
   * PROMPT DESIGN:
   * - Each prompt is carefully crafted for the specific use case
   * - Includes detailed instructions for consistent, high-quality output
   * - Avoids generic responses by being specific about format and tone
   */
  triggerPremiumSectionAction(action) {
    // ACTION MAPPING: Each pill maps to a specific AI task
    // The backendText contains detailed instructions for the AI
    const actionMap = {
      'Summarize': {
        displayText: 'Summarize',
        backendText: "Analyze this LinkedIn profile and create a concise, professional summary. Focus on key achievements, skills, work experience, education, and hobbies, and interests. Keep it under 200 words and make it easy to understand. Be specific and highlight what makes this person unique. No jargon, people use in everyday conversation."
      },
      'Draft messages': {
        displayText: 'Draft messages',
        backendText: `Output ONLY message drafts, nothing else. Rules:

- Always start with 'Hi'
- Absolutely max 300 characters
- Sentence 1: Something specific about their exact role/team or congrats based on their profile. If they started as an intern → mention it. If they just got promoted → say congrats.
- Sentence 2: Always mention the SPECIFIC role I just applied for (include exact job title AND company name)
- Sentence 3: ABSOLUTELY ONLY if they are a recruiter or hiring manager, briefly mention my relevant background and role number in parenthesis after job title I applied for.
- Final sentence: Always end with a polite request for a brief call ('to hear about your experience and your team's focus' / 'to learn more about the team's priorities').
- Tone: warm, professional, not forced. Avoid sounding robotic.
- ABSOLUTELY avoid words like: stood out, inspiring, impressive, unique, bridging, advancing, journey, takeaways, and other buzzwords that feel fake/cringe/impersonal/robotic. Use mom-talk, what matters to customers, no consultant-ese.
- IMPORTANT: Only reference their posts/comments if they're substantial (career moves, insights, achievements). Never reference trivial comments like 'congrats' on random posts - that's spammy and irrelevant.
- NEVER mention LinkedIn Premium, badges, or other LinkedIn features - that's weird and awkward.
- Be specific about job titles and companies - never say vague things like 'the role' without context.

Generate 3 variations personalized based on the person's role and posts.`
      },
      'Improve my profile': {
        displayText: 'Improve my profile',
        backendText: `Look at my profile and this person's profile and suggest 3-5 ways I could make my profile more authentic and human. Focus on showing my personality, interests, and what I'm passionate about - not just my job title. Help me come across as someone people would want to have a conversation with, not just work with.

ONLY OUTPUT THIS EXACT FORMAT AND NOTHING ELSE:
Clean, simple sentence about how to improve my profile for this person

• [Direct, actionable improvement suggestion]
• [Direct, actionable improvement suggestion]
• [Direct, actionable improvement suggestion]
• [Direct, actionable improvement suggestion]
• [Direct, actionable improvement suggestion]`
      }
    };

    // Execute the action using the same method as chat quick actions
    // This ensures consistent behavior and UI updates
    const actionConfig = actionMap[action];
    if (actionConfig) {
      this.handleQuickAction(actionConfig.displayText, actionConfig.backendText);
    }
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
    
    // Check if this is a company page
    const isCompanyPage = window.location.href.includes('/company/');
    
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
      
      // LinkedIn profile/company actions typically have 2-5 buttons in a row
      if (buttons.length >= 2 && buttons.length <= 5) {
        // Check if any button has a common action keyword
        const hasActionButton = buttons.some(btn => {
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          const text = btn.textContent.trim().toLowerCase();
          
          if (isCompanyPage) {
            // Company page specific keywords
            return ariaLabel.includes('follow') || 
                   ariaLabel.includes('visit website') ||
                   ariaLabel.includes('more') ||
                   text.includes('follow') ||
                   text.includes('visit website') ||
                   text.includes('more');
          } else {
            // Profile page keywords
            return ariaLabel.includes('message') || 
                   ariaLabel.includes('connect') || 
                   ariaLabel.includes('follow') ||
                   ariaLabel.includes('more') ||
                   text.includes('message') ||
                   text.includes('follow') ||
                   text.includes('more');
          }
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
    const actionKeywords = isCompanyPage 
      ? ['follow', 'visit website', 'more'] 
      : ['message', 'connect', 'follow', 'more', 'view my'];
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



  async toggleChat() {
    if (!this.chatOpen) {
      // Check for API key first
      const { gemini_api_key } = await chrome.storage.sync.get(['gemini_api_key']);
      if (!gemini_api_key) {
        this.showAPIKeySetup();
        return;
      }

      // Create chat interface immediately for instant feedback
      this.createChatInterface();
      this.chatOpen = true;

      // Scrape profile data in the background
      this.scrapeProfile().then(profileData => {
        this.currentProfile = profileData;
        // Optionally show a notification that profile data is ready
        console.log('LinkedIn AI: Profile data loaded');
      }).catch(err => {
        console.error('LinkedIn AI: Error loading profile data:', err);
        // Still usable even if profile scraping fails
      });
    } else {
      const chatContainer = document.getElementById('linkedin-ai-chat');
      if (chatContainer) {
        chatContainer.remove();
      }
      this.chatOpen = false;
      this.chatCollapsed = false;
    }
  }

  toggleChatCollapse() {
    const chatPanel = document.querySelector('.linkedin-ai-chat-panel');
    const chatContainer = document.querySelector('.linkedin-ai-chat-container');
    if (!chatPanel || !chatContainer) return;

    this.chatCollapsed = !this.chatCollapsed;
    
    if (this.chatCollapsed) {
      // Add collapsed class - CSS transitions handle the animation
      chatPanel.classList.add('collapsed');
      chatContainer.classList.add('collapsed');
    } else {
      // Remove collapsed state - CSS transitions handle the animation
      chatPanel.classList.remove('collapsed');
      chatContainer.classList.remove('collapsed');
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
            <!-- Quick actions will be populated by resetQuickActionsToDefault() -->
          </div>
        </div>
      </div>

    `;

    document.body.appendChild(chatContainer);
    this.attachChatEventListeners();
    this.loadChatHistory();
    
    // Initialize quick actions based on current profile type
    this.resetQuickActionsToDefault();
  }

  attachChatEventListeners() {
    const menuBtn = document.getElementById('chat-menu-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const closeBtn = document.getElementById('chat-close-btn');
    const navbar = document.querySelector('.chat-navbar');

    const openExtensionPopup = () => {
      // Open the Chrome extension popup by simulating a click on the extension icon
      chrome.runtime.sendMessage({ action: 'openPopup' });
    };

    const handleNewChat = async () => {
      // Clear chat messages from UI
      const messagesContainer = document.getElementById('chat-messages');
      if (messagesContainer) {
        messagesContainer.innerHTML = '';
      }
      
      // Reset message count and streaming state
      this.messageCount = 0;
      this.streamingMessageId = null;
      
      // Reset clicked actions tracking
      this.clickedActions.clear();
      
      // Clear chat history from storage for current profile
      const profileHash = this.hashProfile(window.location.href);
      await chrome.storage.local.get(['chats']).then(result => {
        const chats = result.chats || {};
        if (chats[profileHash]) {
          delete chats[profileHash];
          chrome.storage.local.set({ chats });
        }
      });
      
      // Reset AI suggestions to default quick actions
      this.resetQuickActionsToDefault();
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

    attachButtonHandlers(menuBtn, openExtensionPopup);
    attachButtonHandlers(newChatBtn, handleNewChat);
    attachButtonHandlers(closeBtn, () => this.toggleChat());
    
    // Navbar click handler for collapse/expand
    if (navbar) {
      navbar.addEventListener('click', (e) => {
        // Don't collapse if clicking on action buttons
        if (e.target.closest('.navbar-actions')) {
          return;
        }
        this.toggleChatCollapse();
      });
    }

    // API key actions

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

    // Prevent page scrolling when scrolling in chat viewport
    const chatViewport = document.getElementById('chat-content');
    if (chatViewport) {
      chatViewport.addEventListener('wheel', (e) => {
        // Check if we're at the top or bottom of the chat viewport
        const { scrollTop, scrollHeight, clientHeight } = chatViewport;
        const isAtTop = scrollTop === 0;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1; // Small tolerance for rounding
        
        // If scrolling up and at top, or scrolling down and at bottom, prevent page scroll
        if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, { passive: false });
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
    
    // Track this action as clicked
    this.clickedActions.add(displayText);
    
    // Hide suggestions during streaming
    this.hideSuggestionsDuringStreaming();
    
    // Show display text in input briefly, then send backend text to AI
    if (chatInput) {
      chatInput.value = displayText;
      chatInput.dispatchEvent(new Event('input'));
    }
    
    // Store user message for share sheet functionality
    // This allows the share sheet to include the user's question for context
    this.lastUserMessage = displayText;
    
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
    
    // Send backend text to AI but pass displayText for storage
    this.getAIResponse(backendText, displayText);
  }

  async sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const message = chatInput?.value.trim();
    if (!message) return;

    // Hide suggestions during streaming
    this.hideSuggestionsDuringStreaming();

    // Clear input and reset height
    if (chatInput) {
    chatInput.value = '';
      chatInput.style.height = 'auto';
    }
    if (sendBtn) {
      sendBtn.disabled = true;
    }

    // Store user message for share sheet functionality
    // This allows the share sheet to include the user's question for context
    this.lastUserMessage = message;

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
    
    /**
     * Share functionality: Convert HTML to image and share via multiple methods
     * 
     * WHY THIS APPROACH:
     * - Users want to share AI responses as images (not just text)
     * - Images are more visually appealing and easier to share on social media
     * - Need robust fallbacks since sharing APIs vary by browser/platform
     * 
     * SHARING FLOW:
     * 1. Try Web Share API with image file (best experience)
     * 2. Fallback to clipboard image copy (works on most platforms)
     * 3. Fallback to Web Share API with text (if image fails)
     * 4. Final fallback to clipboard text copy (universal)
     */
    const handleShare = async () => {
      // Get the last user message to include in the share sheet
      // This provides context for what the AI was responding to
      const userMessage = this.lastUserMessage || 'User message';
      
      // Parse markdown to HTML for proper formatting in the image
      // This preserves bold, italic, lists, etc. instead of showing raw markdown
      const aiResponse = parseMarkdown(content);
      
      // Create HTML template for the share sheet image
      // WHY THESE DESIGN CHOICES:
      // - 320x480px: Standard mobile-friendly aspect ratio
      // - System fonts: Can't load external fonts in SVG data URLs (CORS restriction)
      // - Full width layout: Prevents text cutoff issues
      // - White background: Clean, professional appearance
      // - LinkedIn logo: Branding and attribution
      const shareSheetHTML = `<div class="share-sheet" style="width: 320px; height: 480px; padding: 24px; position: relative; background: white; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; gap: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
  <div class="messages-container" style="width: 100%; display: flex; flex-direction: column; justify-content: flex-start; align-items: flex-end; gap: 10px;">
    <div class="user-bubble" style="max-width: 224px; padding: 12px; background: rgba(0, 0, 0, 0.08); border-radius: 20px; word-wrap: break-word;">
      <div class="user-text" style="color: rgba(0, 0, 0, 0.95); font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-weight: 400; line-height: 24px;">${userMessage}</div>
    </div>
  </div>
  <div class="ai-response-text" style="width: 100%; flex: 1 1 0; overflow: hidden; color: rgba(0, 0, 0, 0.95); font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-weight: 400; line-height: 24px; word-wrap: break-word;">${aiResponse}</div>
  <div class="logo-overlay" style="width: 320px; padding-top: 96px; padding-bottom: 24px; padding-left: 24px; padding-right: 24px; left: 0; top: 324.26px; position: absolute; background: linear-gradient(0deg, white 50%, rgba(255, 255, 255, 0) 100%); overflow: hidden; flex-direction: column; justify-content: flex-end; align-items: flex-start; gap: 10px; display: flex;">
    <div class="linkedin-logo">
      <svg width="144" height="37" viewBox="0 0 144 37" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M110.712 0.264648C109.245 0.264648 108 1.42645 108 2.85617V33.6731C108 35.1046 108.816 36.2646 110.283 36.2646H140.963C142.432 36.2646 144 35.1046 144 33.6731V2.85617C144 1.42645 142.861 0.264648 141.392 0.264648H110.712ZM115.714 4.76465C117.49 4.76465 118.929 6.20293 118.929 7.97893C118.929 9.75493 117.49 11.1932 115.714 11.1932C113.938 11.1932 112.5 9.75493 112.5 7.97893C112.5 6.20293 113.938 4.76465 115.714 4.76465ZM21.4319 4.89185C19.7296 4.89185 18.3415 6.2749 18.3415 7.9789C18.3415 9.6829 19.7296 11.066 21.4319 11.066C23.1359 11.066 24.5156 9.6829 24.5156 7.9789C24.5156 6.2749 23.1359 4.89185 21.4319 4.89185ZM0 5.40751V31.1218H15.4286V25.9789H5.14286V5.40751H0ZM48 5.40751V31.1218H53.1429V22.5504L59.4844 31.1218H65.5547L58.2857 21.7501L65.1429 13.9789H59.1429L53.1429 20.8361V5.40751H48ZM97.7143 5.40751V16.0214H97.6641C96.6166 14.7562 94.8851 13.7646 92.0993 13.7646C87.5993 13.7646 83.9632 17.2905 83.9632 22.5705C83.9632 28.1127 87.6529 31.3361 91.9386 31.3361C95.0826 31.3361 96.9376 30.3171 98.0056 29.0794H98.0558V31.1218H102.857V5.40751H97.7143ZM37.9487 13.7646C35.2504 13.7646 33.0659 15.1179 32.327 16.4499H32.2735V13.9789H27.4286V31.1218H32.5714V22.8885C32.5714 20.312 33.8032 18.2646 36.3884 18.2646C38.5175 18.2646 39.4286 20.0202 39.4286 22.5437V31.1218H44.5714V21.6062C44.5714 17.0496 43.1275 13.7646 37.9487 13.7646ZM74.106 13.7646C68.2483 13.7646 65.1429 17.1921 65.1429 22.1687C65.1429 27.7709 68.5708 31.3361 73.9554 31.3361C77.9908 31.3361 80.4894 29.9315 81.7031 28.3595L78.5022 25.7646C77.8097 26.7058 76.2745 27.9075 74.0391 27.9075C71.4779 27.9075 70.3623 26.1006 70.0246 24.6229L69.9978 24.0939H82.192C82.192 24.0939 82.2858 23.5166 82.2858 22.9321C82.2858 17.0881 79.1649 13.7646 74.106 13.7646ZM132.234 13.7646C137.413 13.7646 138.857 16.513 138.857 21.6062V31.1218H133.714V22.5437C133.714 20.2637 132.803 18.2646 130.674 18.2646C128.089 18.2646 126.857 20.0154 126.857 22.8885V31.1218H121.714V13.9789H126.559V16.4499H126.613C127.351 15.1179 129.536 13.7646 132.234 13.7646ZM18.8571 13.9789V31.1218H24V13.9789H18.8571ZM113.143 13.9789H118.286V31.1218H113.143V13.9789ZM73.952 17.1932C76.0434 17.1932 77.3713 19.0275 77.3371 20.8361H69.9978C70.1366 19.1372 71.4629 17.1932 73.952 17.1932ZM93.3918 17.6218C96.3352 17.6218 98.0558 19.5823 98.0558 22.5068C98.0558 25.3526 96.3352 27.4789 93.3918 27.4789C90.4518 27.4789 88.8013 25.296 88.8013 22.5068C88.8013 19.7194 90.4518 17.6218 93.3918 17.6218Z" fill="#0A66C2"/>
      </svg>
    </div>
  </div>
</div>`;
      
      try {
        // STEP 1: Convert HTML to PNG image blob
        // This uses our htmlToImage function with SVG foreignObject approach
        console.log('Attempting to create share image...');
        const imageBlob = await htmlToImage(shareSheetHTML);
        console.log('Image blob created:', imageBlob);
        
        // Create File object from blob for Web Share API
        // File objects are required for sharing images via Web Share API
        const imageFile = new File([imageBlob], 'ai-response.png', { type: 'image/png' });
        
        // STEP 2: Try Web Share API with image file (best user experience)
        // Check if browser supports file sharing via Web Share API
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
          console.log('Sharing image via Web Share API...');
          await navigator.share({
            files: [imageFile],
            title: 'AI Response'
          });
          console.log('Image shared successfully');
          return; // Success - exit early
        } 
        
        // STEP 3: Fallback to clipboard image copy
        // This works on most platforms (mobile and desktop)
        console.log('File sharing not supported, copying image to clipboard...');
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': imageBlob
          })
        ]);
        console.log('Image copied to clipboard');
        
        // Show visual feedback: hide share icon, show checkmark
        if (shareIcon) shareIcon.style.display = 'none';
        if (shareCheckmark) shareCheckmark.style.display = 'flex';
        setTimeout(() => {
          if (shareIcon) shareIcon.style.display = 'flex';
          if (shareCheckmark) shareCheckmark.style.display = 'none';
        }, 2000);
        
      } catch (err) {
        // STEP 4: Image sharing failed, fallback to text sharing
        console.error('Image share/copy failed:', err.message);
        
        // Strip markdown for plain text sharing
        const plainText = stripMarkdown(content);
        
        // STEP 5: Try Web Share API with text
        if (navigator.share) {
          try {
            console.log('Sharing text via Web Share API...');
            await navigator.share({
              title: 'AI Response',
              text: plainText
            });
            console.log('Text shared successfully');
            return; // Success - exit early
          } catch (shareErr) {
            // Handle user cancellation gracefully
            if (shareErr.name === 'AbortError') {
              console.log('Share cancelled by user');
              return;
            }
            console.log('Text share failed, copying to clipboard...');
          }
        }
        
        // STEP 6: Final fallback - Copy text to clipboard
        // This works universally across all browsers and platforms
        try {
          await navigator.clipboard.writeText(plainText);
          console.log('Text copied to clipboard');
          
          // Show visual feedback
          if (shareIcon) shareIcon.style.display = 'none';
          if (shareCheckmark) shareCheckmark.style.display = 'flex';
          setTimeout(() => {
            if (shareIcon) shareIcon.style.display = 'flex';
            if (shareCheckmark) shareCheckmark.style.display = 'none';
          }, 2000);
        } catch (textErr) {
          // All sharing methods have failed
          console.error('All share methods failed:', textErr);
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
      thumbsDownIcon.addEventListener('click', () => this.showFeedbackPopup());
      thumbsDownIcon.addEventListener('keydown', (event) => handleKeyActivation(event, () => this.showFeedbackPopup()));
    }

    const toggleTTSState = (listening) => {
      if (!listenIcon || !stopIcon) return;
      listenIcon.style.display = listening ? 'none' : 'flex';
      stopIcon.style.display = listening ? 'flex' : 'none';
    };

    let currentUtterance = null;

    const startTTS = async () => {
      // Stop any ongoing speech
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      // Get plain text content (no markdown)
      const plainText = stripMarkdown(content);
      
      // Use native browser TTS directly
      this.startBrowserTTS(plainText, toggleTTSState);
    };

    const stopTTS = () => {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (this.currentUtterance) {
        this.currentUtterance = null;
      }
      toggleTTSState(false);
      this.currentTTSMessageId = null;
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

  async getAIResponse(userMessage, displayTextForStorage = null, retryCount = 0) {
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
            setTimeout(() => this.getAIResponse(userMessage, displayTextForStorage, retryCount + 1), 1000);
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
            setTimeout(() => this.getAIResponse(userMessage, displayTextForStorage, retryCount + 1), 1000);
          } else {
            this.addMessage('assistant', '⚠️ Sorry, I encountered an error. Please try again later.');
          }
        } else if (response && response.text) {
          // Streaming complete - add action buttons to the message
          this.finalizeStreamingMessage(response.text);
          
          // Save message to storage (use displayTextForStorage if provided, otherwise userMessage)
          this.saveMessageToStorage(displayTextForStorage || userMessage, response.text);
        } else {
          this.addMessage('assistant', '⚠️ Received empty response. Please try again.');
        }
      });
    } catch (error) {
      console.error('Error getting AI response:', error);
      document.getElementById('thinking-indicator')?.remove();
      
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => this.getAIResponse(userMessage, displayTextForStorage, retryCount + 1), 1000);
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

      const prompt = `Based on this AI response, generate 3 very short (2-5 words each) follow-up questions or statements that a user would naturally say next. These should be conversational, relevant, and feel like what the user would actually type in a chat. Focus on natural curiosity, clarification, or next steps. Return ONLY a JSON array of strings, no other text.

AI Response: "${aiResponse.substring(0, 500)}"

Examples of good suggestions:
- "What's his biggest win?"
- "How long at Lenovo?"
- "What's his leadership style?"
- "Make it sound friendlier"
- "Focus on hardware instead"
- "What's his biggest focus?"
- "What about his background?"
- "Any interesting projects?"
- "How to highlight my achievements?"

Return format: ["suggestion1", "suggestion2", "suggestion3"]`;

      // Call Gemini API directly for suggestions (non-streaming, quick response)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-09-2025:generateContent?key=${gemini_api_key}`,
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

    // Show the container if it was hidden during streaming
    quickActionsContainer.style.display = '';

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

  resetQuickActionsToDefault() {
    const quickActionsContainer = document.getElementById('quick-actions');
    if (!quickActionsContainer) return;

    // Check if this is a company page
    const isCompanyPage = this.currentProfile && this.currentProfile.type === 'company';

    // Reset to context-appropriate quick actions
    if (isCompanyPage) {
      // Company page quick actions
      quickActionsContainer.innerHTML = `
        <div data-layer="summarize" class="quick-action" 
             data-action="Summarize" 
             data-backend-action="Write a human summary like you're telling your mom about this company (but don't actually say that). Focus on what the company does, their industry, size, culture, notable achievements, and how to approach them professionally. Use normal words people actually say. Still be polite and friendly.

ONLY OUTPUT THIS EXACT FORMAT AND NOTHING ELSE:
Clean, simple sentence about what this company is

• [Emoji] [1-5 human, short & succinct, conversational points about their industry, culture, achievements, and how to connect with them]"
             role="button" tabindex="0" aria-label="Summarize">
          <div data-layer="Summarize">Summarize</div>
        </div>
        <div data-layer="use cases" class="quick-action" 
             data-action="Use cases" 
             data-backend-action="Based on this company's profile, list 1-5 specific use cases for their products/services. Focus on practical scenarios where someone would actually use what they offer. Be specific and actionable.

ONLY OUTPUT THIS EXACT FORMAT AND NOTHING ELSE:
Clean, simple sentence about who uses this company

• [Emoji] [1-5 human, short & succinct, conversational points about specific use cases and scenarios]"
             role="button" tabindex="0" aria-label="Use cases">
          <div data-layer="Use cases">Use cases</div>
        </div>
        <div data-layer="improve my profile (to better sell myself to this company)" class="quick-action" 
             data-action="Improve my profile" 
             data-backend-action="Look at my profile and this company's profile and suggest 3-5 ways I could make my profile more attractive to this company. Focus on aligning my skills, experience, and interests with their culture and values. Help me come across as someone they'd want to hire or work with.

ONLY OUTPUT THIS EXACT FORMAT AND NOTHING ELSE:
Clean, simple sentence about how to improve my profile for this company

• [Direct, actionable improvement suggestion]
• [Direct, actionable improvement suggestion]
• [Direct, actionable improvement suggestion]
• [Direct, actionable improvement suggestion]
• [Direct, actionable improvement suggestion]"
             role="button" tabindex="0" aria-label="Improve my profile">
          <div data-layer="Improve my profile">Improve my profile</div>
        </div>
      `;
    } else {
      // Profile page quick actions
      quickActionsContainer.innerHTML = `
        <div data-layer="summarize" class="quick-action" 
             data-action="Summarize" 
             data-backend-action="Analyze this LinkedIn profile and create a concise, professional summary. Focus on key achievements, skills, work experience, education, and hobbies, and interests. Keep it under 200 words and make it easy to understand. Be specific and highlight what makes this person unique. No jargon, people use in everyday conversation."
             role="button" tabindex="0" aria-label="Summarize">
          <div data-layer="Summarize">Summarize</div>
        </div>
        <div data-layer="draft messages" class="quick-action" 
             data-action="Draft messages" 
             data-backend-action="Output ONLY message drafts, nothing else. Rules:

- Always start with 'Hi'
- Absolutely max 300 characters
- Sentence 1: Something specific about their exact role/team or congrats based on their profile. If they started as an intern → mention it. If they just got promoted → say congrats.
- Sentence 2: Always mention the SPECIFIC role I just applied for (include exact job title AND company name)
- Sentence 3: ABSOLUTELY ONLY if they are a recruiter or hiring manager, briefly mention my relevant background and role number in parenthesis after job title I applied for.
- Final sentence: Always end with a polite request for a brief call ('to hear about your experience and your team's focus' / 'to learn more about the team's priorities').
- Tone: warm, professional, not forced. Avoid sounding robotic.
- ABSOLUTELY avoid words like: stood out, inspiring, impressive, unique, bridging, advancing, journey, takeaways, and other buzzwords that feel fake/cringe/impersonal/robotic. Use mom-talk, what matters to customers, no consultant-ese.
- IMPORTANT: Only reference their posts/comments if they're substantial (career moves, insights, achievements). Never reference trivial comments like 'congrats' on random posts - that's spammy and irrelevant.
- NEVER mention LinkedIn Premium, badges, or other LinkedIn features - that's weird and awkward.
- Be specific about job titles and companies - never say vague things like 'the role' without context.

Generate 3 variations personalized based on the person's role and posts."
             role="button" tabindex="0" aria-label="Draft messages">
          <div data-layer="Draft messages">Draft messages</div>
        </div>
        <div data-layer="improve my profile (to better sell myself to this person)" class="quick-action" 
             data-action="Improve my profile" 
             data-backend-action="Look at my profile and this person's profile and suggest 3-5 ways I could make my profile more authentic and human. Focus on showing my personality, interests, and what I'm passionate about - not just my job title. Help me come across as someone people would want to have a conversation with, not just work with.

ONLY OUTPUT THIS EXACT FORMAT AND NOTHING ELSE:
Clean, simple sentence about how to improve my profile for this person

• [Direct, actionable improvement suggestion]
• [Direct, actionable improvement suggestion]
• [Direct, actionable improvement suggestion]
• [Direct, actionable improvement suggestion]
• [Direct, actionable improvement suggestion]"
             role="button" tabindex="0" aria-label="Improve my profile">
          <div data-layer="Improve my profile">Improve my profile</div>
        </div>
      `;
    }
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
    
    // Generate AI follow-up suggestions based on the response content
    this.generateFollowUpSuggestions(content).then(suggestions => {
      if (suggestions && suggestions.length > 0) {
        this.updateQuickActions(suggestions);
      } else {
        // Fallback to contextual suggestions if AI suggestions fail
        this.showContextualSuggestions();
      }
    });
    
    // Clear streaming message ID
    this.streamingMessageId = null;
  }

  hideSuggestionsDuringStreaming() {
    const quickActionsContainer = document.getElementById('quick-actions');
    if (quickActionsContainer) {
      quickActionsContainer.style.display = 'none';
    }
  }

  showContextualSuggestions() {
    const quickActionsContainer = document.getElementById('quick-actions');
    if (!quickActionsContainer) return;

    // Get the last clicked action
    const lastClickedAction = Array.from(this.clickedActions).pop();
    
    // Define contextual suggestions based on last clicked action
    const contextualSuggestions = this.getContextualSuggestions(lastClickedAction);
    
    // Update quick actions with contextual suggestions
    this.updateQuickActions(contextualSuggestions);
  }

  getContextualSuggestions(lastClickedAction) {
    const suggestions = [];
    
    // Define contextual suggestions based on action
    switch (lastClickedAction) {
      case 'Summarize':
        suggestions.push('Draft messages', 'Improve my profile');
        break;
      case 'Draft messages':
        suggestions.push('Summarize', 'Improve my profile');
        break;
      case 'Improve my profile':
        suggestions.push('Summarize', 'Draft messages');
        break;
      case 'Use cases':
        suggestions.push('Summarize', 'Draft messages');
        break;
      case 'Company culture':
        suggestions.push('Summarize', 'Use cases');
        break;
      case 'Interview prep':
        suggestions.push('Summarize', 'Draft messages');
        break;
      default:
        // Default suggestions for unknown actions
        suggestions.push('Summarize', 'Draft messages', 'Improve my profile');
    }
    
    // Filter out already clicked actions
    return suggestions.filter(action => !this.clickedActions.has(action));
  }

  attachMessageActionListeners(actionsDiv, content) {
    const shareIcon = actionsDiv.querySelector('.share-icon');
    const shareCheckmark = actionsDiv.querySelector('.share-checkmark-icon');
    const listenIcon = actionsDiv.querySelector('.tts-listen-icon');
    const stopIcon = actionsDiv.querySelector('.tts-stop-icon');

    /**
     * Share functionality: Convert HTML to image and share via multiple methods
     * 
     * WHY THIS APPROACH:
     * - Users want to share AI responses as images (not just text)
     * - Images are more visually appealing and easier to share on social media
     * - Need robust fallbacks since sharing APIs vary by browser/platform
     * 
     * SHARING FLOW:
     * 1. Try Web Share API with image file (best experience)
     * 2. Fallback to clipboard image copy (works on most platforms)
     * 3. Fallback to Web Share API with text (if image fails)
     * 4. Final fallback to clipboard text copy (universal)
     */
    const handleShare = async () => {
      // Get the last user message to include in the share sheet
      // This provides context for what the AI was responding to
      const userMessage = this.lastUserMessage || 'User message';
      
      // Parse markdown to HTML for proper formatting in the image
      // This preserves bold, italic, lists, etc. instead of showing raw markdown
      const aiResponse = parseMarkdown(content);
      
      // Create HTML template for the share sheet image
      // WHY THESE DESIGN CHOICES:
      // - 320x480px: Standard mobile-friendly aspect ratio
      // - System fonts: Can't load external fonts in SVG data URLs (CORS restriction)
      // - Full width layout: Prevents text cutoff issues
      // - White background: Clean, professional appearance
      // - LinkedIn logo: Branding and attribution
      const shareSheetHTML = `<div class="share-sheet" style="width: 320px; height: 480px; padding: 24px; position: relative; background: white; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-start; align-items: stretch; gap: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;">
  <div class="messages-container" style="width: 100%; display: flex; flex-direction: column; justify-content: flex-start; align-items: flex-end; gap: 10px;">
    <div class="user-bubble" style="max-width: 224px; padding: 12px; background: rgba(0, 0, 0, 0.08); border-radius: 20px; word-wrap: break-word;">
      <div class="user-text" style="color: rgba(0, 0, 0, 0.95); font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-weight: 400; line-height: 24px;">${userMessage}</div>
    </div>
  </div>
  <div class="ai-response-text" style="width: 100%; flex: 1 1 0; overflow: hidden; color: rgba(0, 0, 0, 0.95); font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-weight: 400; line-height: 24px; word-wrap: break-word;">${aiResponse}</div>
  <div class="logo-overlay" style="width: 320px; padding-top: 96px; padding-bottom: 24px; padding-left: 24px; padding-right: 24px; left: 0; top: 324.26px; position: absolute; background: linear-gradient(0deg, white 50%, rgba(255, 255, 255, 0) 100%); overflow: hidden; flex-direction: column; justify-content: flex-end; align-items: flex-start; gap: 10px; display: flex;">
    <div class="linkedin-logo">
      <svg width="144" height="37" viewBox="0 0 144 37" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M110.712 0.264648C109.245 0.264648 108 1.42645 108 2.85617V33.6731C108 35.1046 108.816 36.2646 110.283 36.2646H140.963C142.432 36.2646 144 35.1046 144 33.6731V2.85617C144 1.42645 142.861 0.264648 141.392 0.264648H110.712ZM115.714 4.76465C117.49 4.76465 118.929 6.20293 118.929 7.97893C118.929 9.75493 117.49 11.1932 115.714 11.1932C113.938 11.1932 112.5 9.75493 112.5 7.97893C112.5 6.20293 113.938 4.76465 115.714 4.76465ZM21.4319 4.89185C19.7296 4.89185 18.3415 6.2749 18.3415 7.9789C18.3415 9.6829 19.7296 11.066 21.4319 11.066C23.1359 11.066 24.5156 9.6829 24.5156 7.9789C24.5156 6.2749 23.1359 4.89185 21.4319 4.89185ZM0 5.40751V31.1218H15.4286V25.9789H5.14286V5.40751H0ZM48 5.40751V31.1218H53.1429V22.5504L59.4844 31.1218H65.5547L58.2857 21.7501L65.1429 13.9789H59.1429L53.1429 20.8361V5.40751H48ZM97.7143 5.40751V16.0214H97.6641C96.6166 14.7562 94.8851 13.7646 92.0993 13.7646C87.5993 13.7646 83.9632 17.2905 83.9632 22.5705C83.9632 28.1127 87.6529 31.3361 91.9386 31.3361C95.0826 31.3361 96.9376 30.3171 98.0056 29.0794H98.0558V31.1218H102.857V5.40751H97.7143ZM37.9487 13.7646C35.2504 13.7646 33.0659 15.1179 32.327 16.4499H32.2735V13.9789H27.4286V31.1218H32.5714V22.8885C32.5714 20.312 33.8032 18.2646 36.3884 18.2646C38.5175 18.2646 39.4286 20.0202 39.4286 22.5437V31.1218H44.5714V21.6062C44.5714 17.0496 43.1275 13.7646 37.9487 13.7646ZM74.106 13.7646C68.2483 13.7646 65.1429 17.1921 65.1429 22.1687C65.1429 27.7709 68.5708 31.3361 73.9554 31.3361C77.9908 31.3361 80.4894 29.9315 81.7031 28.3595L78.5022 25.7646C77.8097 26.7058 76.2745 27.9075 74.0391 27.9075C71.4779 27.9075 70.3623 26.1006 70.0246 24.6229L69.9978 24.0939H82.192C82.192 24.0939 82.2858 23.5166 82.2858 22.9321C82.2858 17.0881 79.1649 13.7646 74.106 13.7646ZM132.234 13.7646C137.413 13.7646 138.857 16.513 138.857 21.6062V31.1218H133.714V22.5437C133.714 20.2637 132.803 18.2646 130.674 18.2646C128.089 18.2646 126.857 20.0154 126.857 22.8885V31.1218H121.714V13.9789H126.559V16.4499H126.613C127.351 15.1179 129.536 13.7646 132.234 13.7646ZM18.8571 13.9789V31.1218H24V13.9789H18.8571ZM113.143 13.9789H118.286V31.1218H113.143V13.9789ZM73.952 17.1932C76.0434 17.1932 77.3713 19.0275 77.3371 20.8361H69.9978C70.1366 19.1372 71.4629 17.1932 73.952 17.1932ZM93.3918 17.6218C96.3352 17.6218 98.0558 19.5823 98.0558 22.5068C98.0558 25.3526 96.3352 27.4789 93.3918 27.4789C90.4518 27.4789 88.8013 25.296 88.8013 22.5068C88.8013 19.7194 90.4518 17.6218 93.3918 17.6218Z" fill="#0A66C2"/>
      </svg>
    </div>
  </div>
</div>`;
      
      try {
        // STEP 1: Convert HTML to PNG image blob
        // This uses our htmlToImage function with SVG foreignObject approach
        console.log('Attempting to create share image...');
        const imageBlob = await htmlToImage(shareSheetHTML);
        console.log('Image blob created:', imageBlob);
        
        // Create File object from blob for Web Share API
        // File objects are required for sharing images via Web Share API
        const imageFile = new File([imageBlob], 'ai-response.png', { type: 'image/png' });
        
        // STEP 2: Try Web Share API with image file (best user experience)
        // Check if browser supports file sharing via Web Share API
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
          console.log('Sharing image via Web Share API...');
          await navigator.share({
            files: [imageFile],
            title: 'AI Response'
          });
          console.log('Image shared successfully');
          return; // Success - exit early
        } 
        
        // STEP 3: Fallback to clipboard image copy
        // This works on most platforms (mobile and desktop)
        console.log('File sharing not supported, copying image to clipboard...');
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': imageBlob
          })
        ]);
        console.log('Image copied to clipboard');
        
        // Show visual feedback: hide share icon, show checkmark
        if (shareIcon) shareIcon.style.display = 'none';
        if (shareCheckmark) shareCheckmark.style.display = 'flex';
        setTimeout(() => {
          if (shareIcon) shareIcon.style.display = 'flex';
          if (shareCheckmark) shareCheckmark.style.display = 'none';
        }, 2000);
        
      } catch (err) {
        // STEP 4: Image sharing failed, fallback to text sharing
        console.error('Image share/copy failed:', err.message);
        
        // Strip markdown for plain text sharing
        const plainText = stripMarkdown(content);
        
        // STEP 5: Try Web Share API with text
        if (navigator.share) {
          try {
            console.log('Sharing text via Web Share API...');
            await navigator.share({
              title: 'AI Response',
              text: plainText
            });
            console.log('Text shared successfully');
            return; // Success - exit early
          } catch (shareErr) {
            // Handle user cancellation gracefully
            if (shareErr.name === 'AbortError') {
              console.log('Share cancelled by user');
              return;
            }
            console.log('Text share failed, copying to clipboard...');
          }
        }
        
        // STEP 6: Final fallback - Copy text to clipboard
        // This works universally across all browsers and platforms
        try {
          await navigator.clipboard.writeText(plainText);
          console.log('Text copied to clipboard');
          
          // Show visual feedback
          if (shareIcon) shareIcon.style.display = 'none';
          if (shareCheckmark) shareCheckmark.style.display = 'flex';
          setTimeout(() => {
            if (shareIcon) shareIcon.style.display = 'flex';
            if (shareCheckmark) shareCheckmark.style.display = 'none';
          }, 2000);
        } catch (textErr) {
          // All sharing methods have failed
          console.error('All share methods failed:', textErr);
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
      thumbsDownIcon.addEventListener('click', () => this.showFeedbackPopup());
      thumbsDownIcon.addEventListener('keydown', (event) => handleKeyActivation(event, () => this.showFeedbackPopup()));
    }

    const toggleTTSState = (listening) => {
      if (!listenIcon || !stopIcon) return;
      listenIcon.style.display = listening ? 'none' : 'flex';
      stopIcon.style.display = listening ? 'flex' : 'none';
    };

    let currentUtterance = null;

    const startTTS = async () => {
      // Stop any ongoing speech
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      // Get plain text content (no markdown)
      const plainText = stripMarkdown(content);
      
      // Use native browser TTS directly
      this.startBrowserTTS(plainText, toggleTTSState);
    };

    const stopTTS = () => {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (this.currentUtterance) {
        this.currentUtterance = null;
      }
      toggleTTSState(false);
      this.currentTTSMessageId = null;
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-09-2025:generateContent?key=${gemini_api_key}`,
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
    
    // Get conversation history for this profile
    const profileHash = this.hashProfile(window.location.href);
    const result = await chrome.storage.local.get(['chats']);
    const chats = result.chats || {};
    const chatHistory = chats[profileHash]?.messages || [];
    
    let contextMessage = '';
    
    // Add conversation history if this is a follow-up question
    if (chatHistory.length > 0) {
      contextMessage += `=== CONVERSATION HISTORY ===\n`;
      // Include last 20 messages (10 exchanges) - Gemini 2.5 Flash has 1M token context window
      // This provides much better context while staying well within limits
      const recentMessages = chatHistory.slice(-20);
      recentMessages.forEach(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        contextMessage += `${role}: ${msg.content}\n`;
      });
      contextMessage += `\n`;
    }
    
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
    
    // Add the profile/company being viewed
    if (!this.currentProfile) {
      return contextMessage + userMessage;
    }

    const pageType = this.currentProfile.type === 'company' ? 'COMPANY BEING VIEWED' : 'PROFILE BEING VIEWED';
    contextMessage += `=== ${pageType} ===\n`;
    
    // Use AI-generated summary if available, otherwise use DOM
    if (this.currentProfile.aiSummary) {
      contextMessage += this.currentProfile.aiSummary + '\n';
    } else if (this.currentProfile.dom) {
      contextMessage += this.currentProfile.dom + '\n';
    } else {
      // Fallback to basic info
      contextMessage += `Name: ${this.currentProfile.name}\n`;
    }

    contextMessage += `\n=== CURRENT USER QUESTION ===\n${userMessage}\n\n`;
    
    // Adjust instruction based on whether this is a follow-up
    if (chatHistory.length > 0) {
      contextMessage += `This is a follow-up question. Use the conversation history above to understand the context. Answer directly and build on previous information. Use your general knowledge when helpful (e.g., for questions about locations, companies, universities). Don't repeat information already mentioned unless specifically asked.`;
    } else {
      contextMessage += `Answer the user's question directly and helpfully. Use your general knowledge when helpful.`;
    }

    return contextMessage;
  }

  async scrapeProfile() {
    try {
      // Brief wait to ensure dynamic content is loaded
      await new Promise(resolve => setTimeout(resolve, 500));
      
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

      // Store profile without auto-generating summary
      // Summary will only be generated when user explicitly requests it
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
    const results = await chrome.storage.local.get(['chats']);
    const chats = results.chats || {};
    
    if (chats[profileHash] && chats[profileHash].messages.length > 0) {
      // Display existing chat messages
      const chat = chats[profileHash];
      chat.messages.forEach(msg => {
        this.addMessage(msg.role, msg.content);
      });
    }
    // AI summaries are no longer shown automatically - users must request them
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

  showFeedbackPopup() {
    const modal = document.createElement('div');
    modal.className = 'feedback-modal';
    modal.innerHTML = `
      <div class="feedback-modal-content">
        <div class="feedback-modal-header">
          <h3 class="feedback-modal-title">Tell us more</h3>
          <button class="feedback-modal-close" id="feedback-close-btn">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 11.41L17.41 16L22 20.59L20.59 22L16 17.41L11.41 22L10 20.59L14.59 16L10 11.41L11.41 10L16 14.59L20.59 10L22 11.41Z" fill="white" fill-opacity="0.65"/>
            </svg>
          </button>
        </div>
        <div class="feedback-modal-intro">
          <p class="feedback-modal-intro-text">Your feedback helps us improve.</p>
          <p class="feedback-modal-intro-subtext">Tell us why you don't find this helpful</p>
        </div>
        <div class="feedback-modal-options">
          <div class="feedback-option" data-value="inaccuracies">
            <div class="feedback-radio"></div>
            <span class="feedback-option-text">Contains inaccuracies</span>
          </div>
          <div class="feedback-option" data-value="wrong-focus">
            <div class="feedback-radio"></div>
            <span class="feedback-option-text">Focuses on the wrong things</span>
          </div>
          <div class="feedback-option" data-value="generic">
            <div class="feedback-radio"></div>
            <span class="feedback-option-text">Feels generic or robotic</span>
          </div>
          <div class="feedback-option" data-value="too-long">
            <div class="feedback-radio"></div>
            <span class="feedback-option-text">Too long and exhaustive</span>
          </div>
          <div class="feedback-option" data-value="offensive">
            <div class="feedback-radio"></div>
            <span class="feedback-option-text">Uses offensive, biased, or harmful language</span>
          </div>
          <div class="feedback-option" data-value="none">
            <div class="feedback-radio"></div>
            <span class="feedback-option-text">None of these</span>
          </div>
        </div>
        <div class="feedback-modal-actions">
          <button class="feedback-modal-cancel" id="feedback-cancel-btn">Cancel</button>
          <button class="feedback-modal-submit" id="feedback-submit-btn">Submit</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let selectedOption = null;

    // Handle option selection
    const options = modal.querySelectorAll('.feedback-option');
    options.forEach(option => {
      option.addEventListener('click', () => {
        // Remove previous selection
        options.forEach(opt => opt.querySelector('.feedback-radio').classList.remove('selected'));
        
        // Add selection to clicked option
        option.querySelector('.feedback-radio').classList.add('selected');
        selectedOption = option.dataset.value;
      });
    });

    // Handle close button
    modal.querySelector('#feedback-close-btn').addEventListener('click', () => {
      modal.remove();
    });

    // Handle cancel button
    modal.querySelector('#feedback-cancel-btn').addEventListener('click', () => {
      modal.remove();
    });

    // Handle submit button
    modal.querySelector('#feedback-submit-btn').addEventListener('click', () => {
      console.log('Feedback submitted:', selectedOption || 'No option selected');
      // Here you could send the feedback to your backend or storage
      modal.remove();
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  // Handle TTS audio data from Gemini API
  handleTTSAudio(audioData, text) {
    try {
      // Convert base64 audio data to blob
      const audioBlob = this.base64ToBlob(audioData.data, audioData.mimeType);
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Create audio element and play
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      
      audio.onended = () => {
        this.currentAudio = null;
        URL.revokeObjectURL(audioUrl);
        // Update TTS button state
        this.updateTTSButtonState(false);
      };
      
      audio.onerror = (error) => {
        console.error('TTS audio playback error:', error);
        this.currentAudio = null;
        URL.revokeObjectURL(audioUrl);
        this.updateTTSButtonState(false);
      };
      
      audio.play();
    } catch (error) {
      console.error('Error handling TTS audio:', error);
      this.updateTTSButtonState(false);
    }
  }
  
  // Handle TTS audio URL from Gemini API
  handleTTSAudioURL(audioUrl, text) {
    try {
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      
      audio.onended = () => {
        this.currentAudio = null;
        this.updateTTSButtonState(false);
      };
      
      audio.onerror = (error) => {
        console.error('TTS audio URL playback error:', error);
        this.currentAudio = null;
        this.updateTTSButtonState(false);
      };
      
      audio.play();
    } catch (error) {
      console.error('Error handling TTS audio URL:', error);
      this.updateTTSButtonState(false);
    }
  }
  
  // Convert base64 to blob
  base64ToBlob(base64Data, mimeType) {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
  
  // Update TTS button state across all messages
  updateTTSButtonState(isPlaying) {
    const allListenIcons = document.querySelectorAll('.tts-listen-icon');
    const allStopIcons = document.querySelectorAll('.tts-stop-icon');
    
    allListenIcons.forEach(icon => {
      icon.style.display = isPlaying ? 'none' : 'flex';
    });
    
    allStopIcons.forEach(icon => {
      icon.style.display = isPlaying ? 'flex' : 'none';
    });
  }
  
  // Native browser TTS implementation
  startBrowserTTS(plainText, toggleTTSState) {
    if (!window.speechSynthesis) {
      console.error('TTS not supported');
      toggleTTSState(false);
      return;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(plainText);
    
    // Configure speech settings
    utterance.rate = 0.9; // Slightly slower for better comprehension
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Try to use a more natural voice if available
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      // Prefer English voices, especially female voices for better clarity
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith('en') && voice.name.includes('Female')
      ) || voices.find(voice => 
        voice.lang.startsWith('en') && voice.name.includes('Google')
      ) || voices.find(voice => 
        voice.lang.startsWith('en')
      ) || voices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
    }
    
    // Store utterance reference for potential cancellation
    this.currentUtterance = utterance;
    
    utterance.onstart = () => {
      console.log('TTS started');
      toggleTTSState(true);
    };
    
    utterance.onend = () => {
      console.log('TTS ended');
      this.currentUtterance = null;
      toggleTTSState(false);
    };
    
    utterance.onerror = (error) => {
      console.error('Browser TTS error:', error);
      this.currentUtterance = null;
      toggleTTSState(false);
    };
    
    // Start speaking
    window.speechSynthesis.speak(utterance);
  }

  observeProfileChanges() {
    let lastUrl = window.location.href;
    let checkCount = 0;
    
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.href;
      
      // Profile/Company navigation detected
      if (currentUrl !== lastUrl && (currentUrl.includes('/in/') || currentUrl.includes('/company/'))) {
        lastUrl = currentUrl;
        console.log('LinkedIn AI: Profile/Company navigation detected:', currentUrl);
        
        // Remove old premium section if it exists
        const oldSection = document.getElementById('linkedin-ai-premium-section');
        if (oldSection) {
          oldSection.remove();
        }
        
        // Wait a bit for LinkedIn to render the new profile, then inject button and section
        setTimeout(() => {
          this.injectAIButton();
          this.injectAIPremiumSection();
        }, 1000);
        
        // If chat is open, switch context
        if (this.chatOpen) {
          this.scrapeProfile().then(profile => {
            this.currentProfile = profile;
            const notification = document.createElement('div');
            notification.className = 'profile-switch-notification';
            const pageType = currentUrl.includes('/company/') ? 'company' : 'profile';
            notification.textContent = `Switched to ${profile.name}'s ${pageType}`;
            const chatEl = document.getElementById('linkedin-ai-chat');
            if (chatEl) {
              chatEl.appendChild(notification);
              setTimeout(() => notification.remove(), 3000);
            }
          });
        }
      }
      
      // Re-inject button and section if they disappear (LinkedIn removes them)
      // Only check every 10 mutations to reduce overhead
      checkCount++;
      if (checkCount % 10 === 0 && (window.location.href.includes('/in/') || window.location.href.includes('/company/'))) {
        const button = document.getElementById('linkedin-ai-button');
        if (!button || !button.isConnected) {
          console.log('LinkedIn AI: Button was removed by LinkedIn, re-injecting...');
          setTimeout(() => this.injectAIButton(), 500);
        }
        
        const section = document.getElementById('linkedin-ai-premium-section');
        if (window.location.href.match(/linkedin\.com\/in\/[^/]+\/?$/) && (!section || !section.isConnected)) {
          console.log('LinkedIn AI: Premium section was removed by LinkedIn, re-injecting...');
          setTimeout(() => this.injectAIPremiumSection(), 500);
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
  },
  injectPremiumSection: () => {
    const ai = new LinkedInAI();
    ai.injectAIPremiumSection();
  },
  findInsertionPoint: () => {
    const ai = new LinkedInAI();
    const point = ai.findPremiumSectionInsertionPoint();
    if (point) {
      console.log('Found insertion point:', point);
      point.style.border = '2px solid blue';
      return point;
    } else {
      console.log('No insertion point found');
    }
  },
  getProfileName: () => {
    const ai = new LinkedInAI();
    const name = ai.extractProfileName();
    console.log('Profile name:', name);
    return name;
  }
};

