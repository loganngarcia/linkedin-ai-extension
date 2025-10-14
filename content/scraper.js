// LinkedIn Profile Scraper
// Captures full DOM of LinkedIn profile pages

class LinkedInScraper {
  static async scrapeProfile() {
    const profile = {
      name: '',
      url: window.location.href,
      scrapedAt: new Date().toISOString(),
      dom: ''
    };

    try {
      // Wait for profile to load
      await this.waitForElement('h1');

      // Extract just the name for display purposes
      profile.name = this.extractName();

      // Capture the full profile DOM
      profile.dom = this.captureProfileDOM();

    } catch (error) {
      console.error('Error scraping LinkedIn profile:', error);
    }

    return profile;
  }

  static captureProfileDOM() {
    // Get main profile container
    const mainContent = document.querySelector('main.scaffold-layout__main') || 
                       document.querySelector('main') || 
                       document.querySelector('.scaffold-layout__detail');
    
    if (!mainContent) {
      console.warn('Could not find main profile container');
      return document.body.innerHTML;
    }

    // Clone and clean the DOM
    const clone = mainContent.cloneNode(true);
    
    // Remove scripts, styles, and unnecessary elements
    clone.querySelectorAll('script, style, link, noscript').forEach(el => el.remove());
    
    // Remove hidden elements to reduce size
    clone.querySelectorAll('[style*="display: none"], [style*="display:none"]').forEach(el => el.remove());
    
    // Get the cleaned HTML
    return clone.innerHTML;
  }

  static extractName() {
    const selectors = [
      'h1.text-heading-xlarge',
      'h1.inline.t-24.v-align-middle.break-words',
      'h1.top-card-layout__title',
      '.pv-top-card--list li:first-child'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return '';
  }


  static waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LinkedInScraper;
}

