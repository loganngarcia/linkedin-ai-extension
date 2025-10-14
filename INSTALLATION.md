# Installation Guide

## Quick Start

### Step 1: Generate Icon Files

The extension requires icon files. You have two options:

#### Option A: Use Online Converter (Recommended)
1. Go to https://cloudconvert.com/svg-to-png
2. Upload `assets/ai-icon.svg`
3. Convert to PNG at these sizes:
   - 16x16 → Save as `assets/icons/icon16.png`
   - 48x48 → Save as `assets/icons/icon48.png`
   - 128x128 → Save as `assets/icons/icon128.png`

#### Option B: Skip Icons (Extension will use default Chrome icon)
- Extension will work but show Chrome's default puzzle icon
- You can add icons later

### Step 2: Get Gemini API Key

1. Visit https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key (starts with `AIza...`)

### Step 3: Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `linkedin-ai-extension` folder
5. Extension is now installed! ✓

### Step 4: Configure API Key

1. Click the extension icon in Chrome toolbar
2. Or go to `chrome://extensions/` and click "Details" → "Extension options"
3. Enter your Gemini API key
4. Click "Save API Key"
5. Click "Test Connection" to verify

### Step 5: Use on LinkedIn

1. Go to any LinkedIn profile (e.g., `linkedin.com/in/someone`)
2. You'll see an "AI" button next to the profile actions
3. Click it to open the chat interface
4. Start asking questions about the profile!

## Troubleshooting

### Extension doesn't appear on LinkedIn
- Make sure you're on a profile page (`/in/username`)
- Refresh the page (Ctrl+R or Cmd+R)
- Check if extension is enabled in `chrome://extensions/`

### AI button not showing
- Wait 2-3 seconds for LinkedIn to fully load
- Check browser console for errors (F12 → Console tab)
- Try refreshing the page

### API key errors
- Verify key starts with `AIza...`
- Test connection in settings page
- Check you have API quota available
- Visit https://aistudio.google.com to check key status

### Chat not responding
- Check internet connection
- Verify API key is saved correctly
- Check Chrome console for errors
- Try clearing extension data and re-entering API key

### Profile data not loading
- Some profiles may be private or have restricted data
- Refresh the page to re-scrape
- Check LinkedIn hasn't changed their UI structure

## Permissions Explained

- **storage**: Save API key and chat history locally
- **activeTab**: Access current LinkedIn tab content
- **scripting**: Inject AI button and chat interface
- **linkedin.com**: Required to access LinkedIn profiles
- **generativelanguage.googleapis.com**: Gemini API calls

## Privacy & Security

- ✅ All chat history stored locally in your browser
- ✅ API key encrypted in Chrome sync storage
- ✅ No third-party analytics or tracking
- ✅ No data sent anywhere except Gemini API
- ✅ Open source - review the code yourself

## Advanced: Build from Source

If you want to modify the extension:

```bash
# Clone or download the repository
cd linkedin-ai-extension

# Make your changes to the code

# Reload extension in chrome://extensions/
# Click the refresh icon on the extension card
```

## Getting Help

### Common Issues

**"Invalid API key"**
- Double-check the key from AI Studio
- Make sure there's no extra spaces
- Generate a new key if needed

**"Rate limit exceeded"**
- Gemini has usage quotas
- Wait a few minutes and try again
- Check quota at https://aistudio.google.com

**Chat history not persisting**
- Make sure "storage" permission is granted
- Check Chrome sync is enabled
- Try exporting/importing history in settings

### Debug Mode

1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Look for errors prefixed with "LinkedIn AI:"
4. Check Network tab for API call failures

### Clean Reinstall

If nothing works:

1. Go to `chrome://extensions/`
2. Remove the extension
3. Close all LinkedIn tabs
4. Re-install following steps above
5. Re-enter API key

## What's Next?

- Explore quick actions: "Quick facts", "Draft messages"
- Chat persists per profile - conversations are saved
- Switch profiles - chat automatically updates context
- Export your chat history from settings

## Updates

To update the extension:

1. Download the latest version
2. In `chrome://extensions/`, remove old version
3. Load the new unpacked extension
4. Your settings and chat history should migrate automatically

---

**Enjoy using LinkedIn AI Premium!** 🚀

For bugs or feature requests, please open an issue on GitHub.

