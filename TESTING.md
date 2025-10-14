# Testing Guide

Comprehensive testing checklist for LinkedIn AI Premium extension.

## Pre-Flight Check

Before testing, ensure:
- [ ] Chrome browser installed (latest version)
- [ ] Gemini API key obtained from https://aistudio.google.com
- [ ] Extension loaded in `chrome://extensions/`
- [ ] Developer mode enabled
- [ ] No console errors on extension load

## 1. Installation Testing

### Load Extension
```
Steps:
1. Open chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select linkedin-ai-extension folder

Expected:
✓ Extension appears in list
✓ No errors in console
✓ Extension icon appears in toolbar
```

### Verify Permissions
```
Check chrome://extensions/ details:
✓ storage
✓ activeTab
✓ scripting
✓ Host permissions for linkedin.com
```

## 2. Settings Page Testing

### Access Settings
```
Steps:
1. Click extension icon in toolbar
   OR
2. chrome://extensions/ → Details → Extension options

Expected:
✓ Settings page opens
✓ Clean UI with dark theme
✓ All sections visible
```

### API Key Management
```
Test Cases:

1. Save API Key
   - Enter: Valid Gemini API key
   - Click: "Save API Key"
   Expected: ✓ Success message appears

2. Toggle Visibility
   - Click: Eye icon
   Expected: ✓ Key toggles between hidden/visible

3. Test Connection
   - Click: "Test Connection"
   Expected: ✓ "Connection successful" message

4. Invalid Key
   - Enter: "invalid_key_123"
   - Click: "Test Connection"
   Expected: ✓ Error message displayed
```

### Chat History
```
Test Cases:

1. Export History
   - Have some chat history
   - Click: "Export History"
   Expected: ✓ JSON file downloads

2. Clear History
   - Click: "Clear All History"
   - Confirm: Dialog
   Expected: ✓ Success message
           ✓ All chats cleared
```

## 3. LinkedIn Profile Testing

### AI Button Injection
```
Test Profiles:
- Public profile
- 1st connection
- 2nd connection
- Private profile

Steps:
1. Navigate to linkedin.com/in/[username]
2. Wait for page load (2-3 seconds)

Expected:
✓ "AI" button appears next to profile actions
✓ Button has blue color (#71B7FB)
✓ Star icon visible
✓ Button is clickable
✓ Hover effect works
✓ Focus outline on tab navigation
```

### Button Interactions
```
Test Cases:

1. Click Button (No API Key)
   Expected: ✓ API key modal appears

2. Click Button (With API Key)
   Expected: ✓ Chat interface opens
           ✓ Welcome message displayed

3. Hover Button
   Expected: ✓ Background color changes
           ✓ Subtle lift animation

4. Keyboard Navigation
   - Tab to button
   - Press Enter
   Expected: ✓ Chat opens
```

## 4. Chat Interface Testing

### Initial Display
```
Verify:
✓ Chat window 500px width, 700px height
✓ Dark theme (#1A2024 background)
✓ Positioned bottom-right
✓ Slide-in animation plays
✓ All UI elements visible:
  - Navbar with AI icon
  - Welcome section
  - Quick action buttons
  - Message input
  - Toolbar icons
```

### Chat Controls
```
Test Cases:

1. Close Button (X)
   - Click: X button
   Expected: ✓ Chat closes
           ✓ Slide-out animation

2. Collapse Button
   - Click: Collapse icon
   Expected: ✓ Chat height reduces to 400px
           ✓ Smooth transition
   - Click again
   Expected: ✓ Chat expands back

3. Menu Button (...)
   - Click: Three dots
   Expected: ✓ Dropdown shows
           ✓ API key input visible

4. Navbar Link
   - Click: "AI Premium" text
   Expected: ✓ Opens LinkedIn help page
```

## 5. Message Flow Testing

### Sending Messages
```
Test Cases:

1. Type and Send
   - Type: "Hello"
   - Click: Send button
   Expected: ✓ Message appears in chat
           ✓ User avatar displayed
           ✓ Timestamp shown
           ✓ Typing indicator appears
           ✓ AI response received
           ✓ Typing indicator removed

2. Send with Enter
   - Type: "Test message"
   - Press: Enter
   Expected: ✓ Message sends

3. Newline with Shift+Enter
   - Type: "Line 1"
   - Press: Shift+Enter
   - Type: "Line 2"
   Expected: ✓ Multi-line message
           ✓ Send button enabled

4. Empty Message
   - Click: Send (no text)
   Expected: ✓ Nothing happens
           ✓ Button stays disabled
```

### Quick Actions
```
Test Cases:

1. Quick Facts
   - Click: "Quick facts" button
   Expected: ✓ Input populated with action text
           ✓ Message sent automatically
           ✓ AI responds with facts

2. Draft Messages
   - Click: "Draft messages" button
   Expected: ✓ Input populated
           ✓ Message sent
           ✓ AI responds with draft
```

### AI Responses
```
Test Prompts:

1. "What's their background?"
   Expected: ✓ Contextual response about profile

2. "What companies have they worked at?"
   Expected: ✓ Lists experience from profile

3. "What education do they have?"
   Expected: ✓ Lists education info

4. Random question: "What's the weather?"
   Expected: ✓ AI responds (no profile context)
```

