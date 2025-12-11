# Wubby Pleb Titles - Chrome Extension

A Chrome extension that automatically replaces video titles on parasoci.al and archive.wubby.tv with community "pleb titles" from the Wubby Parasocial Workbench database.

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `wubby-pleb-titles-extension` folder
5. The extension should now appear in your toolbar

## How It Works

1. When you visit parasoci.al/vods or archive.wubby.tv
2. The extension scans for video URLs on the page
3. Each URL is hashed using SHA-256 (same as the main site)
4. The hash is used to lookup the "pleb title" from Supabase
5. If found, the video title is replaced with the pleb title
6. A colored border indicates the platform (purple = Twitch, green = Kick)

## Features

- **Automatic**: Works on page load, no clicking needed
- **Dynamic content**: Uses MutationObserver to catch lazily-loaded videos
- **Caching**: Avoids redundant API calls (24-hour TTL)
- **Batch API**: Fetches multiple titles in one request

## Supported Sites

- [parasoci.al/vods](https://parasoci.al/vods)
- [archive.wubby.tv](https://archive.wubby.tv)

## Development

### File Structure
```
wubby-pleb-titles-extension/
├── manifest.json          # Chrome extension manifest (MV3)
├── src/
│   ├── background.js      # Service worker (API calls)
│   ├── content.js         # DOM manipulation
│   ├── lib/
│   │   ├── api.js         # Supabase REST client
│   │   ├── config.js      # API configuration
│   │   └── hash.js        # SHA-256 hash utility
│   └── popup/
│       ├── popup.html     # Extension popup
│       └── popup.js       # Popup logic
├── icons/                 # Extension icons (add PNG files)
└── README.md
```

### Icons Needed

Add PNG icons to the `icons/` folder:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

### Testing

1. Load extension in developer mode
2. Visit parasoci.al/vods or archive.wubby.tv
3. Open DevTools (F12) → Console
4. Look for `[WubbyExt]` log messages
5. Click extension icon to see popup stats

## Troubleshooting

**No titles replaced:**
- Check console for `[WubbyExt]` logs
- Verify the site is supported (parasoci.al or archive.wubby.tv)
- The video might not have a pleb title in the database

**Extension not loading:**
- Ensure Developer mode is enabled
- Check for errors in `chrome://extensions/`
- Try removing and re-loading the extension

## Related Projects

- [Wubby Parasocial Workbench](https://github.com/yourusername/wubbyParasocialWorkbench) - Main web app

## License

MIT
