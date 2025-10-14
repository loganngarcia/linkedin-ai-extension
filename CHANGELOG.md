# Changelog

All notable changes to the LinkedIn AI Premium Extension.

## [1.0.0] - 2025-10-13

### ✨ Added
- **Markdown Support** - Full markdown rendering for AI responses
  - Headers (h1-h6 with # ## ### etc.)
  - Bold (`**text**` or `__text__`)
  - Italic (`*text*` or `_text_`)
  - Code blocks (` ```code``` `) and inline code (`` `code` ``)
  - Lists (ordered and unordered)
  - Links, blockquotes, horizontal rules
  - Tables with proper dark theme styling
- **Custom Markdown Parser** - No external dependencies, lightweight implementation
- **Hover Effects** - AI button shows 4% white fill with #A5D4FE color on hover
- **Active State** - AI button shows 8% white fill on click
- **Smart Button Detection** - Improved algorithm to find profile action buttons, skips sticky headers

### 🎨 UI/UX Improvements
- **Left-Side Chat** - Repositioned chat to left side of screen (8px from left edge)
- **Bottom Alignment** - Chat touches bottom of screen with no gap
- **Rounded Top Corners** - Border radius only on top (8px 8px 0 0)
- **Scrollable Welcome** - Welcome section now scrolls with messages instead of being fixed
- **Auto-Hide Welcome** - Welcome section automatically hides after first message sent
- **Markdown Styling** - Beautiful dark theme styles for all markdown elements

### 🔧 Simplified
- **Removed User Profile Capture** - No longer asks users to load their own profile
  - Simplified onboarding flow
  - Removed profile URL input from settings
  - Removed profile capture logic from content script
- **Streamlined Settings** - API key dropdown now only contains:
  - API key input field
  - Save button
  - Get API Key link
- **Cleaner Code** - Removed ~150 lines of unnecessary code

### 🐛 Bug Fixes
- **Duplicate Button Issue** - Fixed bug where multiple AI buttons would appear
  - Added `isConnected` check to prevent re-injection
  - Improved button cleanup in `observeProfileChanges`
- **Button Visibility** - Enhanced z-index and positioning to ensure button stays visible
- **LinkedIn UI Changes** - More robust selectors to handle LinkedIn's dynamic class names

### 🔄 Changed
- `addMessage()` function is now synchronous (removed `async/await`)
- `prepareContext()` simplified - no longer includes user profile data
- Welcome section behavior - scrolls and hides instead of staying fixed
- Chat auto-scrolls to bottom on new messages
- API key dropdown header changed from "Settings" to "API Key Settings"

### 📝 Documentation
- Updated README.md with all new features
- Added "Recent Updates" section to README
- Updated PROJECT_SUMMARY.md with latest improvements
- Added inline code comments documenting key features
- Created CHANGELOG.md for version tracking

### 🗑️ Removed
- User profile capture functionality (`checkAndCaptureUserProfile()`)
- User LinkedIn URL input field
- "Load My Profile" button
- User profile storage logic
- Profile picture fetching for user messages
- Settings section dividers and labels for user profile

---

## Future Enhancements (Planned)

### Potential Features
- [ ] Code syntax highlighting (highlight.js integration)
- [ ] Quick action button functionality ("Quick facts", "Draft messages")
- [ ] Export chat history to markdown/PDF
- [ ] Keyboard shortcuts (ESC to close, CMD+K to open)
- [ ] Profile comparison feature
- [ ] Custom AI prompts/templates
- [ ] Dark/light theme toggle
- [ ] Multi-language support

### Technical Debt
- [ ] Add unit tests for markdown parser
- [ ] Add E2E tests with Puppeteer
- [ ] Performance optimization for large chat histories (virtual scrolling)
- [ ] Better error messages with retry UI
- [ ] Rate limiting indicator in UI

---

**Version Format:** [MAJOR.MINOR.PATCH]
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)

