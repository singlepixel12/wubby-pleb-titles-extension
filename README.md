# Wubby Pleb Titles

Chrome extension that replaces generic video titles on **archive.wubby.tv** with community-submitted "pleb titles" from the Wubby Parasocial Workbench database.

## Supported Sites

| Site | Status |
|------|--------|
| [archive.wubby.tv](https://archive.wubby.tv) | Supported |
| [parasoci.al](https://parasoci.al) | Not yet supported |

## Features

- **Automatic Title Replacement** - Video titles are replaced with pleb titles as you browse
- **Platform Badges** - Color-coded borders indicate platform (purple = Twitch, green = Kick)
- **Info Button** - Click the (i) button to expand and view the AI-generated summary
- **Hide Untitled Toggle** - Filter out videos that don't have pleb titles yet
- **Download Filename Override** - Downloaded files use the pleb title as filename
- **SPA Navigation** - Works seamlessly as you navigate between pages
- **Smart Caching** - 24-hour cache to minimize API calls

## Installation

### Chrome (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `wubby-pleb-titles-extension` folder
6. Visit [archive.wubby.tv](https://archive.wubby.tv) to see it in action

### Firefox

Not yet supported.

## How It Works

1. Extension detects video links on the page
2. Each video URL is hashed using SHA-256 (matching the main database)
3. Hash is looked up against the Supabase database
4. If a pleb title exists, it replaces the original title
5. MutationObserver watches for dynamically loaded content

## Screenshots

*Coming soon*

## Development

### File Structure
```
wubby-pleb-titles-extension/
├── manifest.json          # Chrome MV3 manifest
├── src/
│   ├── background.js      # Service worker (API calls + caching)
│   ├── content.js         # DOM manipulation + UI
│   ├── lib/
│   │   ├── api.js         # Supabase REST client
│   │   ├── config.js      # API configuration
│   │   └── hash.js        # SHA-256 utility
│   └── popup/
│       ├── popup.html     # Extension popup
│       └── popup.js       # Popup logic
└── README.md
```

### Testing Locally

1. Load extension in developer mode
2. Visit [archive.wubby.tv](https://archive.wubby.tv)
3. Open DevTools (F12) → Console
4. Look for `[WubbyExt]` log messages

### Icons

Add PNG icons to an `icons/` folder if you want a custom toolbar icon:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

## Troubleshooting

**No titles being replaced?**
- Check the console for `[WubbyExt]` logs
- Not all videos have pleb titles yet - use the toggle to hide untitled ones
- Make sure you're on archive.wubby.tv (parasoci.al not supported yet)

**Extension not loading?**
- Ensure Developer mode is enabled in `chrome://extensions/`
- Check for errors on the extension card
- Try removing and re-loading the extension

## Roadmap

- [ ] parasoci.al support
- [ ] VTT subtitle injection
- [ ] Firefox support
- [ ] Chrome Web Store release

## Related

- [Wubby Parasocial Workbench](https://parasoci.al) - Main web app for browsing and searching VODs

## License

MIT
