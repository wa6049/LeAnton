/* Lè Anton Home gallery
   - The table: an endless, wrap-around canvas of cards. Drag, flick or scroll to move it.
   - The detail view: a pile of notes. The open piece sits on top with the next ones stacked
     underneath. Next throws the top note off the pile; previous drops one back on.
     Notes can be dragged and thrown, and tapping a note under the top one jumps to it. */
(() => {
"use strict";

const CATS = [["all","All"],["candles","Candles"],["jesmonite","Jesmonite"],["fibre","Crochet & Macrame"],["art","Art"],["diffusers","Diffusers"]];
const CATNAME = {candles:"Dessert Candles",jesmonite:"Jesmonite",fibre:"Crochet & Macrame",art:"Art",diffusers:"Car Diffusers"};
const DEPTH = 4;                       // notes visible in the pile
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, "0");
const fmtDate = d => new Date(d + "T12:00:00").toLocaleDateString("en-GB", {day:"numeric", month:"short", year:"numeric"});
const mod = (a, n) => ((a % n) + n) % n;
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function rng(seed){ return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function hash(str){ let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; }
const thumb = it => `assets/img/thumb/${it.code}.jpg`;
const full  = it => `assets/img/full/${it.code}.jpg`;
const zoomSrc = it => `assets/img/zoom/${it.code}.jpg`;

let ITEMS = [], order = [];
let filter = "all";
try { const f = localStorage.getItem("la-filter"); if (CATS.some(c => c[0] === f)) filter = f; } catch (_) {}

fetch("assets/data/pieces.json?v=3").then(r => r.json()).then(data => {
  ITEMS = data.sort((a, b) => b.date.localeCompare(a.date));
  ITEMS.forEach((it, i) => it.no = i + 1);           // Nº 01 is the newest piece
  const r = rng(20261020);
  order = ITEMS.map((_, i) => i).sort(() => r() - .5);
  initFilters(); build(); ox = -cellW * .3; oy = -cellH * .25; place();
  openFromHash(true);
}).catch(() => {
  $("#stage").innerHTML = '<p class="noscript">The collection could not load. Try refreshing, or see it on <a href="https://www.instagram.com/le__anton/">Instagram</a>.</p>';
});

/* ================= the table ================= */
const stage = $("#stage");
let cards = [], TW = 0, TH = 0, cellW = 0, cellH = 0, ox = 0, oy = 0, vx = 0, vy = 0;

function build(){
  stage.innerHTML = ""; cards = [];
  const cw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--card"));
  cellW = cw * 1.42; cellH = cw * 1.72;
  const cols = Math.max(7, Math.ceil((innerWidth + cellW * 2) / cellW));
  const rows = Math.max(Math.ceil(ITEMS.length / cols), Math.ceil((innerHeight + cellH * 2) / cellH));
  TW = cols * cellW; TH = rows * cellH;
  const r = rng(7);
  for (let k = 0; k < cols * rows; k++) {
    const idx = order[k % order.length], it = ITEMS[idx];
    const c = k % cols, row = Math.floor(k / cols);
    const ar = Math.min(1.6, Math.max(.78, it.h / it.w));
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `<button class="inner" style="--r:${((r() - .5) * 9).toFixed(2)}deg;--ar:1/${ar.toFixed(3)};--d:${(r() * .5).toFixed(2)}s" aria-label="${esc(it.title)}, ${CATNAME[it.cat]}">
      <span class="ph"><img src="${thumb(it)}" alt="" loading="lazy" decoding="async"></span>
      ${it.kind === "reel" ? '<span class="reel" aria-hidden="true"></span>' : ""}
      <span class="lbl"><span class="nm">${esc(it.title)}</span><span class="no">Nº ${pad(it.no)}</span></span></button>`;
    const btn = el.firstElementChild;
    // pointer taps are handled in release(); this catches Enter/Space from the keyboard
    btn.addEventListener("click", e => { e.preventDefault(); if (e.detail === 0) openItem(it, el); });
    btn.addEventListener("focus", () => { if (btn.matches(":focus-visible")) bringIntoView(el); });
    stage.appendChild(el);
    cards.push({el, it, x:0, y:0,
      bx: c * cellW + (cellW - cw) / 2 + (r() - .5) * cellW * .22 + (row % 2 ? cellW * .5 : 0),
      by: row * cellH + (r() - .5) * cellH * .18});
  }
  applyFilter(); place();
}
function place(){
  for (const c of cards) {
    c.x = mod(c.bx + ox + cellW, TW) - cellW;
    c.y = mod(c.by + oy + cellH, TH) - cellH;
    c.el.style.transform = `translate3d(${c.x}px,${c.y}px,0)`;
  }
}
function onScreen(c){ return c.x > -40 && c.y > -40 && c.x < innerWidth - 40 && c.y < innerHeight - 40; }
function bringIntoView(el){
  const c = cards.find(c => c.el === el); if (!c) return;
  const w = el.offsetWidth, h = el.offsetHeight;
  if (c.x < 40 || c.x + w > innerWidth - 40 || c.y < 90 || c.y + h > innerHeight - 90) {
    ox += innerWidth / 2 - (c.x + w / 2); oy += innerHeight / 2 - (c.y + h / 2); place();
  }
}

let down = false, moved = false, lx = 0, ly = 0, lt = 0, raf = 0, downCard = null, gliding = false;
stage.addEventListener("pointerdown", e => {
  if (e.button > 0) return;
  // a tap that stops a moving table should only stop it, not open a card
  downCard = gliding ? null : e.target.closest(".card");
  down = true; moved = false; lx = e.clientX; ly = e.clientY; lt = performance.now(); vx = vy = 0; cancelAnimationFrame(raf); gliding = false;
});
addEventListener("pointermove", e => {
  document.documentElement.style.setProperty("--gx", e.clientX + "px");
  document.documentElement.style.setProperty("--gy", e.clientY + "px");
  if (!down) return;
  const dx = e.clientX - lx, dy = e.clientY - ly;
  if (!moved && Math.hypot(dx, dy) < 6) return;
  if (!moved) { moved = true; stage.classList.add("grabbing"); hideHint(); try { stage.setPointerCapture(e.pointerId); } catch (_) {} }
  const now = performance.now(), dt = Math.max(1, now - lt);
  ox += dx; oy += dy; vx = dx / dt * 16; vy = dy / dt * 16; lx = e.clientX; ly = e.clientY; lt = now; place();
});
function release(e){
  if (!down) return; down = false; stage.classList.remove("grabbing");
  if (moved) { if (!reduce) { gliding = true; glide(); } }
  else if (downCard && e.type === "pointerup") {
    const c = cards.find(c => c.el === downCard);
    if (c) openItem(c.it, c.el);
  }
  downCard = null;
}
addEventListener("pointerup", release); addEventListener("pointercancel", release);
function glide(){
  vx *= .94; vy *= .94; ox += vx; oy += vy; place();
  if (Math.hypot(vx, vy) > .2) raf = requestAnimationFrame(glide); else gliding = false;
}
stage.addEventListener("wheel", e => { e.preventDefault(); ox -= e.deltaX; oy -= e.deltaY; place(); hideHint(); }, {passive:false});
function hideHint(){ $("#hint").classList.add("gone"); }

/* ================= filters ================= */
const nav = $("#filters");
function initFilters(){
  CATS.forEach(([k, label]) => {
    const n = k === "all" ? ITEMS.length : ITEMS.filter(i => i.cat === k).length;
    const b = document.createElement("button");
    b.className = "chip"; b.dataset.k = k; b.innerHTML = `${label}<sup>${n}</sup>`;
    b.onclick = () => { filter = k; applyFilter(); try { localStorage.setItem("la-filter", k); } catch (_) {} };
    nav.appendChild(b);
  });
}
const visible = () => ITEMS.filter(i => filter === "all" || i.cat === filter);
function applyFilter(){
  nav.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c.dataset.k === filter));
  for (const c of cards) {
    const on = filter === "all" || c.it.cat === filter;
    c.el.classList.toggle("dim", !on); c.el.firstElementChild.tabIndex = on ? 0 : -1;
  }
  const n = visible().length;
  $("#tally").innerHTML = `<b>${pad(n)}</b>${filter === "all" ? "pieces" : CATNAME[filter].toLowerCase()}`;
}

