// Settings Page JavaScript

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('api-key');
  const toggleVisibilityBtn = document.getElementById('toggle-visibility');
  const saveKeyBtn = document.getElementById('save-key');
  const testKeyBtn = document.getElementById('test-key');
  const exportHistoryBtn = document.getElementById('export-history');
  const clearHistoryBtn = document.getElementById('clear-history');
  const statusMessage = document.getElementById('status-message');
  
  // User profile elements
  const linkedinUrlInput = document.getElementById('linkedin-url');
  const saveProfileUrlBtn = document.getElementById('save-profile-url');
  const captureNowBtn = document.getElementById('capture-now');
  const profileStatus = document.getElementById('profile-status');
  const profilePreview = document.getElementById('profile-preview');

  // Load existing API key and profile data
  const { gemini_api_key, user_profile, user_profile_url } = await chrome.storage.sync.get(['gemini_api_key', 'user_profile', 'user_profile_url']);
  if (gemini_api_key) {
    apiKeyInput.value = gemini_api_key;
  }
  if (user_profile_url) {
    linkedinUrlInput.value = user_profile_url;
  }
  if (user_profile) {
    displayProfilePreview(user_profile);
  }

  // Toggle API key visibility
  let isVisible = false;
  toggleVisibilityBtn.addEventListener('click', () => {
    isVisible = !isVisible;
    apiKeyInput.type = isVisible ? 'text' : 'password';
    toggleVisibilityBtn.innerHTML = isVisible ? 
      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" fill="currentColor"/>
      </svg>` :
      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
      </svg>`;
  });

  // Save API key
  saveKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ 
        gemini_api_key: apiKey,
        api_key_set: true 
      });
      showStatus('API key saved successfully!', 'success');
    } catch (error) {
      showStatus('Failed to save API key: ' + error.message, 'error');
    }
  });

  // Test API key
  testKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    showStatus('Testing connection...', 'success');
    
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: 'Hello, this is a test message.'
              }]
            }]
          })
        }
      );

      if (response.ok) {
        showStatus('✓ Connection successful! API key is valid.', 'success');
      } else {
        const error = await response.json();
        showStatus('✗ Connection failed: ' + (error.error?.message || 'Invalid API key'), 'error');
      }
    } catch (error) {
      showStatus('✗ Connection failed: ' + error.message, 'error');
    }
  });

  // Export history
  exportHistoryBtn.addEventListener('click', async () => {
    try {
      const { chats } = await chrome.storage.local.get(['chats']);
      const dataStr = JSON.stringify(chats || {}, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `linkedin-ai-history-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      showStatus('Chat history exported successfully!', 'success');
    } catch (error) {
      showStatus('Failed to export history: ' + error.message, 'error');
    }
  });

  // Clear history
  clearHistoryBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear all chat history? This action cannot be undone.')) {
      return;
    }

    try {
      await chrome.storage.local.set({ chats: {} });
      showStatus('All chat history cleared', 'success');
    } catch (error) {
      showStatus('Failed to clear history: ' + error.message, 'error');
    }
  });

  // Save profile URL
  saveProfileUrlBtn.addEventListener('click', async () => {
    const profileUrl = linkedinUrlInput.value.trim();
    
    if (!profileUrl) {
      showProfileStatus('Please enter your LinkedIn profile URL', 'error');
      return;
    }

    if (!profileUrl.includes('linkedin.com/in/')) {
      showProfileStatus('Please enter a valid LinkedIn profile URL', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ user_profile_url: profileUrl });
      showProfileStatus('Profile URL saved! Navigate to your LinkedIn profile and click "Capture Profile Now"', 'success');
    } catch (error) {
      showProfileStatus('Failed to save profile URL: ' + error.message, 'error');
    }
  });

  // Capture profile now
  captureNowBtn.addEventListener('click', async () => {
    const profileUrl = linkedinUrlInput.value.trim();
    
    if (!profileUrl) {
      showProfileStatus('Please save your profile URL first', 'error');
      return;
    }

    showProfileStatus('Opening your LinkedIn profile... Please scroll down to load all sections!', 'success');
    
    // Open the profile in a new tab
    const tab = await chrome.tabs.create({ url: profileUrl });
    
    // Show countdown messages
    setTimeout(() => {
      showProfileStatus('Capturing in 5 seconds... Keep scrolling!', 'success');
    }, 2000);
    
    setTimeout(() => {
      showProfileStatus('Capturing in 3 seconds...', 'success');
    }, 4000);
    
    // Wait 7 seconds for page to load and user to scroll
    setTimeout(async () => {
      try {
        showProfileStatus('Capturing your profile data...', 'success');
        
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: scrapeUserProfile
        });

        if (result && result.result) {
          const profile = result.result;
          await chrome.storage.sync.set({ user_profile: profile });
          displayProfilePreview(profile);
          showProfileStatus('✓ Profile captured successfully!', 'success');
          
          // Close the tab after 2 seconds
          setTimeout(() => {
            chrome.tabs.remove(tab.id);
          }, 2000);
        } else {
          showProfileStatus('Failed to capture profile data', 'error');
        }
      } catch (error) {
        showProfileStatus('Error capturing profile: ' + error.message, 'error');
      }
    }, 7000); // Wait 7 seconds for page to load and scrolling
  });

  function displayProfilePreview(profile) {
    if (!profile) return;
    
    const previewPhoto = document.getElementById('preview-photo');
    const previewName = document.getElementById('preview-name');
    const previewHeadline = document.getElementById('preview-headline');
    
    if (profile.photoUrl) {
      previewPhoto.src = profile.photoUrl;
      previewPhoto.style.display = 'block';
    } else {
      previewPhoto.style.display = 'none';
    }
    
    previewName.textContent = profile.name || 'Name not available';
    previewHeadline.textContent = profile.headline || 'Headline not available';
    
    profilePreview.style.display = 'block';
  }

  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';

    if (type === 'success') {
      setTimeout(() => {
        statusMessage.style.display = 'none';
      }, 5000);
    }
  }

  function showProfileStatus(message, type) {
    profileStatus.textContent = message;
    profileStatus.className = `status-message ${type}`;
    profileStatus.style.display = 'block';

    if (type === 'success') {
      setTimeout(() => {
        profileStatus.style.display = 'none';
      }, 5000);
    }
  }
});

// Function to scrape user's own profile (injected into LinkedIn page)
function scrapeUserProfile() {
  const profile = {
    name: '',
    headline: '',
    photoUrl: '',
    location: '',
    about: '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    capturedAt: new Date().toISOString()
  };

  // Name
  const nameEl = document.querySelector('h1.text-heading-xlarge, h1.inline');
  if (nameEl) profile.name = nameEl.textContent.trim();

  // Headline
  const headlineEl = document.querySelector('.text-body-medium.break-words, .top-card-layout__headline');
  if (headlineEl) profile.headline = headlineEl.textContent.trim();

  // Profile photo
  const photoEl = document.querySelector('img.pv-top-card-profile-picture__image, button.pv-top-card-profile-picture img');
  if (photoEl) profile.photoUrl = photoEl.src;

  // Location
  const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words, .top-card__subline-item');
  if (locationEl) profile.location = locationEl.textContent.trim();

  // About section
  const aboutEl = document.querySelector('.display-flex.ph5.pv3 > div > span[aria-hidden="true"]');
  if (aboutEl) profile.about = aboutEl.textContent.trim();

  // Experience - capture job titles and companies
  const experienceItems = document.querySelectorAll('#experience ~ .pvs-list__outer-container li.artdeco-list__item, [id^="profilePagedListComponent-"] li.artdeco-list__item');
  experienceItems.forEach((item, index) => {
    if (index >= 10) return; // Limit to 10 most recent
    const titleEl = item.querySelector('.mr1.t-bold span[aria-hidden="true"]');
    const companyEl = item.querySelector('.t-14.t-normal span[aria-hidden="true"]');
    const dateEl = item.querySelector('.t-14.t-normal.t-black--light span[aria-hidden="true"]');
    
    if (titleEl) {
      profile.experience.push({
        title: titleEl.textContent.trim(),
        company: companyEl ? companyEl.textContent.trim() : '',
        duration: dateEl ? dateEl.textContent.trim() : ''
      });
    }
  });

  // Education
  const educationItems = document.querySelectorAll('#education ~ .pvs-list__outer-container li.artdeco-list__item');
  educationItems.forEach((item, index) => {
    if (index >= 5) return; // Limit to 5
    const schoolEl = item.querySelector('.mr1.t-bold span[aria-hidden="true"]');
    const degreeEl = item.querySelector('.t-14.t-normal span[aria-hidden="true"]');
    
    if (schoolEl) {
      profile.education.push({
        school: schoolEl.textContent.trim(),
        degree: degreeEl ? degreeEl.textContent.trim() : ''
      });
    }
  });

  // Skills - get top skills
  const skillItems = document.querySelectorAll('#skills ~ .pvs-list__outer-container li.artdeco-list__item span[aria-hidden="true"]');
  skillItems.forEach((item, index) => {
    if (index >= 15) return; // Limit to 15 skills
    const skillText = item.textContent.trim();
    if (skillText && !profile.skills.includes(skillText)) {
      profile.skills.push(skillText);
    }
  });

  // Certifications
  const certItems = document.querySelectorAll('#licenses_and_certifications ~ .pvs-list__outer-container li.artdeco-list__item span.mr1.t-bold span[aria-hidden="true"]');
  certItems.forEach((item, index) => {
    if (index >= 10) return; // Limit to 10
    const certText = item.textContent.trim();
    if (certText) {
      profile.certifications.push(certText);
    }
  });

  // Languages
  const langItems = document.querySelectorAll('#languages ~ .pvs-list__outer-container li.artdeco-list__item span.mr1.t-bold span[aria-hidden="true"]');
  langItems.forEach((item, index) => {
    if (index >= 5) return; // Limit to 5
    const langText = item.textContent.trim();
    if (langText) {
      profile.languages.push(langText);
    }
  });

  return profile;
}

