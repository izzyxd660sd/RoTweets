(() => {
  'use strict';

  // Keep every RoTweet node and every style inside an extension-owned Shadow DOM.
  // This avoids leaking CSS into Roblox or modifying Roblox's React app container.
  const HOST_ID = 'rotweet-fresh-host';
  if (!/^www\.roblox\.com$/i.test(location.hostname) || !/^\/games\/\d+/.test(location.pathname)) return;
  if (document.getElementById(HOST_ID)) return;

  const GAME_ID = location.pathname.match(/\/games\/(\d+)/)?.[1] || '';
  const GAME_PRESET = (globalThis.ROTWEET_GAMES || []).find(game => game.id === GAME_ID);
  let isLoading = false;
  let lastLoadedAt = 0;
  let host;
  let shadow;
  let panel;

  const css = `
    :host{all:initial;color-scheme:dark;font:13px/1.45 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#f4f6fa}
    *{box-sizing:border-box}
    .panel{width:100%;max-height:calc(100vh - 118px);display:flex;flex-direction:column;background:#111318;color:#f4f6fa;border:1px solid #303641;border-radius:14px;box-shadow:0 14px 44px #0009;overflow:hidden;pointer-events:auto}
    .head{display:flex;align-items:center;gap:9px;padding:11px 12px;background:#191c23;border-bottom:1px solid #2d3038;flex-shrink:0}
    .logo{display:grid;place-items:center;width:32px;height:32px;flex-shrink:0;border-radius:9px;background:#20364a;color:#9bd6ff;font-size:19px;font-weight:800}
    .heading{min-width:0;flex:1}.title{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sub{font-size:11px;color:#a4adbb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    button{font:inherit;cursor:pointer;border:1px solid #3b414d;background:#252a33;color:#f5f6f8;border-radius:8px;padding:6px 8px}button:hover{background:#343b47}button:focus-visible,a:focus-visible{outline:2px solid #83c8ff;outline-offset:2px}
    .actions{display:flex;gap:5px;flex-shrink:0}.body{overflow:auto;padding:10px;min-height:90px;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#414957 #111318}
    .status{padding:15px 8px;color:#b8bdc8;text-align:center;overflow-wrap:anywhere}.status strong{display:block;color:#fff;margin-bottom:6px;font-size:13px}
    .post{padding:11px;margin-bottom:8px;border:1px solid #2e333d;border-radius:11px;background:#181b21}.post:last-child{margin-bottom:0}.post-top{display:flex;align-items:center;gap:6px;color:#9ca5b3;font-size:11px;margin-bottom:7px}.post-top b{color:#e7edf5}.post-text{white-space:pre-wrap;overflow-wrap:anywhere;color:#e9ebef}.post-link{display:inline-block;margin-top:9px;color:#83c8ff;text-decoration:none;font-weight:700}.post-link:hover{text-decoration:underline}
    .foot{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 12px;border-top:1px solid #2d3038;color:#8f96a4;font-size:10px;flex-shrink:0}.profile{color:#83c8ff;text-decoration:none;font-size:11px;white-space:nowrap}.error-detail{font-size:10px;color:#8f96a4;padding:0 7px 8px;overflow-wrap:anywhere}
    .panel.collapsed .body,.panel.collapsed .foot{display:none}.panel.collapsed .head{border-bottom:0}.panel.collapsed{width:100%}
    @media(max-width:900px){.panel{max-height:calc(100vh - 100px)}}
    @media(max-width:700px){.panel{max-height:calc(100vh - 92px)}.title{max-width:190px}}
    @media(prefers-reduced-motion:no-preference){.panel{animation:rt-enter .16s ease-out}@keyframes rt-enter{from{opacity:.7;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}}
  `;

  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function ensurePanel() {
    if (panel) return panel;
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-rotweet-ui', 'true');
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483000;right:14px;top:96px;width:320px;max-width:calc(100vw - 28px);pointer-events:none;';
    shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style'); style.textContent = css;
    panel = node('section', 'panel'); panel.setAttribute('aria-label', 'RoTweet Fresh X feed');

    const head = node('div', 'head');
    head.append(node('div', 'logo', '𝕏'));
    const heading = node('div', 'heading');
    heading.append(node('div', 'title', GAME_PRESET ? `RoTweet Fresh · ${GAME_PRESET.name}` : 'RoTweet Fresh'), node('div', 'sub', 'Game community feed'));
    const actions = node('div', 'actions');
    const refresh = node('button', '', '↻'); refresh.title = 'Refresh posts'; refresh.setAttribute('aria-label', 'Refresh posts'); refresh.addEventListener('click', () => loadFeed(true));
    const minimize = node('button', '', '−'); minimize.title = 'Minimize feed'; minimize.setAttribute('aria-label', 'Minimize feed');
    minimize.addEventListener('click', () => {
      const collapsed = panel.classList.toggle('collapsed');
      minimize.textContent = collapsed ? '+' : '−';
      minimize.title = collapsed ? 'Expand feed' : 'Minimize feed';
      minimize.setAttribute('aria-label', minimize.title);
      host.style.width = collapsed ? '48px' : (window.innerWidth <= 700 ? 'min(320px, calc(100vw - 16px))' : '320px');
    });
    const settings = node('button', '', '⚙'); settings.title = 'Settings'; settings.setAttribute('aria-label', 'Settings'); settings.addEventListener('click', () => sendMessage({ type: 'ROTWEET_OPEN_OPTIONS' }).catch(() => {}));
    actions.append(refresh, minimize, settings); head.append(heading, actions);
    const body = node('div', 'body');
    const foot = node('div', 'foot'); foot.append(node('span', 'source', 'Public feed fallback enabled'));
    const profile = node('a', 'profile', 'Open X profile ↗'); profile.href = 'https://x.com'; profile.target = '_blank'; profile.rel = 'noopener noreferrer';
    foot.append(profile); panel.append(head, body, foot); shadow.append(style, panel);

    const mount = () => {
      if (!host.isConnected && document.body) document.body.appendChild(host);
    };
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount, { once: true });
    return panel;
  }

  function setStatus(title, detail) {
    const currentPanel = ensurePanel(), body = currentPanel.querySelector('.body'); body.replaceChildren();
    const status = node('div', 'status'); status.append(node('strong', '', title));
    if (detail) status.append(node('div', '', detail)); body.append(status);
  }

  function setFallback(username, message) {
    const currentPanel = ensurePanel();
    const profile = currentPanel.querySelector('.profile');
    profile.href = `https://x.com/${encodeURIComponent(username || '')}`;
    setStatus('Posts aren’t available right now', message || 'Open the profile to view posts directly on X.');
    const body = currentPanel.querySelector('.body');
    const link = node('a', 'post-link', `Open @${username} on X ↗`);
    link.href = profile.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.style.cssText = 'display:block;text-align:center;margin:0 0 15px'; body.append(link);
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderFeed(result) {
    const currentPanel = ensurePanel(), body = currentPanel.querySelector('.body');
    body.replaceChildren(); currentPanel.querySelector('.title').textContent = `RoTweet Fresh · ${GAME_PRESET?.name || 'Roblox game'}`;
    currentPanel.querySelector('.sub').textContent = `@${result.username} · ${GAME_PRESET?.role || 'Custom account'}`;
    currentPanel.querySelector('.profile').href = `https://x.com/${encodeURIComponent(result.username)}`;
    if (!Array.isArray(result.posts) || !result.posts.length) { setFallback(result.username, 'The feed returned no readable posts. You can still open the account directly.'); return; }
    for (const post of result.posts) {
      const card = node('article', 'post'), top = node('div', 'post-top');
      top.append(node('b', '', `@${result.username}`)); const date = formatDate(post.date); if (date) top.append(node('span', '', `· ${date}`));
      const text = node('div', 'post-text', post.text || 'Post text unavailable.');
      const link = node('a', 'post-link', 'View post on X ↗');
      link.href = /^https:\/\/(x\.com|twitter\.com)\//i.test(post.link || '') ? post.link : `https://x.com/${encodeURIComponent(result.username)}`;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(top, text, link); body.append(card);
    }
    currentPanel.querySelector('.source').textContent = `Feed: ${new URL(result.source).hostname}`;
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(response);
      });
    });
  }

  async function loadFeed(force = false) {
    if (isLoading || (!force && Date.now() - lastLoadedAt < 30000)) return;
    isLoading = true; ensurePanel(); setStatus('Checking public feeds…', `Loading ${GAME_PRESET?.name || 'this game'} posts. This may take a few seconds.`);
    let username = '';
    try {
      const settings = await chrome.storage.sync.get(['rotweetGameAccounts', 'rotweetDefaultUsername']);
      const accounts = settings.rotweetGameAccounts || {};
      username = accounts[GAME_ID] || GAME_PRESET?.username || settings.rotweetDefaultUsername || '';
      username = String(username).trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '');
      if (!username) {
        setStatus('No preset account for this game yet', `Open ⚙ Settings to add an X account for Roblox game ID ${GAME_ID || 'unknown'}.`);
        ensurePanel().querySelector('.profile').href = 'https://x.com';
        return;
      }
      ensurePanel().querySelector('.profile').href = `https://x.com/${encodeURIComponent(username)}`;
      ensurePanel().querySelector('.title').textContent = `RoTweet Fresh · ${GAME_PRESET?.name || 'Roblox game'}`;
      ensurePanel().querySelector('.sub').textContent = `@${username} · ${GAME_PRESET?.role || 'Custom account'}`;
      const response = await sendMessage({ type: 'ROTWEET_GET_FEED', username });
      lastLoadedAt = Date.now();
      if (response?.ok) renderFeed(response);
      else {
        setFallback(username, response?.error || 'The public feed providers did not return posts.');
        if (response?.details?.length) ensurePanel().querySelector('.body').append(node('div', 'error-detail', response.details.join(' • ')));
      }
    } catch (error) {
      lastLoadedAt = Date.now();
      if (username) setFallback(username, 'RoTweet hit a connection error. Open the X profile directly or refresh in a moment.');
      else setStatus('RoTweet couldn’t load settings', error.message || 'Reload the Roblox tab and try again.');
    } finally { isLoading = false; }
  }

  ensurePanel();
  loadFeed(true);
  // Low-frequency refresh only; no page-wide observers or DOM polling.
  window.setInterval(() => { if (host?.isConnected && !panel?.classList.contains('collapsed')) loadFeed(true); }, 5 * 60 * 1000);
})();