/* ================= detail: the pile of notes ================= */
const D = $("#detail"), stackEl = $("#stack"), sheet = $("#sheet"), shot = $("#shot");
let isOpen = false, list = [], pos = 0, pile = [], lifted = null, busy = 0, pushed = false;
const small = () => innerWidth <= 860;

function sizeStack(){
  const cs = getComputedStyle(shot);
  const aw = shot.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const ah = small() ? Math.min(innerHeight * .56, 560) : shot.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const sw = Math.max(200, Math.min(aw - (small() ? 30 : 60), 600));
  const sh = Math.max(240, Math.min(ah - 30, 760));
  stackEl.style.setProperty("--sw", sw + "px"); stackEl.style.setProperty("--sh", sh + "px");
  return {sw, sh};
}
function noteSize(it){
  const {sw, sh} = box;
  const px = small() ? 14 : 20, py = small() ? 35 : 44;
  const ar = Math.min(1.7, Math.max(.7, it.h / it.w));
  let w = sw - px, h = w * ar;
  if (h > sh - py) { h = sh - py; w = h / ar; }
  return {w: w + px, h: h + py};
}
let box = {sw:480, sh:600};

// where a note sits at depth k
function levelVars(it, k){
  const s = hash(it.code), side = s < .5 ? -1 : 1;
  if (k === 0) return {tx:0, ty:0, rot:(s - .5) * 2.4, sc:1, br:1};
  const alt = k % 2 ? side : -side; // notes fan out to alternating sides
  const spread = Math.min(1.5, Math.max(.45, box.sw / 520));
  return {tx: alt * (16 + k * 20 + s * 10) * spread, ty: -k * 16 * spread, rot: alt * (3.5 + k * 3 + s * 2), sc: 1 - k * .035, br: 1 - k * .14};
}
function setLevel(n, k){
  const v = levelVars(n.it, k);
  const st = n.el.style;
  st.setProperty("--tx", v.tx + "px"); st.setProperty("--ty", v.ty + "px");
  st.setProperty("--rot", v.rot + "deg"); st.setProperty("--sc", v.sc); st.setProperty("--br", v.br);
  st.zIndex = 20 - k; st.opacity = k >= DEPTH ? 0 : 1;
  n.el.classList.toggle("top", k === 0);
  n.el.tabIndex = k === 0 ? 0 : -1;
  if (k === 0) { n.el.setAttribute("role", "button"); n.el.setAttribute("aria-label", `View ${n.it.title} full screen`); }
  else { n.el.removeAttribute("role"); n.el.removeAttribute("aria-label"); }
  n.el.setAttribute("aria-hidden", k === 0 ? "false" : "true");
  n.k = k;
}
function makeNote(it){
  const el = document.createElement("div");
  const {w, h} = noteSize(it);
  el.className = "note";
  el.style.setProperty("--w", w + "px"); el.style.setProperty("--h", h + "px");
  el.innerHTML = `<span class="pic"><img src="${thumb(it)}" alt="${esc(it.title)}" draggable="false"></span>
    <span class="cap"><span>${esc(it.title)}</span><span>Nº ${pad(it.no)}</span></span>
    <span class="zoomhint" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg></span>`;
  const n = {it, el, k:0};
  el.addEventListener("pointerdown", e => grab(e, n));
  el.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && n.k === 0) { e.preventDefault(); openZoom(); } });
  stackEl.appendChild(el);
  return n;
}
function upgrade(n){ // swap the thumbnail for the full photo once it has loaded
  const img = new Image();
  img.onload = () => { const i = n.el.querySelector("img"); if (i) i.src = img.src; };
  img.src = full(n.it);
}
function at(offset){ return list[mod(pos + offset, list.length)]; }
function depth(){ return Math.min(DEPTH, list.length); }

