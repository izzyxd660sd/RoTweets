const mappingsEl = document.getElementById("mappings");
const defaultInput = document.getElementById("defaultUser");
const statusEl = document.getElementById("status");
const presets = Array.isArray(window.ROTWEET_GAMES) ? window.ROTWEET_GAMES : [];
function normalizeUser(value) { return String(value || "").trim().replace(/^@+/, "").replace(/[^a-zA-Z0-9_]/g, ""); }
function addRow({id = "", username = "", name = "Custom game", role = "Custom account", builtin = false} = {}) {
  const row = document.createElement("div"); row.className = "mapping-row"; row.dataset.builtin = builtin ? "true" : "false";
  const game = document.createElement("div"); game.className = "game-name"; game.textContent = name;
  const gameId = document.createElement("input"); gameId.placeholder = "Roblox game ID"; gameId.inputMode = "numeric"; gameId.value = id; gameId.setAttribute("aria-label", `${name} Roblox game ID`);
  const user = document.createElement("input"); user.placeholder = "X username"; user.value = username; user.setAttribute("aria-label", `${name} X username`);
  const remove = document.createElement("button"); remove.className = "remove-row"; remove.textContent = "×"; remove.title = `Remove ${name}`; remove.setAttribute("aria-label", `Remove ${name}`); remove.addEventListener("click", () => row.remove());
  row.append(game, gameId, user, remove); mappingsEl.append(row);
}
async function load() {
  const data = await chrome.storage.sync.get(["rotweetGameAccounts", "rotweetDefaultUsername"]);
  defaultInput.value = data.rotweetDefaultUsername || "";
  const saved = data.rotweetGameAccounts || {};
  const presetIds = new Set(presets.map(game => game.id));
  presets.forEach(game => addRow({id: game.id, username: Object.prototype.hasOwnProperty.call(saved, game.id) ? saved[game.id] : game.username, name: game.name, role: game.role, builtin: true}));
  Object.entries(saved).filter(([id]) => !presetIds.has(id)).forEach(([id, username]) => addRow({id, username, name: "Custom game"}));
}
document.getElementById("addRow").addEventListener("click", () => addRow());
document.getElementById("resetPresets").addEventListener("click", () => {
  mappingsEl.replaceChildren();
  presets.forEach(game => addRow({id: game.id, username: game.username, name: game.name, role: game.role, builtin: true}));
  statusEl.textContent = "Built-in handles restored. Click Save settings to apply.";
});
document.getElementById("save").addEventListener("click", async () => {
  const mappings = {};
  for (const row of mappingsEl.querySelectorAll(".mapping-row")) {
    const inputs = row.querySelectorAll("input"); const id = inputs[0].value.trim(); const username = normalizeUser(inputs[1].value);
    if (!id && !username) continue;
    if (!/^\d+$/.test(id)) { statusEl.textContent = "Each mapping needs a numeric Roblox game ID."; return; }
    if (!username) { statusEl.textContent = `Enter an X username for game ${id}, or remove that row.`; return; }
    mappings[id] = username;
  }
  await chrome.storage.sync.set({rotweetGameAccounts:mappings, rotweetDefaultUsername:normalizeUser(defaultInput.value)});
  statusEl.textContent = "Saved! Reload your Roblox game tab to apply changes.";
});
load().catch(error => statusEl.textContent = "Could not load settings: " + error.message);
