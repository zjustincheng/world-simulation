import {
  W,
  H,
  WATER,
  NEUTRAL,
  colors,
  createWorld,
  stats,
  declareWar,
  peace,
  ally,
  annex,
  collapse,
  rebel,
  spawnNation,
  paint,
  related,
  log,
  validate,
  technologyName,
  TECHNOLOGY_AGES,
} from "./engine.js";
import { REAL_MAPS } from "./real-maps.js";
import { populateWorld } from "./setup.js";
import { createSound } from "./sound.js";
import { advanceToMajorEvent } from "./turns.js";
import { capitalRegion, generateNationName } from "./names.js";
import {
  readSaves,
  saveWorld,
  deleteSave,
  readRecovery,
  writeRecovery,
} from "./saves.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const canvas = $("#map"),
  ctx = canvas.getContext("2d");
const pixelCanvas = document.createElement("canvas");
pixelCanvas.width = W;
pixelCanvas.height = H;
const pixelCtx = pixelCanvas.getContext("2d");
let world = createWorld("EARTH", 0, "earth"),
  selected = null,
  layer = "political",
  tool = "inspect";
let zoom = 1,
  pan = { x: 0, y: 0 },
  cw = 0,
  ch = 0,
  drag = null,
  pointer = null,
  brush = 3,
  undoSnapshot = null;
let recoveryPending = null;
let lastTurn = null;
let pendingTurn = null;
let borderAnimation = null;
let lastPlayback = null;
let toastTimer,
  lastPaint = 0,
  showLabels = true,
  showEffects = true;