function buildPile(){
  stackEl.innerHTML = ""; pile = [];
  box = sizeStack();
  for (let k = 0; k < depth(); k++) { const n = makeNote(at(k)); setLevel(n, k); pile.push(n); }
  upgrade(pile[0]);
}

function fill(it){
  $("#d-count").innerHTML = `<b>${pad(pos + 1)}</b>of ${pad(list.length)}`;
  $("#d-meta").innerHTML = `<span>${CATNAME[it.cat]}</span><span>${fmtDate(it.date)}</span>`;
  $("#d-title").textContent = it.title;
  $("#d-desc").textContent = it.desc;
  let notes = "";
  if (it.scents.length) notes += `<div><dt>Scent notes</dt>${it.scents.map(s => s.split(" · ").map(x => `<dd>${esc(x)}</dd>`).join("")).join("")}</div>`;
  if (it.material) notes += `<div><dt>Made with</dt><dd>${esc(it.material)}</dd></div>`;
  const dl = $("#d-notes"); dl.innerHTML = notes; dl.hidden = !notes;
  const ig = $("#d-ig"); ig.href = it.url; ig.textContent = it.kind === "reel" ? "Watch the reel" : "View on Instagram";
}
function swapSheet(it){
  if (reduce) { fill(it); return; }
  sheet.classList.add("swap");
  setTimeout(() => { fill(it); sheet.classList.remove("swap"); }, 180);
}

