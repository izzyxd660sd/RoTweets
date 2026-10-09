RoTweet Fresh 1.1.1
===================

INSTALL / UPDATE IN CHROME
1. Extract RoTweet_Fresh_1.1.1.zip to a normal folder.
2. Open chrome://extensions in Google Chrome.
3. Enable Developer mode.
4. If RoTweet Fresh is installed from an older folder, choose Load unpacked for this new folder (or replace the old folder contents and click Reload).
5. Refresh the Roblox game page.

UI SAFETY FIX
- All RoTweet markup and CSS now live in an extension-owned Shadow DOM.
- The panel is mounted as its own child of document.body, not directly under <html>.
- RoTweet styles are encapsulated and do not modify Roblox page-wide styles or React containers.
- The panel can be minimized to reduce overlap with Roblox controls.
- The extension does not alter the experience's availability state or Roblox API responses.

AUTOMATIC GAME ACCOUNTS
- Detects the Roblox game ID in /games/<ID>.
- games.js contains 31 popular game presets, including Car Dealership Tycoon -> @Foxzie_RBLX.
- Settings lets users edit handles or add custom game IDs.
- Saved mappings override built-in presets; the default handle is only a fallback.
- Handles are suggested game/developer accounts, not a guarantee of verification or official ownership.

DESIGN / PRIVACY
- Chrome Manifest V3, no remotely hosted JavaScript.
- Uses chrome.storage.sync for user settings.
- Requests public posts from an unofficial profile reader and RSS mirrors, then renders plain-text cards locally.
- These third-party services receive network requests for the selected public username and may process request metadata such as IP address. See PRIVACY_POLICY.md.
- Does not inject platform.twitter.com/widgets.js into Roblox.

LIMITATIONS
X does not offer a dependable unauthenticated public timeline API. Public providers can be offline, rate-limited, blocked, or changed without notice. The extension cannot guarantee posts will always be retrievable. The fallback opens the profile directly on X.

TROUBLESHOOTING
- After saving settings, reload the Roblox game tab.
- If posts are unavailable, use Refresh or open the X profile link.
- If Roblox still says “This experience is currently not available,” test with RoTweet disabled at chrome://extensions and reload the page. Roblox documents that browser extensions can cause site problems, but the message can also come from Roblox or the experience itself. If it persists with RoTweet disabled, it is not caused by this sidebar UI.
- Check chrome://extensions for any extension errors.