let counts = [],
  landCount = 0,
  labelPositions = [],
  borderLines = [],
  activeFronts = [];
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const compact = (n) =>
  Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3200);
}
function view() {
  const scale = Math.min((cw - 60) / W, (ch - 75) / H) * zoom;
  return {
    scale,
    x: (cw - W * scale) / 2 + pan.x + 12,
    y: (ch - H * scale) / 2 + pan.y - 8,
  };
}
function mapColor(id, height) {
  if (id === WATER) return "#20384c";
  if (id === NEUTRAL) return layer === "terrain" ? "#82936d" : "#637063";
  if (layer === "terrain")
    return height > 0.28 ? "#a9a78b" : height > 0.14 ? "#7d946e" : "#97ab7c";
  if (layer === "diplomacy" && selected !== null) {
    if (id === selected) return "#e4c36b";
    if (related(world.wars, id, selected)) return "#dc6a66";
    if (related(world.alliances, id, selected)) return "#64c697";
    return "#62798d";
  }
  return world.nations[id].color;
}
function rebuildMap() {
  counts = stats(world);
  landCount = world.owner.filter((n) => n !== WATER).length;
  const pixels = pixelCtx.createImageData(W, H),
    sums = world.nations.map(() => ({ x: 0, y: 0 }));
  const atWar = new Set(world.wars.map((p) => p.slice(0, 2).join(",")));
  borderLines = [];
  activeFronts = [];
  for (let i = 0; i < W * H; i++) {
    const id = world.owner[i],
      x = i % W,
      y = Math.floor(i / W);
    const rgb = mapColor(id, world.terrain[i])
      .match(/[a-f\d]{2}/gi)
      .map((v) => parseInt(v, 16));
    const shade =
      id >= 0 && layer === "political" && selected !== null && id !== selected
        ? 0.83
        : 1;
    for (let k = 0; k < 3; k++) pixels.data[i * 4 + k] = rgb[k] * shade;
    pixels.data[i * 4 + 3] = 255;
    if (id >= 0) {
      sums[id].x += x;
      sums[id].y += y;
    }
    for (const [j, line] of [
      [x < W - 1 ? i + 1 : -1, [x + 1, y, x + 1, y + 1]],
      [y < H - 1 ? i + W : -1, [x, y + 1, x + 1, y + 1]],
    ]) {
      if (j < 0 || world.owner[j] === id) continue;
      const other = world.owner[j];
      if (id === WATER || other === WATER) {
        borderLines.push([...line, "coast"]);
        continue;
      }
      borderLines.push([
        ...line,
        id === selected || other === selected ? "selected" : "border",
      ]);
      if (
        id >= 0 &&
        other >= 0 &&
        atWar.has([Math.min(id, other), Math.max(id, other)].join(","))
      )
        activeFronts.push(line);
    }
  }
  pixelCtx.putImageData(pixels, 0, 0);
  // Put names inside owned territory nearest the geographic center, rather than at a coastal capital.
  labelPositions = sums.map((sum, id) => ({
    x: sum.x / Math.max(1, counts[id]),
    y: sum.y / Math.max(1, counts[id]),
    cell: world.nations[id].capital,
    d: Infinity,
  }));
  world.owner.forEach((id, i) => {
    if (id < 0) return;
    const p = labelPositions[id],
      d = ((i % W) - p.x) ** 2 + (Math.floor(i / W) - p.y) ** 2;
    if (d < p.d) {
      p.d = d;
      p.cell = i;
    }
  });
}
function draw(now = performance.now()) {
  const dpr = devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#20384c";
  ctx.fillRect(0, 0, cw, ch);
  const v = view();
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.scale(v.scale, v.scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixelCanvas, 0, 0);
  ctx.lineWidth = 0.2;
  ctx.strokeStyle = "#0e253650";
  ctx.strokeRect(0, 0, W, H);
  for (const style of ["coast", "border", "selected"]) {
    ctx.strokeStyle =
      style === "coast"
        ? "#112a3b99"
        : style === "selected"
          ? "#ffffffa0"
          : "#172a365f";
    ctx.lineWidth = style === "selected" ? 0.35 : 0.17;
    ctx.beginPath();
    for (const [x, y, x2, y2, type] of borderLines)
      if (type === style) {
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
      }
    ctx.stroke();
  }
  if (lastTurn && $("#show-changes").checked) {
    ctx.lineWidth = 0.28;
    for (const change of lastTurn.changes) {
      const x = change.cell % W,
        y = Math.floor(change.cell / W);
      ctx.fillStyle = change.from === NEUTRAL ? "#8effb633" : "#ffbf6855";
      ctx.strokeStyle = change.from === NEUTRAL ? "#a8ffc3" : "#ffd18c";
      ctx.fillRect(x, y, 1, 1);
      ctx.strokeRect(x + 0.1, y + 0.1, 0.8, 0.8);
    }
  }
  const playbackYear = borderAnimation?.steps[borderAnimation.cursor - 1]?.year;
  const battleMarks = (borderAnimation?.battles || lastTurn?.battles || [])
    .filter(
      (battle) =>
        !borderAnimation ||
        (playbackYear !== undefined && battle.year <= playbackYear),
    )
    .filter((battle) => battle.key)
    .slice(0, 12);
  for (const battle of battleMarks) {
    const x = (battle.cell % W) + 0.5,
      y = Math.floor(battle.cell / W) + 0.5;
    ctx.save();
    ctx.strokeStyle = "#ffe38a";
    ctx.fillStyle = "#342b1bdc";
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    ctx.arc(x, y, battle.annihilated ? 1.15 : 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff3bf";
    ctx.font = `bold ${battle.annihilated ? 1.2 : 0.95}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(battle.annihilated ? "★" : "✦", x, y);
    ctx.restore();
  }
  if (borderAnimation) {
    const recent = borderAnimation.steps.slice(
      Math.max(0, borderAnimation.cursor - 45),
      borderAnimation.cursor,
    );
    ctx.fillStyle = "#fff3b6aa";
    for (const change of recent)
      ctx.fillRect(change.cell % W, Math.floor(change.cell / W), 1, 1);
  }
  if (showEffects) {
    ctx.strokeStyle = "#ffe2a5";
    ctx.lineWidth = 0.33;
    ctx.beginPath();
    for (const [x, y, x2, y2] of activeFronts) {
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    const elapsed = (now - lastPaint) / 700;
    if (elapsed < 1)
      for (const f of world.flashes || []) {
        ctx.globalAlpha = (1 - elapsed) * 0.7;
        ctx.strokeStyle = "#fff2ce";
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.arc(
          (f.cell % W) + 0.5,
          Math.floor(f.cell / W) + 0.5,
          0.5 + elapsed * 2.2,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    ctx.globalAlpha = 1;
  }
  const placedLabels = [];
  const labelOrder = [...world.nations].sort(
    (a, b) =>
      (b.id === selected) - (a.id === selected) || counts[b.id] - counts[a.id],
  );
  for (const n of labelOrder) {
    if (!counts[n.id]) continue;
    const x = (n.capital % W) + 0.5,
      y = Math.floor(n.capital / W) + 0.5;
    ctx.fillStyle = "#fff2c2";
    ctx.strokeStyle = "#152434";
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    ctx.arc(x, y, 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (showLabels && (counts[n.id] >= 40 || selected === n.id)) {
      const p = labelPositions[n.id],
        lx = (p.cell % W) + 0.5,
        ly = Math.floor(p.cell / W) + 0.5;
      const size = Math.max(
        9 / Math.max(0.1, v.scale),
        Math.min(2.7, Math.sqrt(counts[n.id]) * 0.095),
      );
      ctx.font = `600 ${size}px "DM Sans",sans-serif`;
      const width = ctx.measureText(n.name).width + 2,
        height = size + 1;
      const box = {
        left: lx - width / 2,
        right: lx + width / 2,
        top: ly - height / 2,
        bottom: ly + height / 2,
      };
      if (
        placedLabels.some(
          (p) =>
            box.left < p.right &&
            box.right > p.left &&
            box.top < p.bottom &&
            box.bottom > p.top,
        )
      )
        continue;
      placedLabels.push(box);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = "#152534b0";
      ctx.lineWidth = 0.55;
      ctx.lineJoin = "round";
      ctx.fillStyle = "#ffffff";
      ctx.strokeText(n.name, lx, ly);
      ctx.fillText(n.name, lx, ly);
    }
  }
  if (pointer && tool !== "inspect") {
    const i = cellAt(pointer.x, pointer.y);
    if (i >= 0) {
      ctx.strokeStyle = "#ffffffcc";
      ctx.fillStyle = "#ffffff18";
      ctx.lineWidth = 1 / v.scale;
      ctx.beginPath();
      ctx.arc(
        (i % W) + 0.5,
        Math.floor(i / W) + 0.5,
        tool === "spawn" ? Number($("#spawn-radius").value) : brush,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}
function resize() {
  const r = canvas.getBoundingClientRect();
  cw = r.width;
  ch = r.height;
  canvas.width = Math.round(cw * (devicePixelRatio || 1));
  canvas.height = Math.round(ch * (devicePixelRatio || 1));
  draw();
}
new ResizeObserver(resize).observe(canvas);
function selectNation(id) {
  selected = id;
  switchPanel("nations");
  renderDetail(true);
  refresh();
  if (tool !== "inspect") setTool(tool);
}
function switchPanel(name) {
  $$("[data-panel]").forEach((b) =>
    b.classList.toggle("active", b.dataset.panel === name),
  );
  $$(".panel").forEach((p) => (p.hidden = p.id !== `panel-${name}`));
}
$$("[data-panel]").forEach(
  (b) => (b.onclick = () => switchPanel(b.dataset.panel)),
);
function renderRanking() {
  const sort = $("#sort").value,
    alive = world.nations.filter((n) => counts[n.id]);
  alive.sort((a, b) =>
    sort === "gold"
      ? b.wealth - a.wealth
      : sort === "strength"
        ? b.efficiency - a.efficiency
        : counts[b.id] - counts[a.id],
  );
  $("#nations").innerHTML =
    alive
      .map((n, index) => {
        const war = world.wars.some((p) => p[0] === n.id || p[1] === n.id),
          share = (counts[n.id] / Math.max(1, landCount)) * 100;
        return `<button class="nation ${selected === n.id ? "active" : ""}" data-nation="${n.id}" aria-label="Inspect ${esc(n.name)}"><div class="nation-line"><span class="rank">${index + 1}</span><span class="flag" style="background:${n.color}"></span><span class="nation-name">${esc(n.name)}</span><span class="nation-share">${share.toFixed(1)}%</span></div><div class="nation-meta"><span>${compact(Math.floor(n.wealth))} gold · ${Math.round(n.efficiency)} CE</span><span class="${war ? "at-war" : ""}">${war ? "⚔ At war" : "At peace"}</span></div><div class="nation-progress"><div style="width:${share}%;background:${n.color}"></div></div></button>`;
      })
      .join("") ||
    '<p class="setting-note">No nations yet. Select Spawn and click on land to place one.</p>';
  const fallen = world.nations.filter((n) => !counts[n.id]);
  $("#fallen-count").textContent = fallen.length;
  $("#fallen-list").innerHTML = fallen
    .map(
      (n) =>
        `<div class="fallen-row"><span>${esc(n.name)}</span><span>Year ${n.dead || world.year}</span></div>`,
    )
    .join("");
  $("#list-count").textContent = alive.length;
}
function renderDetail(force = false) {
  const detail = $("#nation-detail");
  if (tool === "spawn" || selected === null || !world.nations[selected]) {
    detail.hidden = true;
    return;
  }
  detail.hidden = false;
  const n = world.nations[selected],
    alive = counts[selected] > 0;
  // Preserve focus, in-progress edits, selected rival, and disclosure state across simulation ticks.
  if (!force && detail.dataset.nation === String(selected)) {
    if (detail.contains(document.activeElement)) return;
  }
  const rival = $("#rival")?.value,
    open = $("#edit-nation")?.open;
  const enemies = world.wars
    .filter((p) => p[0] === selected || p[1] === selected)
    .map((p) => world.nations[p[0] === selected ? p[1] : p[0]].name);
  const allies = world.alliances
    .filter((p) => p.includes(selected))
    .map((p) => world.nations[p[0] === selected ? p[1] : p[0]].name);
  detail.dataset.nation = selected;
  const tech = n.tech || { age: 0, progress: 0, unlocked: [] },
    currentAge = TECHNOLOGY_AGES[tech.age] || TECHNOLOGY_AGES[0],
    nextTech = currentAge.technologies.find(
      (t) => !tech.unlocked.includes(t.id),
    );
  const techMarkup = `<div class="tech-card"><div class="tech-heading">TECHNOLOGY · ${esc(technologyName(n))}</div><div class="tech-progress"><div style="width:${Math.min(100, (tech.progress / 12) * 100)}%"></div></div><p>${tech.unlocked.length} discoveries · ${nextTech ? `Researching ${esc(nextTech.name)}` : tech.age < TECHNOLOGY_AGES.length - 1 ? "A new age of scholarship is within reach" : "All known technologies mastered"}</p><small>${currentAge.technologies.map((t) => `${tech.unlocked.includes(t.id) ? "✓" : "·"} ${esc(t.name)}`).join(" · ")}</small></div>`;
  detail.innerHTML = `<div class="detail-top">NATION INSPECTOR <button id="close-detail" aria-label="Close nation inspector">×</button></div><div class="detail-title"><span class="flag" style="background:${n.color}"></span><h2>${esc(n.name)}</h2></div><div class="detail-status">${alive ? (enemies.length ? "⚔ AT WAR · " + enemies.length + " FRONT" + (enemies.length > 1 ? "S" : "") : "● AT PEACE") : "FALLEN NATION"} · FOUNDED YEAR ${n.born}<br>CAPITAL REGION · ${esc(capitalRegion(world, n.capital).label)}</div>${techMarkup}<div class="metrics"><div><label>Territory</label><strong>${compact(counts[selected])} <small>tiles</small></strong></div><div><label>Gold <small>(${(n.income || 0) >= 0 ? "+" : ""}${n.income || 0}/yr)</small></label><strong>${compact(Math.floor(n.wealth))}</strong></div><div><label>Combat efficiency</label><strong>${Math.round(n.efficiency)}<small>%</small></strong><div class="stat-bar"><div style="width:${Math.min(100, n.efficiency / 1.5)}%"></div></div></div><div><label>Stability</label><strong>${Math.round(n.stability)}<small>%</small></strong><div class="stat-bar"><div style="width:${n.stability}%;background:${n.stability < 40 ? "#ed827e" : "#8ed8b1"}"></div></div></div></div><div class="relations"><b>Allies:</b> ${esc(allies.join(", ") || "None")}<br><b>Enemies:</b> ${esc(enemies.join(", ") || "None")}</div><div class="god-heading">GOD MODE <span>${n.kills} CONQUESTS</span></div><div class="actions"><button data-action="gold" ${!alive ? "disabled" : ""}>＋ 500 gold</button><button data-action="peace" ${!enemies.length ? "disabled" : ""}>☮ Make peace</button><button data-action="rebel" ${counts[selected] < 30 ? "disabled" : ""}>⚡ Revolt</button><button data-action="follow" ${!alive ? "disabled" : ""}>⌖ Find capital</button></div><select id="rival" class="diplomacy-select" aria-label="Target nation">${world.nations
    .filter((m) => m.id !== selected && counts[m.id])
    .map((m) => `<option value="${m.id}">${esc(m.name)}</option>`)
    .join(
      "",
    )}</select><div class="actions"><button data-action="war" class="danger-outline" ${!alive ? "disabled" : ""}>⚔ Declare war</button><button data-action="ally" ${!alive ? "disabled" : ""}>◇ Toggle alliance</button><button data-action="annex" ${!alive ? "disabled" : ""}>▣ Annex target</button><button data-action="collapse" class="danger-outline" ${!alive ? "disabled" : ""}>× Collapse</button></div><details id="edit-nation" class="edit-toggle" ${open ? "open" : ""}><summary>Edit nation</summary><div class="edit-fields"><label>Name<input type="text" id="nation-name" maxlength="35" value="${esc(n.name)}"></label><label>Color<input type="color" id="nation-color" value="${n.color}"></label><label>Combat efficiency <input id="efficiency" type="range" min="15" max="150" value="${Math.round(n.efficiency)}"></label><label>Stability <input id="stability" type="range" min="5" max="100" value="${Math.round(n.stability)}"></label><button data-action="regional-name">✧ Name from capital</button><button data-action="apply">Apply changes</button></div></details>`;
  if (rival && [...$("#rival").options].some((o) => o.value === rival))
    $("#rival").value = rival;
}
function renderWars() {
  const crises = Object.values(world.relations || {})
    .filter(
      (r) =>
        counts[r.a] &&
        counts[r.b] &&
        r.tension >= 24 &&
        r.reason &&
        !related(world.wars, r.a, r.b),
    )
    .sort((a, b) => b.tension - a.tension);
  $("#crises-list").innerHTML =
    crises
      .map(
        (r) =>
          `<article class="war-card"><small>${r.stage >= 3 ? "MOBILIZATION" : r.stage >= 2 ? "NEGOTIATIONS" : "DISPUTE"} · SINCE YEAR ${r.since}</small><h4>${esc(world.nations[r.a].name)} & ${esc(world.nations[r.b].name)}</h4><p>${esc(r.reason)}.</p><span>Tension ${Math.round(r.tension)}/100</span></article>`,
      )
      .join("") ||
    '<p class="setting-note">No active diplomatic crises. Shared borders alone do not mean war.</p>';
  $("#settlements-list").innerHTML =
    (world.warHistory || [])
      .filter((r) => r.ended !== null)
      .slice(-8)
      .reverse()
      .map(
        (r) =>
          `<article class="truce-card"><strong>${esc(world.nations[r.a].name)} / ${esc(world.nations[r.b].name)}</strong><small>YEARS ${r.started}–${r.ended}</small><p>${esc(r.reason)}.</p><p>${esc(r.outcome)}</p></article>`,
      )
      .join("") ||
    '<p class="setting-note">Settlements will record how wars ended and what changed.</p>';
  $("#wars-list").innerHTML =
    world.wars
      .map(([a, b, started]) => {
        const first = world.nations[a],
          second = world.nations[b];
        const [ga, gb] = world.warStats?.[`${a},${b}`] || [0, 0];
        const history = (world.warHistory || []).findLast(
          (r) => r.a === a && r.b === b && r.ended === null,
        );
        const share = ga + gb ? (ga / (ga + gb)) * 100 : 50;
        return `<article class="war-card"><small>WAR · ${world.year - started} YEARS</small><div class="war-sides"><button data-focus-nation="${a}" style="color:${first.color}">${esc(first.name)}</button><span>⚔</span><button data-focus-nation="${b}" style="color:${second.color}">${esc(second.name)}</button></div><p class="war-cause"><b>Cause:</b> ${esc(history?.reason || "The cause of this older conflict was not recorded.")}</p><div class="war-balance" style="background:${second.color}"><div style="background:${first.color};width:${share}%"></div></div><div class="war-gains"><span>${ga} captured</span><span>${gb} captured</span></div><button class="full" data-war-peace="${a},${b}">Negotiate peace</button></article>`;
      })
      .join("") ||
    '<p class="setting-note">The world is at peace. Wars will appear here as rival nations clash.</p>';
  $("#truces-list").innerHTML =
    (world.truces || [])
      .filter((p) => p[2] > world.year)
      .map(
        ([a, b, until]) =>
          `<article class="truce-card"><strong>${esc(world.nations[a].name)} & ${esc(world.nations[b].name)}</strong><span>${until - world.year} years remaining</span></article>`,
      )
      .join("") || '<p class="setting-note">No active truces.</p>';
}
$("#panel-wars").onclick = (e) => {
  const focus = e.target.closest("[data-focus-nation]");
  if (focus) {
    setTool("inspect");
    selectNation(Number(focus.dataset.focusNation));
  }
  const treaty = e.target.closest("[data-war-peace]");
  if (treaty) {
    const [a, b] = treaty.dataset.warPeace.split(",").map(Number);
    peace(world, a, b);
    undoSnapshot = null;
    refresh();
    toast("Peace signed. A 15-year truce protects both nations.");
  }
};
function syncSettings() {
  for (const input of $$("[data-setting]"))
    input.checked = world.settings[input.dataset.setting];
  $("#aggression").value = world.settings.aggression;
  $("#aggression-value").textContent =
    world.settings.aggression === 1
      ? "Normal"
      : `${world.settings.aggression}×`;
}
function refresh({ map = true } = {}) {
  if (map) {
    rebuildMap();
    lastPaint = performance.now();
  }
  $("#year").textContent = world.year;
  const outlook = world.climate?.seasons || [];
  $("#climate-label").textContent = outlook.length
    ? outlook
        .map((item) => `${item.season.slice(0, 3)} ${item.weather}`)
        .join(" · ")
    : "Seasonal outlook";
  $("#review-turn").disabled = !lastTurn;
  $("#nation-count").textContent = counts.filter(Boolean).length;
  $("#war-count").textContent = world.wars.length;
  $("#claimed").textContent =
    Math.round(
      (counts.reduce((a, b) => a + b, 0) / Math.max(1, landCount)) * 100,
    ) + "%";
  $("#seed-label").textContent = REAL_MAPS[world.preset]
    ? `${REAL_MAPS[world.preset].name} · ${world.seed}`
    : world.seed;
  const placed = counts.filter(Boolean).length;
  $("#spawn-count").textContent = placed
    ? `${placed} nation${placed === 1 ? "" : "s"} placed. Add more, or start when you're ready.`
    : "No nations placed yet. Click land to place your first nation.";
  $("#start-simulation").disabled = placed === 0;
  $("#undo-spawn").disabled = !undoSnapshot;
  renderRanking();
  renderDetail();
  $("#events").innerHTML = world.events
    .map(
      (e) =>
        `<article class="event ${["war", "peace", "birth", "battle", "fall"].includes(e.type) ? e.type : ""}"><small>YEAR ${e.year}</small><p>${esc(e.text)}</p></article>`,
    )
    .join("");
  renderWars();
  draw();
}
$("#sort").onchange = renderRanking;
$("#nations").onclick = (e) => {
  const el = e.target.closest("[data-nation]");
  if (el) selectNation(Number(el.dataset.nation));
};
$("#nation-detail").onclick = (e) => {
  if (e.target.closest("#close-detail")) {
    selected = null;
    $("#nation-detail").hidden = true;
    refresh();
    return;
  }
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action || selected === null) return;
  const n = world.nations[selected],
    rival = $("#rival")?.value;
  const target = rival === "" || rival === undefined ? null : Number(rival);
  if (action === "gold") {
    n.wealth = Math.min(99999, n.wealth + 500);
    toast(`500 gold donated to ${n.name}.`);
  }
  if (action === "peace") peace(world, selected);
  if (action === "rebel" && !rebel(world, selected))
    toast(
      "A revolt needs at least 30 connected tiles and room for another nation.",
    );
  if (["war", "ally", "annex"].includes(action) && target === null) {
    toast("There is no other living nation to target.");
    return;
  }
  if (action === "war" && !declareWar(world, selected, target))
    toast("These nations are already at war.");
  if (action === "ally") ally(world, selected, target);
  if (action === "annex") {
    annex(world, selected, target);
    toast(`${n.name} annexed the target nation.`);
  }
  if (action === "collapse") {
    collapse(world, selected);
    toast(`${n.name} collapsed.`);
  }
  if (action === "follow") {
    zoom = 2.5;
    const scale = Math.min((cw - 60) / W, (ch - 75) / H) * zoom;
    pan = {
      x: (W / 2 - (n.capital % W)) * scale - 12,
      y: (H / 2 - Math.floor(n.capital / W)) * scale + 8,
    };
    updateZoom();
  }
  if (action === "regional-name") {
    n.name = generateNationName(world, n.capital, { excludeId: selected });
    toast(`Renamed to ${n.name}.`);
  }
  if (action === "apply") {
    const name = $("#nation-name").value.trim();
    if (!name) {
      toast("Give the nation a name.");
      return;
    }
    n.name = name;
    n.color = $("#nation-color").value;
    n.efficiency = Number($("#efficiency").value);
    n.stability = Number($("#stability").value);
    toast("Nation updated.");
  }
  undoSnapshot = null;
  $("#undo").disabled = true;
  refresh();
  renderDetail(true);
};
const sound = createSound();
function renderSound() {
  $("#sound-toggle").textContent = sound.enabled ? "Sound on" : "Sound off";
  $("#sound-toggle").setAttribute("aria-pressed", String(sound.enabled));
}
renderSound();
$("#sound-toggle").onclick = () => {
  sound.toggle();
  renderSound();
};
$("#auto-place").onclick = () => {
  const before = structuredClone(world);
  const added = populateWorld(world, Number($("#auto-count").value));
  if (!added)
    return toast(
      "No room for more countries. Paint land or free territory first.",
    );
  undoSnapshot = before;
  $("#undo").disabled = false;
  lastTurn = null;
  refresh();
  renderTurn();
  sound.play("settle");
  toast(
    `${added} countries placed and all land claimed. Advance a turn to see their stories unfold.`,
  );
};
function nextTurn() {
  if (pendingTurn) return;
  if (document.querySelector("dialog[open]") || drag || pinch) return;
  if (!counts.some(Boolean)) {
    setTool(world.preset === "blank" ? "land" : "spawn");
    toast("Place at least one nation before advancing a turn.");
    return;
  }
  setTool("inspect");
  autoSave();
  const future = structuredClone(world);
  const report = advanceToMajorEvent(future);
  pendingTurn = {
    future,
    report,
    before: [...world.owner],
    initialBefore: [...world.owner],
    eventIndex: 0,
    staged: true,
    events: [...report.events].reverse(),
  };
  showTurnEvent();
  $("#event-dialog").showModal();
}
function renderWorldRoundup(report) {
  if (!report?.roundup) return "";
  const r = report.roundup;
  const cards = (items) =>
    items
      .map(
        (item) =>
          `<article class="roundup-item"><strong>${esc(item.title || `Year ${item.year}`)}</strong><p>${esc(item.text)}</p></article>`,
      )
      .join("");
  const climate = r.climate
    .map((item) => `${item.season}: ${item.weather}`)
    .join(" · ");
  return `<div class="world-roundup"><h3>AROUND THE WORLD</h3><details><summary>Seasonal outlook</summary><p>${esc(climate || "Seasonal conditions are not recorded.")}</p><p class="battle-legend">Weather varies by region and season. Rain, fog, storms, and winter conditions slow assaults and help defenders hold ground.</p></details><details open><summary>Wars & settlements · ${r.wars.length}</summary>${cards(r.wars) || "<p>No wars during this period.</p>"}</details><details ${r.battles.length ? "open" : ""}><summary>Decisive battles · ${r.battles.length}</summary>${cards(r.battles) || "<p>No battles crossed the decisive threshold this chapter.</p>"}<p class="battle-legend">✦ A battle must take at least 20 tiles and 25% of the defender’s yearly territory; ★ marks a state’s final stand. Markers remain on the map until the next chapter.</p></details><details><summary>Technology & scholarship · ${r.technologies.length} discoveries</summary>${cards(r.technologies) || "<p>The kingdoms remain within the medieval age.</p>"}</details><details open><summary>Alliances & unions · ${r.alliances.length} active alliances</summary>${cards(r.alliances) || "<p>No active alliances.</p>"}${r.allianceEvents.length ? `<h4>Diplomatic changes</h4>${cards(r.allianceEvents)}` : "<p>No new unions or alliance changes were recorded.</p>"}</details><details ${r.politics.length ? "open" : ""}><summary>Countries & political changes · ${r.politics.length}</summary>${cards(r.politics) || "<p>No changes to statehood.</p>"}</details><details><summary>Negotiations & peace agreements · ${r.diplomacy.length}</summary>${cards(r.diplomacy) || "<p>No diplomatic developments recorded.</p>"}</details><details><summary>Other diplomatic crises · ${r.crises.length}</summary>${cards(r.crises) || "<p>No active crises.</p>"}</details></div>`;
}
function showTurnEvent() {
  const { report, eventIndex } = pendingTurn;
  const events = pendingTurn.events;
  const event = events[eventIndex];
  $("#event-back").hidden = true;
  $("#event-skip").hidden = eventIndex >= events.length - 1;
  $("#event-progress").textContent = event
    ? `EVENT ${eventIndex + 1} OF ${events.length} · YEAR ${event.year}`
    : "A QUIET CHAPTER";
  $("#event-title").textContent = event
    ? event.text.split(". ")[0]
    : "The borders await";
  $("#event-story").textContent = event
    ? event.text.split(". ").slice(1).join(". ")
    : "No major events were recorded. Continue to see how the map changed.";
  $("#event-roundup").innerHTML = renderWorldRoundup(report);
  $("#event-note").textContent = event?.changes?.length
    ? `${event.changes.length} tiles change in this event. Watch them move before continuing.`
    : "This event has no separate territory changes. Continue when you’re ready.";
  $("#event-continue").textContent = event?.changes?.length
    ? "Watch this event →"
    : eventIndex < events.length - 1
      ? "Next event →"
      : "Continue →";
}
$("#event-dialog").addEventListener("cancel", (e) => e.preventDefault());
$("#event-continue").onclick = () => {
  if (!pendingTurn) return;
  const event = pendingTurn.events[pendingTurn.eventIndex];
  if (event?.changes?.length) {
    $("#event-dialog").close();
    startBorderAnimation();
  } else advanceEvent();
};
function advanceEvent() {
  if (++pendingTurn.eventIndex < pendingTurn.events.length) {
    showTurnEvent();
    if (!$("#event-dialog").open) $("#event-dialog").showModal();
  } else {
    $("#event-dialog").close();
    pendingTurn.staged = false;
    finishBorderAnimation();
  }
}
$("#event-skip").onclick = () => {
  $("#event-dialog").close();
  pendingTurn.remainingSteps = pendingTurn.events
    .slice(pendingTurn.eventIndex)
    .flatMap((event) =>
      event.changes.map((change) => ({ ...change, year: event.year })),
    );
  pendingTurn.staged = false;
  startBorderAnimation();
};
$("#pause-animation").onclick = () => {
  if (!borderAnimation) return;
  if (borderAnimation.pausedAt !== null) {
    borderAnimation.start += performance.now() - borderAnimation.pausedAt;
    borderAnimation.pausedAt = null;
    $("#pause-animation").textContent = "Pause";
  } else {
    borderAnimation.pausedAt = performance.now();
    $("#pause-animation").textContent = "Resume";
  }
};
function startBorderAnimation() {
  const { future, report, before } = pendingTurn;
  world = structuredClone(future);
  world.owner = [...before];
  lastTurn = null;
  undoSnapshot = null;
  $("#undo").disabled = true;
  $("main").inert = true;
  $(".topbar").inert = true;
  $("#border-playback").hidden = false;
  sound.play(report.transferred ? "conflict" : "turn");
  const event = pendingTurn.staged
    ? pendingTurn.events[pendingTurn.eventIndex]
    : null;
  const steps = event
    ? report.frames.flatMap((frame) =>
        frame.changes.map((change) => ({ ...change, year: frame.year })),
      )
    : pendingTurn.remainingSteps ||
      report.frames.flatMap((frame) =>
        frame.changes.map((change) => ({ ...change, year: frame.year })),
      );
  $("#pause-animation").textContent = "Pause";
  borderAnimation = {
    steps,
    battles: report.battles || [],
    pausedAt: null,
    cursor: 0,
    start: performance.now(),
    duration: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 300
      : Math.min(6500, Math.max(1800, steps.length * 3)),
  };
  rebuildMap();
  draw();
}
function finishBorderAnimation() {
  if (!pendingTurn) return;
  if (pendingTurn.staged) {
    for (const change of borderAnimation.steps)
      world.owner[change.cell] = change.to;
    pendingTurn.before = [...world.owner];
    borderAnimation = null;
    $("main").inert = false;
    $(".topbar").inert = false;
    $("#border-playback").hidden = true;
    rebuildMap();
    draw();
    advanceEvent();
    return;
  }
  if (!pendingTurn.replay)
    lastPlayback = {
      before: [...(pendingTurn.initialBefore || pendingTurn.before)],
      future: structuredClone(pendingTurn.future),
      report: pendingTurn.report,
    };
  world = pendingTurn.returnWorld || pendingTurn.future;
  lastTurn = pendingTurn.report;
  pendingTurn = null;
  borderAnimation = null;
  $("main").inert = false;
  $(".topbar").inert = false;
  $("#border-playback").hidden = true;
  refresh();
  renderTurn();
  switchPanel("turn");
  autoSave();
  $("#next-turn").focus();
}
$("#finish-animation").onclick = finishBorderAnimation;

