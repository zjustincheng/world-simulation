import {
  W,
  H,
  WATER,
  NEUTRAL,
  createWorld,
  tick,
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
} from "./engine.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const canvas = $("#map"),
  ctx = canvas.getContext("2d");
const pixelCanvas = document.createElement("canvas");
pixelCanvas.width = W;
pixelCanvas.height = H;
const pixelCtx = pixelCanvas.getContext("2d");
let world = createWorld(),
  selected = null,
  running = true,
  speed = 1,
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
let toastTimer,
  lastTick = performance.now(),
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
        tool === "spawn" ? 3 : brush,
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
  if (selected === null || !world.nations[selected]) {
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
  detail.innerHTML = `<div class="detail-top">NATION INSPECTOR <button id="close-detail" aria-label="Close nation inspector">×</button></div><div class="detail-title"><span class="flag" style="background:${n.color}"></span><h2>${esc(n.name)}</h2></div><div class="detail-status">${alive ? (enemies.length ? "⚔ AT WAR · " + enemies.length + " FRONT" + (enemies.length > 1 ? "S" : "") : "● AT PEACE") : "FALLEN NATION"} · FOUNDED YEAR ${n.born}</div><div class="metrics"><div><label>Territory</label><strong>${compact(counts[selected])} <small>tiles</small></strong></div><div><label>Gold <small>(${(n.income || 0) >= 0 ? "+" : ""}${n.income || 0}/yr)</small></label><strong>${compact(Math.floor(n.wealth))}</strong></div><div><label>Combat efficiency</label><strong>${Math.round(n.efficiency)}<small>%</small></strong><div class="stat-bar"><div style="width:${Math.min(100, n.efficiency / 1.5)}%"></div></div></div><div><label>Stability</label><strong>${Math.round(n.stability)}<small>%</small></strong><div class="stat-bar"><div style="width:${n.stability}%;background:${n.stability < 40 ? "#ed827e" : "#8ed8b1"}"></div></div></div></div><div class="relations"><b>Allies:</b> ${esc(allies.join(", ") || "None")}<br><b>Enemies:</b> ${esc(enemies.join(", ") || "None")}</div><div class="god-heading">GOD MODE <span>${n.kills} CONQUESTS</span></div><div class="actions"><button data-action="gold" ${!alive ? "disabled" : ""}>＋ 500 gold</button><button data-action="peace" ${!enemies.length ? "disabled" : ""}>☮ Make peace</button><button data-action="rebel" ${counts[selected] < 30 ? "disabled" : ""}>⚡ Revolt</button><button data-action="follow" ${!alive ? "disabled" : ""}>⌖ Find capital</button></div><select id="rival" class="diplomacy-select" aria-label="Target nation">${world.nations
    .filter((m) => m.id !== selected && counts[m.id])
    .map((m) => `<option value="${m.id}">${esc(m.name)}</option>`)
    .join(
      "",
    )}</select><div class="actions"><button data-action="war" class="danger-outline" ${!alive ? "disabled" : ""}>⚔ Declare war</button><button data-action="ally" ${!alive ? "disabled" : ""}>◇ Toggle alliance</button><button data-action="annex" ${!alive ? "disabled" : ""}>▣ Annex target</button><button data-action="collapse" class="danger-outline" ${!alive ? "disabled" : ""}>× Collapse</button></div><details id="edit-nation" class="edit-toggle" ${open ? "open" : ""}><summary>Edit nation</summary><div class="edit-fields"><label>Name<input type="text" id="nation-name" maxlength="35" value="${esc(n.name)}"></label><label>Color<input type="color" id="nation-color" value="${n.color}"></label><label>Combat efficiency <input id="efficiency" type="range" min="15" max="150" value="${Math.round(n.efficiency)}"></label><label>Stability <input id="stability" type="range" min="5" max="100" value="${Math.round(n.stability)}"></label><button data-action="apply">Apply changes</button></div></details>`;
  if (rival && [...$("#rival").options].some((o) => o.value === rival))
    $("#rival").value = rival;
}
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
  $("#nation-count").textContent = counts.filter(Boolean).length;
  $("#war-count").textContent = world.wars.length;
  $("#claimed").textContent =
    Math.round(
      (counts.reduce((a, b) => a + b, 0) / Math.max(1, landCount)) * 100,
    ) + "%";
  $("#seed-label").textContent = world.seed;
  renderRanking();
  renderDetail();
  $("#events").innerHTML = world.events
    .map(
      (e) =>
        `<article class="event ${["war", "peace", "birth", "battle", "fall"].includes(e.type) ? e.type : ""}"><small>YEAR ${e.year}</small><p>${esc(e.text)}</p></article>`,
    )
    .join("");
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
function setRunning(value) {
  running = value;
  lastTick = performance.now();
  $("#play").textContent = running ? "Ⅱ Pause" : "▶ Play";
  $("#simulation-status").textContent = running
    ? "SIMULATION RUNNING"
    : "SIMULATION PAUSED";
  $(".transport").classList.toggle("paused", !running);
}
$("#play").onclick = () => {
  if (!running) setTool("inspect");
  setRunning(!running);
};
$("#step").onclick = () => {
  setRunning(false);
  tick(world);
  undoSnapshot = null;
  $("#undo").disabled = true;
  refresh();
};
$$("[data-speed]").forEach(
  (b) =>
    (b.onclick = () => {
      speed = Number(b.dataset.speed);
      $$("[data-speed]").forEach((x) => x.classList.toggle("active", x === b));
    }),
);
function animate(now) {
  if (
    running &&
    !document.querySelector("dialog[open]") &&
    now - lastTick > 500
  ) {
    lastTick = now;
    for (let i = 0; i < speed; i++) tick(world);
    undoSnapshot = null;
    $("#undo").disabled = true;
    refresh();
  } else if (
    showEffects &&
    ((world.flashes?.length && now - lastPaint < 720) ||
      (pointer && tool !== "inspect"))
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
  if (tool !== "inspect") setRunning(false);
  const messages = {
    inspect: "Select a nation to inspect it. Drag to pan · Scroll to zoom",
    spawn: "Click any land tile to place a new nation. Escape to inspect.",
    territory:
      selected === null
        ? "Select a nation from the ranking, then paint its territory."
        : `Paint territory for ${world.nations[selected].name}. Escape to inspect.`,
    land: "Drag to paint land. Time is paused while you edit.",
    water: "Drag to paint sea. Owned territory under the brush is removed.",
    erase: "Drag to remove ownership and leave unclaimed land.",
  };
  $("#tool-hint").textContent = messages[tool];
  draw();
}
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
canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  pointer = eventPoint(e);
  canvas.setPointerCapture(e.pointerId);
  drag = { ...pointer, px: pan.x, py: pan.y, moved: false, last: pointer };
  if (tool !== "inspect") {
    undoSnapshot = structuredClone(world);
    $("#undo").disabled = false;
    if (tool === "spawn") {
      const id = spawnNation(world, cellAt(pointer.x, pointer.y));
      if (id < 0)
        toast("Place a nation on land. A world supports up to 64 nations.");
      else {
        selected = id;
        switchPanel("nations");
        renderDetail(true);
      }
      refresh();
    } else {
      if (tool === "territory" && selected === null)
        toast("Select a nation from the ranking first.");
      editAt(pointer);
      refresh();
    }
  }
});
canvas.addEventListener("pointermove", (e) => {
  pointer = eventPoint(e);
  if (drag) {
    const dx = pointer.x - drag.x,
      dy = pointer.y - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (tool === "inspect") {
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
  tip.style.display = tool === "inspect" && n !== WATER ? "block" : "none";
  if (n !== WATER && i >= 0) {
    tip.innerHTML =
      n >= 0
        ? `${esc(world.nations[n].name)}<small>${counts[n]} tiles · ${Math.floor(world.nations[n].wealth)} gold</small>`
        : "Unclaimed land";
    tip.style.left = Math.max(0, Math.min(cw - 180, pointer.x + 14)) + "px";
    tip.style.top = Math.max(0, pointer.y - 50) + "px";
  }
});
canvas.addEventListener("pointerup", (e) => {
  if (drag && tool === "inspect" && !drag.moved) {
    const p = eventPoint(e),
      i = cellAt(p.x, p.y);
    if (i >= 0 && world.owner[i] >= 0) selectNation(world.owner[i]);
  }
  drag = null;
});
canvas.addEventListener("pointercancel", () => (drag = null));
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
}
$("#new").onclick = () => {
  $("#seed").value = "WORLD-" + Math.floor(Math.random() * 999999);
  $("#new-dialog").showModal();
};
$("#cancel").onclick = () => $("#new-dialog").close();
$("#random-seed").onclick = () =>
  ($("#seed").value = "WORLD-" + Math.floor(Math.random() * 999999));
$("#world-form").onsubmit = (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  world = createWorld(
    String(data.get("seed")),
    Number(data.get("count")),
    String(data.get("preset")),
    String(data.get("start")),
  );
  $("#new-dialog").close();
  newView();
  setRunning(data.get("preset") !== "blank");
  if (data.get("preset") === "blank") setTool("land");
  toast("New world created.");
};
$("#help").onclick = () => $("#help-dialog").showModal();
$("#close-help").onclick = () => $("#help-dialog").close();
$("#save").onclick = () => {
  try {
    localStorage.setItem("world-simulation-save", JSON.stringify(world));
    toast("World saved in this browser.");
  } catch {
    toast("Storage unavailable. Export your world instead.");
  }
};
function restore(input) {
  const validated = validate(input);
  world = validated;
  newView();
  setRunning(false);
}
$("#load").onclick = () => {
  try {
    const saved = localStorage.getItem("world-simulation-save");
    if (!saved) return toast("No saved world yet.");
    restore(JSON.parse(saved));
    toast("World loaded. Press Play to continue.");
  } catch {
    toast("This save could not be loaded. Your current world is unchanged.");
  }
};
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
    if (!running) setTool("inspect");
    setRunning(!running);
  }
});
refresh();
requestAnimationFrame(animate);