function openItem(it, cardEl){
  list = visible(); if (!list.includes(it)) { filter = "all"; applyFilter(); list = visible(); }
  pos = list.indexOf(it);
  isOpen = true; hideHint(); openedAt = performance.now();
  D.classList.add("open"); D.setAttribute("aria-hidden", "false");
  fill(it); buildPile();
  if (location.hash.slice(1) !== it.code) { history.pushState({piece:it.code}, "", "#" + it.code); pushed = true; }

  if (cardEl) { lifted = cardEl; cardEl.classList.add("lifted"); }
  const top = pile[0];
  if (cardEl && !reduce) {
    const from = cardEl.querySelector(".inner").getBoundingClientRect();
    const to = top.el.getBoundingClientRect();
    const sx = from.width / to.width, sy = from.height / to.height;
    top.el.animate([
      {transform:`translate(${from.left + from.width / 2 - (to.left + to.width / 2)}px,${from.top + from.height / 2 - (to.top + to.height / 2)}px) scale(${sx},${sy})`},
      {transform:getComputedStyle(top.el).transform}
    ], {duration:620, easing:"cubic-bezier(.2,.8,.2,1)"});
  }
  // the rest of the pile fans out from under the top note
  if (!reduce) pile.slice(1).forEach((n, i) => n.el.animate(
    [{transform:"translate(0,0) rotate(0deg) scale(.92)", opacity:0}, {transform:getComputedStyle(n.el).transform, opacity:1}],
    {duration:620, delay:260 + i * 90, easing:"cubic-bezier(.2,.8,.2,1)", fill:"backwards"}));
  $("#close").focus({preventScroll:true});
}

function close(fromPop){
  if (!isOpen) return; isOpen = false;
  if (pushed && !fromPop) history.back();
  else if (!fromPop && location.hash) history.replaceState(null, "", location.pathname + location.search);
  pushed = false;
  const it = list[pos];
  if (lifted) { lifted.classList.remove("lifted"); lifted = null; }
  const target = cards.find(c => c.it === it && onScreen(c));
  const finish = () => {
    D.classList.remove("open", "closing"); D.setAttribute("aria-hidden", "true");
    stackEl.innerHTML = ""; pile = [];
    if (target) { target.el.classList.remove("lifted"); target.el.firstElementChild.focus({preventScroll:true}); }
  };
  if (!target || reduce || !pile.length) { finish(); return; }
  target.el.classList.add("lifted");
  D.classList.add("closing"); D.classList.remove("open");
  const top = pile[0];
  const from = top.el.getBoundingClientRect(), to = target.el.querySelector(".inner").getBoundingClientRect();
  pile.slice(1).forEach(n => n.el.animate([{opacity:1}, {opacity:0, transform:"translate(0,0) scale(.9)"}], {duration:260, fill:"forwards"}));
  top.el.animate([
    {transform:getComputedStyle(top.el).transform},
    {transform:`translate(${to.left - from.left + (to.width - from.width) / 2}px,${to.top - from.top + (to.height - from.height) / 2}px) scale(${to.width / from.width},${to.height / from.height})`}
  ], {duration:480, easing:"cubic-bezier(.4,0,.2,1)", fill:"forwards"}).onfinish = finish;
}

/* --- moving through the pile --- */
function step(dir, fling){
  if (!isOpen || list.length < 2) return;
  const t = reduce ? 0 : 1;
  if (lifted) { lifted.classList.remove("lifted"); lifted = null; }
  if (dir > 0) {
    // throw the top note off the pile
    const top = pile.shift();
    const fx = fling ? fling.x : innerWidth * .55, fy = fling ? fling.y : -innerHeight * .12;
    top.el.classList.remove("top", "dragging"); top.el.style.zIndex = 30;
    const out = top.el.animate([{transform:getComputedStyle(top.el).transform, opacity:1},
      {transform:`translate(${fx}px,${fy}px) rotate(${fx > 0 ? 24 : -24}deg) scale(.96)`, opacity:0}],
      {duration:520 * t, easing:"cubic-bezier(.3,.6,.3,1)", fill:"forwards"});
    out.onfinish = () => top.el.remove();
    pos = mod(pos + 1, list.length);
    pile.forEach((n, k) => setLevel(n, k));
    // slide a new note in at the bottom of the pile
    const n = makeNote(at(depth() - 1));
    setLevel(n, DEPTH); n.el.getBoundingClientRect(); setLevel(n, depth() - 1);
    pile.push(n);
  } else {
    // drop the previous note back on top
    pos = mod(pos - 1, list.length);
    const n = makeNote(list[pos]);
    setLevel(n, 0); n.el.style.zIndex = 30;
    if (t) n.el.animate([{transform:`translate(${-innerWidth * .5}px,${-innerHeight * .1}px) rotate(-22deg)`, opacity:0},
      {transform:getComputedStyle(n.el).transform, opacity:1}], {duration:520, easing:"cubic-bezier(.2,.8,.2,1)"});
    pile.unshift(n);
    pile.forEach((p, k) => setLevel(p, k));
    while (pile.length > depth()) { const gone = pile.pop(); gone.el.style.opacity = 0; setTimeout(() => gone.el.remove(), 400); }
  }
  upgrade(pile[0]);
  swapSheet(list[pos]);
  history.replaceState({piece:list[pos].code}, "", "#" + list[pos].code);
}
function jump(k){ for (let i = 0; i < k; i++) setTimeout(() => step(1), i * 130); }

