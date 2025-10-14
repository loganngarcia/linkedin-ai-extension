# Debugging Guide - AI Button Not Showing

If the AI button isn't appearing on LinkedIn profiles, follow these steps:

## Quick Fixes

### 1. Reload Extension
```
1. Go to chrome://extensions/
2. Find "LinkedIn AI Premium"
3. Click the refresh icon (↻)
4. Refresh the LinkedIn profile page
```

### 2. Check Console for Errors
```
1. Open DevTools (F12 or Cmd+Option+I)
2. Go to Console tab
3. Look for messages starting with "LinkedIn AI:"
4. Should see: "LinkedIn AI: Button injected successfully"
```

### 3. Use Debug Helper
Open the Console on a LinkedIn profile and run:

```javascript
// Find the container where button should be injected
LinkedInAI_Debug.findContainer();

// Manually inject the button
LinkedInAI_Debug.injectButton();
```

## Troubleshooting Steps

### Button Not Injecting

**Problem: No "Button injected successfully" message**

1. Check if you're on a profile page (URL contains `/in/`)
2. Run in console:
```javascript
LinkedInAI_Debug.findContainer();
```

This will:
- Show which container was found (if any)
- Highlight it with a red border
- List all selectors tried

**If no container found:**
- LinkedIn's UI structure has changed
- Need to update selectors

### Find the Right Selector

1. Inspect the Message/Connect buttons on LinkedIn
2. Find their parent container
3. Copy the selector or class name
4. Update in `content-script.js` line 44-59

### Manual Injection

If automatic injection fails, you can manually inject:

```javascript
// In console
const container = document.querySelector('YOUR_SELECTOR_HERE');
LinkedInAI_Debug.injectButton();
```

## Common Issues

### Issue: Button appears but is hidden
**Solution:** Check CSS conflicts
```javascript
// In console
const btn = document.getElementById('linkedin-ai-button');
console.log(getComputedStyle(btn).display); // Should be "inline-flex"
console.log(getComputedStyle(btn).visibility); // Should be "visible"
```

### Issue: Button appears in wrong place
**Solution:** Update injection logic
- Check `content-script.js` line 88-95
- Modify `insertBefore` logic

### Issue: "Could not find profile actions container" in console
**Solution:** LinkedIn UI changed
1. Inspect the page structure
2. Find where Message/Connect buttons are
3. Update selectors in `findProfileActionsContainer()`

## LinkedIn Selector Inspector

Run this to find all possible button containers:

```javascript
// Find all divs that contain buttons
document.querySelectorAll('div').forEach(div => {
  const buttons = div.querySelectorAll('button');
  if (buttons.length >= 2 && buttons.length <= 5) {
    console.log('Potential container:', div);
    console.log('Classes:', div.className);
    console.log('Buttons:', buttons);
    div.style.outline = '1px dashed orange';
  }
});
```

## Report Issue

If none of these work, please report:

1. LinkedIn profile URL (without personal info)
2. Console messages (screenshot)
3. Inspected HTML structure (screenshot)
4. Chrome version
5. Extension version (1.0.0)

Include output from:
```javascript
LinkedInAI_Debug.findContainer();
```

## Advanced: Update Selectors

If LinkedIn changed their UI, update selectors in `content-script.js`:

```javascript
findProfileActionsContainer() {
  const selectors = [
    '.pv-top-card-v2-ctas',        // Add your selector here
    '.pvs-profile-actions',
    '.artdeco-card__actions',
    // ... rest of selectors
  ];
  // ...
}
```

Then reload extension and test.

---

**Need Help?** Open an issue with console output and screenshots.