## 6. Profile Scraping Testing

### Data Extraction
```
Test on various profiles:

Public Profile:
✓ Name extracted
✓ Headline extracted
✓ Location extracted
✓ About section extracted
✓ Experience listed (up to 5)
✓ Education listed (up to 3)
✓ Skills listed (up to 10)

Private/Restricted Profile:
✓ Basic info extracted
✓ Graceful handling of missing data
✓ No errors in console
```

## 7. Storage Testing

### Chat Persistence
```
Test Cases:

1. Message History
   - Send several messages
   - Close chat
   - Reopen chat
   Expected: ✓ All messages visible
           ✓ Correct order
           ✓ Timestamps preserved

2. Profile Switching
   - Chat with Profile A
   - Navigate to Profile B
   - Send message
   - Navigate back to Profile A
   Expected: ✓ Profile A chat restored
           ✓ All messages intact

3. Storage Limits
   - Send 60+ messages (exceeds 50 limit)
   Expected: ✓ Only last 50 kept
           ✓ Oldest messages removed
```

## 8. Error Handling Testing

### Network Errors
```
Test Cases:

1. Offline Mode
   - Disconnect internet
   - Send message
   Expected: ✓ Error message displayed
           ✓ Retry logic attempts
           ✓ Clear error feedback

2. API Timeout
   - (Simulate slow network)
   Expected: ✓ Timeout message
           ✓ Retry offered
```

### API Errors
```
Test Cases:

1. Invalid API Key
   - Use invalid key
   - Send message
   Expected: ✓ "Invalid API key" error
           ✓ Settings link provided

2. Rate Limit
   - Send many messages rapidly
   Expected: ✓ Quota error message
           ✓ Helpful guidance

3. Server Error
   - (If API returns 500)
   Expected: ✓ Generic error message
           ✓ Retry option
```

### LinkedIn UI Changes
```
Test Cases:

1. Profile Not Loaded
   - Navigate to profile
   - Click AI button immediately
   Expected: ✓ Scraper waits for load
           ✓ OR shows retry option

2. Changed Selectors
   - (If LinkedIn updates UI)
   Expected: ✓ Fallback selectors work
           ✓ OR graceful degradation
```

## 9. Accessibility Testing

### Keyboard Navigation
```
Test:
✓ Tab to AI button
✓ Tab through all chat controls
✓ Tab into message input
✓ Tab through quick actions
✓ All interactive elements focusable
✓ Focus indicators visible
✓ Enter/Space activate buttons
```

### Screen Reader
```
Test with screen reader:
✓ AI button announces correctly
✓ Chat messages read in order
✓ Input field labeled
✓ Button labels clear
✓ ARIA live regions work
```

### Color Contrast
```
Check:
✓ Text on background: 4.5:1 minimum
✓ Button colors meet WCAG AA
✓ Links distinguishable
✓ Error states clear
```

### Reduced Motion
```
Test:
1. Enable: Prefer reduced motion (OS setting)
2. Use extension
Expected: ✓ Animations minimal/removed
```

## 10. Performance Testing

### Load Times
```
Measure:
✓ Extension load: < 100ms
✓ AI button injection: < 500ms
✓ Chat interface creation: < 200ms
✓ Message send/receive: < 3s
```

### Memory Usage
```
Check Chrome Task Manager:
✓ Extension memory: < 50MB
✓ No memory leaks after prolonged use
✓ Storage usage reasonable
```

### Responsiveness
```
Test:
✓ UI remains responsive during API calls
✓ No janky animations
✓ Smooth scrolling
✓ Input lag < 50ms
```

## 11. Cross-Browser Testing

### Chrome Variants
```
Test on:
✓ Chrome Stable (latest)
✓ Chrome Beta
✓ Edge (Chromium)
✓ Brave
```

## 12. Edge Cases

### Unusual Profiles
```
Test:
✓ Profile with no experience
✓ Profile with no education
✓ Profile in different language
✓ Profile with very long bio
✓ Brand/Company page (should not show button)
```

### Long Conversations
```
Test:
✓ 100+ message conversation
✓ Very long messages (1000+ chars)
✓ Special characters in messages
✓ Code blocks in responses
✓ URLs in responses
```

### Rapid Actions
```
Test:
✓ Rapid clicking AI button
✓ Sending messages quickly
✓ Switching profiles rapidly
✓ Opening/closing chat repeatedly
```

## Bug Report Template

```
**Extension Version:** 1.0.0
**Chrome Version:** [Your version]
**OS:** [Windows/Mac/Linux]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**


**Actual Behavior:**


**Screenshots/Console Errors:**


**Additional Context:**

```

## Success Criteria

Extension passes testing if:
- [ ] All core features work
- [ ] No critical errors
- [ ] Performance acceptable
- [ ] Accessibility requirements met
- [ ] Error handling graceful
- [ ] UI matches design spec
- [ ] Storage persistence works
- [ ] Chat history reliable

---

**Testing Complete!** 🎉

If all tests pass, the extension is ready for use!

