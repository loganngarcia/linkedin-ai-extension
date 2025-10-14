// LinkedIn Profile Scraper
// Extracts profile information from LinkedIn pages

class LinkedInScraper {
  static async scrapeProfile() {
    const profile = {
      name: '',
      headline: '',
      location: '',
      about: '',
      experience: [],
      education: [],
      skills: [],
      connectionDegree: '',
      url: window.location.href,
      scrapedAt: new Date().toISOString()
    };

    try {
      // Wait for profile to load
      await this.waitForElement('h1');

      // Extract name
      profile.name = this.extractName();

      // Extract headline
      profile.headline = this.extractHeadline();

      // Extract location
      profile.location = this.extractLocation();

      // Extract about section
      profile.about = this.extractAbout();

      // Extract connection degree
      profile.connectionDegree = this.extractConnectionDegree();

      // Extract experience (optional, might be behind "Show more")
      profile.experience = this.extractExperience();

      // Extract education (optional)
      profile.education = this.extractEducation();

      // Extract skills (optional)
      profile.skills = this.extractSkills();

    } catch (error) {
      console.error('Error scraping LinkedIn profile:', error);
    }

    return profile;
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

  static extractHeadline() {
    const selectors = [
      '.text-body-medium.break-words',
      '.top-card-layout__headline',
      '.pv-top-card--list.pv-top-card--list-bullet li:first-child'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && !element.closest('h1')) {
        return element.textContent.trim();
      }
    }

    return '';
  }

  static extractLocation() {
    const selectors = [
      '.text-body-small.inline.t-black--light.break-words',
      '.top-card__subline-item',
      '.pv-top-card--list-bullet .t-black--light'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent.trim();
        // Check if it looks like a location (contains comma or common location words)
        if (text.includes(',') || text.includes('Area') || text.includes('United')) {
          return text;
        }
      }
    }

    return '';
  }

  static extractAbout() {
    const selectors = [
      '.display-flex.ph5.pv3 > div > span[aria-hidden="true"]',
      '.pv-about__summary-text',
      '.pv-about-section .pv-about__summary-text',
      '[data-section="about"] .display-flex span[aria-hidden="true"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return '';
  }

  static extractConnectionDegree() {
    const selectors = [
      '.dist-value',
      '.member-distance-badge',
      '[data-control-name="connection_degree"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return '';
  }

  static extractExperience() {
    const experiences = [];
    
    const experienceSection = document.querySelector('[data-section="experience"], .experience-section, #experience-section');
    if (!experienceSection) return experiences;

    const experienceItems = experienceSection.querySelectorAll('li.pvs-list__paged-list-item, .pv-position-entity');
    
    experienceItems.forEach((item, index) => {
      if (index >= 5) return; // Limit to 5 most recent

      const titleEl = item.querySelector('[data-field="experience_company_logo"] + * span[aria-hidden="true"], .pv-entity__summary-info h3');
      const companyEl = item.querySelector('.t-14.t-normal span[aria-hidden="true"], .pv-entity__secondary-title');
      const durationEl = item.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"], .pv-entity__date-range');

      if (titleEl) {
        experiences.push({
          title: titleEl.textContent.trim(),
          company: companyEl ? companyEl.textContent.trim() : '',
          duration: durationEl ? durationEl.textContent.trim() : ''
        });
      }
    });

    return experiences;
  }

  static extractEducation() {
    const education = [];
    
    const educationSection = document.querySelector('[data-section="education"], .education-section, #education-section');
    if (!educationSection) return education;

    const educationItems = educationSection.querySelectorAll('li.pvs-list__paged-list-item, .pv-education-entity');
    
    educationItems.forEach((item, index) => {
      if (index >= 3) return; // Limit to 3 most recent

      const schoolEl = item.querySelector('[data-field="education_school_logo"] + * span[aria-hidden="true"], .pv-entity__school-name');
      const degreeEl = item.querySelector('.t-14.t-normal span[aria-hidden="true"], .pv-entity__degree-name');

      if (schoolEl) {
        education.push({
          school: schoolEl.textContent.trim(),
          degree: degreeEl ? degreeEl.textContent.trim() : ''
        });
      }
    });

    return education;
  }

  static extractSkills() {
    const skills = [];
    
    const skillsSection = document.querySelector('[data-section="skills"], .skills-section, #skills-section');
    if (!skillsSection) return skills;

    const skillItems = skillsSection.querySelectorAll('li.pvs-list__paged-list-item span[aria-hidden="true"], .pv-skill-category-entity__name');
    
    skillItems.forEach((item, index) => {
      if (index >= 10) return; // Limit to 10 skills

      const skillText = item.textContent.trim();
      if (skillText && !skills.includes(skillText)) {
        skills.push(skillText);
      }
    });

    return skills;
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

  static formatProfileForAI(profile) {
    let formatted = `Name: ${profile.name}\n`;
    
    if (profile.headline) {
      formatted += `Headline: ${profile.headline}\n`;
    }
    
    if (profile.location) {
      formatted += `Location: ${profile.location}\n`;
    }
    
    if (profile.connectionDegree) {
      formatted += `Connection: ${profile.connectionDegree}\n`;
    }
    
    if (profile.about) {
      formatted += `\nAbout:\n${profile.about}\n`;
    }
    
    if (profile.experience && profile.experience.length > 0) {
      formatted += `\nExperience:\n`;
      profile.experience.forEach(exp => {
        formatted += `- ${exp.title}${exp.company ? ` at ${exp.company}` : ''}${exp.duration ? ` (${exp.duration})` : ''}\n`;
      });
    }
    
    if (profile.education && profile.education.length > 0) {
      formatted += `\nEducation:\n`;
      profile.education.forEach(edu => {
        formatted += `- ${edu.school}${edu.degree ? ` - ${edu.degree}` : ''}\n`;
      });
    }
    
    if (profile.skills && profile.skills.length > 0) {
      formatted += `\nSkills: ${profile.skills.join(', ')}\n`;
    }
    
    return formatted;
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LinkedInScraper;
}