$("#next-turn").onclick = nextTurn;
$("#review-turn").onclick = () => {
  renderTurn();
  switchPanel("turn");
};
$("#show-changes").onchange = () => draw();
function renderTurn() {
  if (!lastTurn) {
    $("#turn-report").innerHTML =
      '<div class="panel-heading"><h2>Your next chapter</h2><p>Place nations or adjust the world, then press Next event. History advances to the next major development. Quiet years and small battles are summarized. Nothing advances while you read or plan.</p></div><div class="turn-empty">◇<p>Events, border changes, and nation gains will appear here.</p></div>';
    return;
  }
  const movers = lastTurn.nations
    .filter((n) => n.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  $("#turn-report").innerHTML =
    `<div class="eyebrow">${lastTurn.years === 0 ? "HISTORY PAUSED" : `${lastTurn.years} ${lastTurn.years <= 1 ? "YEAR" : "YEARS"} ELAPSED`}</div><h2>${lastTurn.years <= 1 ? `Year ${lastTurn.year}` : `Years ${lastTurn.startYear + 1}–${lastTurn.year}`}</h2><p class="turn-headline">${esc(lastTurn.headline.split(". ")[0])}</p><div class="turn-totals"><div><strong>${lastTurn.claimed}</strong><span>NEWLY SETTLED</span></div><div><strong>${lastTurn.transferred}</strong><span>CHANGED HANDS</span></div><div><strong>${lastTurn.events.length}</strong><span>EVENTS</span></div></div><button id="replay-turn" class="full">↻ Replay border changes</button><h3>HISTORICAL SUMMARY</h3>${lastTurn.events.map((e) => `<article class="turn-event ${e.type === "crisis" ? "crisis" : ["war", "battle", "fall", "hardship"].includes(e.type) ? "conflict" : "peace"}"><span>YEAR ${e.year} · ${esc(e.type.toUpperCase())}</span><h4>${esc(e.text.split(". ")[0])}</h4><p>${esc(e.text.split(". ").slice(1).join(". ") || "A new chapter in the history of this world.")}</p></article>`).join("") || '<p class="setting-note">No major events in this chapter.</p>'}${renderWorldRoundup(lastTurn)}<h3>TERRITORY CHANGES</h3>${movers.map((n) => `<button class="turn-nation" data-turn-nation="${n.id}"><i class="flag" style="background:${n.color}"></i><span>${esc(n.name)}<small>${n.before} → ${n.after} tiles</small></span><b class="${n.delta > 0 ? "gain" : "loss"}">${n.delta > 0 ? "+" : ""}${n.delta}</b></button>`).join("") || '<p class="setting-note">All borders held this turn.</p>'}<p class="setting-note">Green outlines show new settlements; amber marks land that changed hands. Toggle “Changes” above the map to compare. Take your time—nothing moves until the next event.</p>`;
}
$("#turn-report").onclick = (e) => {
  if (e.target.closest("#replay-turn") && lastPlayback && !pendingTurn) {
    pendingTurn = {
      ...lastPlayback,
      replay: true,
      returnWorld: structuredClone(world),
    };
    startBorderAnimation();
    return;
  }
  const b = e.target.closest("[data-turn-nation]");
  if (b) {
    setTool("inspect");
    selectNation(Number(b.dataset.turnNation));
  }
};
function animate(now) {
  if (borderAnimation && borderAnimation.pausedAt === null) {
    const animation = borderAnimation;
    const progress = Math.min(1, (now - animation.start) / animation.duration);
    const target = Math.floor(animation.steps.length * progress);
    while (animation.cursor < target) {
      const change = animation.steps[animation.cursor++];
      world.owner[change.cell] = change.to;
    }
    const year =
      animation.steps[Math.max(0, animation.cursor - 1)]?.year ||
      pendingTurn.report.year;
    $("#border-progress").textContent = animation.steps.length
      ? `Year ${year} · ${Math.round(progress * 100)}%`
      : "No borders changed";
    rebuildMap();
    draw(now);
    if (progress === 1) finishBorderAnimation();
  }

  if (
    (showEffects && world.flashes?.length && now - lastPaint < 720) ||
    (pointer && tool !== "inspect")
  )
    draw(now);
  requestAnimationFrame(animate);
}
$("#world-war").onclick = () => {
  const alive = world.nations.filter((n) => counts[n.id]);
  if (alive.length < 2) return toast("Place at least two nations first.");
  for (let i = 0; i < alive.length; i++)
    for (let j = i + 1; j < alive.length; j++)
      declareWar(world, alive[i].id, alive[j].id);
  log(world, "World war erupts. Every nation stands alone.", "war");
  refresh();
  toast("World war declared.");
};
function setTool(value) {
  tool = value;
  canvas.classList.toggle("editing", tool !== "inspect");
  $$("[data-tool]").forEach((b) =>
    b.classList.toggle("active", b.dataset.tool === tool),
  );
  $("#brush-control").hidden = ["inspect", "spawn"].includes(tool);
  $("#spawn-setup").hidden = tool !== "spawn";
  $("#spawn-nation").classList.toggle("primary", tool === "spawn");
  if (tool === "spawn") switchPanel("nations");
  const messages = {
    inspect: "Select a nation to inspect it. Drag to pan · Scroll to zoom",
    spawn:
      "Click land to spawn nations · Right-drag to pan · Press Next event when ready",
    territory:
      selected === null
        ? "Select a nation from the ranking, then paint its territory."
        : `Paint territory for ${world.nations[selected].name}. Escape to inspect.`,
    land: "Drag to paint land. Nations act when you press Next event.",
    water: "Drag to paint sea. Owned territory under the brush is removed.",
    erase: "Drag to remove ownership and leave unclaimed land.",
  };
  $("#tool-hint").textContent = messages[tool];
  renderDetail(true);
  draw();
}
$("#spawn-nation").onclick = () => setTool("spawn");
$("#spawn-radius").onchange = () => draw();
$("#start-simulation").onclick = () => {
  if (!counts.some(Boolean))
    return toast("Place at least one nation on land first.");
  setTool("inspect");
  renderTurn();
  switchPanel("turn");
};
$$("[data-tool]").forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
$("#brush").oninput = (e) => {
  brush = Number(e.target.value);
  $("#brush-size").textContent = brush;
};
function cellAt(x, y) {
  const v = view(),
    cx = Math.floor((x - v.x) / v.scale),
    cy = Math.floor((y - v.y) / v.scale);
  return cx >= 0 && cx < W && cy >= 0 && cy < H ? cy * W + cx : -1;
}
function eventPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function editAt(point) {
  const i = cellAt(point.x, point.y);
  if (i < 0) return false;
  if (tool === "territory" && selected === null) return false;
  return paint(world, i, brush, tool, selected);
}
const touches = new Map();
let pinch = null,
  touchStart = null;
function touchGeometry() {
  const [a, b] = [...touches.values()];
  return {
    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
}
canvas.addEventListener("pointerdown", (e) => {
  if (![0, 1, 2].includes(e.button)) return;
  if (e.pointerType === "touch") {
    if (!touches.size)
      touchStart = {
        world: structuredClone(world),
        selected,
        undoSnapshot,
        name: $("#spawn-name").value,
        color: $("#spawn-color").value,
      };
    touches.set(e.pointerId, eventPoint(e));
    if (touches.size >= 2) {
      if (!pinch && touchStart && tool !== "inspect") {
        // Cancel the first finger's editor action when it becomes a two-finger navigation gesture.
        world = touchStart.world;
        selected = touchStart.selected;
        undoSnapshot = touchStart.undoSnapshot;
        $("#spawn-name").value = touchStart.name;
        $("#spawn-color").value = touchStart.color;
        $("#undo").disabled = !undoSnapshot;
        refresh();
      }
      pinch = touchGeometry();
      drag = null;
      canvas.setPointerCapture(e.pointerId);
      return;
    }
  }
  pointer = eventPoint(e);
  canvas.setPointerCapture(e.pointerId);
  drag = {
    ...pointer,
    px: pan.x,
    py: pan.y,
    moved: false,
    last: pointer,
    panning: e.button !== 0 || e.shiftKey,
  };
  if (tool !== "inspect" && !drag.panning) {
    const before = structuredClone(world);
    if (tool === "spawn") {
      const id = spawnNation(world, cellAt(pointer.x, pointer.y), {
        name: $("#spawn-name").value.trim() || undefined,
        radius: Number($("#spawn-radius").value),
      });
      if (id < 0)
        toast("Place a nation on land. A world supports up to 64 nations.");
      else {
        undoSnapshot = before;
        $("#undo").disabled = false;
        world.nations[id].color = $("#spawn-color").value;
        $("#spawn-name").value = "";
        $("#spawn-color").value = colors[world.nations.length % colors.length];
        selected = id;
        switchPanel("nations");
        renderDetail(true);
      }
      refresh();
    } else {
      undoSnapshot = before;
      $("#undo").disabled = false;
      if (tool === "territory" && selected === null)
        toast("Select a nation from the ranking first.");
      editAt(pointer);
      refresh();
    }
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch" && touches.has(e.pointerId))
    touches.set(e.pointerId, eventPoint(e));
  if (pinch) {
    if (touches.size >= 2) {
      const next = touchGeometry();
      changeZoom(next.distance / pinch.distance, pinch.center);
      pan.x += next.center.x - pinch.center.x;
      pan.y += next.center.y - pinch.center.y;
      pinch = next;
      draw();
    }
    return;
  }
  pointer = eventPoint(e);
  if (drag) {
    const dx = pointer.x - drag.x,
      dy = pointer.y - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (tool === "inspect" || drag.panning) {
      pan = { x: drag.px + dx, y: drag.py + dy };
      draw();
    } else if (tool !== "spawn") {
      // Interpolate the stroke so quick mouse movement does not leave holes.
      const length = Math.hypot(
          pointer.x - drag.last.x,
          pointer.y - drag.last.y,
        ),
        steps = Math.ceil(length / Math.max(1, view().scale * brush));
      for (let j = 1; j <= steps; j++)
        editAt({
          x: drag.last.x + ((pointer.x - drag.last.x) * j) / steps,
          y: drag.last.y + ((pointer.y - drag.last.y) * j) / steps,
        });
      drag.last = pointer;
      refresh();
    }
    $("#tooltip").style.display = "none";
    return;
  }
  const i = cellAt(pointer.x, pointer.y),
    n = i >= 0 ? world.owner[i] : WATER,
    tip = $("#tooltip");
  tip.style.display =
    ["inspect", "spawn"].includes(tool) && n !== WATER ? "block" : "none";
  if (n !== WATER && i >= 0) {
    tip.innerHTML =
      tool === "spawn"
        ? `${esc($("#spawn-name").value.trim() || generateNationName(world, i))}<small>${esc(capitalRegion(world, i).label)} · Click to found nation</small>`
        : n >= 0
          ? `${esc(world.nations[n].name)}<small>${counts[n]} tiles · ${Math.floor(world.nations[n].wealth)} gold</small>`
          : "Unclaimed land";
    tip.style.left = Math.max(0, Math.min(cw - 180, pointer.x + 14)) + "px";
    tip.style.top = Math.max(0, pointer.y - 50) + "px";
  }
});
canvas.addEventListener("pointerup", (e) => {
  touches.delete(e.pointerId);
  if (pinch) {
    if (!touches.size) {
      pinch = null;
      touchStart = null;
    }
    drag = null;
    return;
  }
  if (drag && tool === "inspect" && !drag.moved && !drag.panning) {
    const p = eventPoint(e),
      i = cellAt(p.x, p.y);
    if (i >= 0 && world.owner[i] >= 0) selectNation(world.owner[i]);
  }
  drag = null;
  touchStart = null;
});
canvas.addEventListener("pointercancel", () => {
  drag = null;
  pinch = null;
  touchStart = null;
  touches.clear();
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerleave", () => {
  pointer = null;
  $("#tooltip").style.display = "none";
  draw();
});
$("#undo").onclick = () => {
  if (!undoSnapshot) return;
  world = undoSnapshot;
  undoSnapshot = null;
  if (selected !== null && !world.nations[selected]) selected = null;
  $("#undo").disabled = true;
  refresh();
  renderDetail(true);
  toast("Last map stroke undone.");
};
$("#undo-spawn").onclick = () => $("#undo").click();
function updateZoom() {
  $("#zoom-label").textContent = Math.round(zoom * 100) + "%";
  draw();
}
function changeZoom(factor, anchor = { x: cw / 2, y: ch / 2 }) {
  const old = view(),
    next = Math.max(0.65, Math.min(6, zoom * factor));
  const ratio = next / zoom;
  zoom = next;
  const fresh = view();
  pan.x += anchor.x - (anchor.x - old.x) * ratio - fresh.x;
  pan.y += anchor.y - (anchor.y - old.y) * ratio - fresh.y;
  updateZoom();
}
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    changeZoom(Math.exp(-e.deltaY * 0.001), eventPoint(e));
  },
  { passive: false },
);
$("#zoom-in").onclick = () => changeZoom(1.25);
$("#zoom-out").onclick = () => changeZoom(0.8);
$("#reset-view").onclick = () => {
  zoom = 1;
  pan = { x: 0, y: 0 };
  updateZoom();
};
$$("[data-layer]").forEach(
  (b) =>
    (b.onclick = () => {
      layer = b.dataset.layer;
      $$("[data-layer]").forEach((x) => x.classList.toggle("active", x === b));
      if (layer === "diplomacy" && selected === null)
        toast("Select a nation to see its allies and enemies.");
      rebuildMap();
      draw();
    }),
);
$$("[data-setting]").forEach(
  (input) =>
    (input.onchange = () =>
      (world.settings[input.dataset.setting] = input.checked)),
);
$("#aggression").oninput = (e) => {
  world.settings.aggression = Number(e.target.value);
  syncSettings();
};
$("#labels").onchange = (e) => {
  showLabels = e.target.checked;
  draw();
};
$("#effects").onchange = (e) => {
  showEffects = e.target.checked;
  draw();
};
function newView() {
  lastPlayback = null;
  lastTurn = null;
  renderTurn();
  recoveryPending = null;
  $("#recovery-banner").hidden = true;
  selected = null;
  zoom = 1;
  pan = { x: 0, y: 0 };
  undoSnapshot = null;
  $("#undo").disabled = true;
  setTool("inspect");
  syncSettings();
  updateZoom();
  refresh();
  renderDetail(true);
  $("#spawn-color").value = colors[world.nations.length % colors.length];
}
function previewMap() {
  const preset = $("#preset").value;
  const preview = createWorld($("#seed").value, 0, preset);
  const previewCanvas = $("#map-preview"),
    context = previewCanvas.getContext("2d");
  context.fillStyle = "#20384c";
  context.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  context.fillStyle = "#98b594";
  preview.owner.forEach((owner, i) => {
    if (owner !== WATER)
      context.fillRect((i % W) * 2, Math.floor(i / W) * 2, 2, 2);
  });
  $("#map-description").textContent = REAL_MAPS[preset]
    ? `${REAL_MAPS[preset].name} · Real coastlines, simplified to the game grid. Create your own countries and borders.`
    : preset === "blank"
      ? "Paint your own land, then use Spawn nation to add countries."
      : "A generated landscape. Your seed recreates the same geography.";
  const manual = $("[name=count]").value === "0" || preset === "blank";
  $("[name=start]").disabled = manual;
  $("[name=count]").disabled = preset === "blank";
}
$("#preset").onchange = previewMap;
$("[name=count]").onchange = previewMap;
$("#seed").onchange = previewMap;
$("#new").onclick = () => {
  $("#seed").value = "WORLD-" + Math.floor(Math.random() * 999999);
  $("#new-dialog").showModal();
  previewMap();
};
$("#cancel").onclick = () => $("#new-dialog").close();
$("#random-seed").onclick = () => {
  $("#seed").value = "WORLD-" + Math.floor(Math.random() * 999999);
  previewMap();
};
$("#world-form").onsubmit = (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  world = createWorld(
    String(data.get("seed")),
    Number(data.get("count")),
    String(data.get("preset")),
    Number(data.get("count")) > 0 ? "borders" : "seeds",
  );
  $("#new-dialog").close();
  newView();
  const manual = Number(data.get("count")) === 0;
  if (data.get("preset") === "blank") setTool("land");
  else if (manual) setTool("spawn");
  toast("New world created.");
};
$("#help").onclick = () => $("#help-dialog").showModal();
$("#close-help").onclick = () => $("#help-dialog").close();
function restore(input) {
  const validated = validate(input);
  world = validated;
  recoveryPending = null;
  $("#recovery-banner").hidden = true;
  newView();
}
function renderSaves() {
  try {
    const entries = readSaves(localStorage);
    $("#save-list").innerHTML =
      entries
        .map(
          (e) =>
            `<article class="save-slot"><strong>${esc(e.name)}</strong><small>Year ${e.world.year} · ${esc(REAL_MAPS[e.world.preset]?.name || e.world.preset || "Custom map")} · ${e.savedAt ? new Date(e.savedAt).toLocaleString() : "Earlier version"}</small><div class="actions"><button data-save-load="${esc(e.id)}">Load</button><button data-save-replace="${esc(e.id)}">Replace</button><button data-save-delete="${esc(e.id)}">Delete</button></div></article>`,
        )
        .join("") ||
      '<p class="setting-note">Your first adventure deserves a save.</p>';
    $("#save-form button").disabled = entries.length >= 6;
  } catch (error) {
    $("#save-error").textContent = error.message;
  }
}
function openSaves() {
  $("#save-name").value =
    `${REAL_MAPS[world.preset]?.name || world.seed} — Year ${world.year}`;
  $("#save-error").textContent = "";
  renderSaves();
  $("#saves-dialog").showModal();
}
$("#save").onclick = openSaves;
$("#load").onclick = openSaves;
$("#close-saves").onclick = () => $("#saves-dialog").close();
$("#save-form").onsubmit = (e) => {
  e.preventDefault();
  try {
    saveWorld(localStorage, world, $("#save-name").value);
    renderSaves();
    $("#save-error").textContent = "World saved.";
  } catch (error) {
    $("#save-error").textContent = `Could not save: ${error.message}`;
  }
};
$("#save-list").onclick = (e) => {
  const button = e.target.closest("button");
  if (!button) return;
  try {
    const entries = readSaves(localStorage);
    const id =
      button.dataset.saveLoad ||
      button.dataset.saveReplace ||
      button.dataset.saveDelete;
    const entry = entries.find((s) => s.id === id);
    if (!entry) return;
    if (button.dataset.saveLoad) {
      restore(entry.world);
      $("#saves-dialog").close();
      toast("World loaded. Advance when you are ready.");
    }
    if (button.dataset.saveReplace) {
      saveWorld(localStorage, world, entry.name, id);
      $("#save-error").textContent = "Slot replaced with your current world.";
      renderSaves();
    }
    if (button.dataset.saveDelete) {
      deleteSave(localStorage, id);
      renderSaves();
      $("#save-error").textContent = "Save deleted.";
    }
  } catch (error) {
    $("#save-error").textContent =
      `Could not complete that action: ${error.message}`;
  }
};
function autoSave() {
  if (pendingTurn || recoveryPending || drag || pinch) return;
  try {
    writeRecovery(localStorage, world);
    $("#autosave-status").textContent = "RECOVERY SAVED";
  } catch {
    $("#autosave-status").textContent = "RECOVERY UNAVAILABLE";
  }
}
$("#resume-recovery").onclick = () => {
  if (recoveryPending) restore(recoveryPending.world);
  toast("Last session recovered. Advance when you are ready.");
};
$("#dismiss-recovery").onclick = () => {
  recoveryPending = null;
  $("#recovery-banner").hidden = true;
  autoSave();
};
setInterval(autoSave, 5000);
window.addEventListener("pagehide", autoSave);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) autoSave();
});
$("#export").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(world, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `world-conflict-year-${world.year}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("World exported.");
};
$("#import").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 4e6) throw Error();
    restore(JSON.parse(await file.text()));
    toast("World imported.");
  } catch {
    toast("Invalid world file. Your current world is unchanged.");
  }
  e.target.value = "";
};
document.addEventListener("keydown", (e) => {
  if (borderAnimation) return;
  if (document.querySelector("dialog[open]")) return;
  if (e.key === "Escape") {
    setTool("inspect");
    return;
  }
  if (
    e.code === "Space" &&
    !/INPUT|SELECT|BUTTON|TEXTAREA/.test(e.target.tagName)
  ) {
    e.preventDefault();
    if (!e.repeat) nextTurn();
  }
});
refresh();
renderTurn();
setTool("spawn");
try {
  recoveryPending = readRecovery(localStorage);
  if (recoveryPending) {
    $("#recovery-message").textContent =
      `Continue your last world? Year ${recoveryPending.world.year} · ${recoveryPending.world.nations.length} nations founded`;
    $("#recovery-banner").hidden = false;
  }
} catch {
  $("#autosave-status").textContent = "RECOVERY UNAVAILABLE";
}
requestAnimationFrame(animate);
