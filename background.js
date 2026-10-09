const PROFILE_API = "https://x.pcstyle.dev";
const RSS_HOSTS = ["https://rsshub.app", "https://rsshub.rssforever.com", "https://rsshub.pseudoyu.com"];
function cleanUsername(value) { return String(value || "").trim().replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, ""); }
function decodeXml(value) {
  return String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function getTag(block, tag) {
  const safeTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("<(?:[\\w.-]+:)?" + safeTag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?" + safeTag + "\\s*>", "i");
  const match = block.match(re);
  return match ? decodeXml(match[1]) : "";
}
function parseRss(xml, username) {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return items.slice(0, 15).map((item, index) => {
    const title = getTag(item, "title"), description = getTag(item, "description");
    const link = getTag(item, "link"), guid = getTag(item, "guid"), date = getTag(item, "pubDate");
    const text = description || title;
    const candidate = /^https:\/\/(x\.com|twitter\.com)\//i.test(link) ? link : guid;
    const safeLink = /^https:\/\/(x\.com|twitter\.com)\//i.test(candidate) ? candidate : `https://x.com/${username}`;
    return { id: safeLink || `${username}-${index}`, text: text || "Open this post on X", link: safeLink, date, username };
  }).filter(post => post.text);
}
function normalizeApiPosts(payload, username) {
  const candidates = Array.isArray(payload) ? payload :
    (Array.isArray(payload?.posts) ? payload.posts :
    (Array.isArray(payload?.profile?.posts) ? payload.profile.posts :
    (Array.isArray(payload?.data?.posts) ? payload.data.posts : [])));
  return candidates.slice(0, 15).map((post, index) => {
    const text = post?.text || post?.full_text || post?.content || post?.markdown || post?.renderedContent || post?.title || "";
    const rawUrl = post?.url || post?.link || post?.permalink || post?.tweetUrl || post?.statusUrl || "";
    const id = post?.id || post?.id_str || post?.rest_id || `${username}-${index}`;
    const link = /^https:\/\/(x\.com|twitter\.com)\//i.test(rawUrl) ? rawUrl : `https://x.com/${username}/status/${encodeURIComponent(id)}`;
    const date = post?.createdAt || post?.created_at || post?.date || post?.published || "";
    return { id: String(id), text: String(text).trim(), link, date, username };
  }).filter(post => post.text && post.text !== "[object Object]");
}
async function fetchWithTimeout(url, ms = 10000, accept = "application/json, application/rss+xml, application/xml, text/xml, */*") {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { signal: controller.signal, cache: "no-store", headers: { Accept: accept } }); }
  finally { clearTimeout(timer); }
}
async function getFeed(rawUsername) {
  const username = cleanUsername(rawUsername);
  if (!username) return { ok: false, username: "", error: "Add an X username in RoTweet settings." };
  const errors = [];
  // Primary: unofficial public profile reader, not an official X API.
  try {
    const response = await fetchWithTimeout(`${PROFILE_API}/${encodeURIComponent(username)}?format=json`);
    if (!response.ok) errors.push(`x.pcstyle.dev: HTTP ${response.status}`);
    else {
      const payload = await response.json(); const posts = normalizeApiPosts(payload, username);
      if (posts.length) return { ok: true, username, posts, source: PROFILE_API, profileUrl: `https://x.com/${username}` };
      errors.push("x.pcstyle.dev: response contained no recognized posts");
    }
  } catch (error) { errors.push(`x.pcstyle.dev: ${error?.name === "AbortError" ? "timed out" : (error?.message || "network error")}`); }
  // Secondary: RSS mirrors.
  for (const host of RSS_HOSTS) {
    try {
      const response = await fetchWithTimeout(`${host}/twitter/user/${encodeURIComponent(username)}`, 8500, "application/rss+xml, application/xml, text/xml, */*");
      if (!response.ok) { errors.push(`${new URL(host).hostname}: HTTP ${response.status}`); continue; }
      const xml = await response.text();
      if (!/<rss\b|<feed\b/i.test(xml)) { errors.push(`${new URL(host).hostname}: not an RSS feed`); continue; }
      const posts = parseRss(xml, username);
      if (posts.length) return { ok: true, username, posts, source: host, profileUrl: `https://x.com/${username}` };
      errors.push(`${new URL(host).hostname}: feed had no readable items`);
    } catch (error) { errors.push(`${new URL(host).hostname}: ${error?.name === "AbortError" ? "timed out" : (error?.message || "network error")}`); }
  }
  return { ok: false, username, error: "Posts could not be retrieved from public feed sources. You can still open the account directly on X.", profileUrl: `https://x.com/${username}`, details: errors };
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ROTWEET_GET_FEED") {
    getFeed(message.username).then(sendResponse).catch(error => sendResponse({ ok: false, username: cleanUsername(message.username), profileUrl: `https://x.com/${cleanUsername(message.username)}`, error: error?.message || "Unexpected feed error." }));
    return true;
  }
  if (message?.type === "ROTWEET_OPEN_OPTIONS") chrome.runtime.openOptionsPage();
});