/* --- dragging and throwing the top note --- */
let drag = null, dragMoved = false;
function grab(e, n){
  dragMoved = false;
  e.preventDefault();
  if (n.k !== 0) { drag = {n, x:e.clientX, y:e.clientY, dx:0, dy:0, under:true}; return; }
  drag = {n, x:e.clientX, y:e.clientY, dx:0, dy:0, t:performance.now(), vx:0, vy:0, base:levelVars(n.it, 0)};
  n.el.classList.add("dragging");
  try { n.el.setPointerCapture(e.pointerId); } catch (_) {}
}
addEventListener("pointermove", e => {
  if (!drag) return;
  if (drag.under) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) dragMoved = true; return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 4) dragMoved = true;
  const now = performance.now(), dt = Math.max(1, now - drag.t);
  drag.vx = (dx - drag.dx) / dt; drag.vy = (dy - drag.dy) / dt; drag.dx = dx; drag.dy = dy; drag.t = now;
  const st = drag.n.el.style;
  st.setProperty("--tx", dx + "px"); st.setProperty("--ty", dy + "px");
  st.setProperty("--rot", (drag.base.rot + dx * .06) + "deg");
});
function drop(e){
  if (!drag) return;
  if (drag.under) { const n = drag.n; drag = null; if (!dragMoved && e.type === "pointerup" && n.k > 0) jump(n.k); return; }
  const {n, dx, dy, vx, vy} = drag; drag = null;
  const far = Math.hypot(dx, dy) > Math.min(140, box.sw * .35) || Math.hypot(vx, vy) > .9;
  if (far && list.length > 1) {
    const len = Math.hypot(dx, dy) || 1;
    step(1, {x: dx + dx / len * innerWidth * .6, y: dy + dy / len * innerHeight * .4});
  } else {
    n.el.classList.remove("dragging"); setLevel(n, 0);
    if (!dragMoved && e.type === "pointerup") openZoom();   // a tap on the top note opens the photo
  }
  dragMoved = false;
}
addEventListener("pointerup", drop); addEventListener("pointercancel", drop);

// swallow the browser's own click that follows the tap which opened the view
let openedAt = 0;
D.addEventListener("click", e => { if (performance.now() - openedAt < 450) { e.preventDefault(); e.stopPropagation(); } }, true);
$("#close").onclick = () => close();
$("#veil").onclick = () => close();
$("#prev").onclick = () => step(-1);
$("#next").onclick = () => step(1);

addEventListener("keydown", e => {
  if (zoomOpen) { zoomKey(e); return; }
  if (aboutOpen) { if (e.key === "Escape") closeAbout(); else if (e.key === "Tab") trap(e, $("#about")); return; }
  if (!isOpen) return;
  if (e.key === "Escape") close();
  else if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); step(1); }
  else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
  else if (e.key === "Tab") trap(e, D);
});
function trap(e, root){
  const f = [...root.querySelectorAll("a[href],button")].filter(x => x.offsetParent !== null);
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
}

/* --- links to a piece: yoursite/#DMNuIcwsypm opens that piece --- */
function openFromHash(first){
  const code = location.hash.slice(1);
  const it = ITEMS.find(i => i.code === code);
  if (it && !isOpen) {
    const c = cards.find(c => c.it === it);
    if (c) bringIntoView(c.el);
    setTimeout(() => { openItem(it, c && onScreen(c) ? c.el : null); pushed = false; }, first ? 500 : 0);
  } else if (!it && isOpen) close(true);
}
addEventListener("popstate", () => {
  if (zoomOpen) { closeZoom(true); return; }
  // after the viewer closes itself, keep the address on the piece that is showing
  if (zBack) { zBack = false; if (isOpen) history.replaceState({piece:list[pos].code}, "", "#" + list[pos].code); return; }
  openFromHash(false);
});

