# Icon Files

This extension requires icon files in PNG format at the following sizes:
- icon16.png (16x16)
- icon48.png (48x48)
- icon128.png (128x128)

## Icon Design

The icon features:
- White/light gray circle background (95% opacity)
- Gold 4-pointed star in center (#D07A00)
- Clean, minimal design matching the extension's AI theme

## Quick Setup

### Option 1: Use the SVG to generate PNGs

Use the `ai-icon.svg` file in the assets folder to generate PNG icons at each size:

```
assets/ai-icon.svg → 64x64 base design
```

### Option 2: Online Conversion (Recommended)

1. Go to [CloudConvert](https://cloudconvert.com/svg-to-png)
2. Upload `assets/ai-icon.svg`
3. Convert to PNG at these sizes:
   - **16x16** → Save as `icon16.png`
   - **48x48** → Save as `icon48.png`
   - **128x128** → Save as `icon128.png`
4. Place all three files in this directory (`assets/icons/`)
5. Reload extension in Chrome

### Option 3: Use Figma/Design Tool

1. Create frames at 16x16, 48x48, and 128x128
2. Add:
   - White circle (fill: white 95% opacity)
   - Gold 4-pointed star in center (fill: #D07A00)
3. Export as PNG at 1x resolution
4. Name files: `icon16.png`, `icon48.png`, `icon128.png`

### Option 4: Skip Icons (Quick Start)

The extension works without custom icons! Chrome will show a default puzzle piece icon. You can add proper icons later.

## SVG Code

The current `ai-icon.svg` (64x64) contains:

```svg
<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- White circle background -->
  <rect width="64" height="64" rx="32" fill="white" fill-opacity="0.95"/>
  
  <!-- Gold sparkle/star icon (centered) -->
  <g transform="translate(16, 16)">
    <path d="..." fill="#D07A00"/>
  </g>
</svg>
```

## Design Specifications

- **Background:** White circle, radius 32, 95% opacity
- **Icon:** Gold 4-pointed star (#D07A00)
- **Size:** 64x64 base (scale for 16, 48, 128)
- **Style:** Minimal, recognizable AI sparkle symbol
- **Contrast:** Good visibility on light/dark backgrounds

## Troubleshooting

**Icons not showing after adding files?**
- Reload extension in `chrome://extensions/`
- Make sure file names are exact: `icon16.png`, `icon48.png`, `icon128.png`
- Check files are in the correct directory: `assets/icons/`

**Icons look blurry?**
- Make sure you're exporting at 1x (not 2x or 3x)
- Use PNG format, not JPG
- Maintain aspect ratio when resizing

The icons should match the extension's visual identity with the gold AI star on white circle background.
