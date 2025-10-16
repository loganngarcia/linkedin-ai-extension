# LinkedIn AI Premium Extension

An AI-powered chat assistant for LinkedIn profiles using Google's Gemini 2.5 Flash Lite Preview model.

## Features

- 🤖 **AI Chat Interface** - Ask questions about LinkedIn profiles with intelligent context
- 📊 **Profile Analysis** - Automatically scrapes and analyzes profile data
- 💬 **Streaming Responses** - Real-time AI responses with typing indicators
- ✨ **Markdown Support** - Rich formatting: **bold**, *italic*, headers, code blocks, lists, tables
- 💾 **Chat History** - Persistent conversation history per profile with auto-load
- 🎨 **Polished UI** - Left-aligned chat (8px from edge), smooth hover effects, modern design
- 🔒 **Privacy First** - All conversations and API keys stored locally
- ♿ **Accessible** - Full keyboard navigation and ARIA labels

## Installation

1. Download the ZIP [https://github.com/loganngarcia/linkedin-ai-extension/archive/refs/heads/main.zip]
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension is now installed!

## Usage

1. Navigate to any LinkedIn profile (`linkedin.com/in/username`)
2. Look for the **AI button** next to Message/Follow buttons (blue outline with star icon)
3. Click the AI button to open the chat (opens on left side of screen)
4. On first use, click the three-dots menu (⋯) in the chat header to enter your Gemini API key
5. Start chatting! The AI will analyze the profile and respond in real-time
6. Your conversation is auto-saved and will load when you return to the profile

**UI Tips:**
- Hover over AI button → Light blue effect with 4% white fill
- Click to toggle chat open/closed
- Chat appears on left side, 8px from edge, touching bottom of screen
- Welcome section auto-hides after first message

## Quick Actions

- **Quick facts** - Get a summary of the person's background
- **Draft messages** - Generate connection request messages

## Settings

Access API key settings by clicking the **three-dots menu (⋯)** in the chat header:

- **Enter/Update Gemini API Key** - Securely stored in Chrome sync storage
- **Get API Key** - Direct link to Google AI Studio

**Note:** Settings have been simplified - just API key configuration needed. No user profile setup required!

## Privacy

- All chat history is stored locally in your browser
- API key is stored securely in Chrome's sync storage
- No data is sent to external servers except Google's Gemini API
- Conversations are automatically deleted after 90 days of inactivity

## Technical Details

- **Manifest Version:** V3
- **AI Model:** Gemini 2.5 Flash Lite Preview
- **Storage:** Chrome Storage API (sync + local)
- **Permissions:** `storage`, `activeTab`, `scripting`

## Features in Detail

### Profile Scraping
Extracts:
- Name, headline, location
- About section
- Work experience (recent 5)
- Education (recent 3)
- Skills (top 10)
- Connection degree

### Chat Interface
- Real-time streaming responses with markdown rendering
- Full markdown support: **bold**, *italic*, headers (# ## ###), code blocks (```), lists, tables
- Message timestamps (e.g., "9:21 AM")
- Date separators (e.g., "JUN 11")
- Collapsible window (click collapse icon in header)
- Profile context switching (chat auto-switches when you navigate to a new profile)
- Left-side positioning (8px from left edge, touching bottom of screen)
- Welcome section hides after first message
- Smooth hover effects on AI button (4% white fill + #A5D4FE color change)

### Error Handling
- API key validation
- Rate limiting protection
- Network error recovery
- LinkedIn UI change resilience

## Development

```bash
# File structure
linkedin-ai-extension/
├── manifest.json
├── background/
│   └── service-worker.js
├── content/
│   ├── content-script.js
│   ├── content-styles.css
│   └── scraper.js
├── options/
│   ├── settings.html
│   ├── settings.js
│   └── settings-styles.css
├── utils/
│   ├── storage-manager.js
│   └── date-formatter.js
└── assets/
    └── icons/
```

## Credits

- Built with Google Gemini 2.5 Flash Lite Preview
- UI inspired by LinkedIn's design system
- Icons from system fonts

## License

MIT License - Feel free to use and modify as needed

## Support

For issues or questions, please open an issue on GitHub.

---

**Note:** This extension requires a Gemini API key to function. Get yours for free at [aistudio.google.com](https://aistudio.google.com/app/apikey)

