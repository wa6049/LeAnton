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

let ITEMS = [], order = [];
let filter = "all";
try { const f = localStorage.getItem("la-filter"); if (CATS.some(c => c[0] === f)) filter = f; } catch (_) {}

fetch("assets/data/pieces.json").then(r => r.json()).then(data => {
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
  n.el.tabIndex = -1;
  n.el.setAttribute("aria-hidden", k === 0 ? "false" : "true");
  n.k = k;
}
function makeNote(it){
  const el = document.createElement("div");
  const {w, h} = noteSize(it);
  el.className = "note";
  el.style.setProperty("--w", w + "px"); el.style.setProperty("--h", h + "px");
  el.innerHTML = `<span class="pic"><img src="${thumb(it)}" alt="${esc(it.title)}" draggable="false"></span>
    <span class="cap"><span>${esc(it.title)}</span><span>Nº ${pad(it.no)}</span></span>`;
  const n = {it, el, k:0};
  el.addEventListener("pointerdown", e => grab(e, n));
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
addEventListener("popstate", () => openFromHash(false));

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
  rt = setTimeout(() => { build(); if (isOpen) { buildPile(); } }, 200);
});
})();