/* ================= photo viewer ================= */
const Z = $("#zoom"), zStage = $("#z-stage"), zImg = $("#z-img"), zLevel = $("#z-level"), zHint = $("#z-hint");
let zoomOpen = false, zPushed = false, zBack = false, zOpenedAt = 0, zReturn = null;
let zs = 1, zx = 0, zy = 0, fitW = 0, fitH = 0, maxS = 4, zItem = null;
const ptrs = new Map();
let pinch = null, pan = null, lastTap = {t:0, x:0, y:0}, swipe = null;

function fitBox(it){
  const pad = innerWidth <= 640 ? 12 : 72;
  const top = innerWidth <= 640 ? 70 : 84, bottom = innerWidth <= 640 ? 120 : 72;
  const aw = innerWidth - pad * 2, ah = innerHeight - top - bottom;
  const ar = it.h / it.w;
  let w = aw, h = w * ar; if (h > ah) { h = ah; w = h / ar; }
  return {w, h, x:(innerWidth - w) / 2, y: top + (ah - h) / 2};
}
function applyZ(anim){
  zImg.style.transition = anim && !reduce ? "transform .32s cubic-bezier(.2,.8,.2,1)" : "none";
  zImg.style.transform = `translate(${zx}px,${zy}px) scale(${zs})`;
  zLevel.textContent = (zs < 1.05 ? 1 : Math.round(zs * 10) / 10) + "×";
  zLevel.setAttribute("aria-label", zs < 1.05 ? "Zoom level, fit to screen" : `Zoom level ${zLevel.textContent}, reset to fit`);
  zStage.classList.toggle("zoomed", zs > 1.05);
  $("#z-out").disabled = zs <= 1.01; $("#z-in").disabled = zs >= maxS - .01;
}
function clampZ(){
  const w = fitW * zs, h = fitH * zs, f = fitBox(zItem);
  zx = w <= innerWidth ? f.x + (fitW - w) / 2 : Math.min(0, Math.max(innerWidth - w, zx));
  zy = h <= innerHeight ? f.y + (fitH - h) / 2 : Math.min(0, Math.max(innerHeight - h, zy));
}
function zoomTo(ns, px, py, anim){
  ns = Math.min(maxS, Math.max(1, ns));
  const ix = (px - zx) / zs, iy = (py - zy) / zs;   // image point under the cursor stays put
  zs = ns; zx = px - ix * zs; zy = py - iy * zs;
  clampZ(); applyZ(anim);
}
function resetZ(anim){ const f = fitBox(zItem); zs = 1; zx = f.x; zy = f.y; applyZ(anim); }
function layoutZ(){
  const f = fitBox(zItem);
  fitW = f.w; fitH = f.h;
  zImg.style.width = fitW + "px"; zImg.style.height = fitH + "px";
  // zoom up to 1.5x the photo's real pixels (at least 3x), past that it only gets blurrier
  const natW = zImg.dataset.nat ? +zImg.dataset.nat : zItem.w;
  maxS = Math.min(6, Math.max(3, natW * 1.5 / fitW));
}
function loadZ(it){
  zItem = it;
  $("#z-title").textContent = it.title;
  $("#z-no").textContent = `Nº ${pad(it.no)} · ${pad(pos + 1)} of ${pad(list.length)}`;
  zImg.alt = it.title;
  zImg.dataset.nat = "";
  zImg.src = full(it);
  layoutZ(); resetZ(false);
  const hi = new Image();
  hi.onload = () => { if (zItem === it) { zImg.src = hi.src; zImg.dataset.nat = hi.naturalWidth; layoutZ(); applyZ(false); } };
  hi.src = zoomSrc(it);
  const one = list.length < 2; $("#z-prev").hidden = one; $("#z-next").hidden = one;
}
function openZoom(){
  if (!isOpen || zoomOpen || !pile[0]) return;
  zoomOpen = true; zOpenedAt = performance.now(); zReturn = document.activeElement;
  Z.classList.add("open"); Z.setAttribute("aria-hidden", "false"); Z.classList.remove("chrome-off");
  zHint.classList.remove("gone"); clearTimeout(zHint._t); zHint._t = setTimeout(() => zHint.classList.add("gone"), 3500);
  loadZ(list[pos]);
  history.pushState({piece:list[pos].code, zoom:1}, "", "#" + list[pos].code); zPushed = true;
  // grow out of the photo on the note
  const pic = pile[0].el.querySelector(".pic").getBoundingClientRect();
  if (!reduce) zImg.animate([
    {transform:`translate(${pic.left}px,${pic.top}px) scale(${pic.width / fitW},${pic.height / fitH})`, opacity:.6},
    {transform:`translate(${zx}px,${zy}px) scale(1)`, opacity:1}], {duration:420, easing:"cubic-bezier(.2,.8,.2,1)"});
  $("#z-close").focus({preventScroll:true});
}
function closeZoom(fromPop){
  if (!zoomOpen) return; zoomOpen = false;
  if (zPushed && !fromPop) { zBack = true; history.back(); }
  zPushed = false;
  if (fromPop) history.replaceState({piece:list[pos].code}, "", "#" + list[pos].code);
  Z.classList.remove("open"); Z.setAttribute("aria-hidden", "true"); Z.style.removeProperty("--zbg");
  ptrs.clear(); pinch = pan = swipe = null;
  if (pile[0]) pile[0].el.focus({preventScroll:true}); else if (zReturn) zReturn.focus({preventScroll:true});
}
function zStep(dir){
  if (list.length < 2) return;
  step(dir);                       // the pile behind follows along
  const from = dir > 0 ? 1 : -1;
  loadZ(list[pos]);
  if (!reduce) zImg.animate([{transform:`translate(${zx + from * 60}px,${zy}px) scale(1)`, opacity:0}, {transform:`translate(${zx}px,${zy}px) scale(1)`, opacity:1}],
    {duration:300, easing:"cubic-bezier(.2,.8,.2,1)"});
}
function zoomKey(e){
  const cx = innerWidth / 2, cy = innerHeight / 2;
  if (e.key === "Escape") closeZoom();
  else if (e.key === "+" || e.key === "=") zoomTo(zs * 1.5, cx, cy, true);
  else if (e.key === "-" || e.key === "_") zoomTo(zs / 1.5, cx, cy, true);
  else if (e.key === "0") resetZ(true);
  else if (e.key.startsWith("Arrow")) {
    e.preventDefault();
    if (zs > 1.05) {
      const d = 80, k = e.key;
      zx += k === "ArrowLeft" ? d : k === "ArrowRight" ? -d : 0;
      zy += k === "ArrowUp" ? d : k === "ArrowDown" ? -d : 0;
      clampZ(); applyZ(true);
    } else zStep(e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1);
  }
  else if (e.key === "Tab") trap(e, Z);
}
// wheel and trackpad pinch
zStage.addEventListener("wheel", e => {
  e.preventDefault(); hideZHint();
  const k = Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0018));
  zoomTo(zs * k, e.clientX, e.clientY, false);
}, {passive:false});
// pointers: pan, pinch, double-tap, swipe
zStage.addEventListener("pointerdown", e => {
  if (performance.now() - zOpenedAt < 300) return;
  zStage.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    pinch = {d:Math.hypot(a.x - b.x, a.y - b.y), s:zs, mx:(a.x + b.x) / 2, my:(a.y + b.y) / 2, zx, zy};
    pan = swipe = null;
  } else if (ptrs.size === 1) {
    if (zs > 1.05) pan = {x:e.clientX, y:e.clientY, zx, zy, moved:false};
    else swipe = {x:e.clientX, y:e.clientY, dx:0, dy:0, axis:null, t:performance.now()};
  }
});
zStage.addEventListener("pointermove", e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (pinch && ptrs.size >= 2) {
    hideZHint();
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const ns = Math.min(maxS * 1.15, Math.max(.85, pinch.s * d / pinch.d));
    const ix = (pinch.mx - pinch.zx) / pinch.s, iy = (pinch.my - pinch.zy) / pinch.s;
    zs = ns; zx = mx - ix * zs; zy = my - iy * zs; applyZ(false);
  } else if (pan) {
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (Math.hypot(dx, dy) > 4) { pan.moved = true; zStage.classList.add("panning"); hideZHint(); }
    zx = pan.zx + dx; zy = pan.zy + dy; clampZ(); applyZ(false);
  } else if (swipe) {
    swipe.dx = e.clientX - swipe.x; swipe.dy = e.clientY - swipe.y;
    if (!swipe.axis && Math.hypot(swipe.dx, swipe.dy) > 10) swipe.axis = Math.abs(swipe.dy) > Math.abs(swipe.dx) ? "y" : "x";
    if (swipe.axis === "y") {   // drag down to close
      const dy = Math.max(0, swipe.dy);
      zImg.style.transition = "none";
      zImg.style.transform = `translate(${zx}px,${zy + dy}px) scale(${1 - Math.min(.2, dy / 2000)})`;
      Z.style.setProperty("--zbg", Math.max(.3, .99 - dy / 500));
    } else if (swipe.axis === "x") {
      zImg.style.transition = "none";
      zImg.style.transform = `translate(${zx + swipe.dx}px,${zy}px) scale(1)`;
    }
  }
});
function zUp(e){
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  zStage.classList.remove("panning");
  if (pinch) {
    if (ptrs.size < 2) {
      pinch = null;
      if (zs < 1) resetZ(true); else { zs = Math.min(zs, maxS); clampZ(); applyZ(true); }
      if (ptrs.size === 1 && zs > 1.05) { const p = [...ptrs.values()][0]; pan = {x:p.x, y:p.y, zx, zy, moved:true}; }
    }
    return;
  }
  const wasTap = (pan && !pan.moved) || (swipe && !swipe.axis);
  if (swipe && swipe.axis === "y") {
    Z.style.removeProperty("--zbg");
    if (swipe.dy > 110 || swipe.dy / (performance.now() - swipe.t) > .6) { closeZoom(); swipe = null; return; }
    applyZ(true);
  } else if (swipe && swipe.axis === "x") {
    if (Math.abs(swipe.dx) > 80 && list.length > 1) zStep(swipe.dx < 0 ? 1 : -1); else applyZ(true);
  }
  pan = swipe = null;
  if (wasTap && e.type === "pointerup") {
    const now = performance.now();
    if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) {
      // double-tap / double-click: zoom in on that spot, or back to fit
      if (zs > 1.05) resetZ(true); else zoomTo(Math.min(2.5, maxS), e.clientX, e.clientY, true);
      lastTap.t = 0; hideZHint();
    } else {
      lastTap = {t:now, x:e.clientX, y:e.clientY};
    }
  }
}
zStage.addEventListener("pointerup", zUp); zStage.addEventListener("pointercancel", zUp);
function hideZHint(){ zHint.classList.add("gone"); }
// the browser's leftover click from the tap that opened the viewer
Z.addEventListener("click", e => { if (performance.now() - zOpenedAt < 450) { e.preventDefault(); e.stopPropagation(); } }, true);
$("#z-close").onclick = () => closeZoom();
$("#z-in").onclick = () => zoomTo(zs * 1.6, innerWidth / 2, innerHeight / 2, true);
$("#z-out").onclick = () => zoomTo(zs / 1.6, innerWidth / 2, innerHeight / 2, true);
zLevel.onclick = () => resetZ(true);
$("#z-prev").onclick = () => zStep(-1);
$("#z-next").onclick = () => zStep(1);
const zfs = $("#z-fs");
if (document.fullscreenEnabled) {
  zfs.hidden = false;
  zfs.onclick = () => { (document.fullscreenElement ? document.exitFullscreen() : Z.requestFullscreen()).catch(() => {}); };
  document.addEventListener("fullscreenchange", () => {
    zfs.setAttribute("aria-label", document.fullscreenElement ? "Exit full screen" : "Full screen");
    if (zoomOpen) setTimeout(() => { layoutZ(); resetZ(false); }, 60);
  });
}
const _closeZoom = closeZoom;
closeZoom = function(fromPop){ if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); _closeZoom(fromPop); };

/* ================= about ================= */
const A = $("#about"); let aboutOpen = false, aboutReturn = null;
function openAbout(){ aboutOpen = true; aboutReturn = document.activeElement; A.classList.add("open"); A.setAttribute("aria-hidden", "false"); A.querySelector(".about-x").focus(); }
function closeAbout(){ aboutOpen = false; A.classList.remove("open"); A.setAttribute("aria-hidden", "true"); aboutReturn && aboutReturn.focus(); }
$("#about-open").onclick = openAbout;
A.querySelectorAll("[data-close]").forEach(b => b.onclick = closeAbout);

/* ================= resize ================= */
let rt;
addEventListener("resize", () => {
  clearTimeout(rt);
  rt = setTimeout(() => { build(); if (isOpen) { buildPile(); } if (zoomOpen) { layoutZ(); resetZ(false); } }, 200);
});
})();
