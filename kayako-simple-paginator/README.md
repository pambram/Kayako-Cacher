# Kayako Simple Paginator

A clean, focused Chrome extension that does **one thing well**: increases Kayako's pagination limit from 30 to 100+ posts per request.

## Philosophy

This extension follows the Unix philosophy: **Do one thing and do it well.**

- ✅ **Simple**: Clean, readable code with clear separation of concerns
- ✅ **Reliable**: No complex caching, no Ember manipulation, just straightforward XHR interception
- ✅ **Debuggable**: Built-in stats and debug commands
- ✅ **Maintainable**: Well-commented code with clear structure

## What It Does

1. **Intercepts** XHR requests to Kayako's posts and activities APIs
2. **Modifies** the `limit` parameter from 30 to your chosen value (default: 100)
3. **That's it!** No caching, no background jobs, no UI manipulation

## Why This Approach?

Other extensions try to do too much:
- Complex caching strategies that cause JSON corruption
- Background backfill jobs that conflict with Ember
- Manual UI array manipulation that fights the framework

This extension focuses on the core problem: **Kayako's API pagination is too small.**

By increasing the limit, you get:
- **3x fewer API requests** (100 posts instead of 30 per request)
- **Faster page loads** (fewer round trips)
- **Better performance** (less network overhead)

All without touching caching, Ember internals, or complex state management.

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `kayako-simple-paginator` folder

## Usage

1. Navigate to any Kayako agent page
2. The extension works automatically
3. Open the extension popup to:
   - Check status
   - Change pagination limit (50/100/200/500)
   - View statistics

## Debug Commands

Open the browser console on any Kayako page:

```javascript
// Get current stats
window.__KayakoPaginator__.stats()
// Returns: { intercepted, modified, total, config }

// Change pagination limit on the fly
window.__KayakoPaginator__.setLimit(200)

// Toggle debug logging
window.__KayakoPaginator__.toggleDebug()
```

## Files

- `manifest.json` - Extension manifest with minimal permissions
- `content.js` - Content script that injects the interceptor
- `injected.js` - The actual XHR interceptor (runs in page context)
- `popup.html/css/js` - Extension popup UI

## Future Enhancements (Maybe)

If the basic pagination works perfectly, we could add:

**Phase 2**: Simple cache-aside pattern
- Check localStorage before making request
- If cache hit, return cached data
- If cache miss, fetch and cache
- No complex simulation, just straightforward caching

**Phase 3**: Background backfill
- Fetch older posts in background
- Push to Ember's store only (no UI manipulation)
- Let Ember's reactivity handle the UI updates

But first, let's prove Phase 1 works flawlessly.

## Testing

1. Load a Kayako ticket with 30+ posts
2. Open Network tab and filter for `posts?`
3. Scroll through the timeline
4. Verify requests show `limit=100` instead of `limit=30`
5. Check console for debug logs
6. Run `window.__KayakoPaginator__.stats()` to see intercept count

## License

MIT - Do whatever you want with this code

## Author

Built with ❤️ for a better Kayako experience

