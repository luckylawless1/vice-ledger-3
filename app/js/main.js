// VICE LEDGER 3 — application logic, written for this entry.
// One module: data loading, saved progress, every view (checklist, roadmap,
// missables, Next Up, the 100% Completion Planner, Tonight's Session,
// journey, sources, matrix, Platinum Card) and all event wiring.

const KIND_LABELS = {
  story: 'Story', side: 'Side chains', collectibles: 'Collectibles',
  activities: 'Activities', online: 'Partner / Online', crime: 'Crime',
  riddles: 'Riddles / Mystery', money: 'Money', feats: 'Feats',
};
const KIND_ORDER = ['story', 'side', 'collectibles', 'activities', 'online', 'crime', 'riddles', 'money', 'feats'];
const GRADE_ORDER = ['platinum', 'gold', 'silver', 'bronze'];
const STAGE_TITLES = {
  1: 'Opening & Chapter 1–2', 2: 'Story to the finale', 3: 'Side chains & strangers',
  4: 'Collectibles & exploration', 5: 'Activities & feats', 6: 'Crime, money & 100% cleanup', 7: 'Platinum',
};
const STAGE_BLURBS = {
  1: 'Learn Leonida, bank the early one-offs — and do the Chapter 1 balcony meditation before the chapter closes.',
  2: 'Finish the campaign and its named missions; keep a manual save before the finale.',
  3: 'Close every stranger strand; each named strand also carries its own trophy.',
  4: 'Cards, WAiNK scans, vehicles and the whole map — the long counters live here.',
  5: 'Ranges, races, stunts and challenges: the skill-and-grind stage.',
  6: 'Robberies, laundering, properties and the 100% checklist tail.',
  7: 'Vice Got a Price! — awarded when the other 54 are earned.',
};
const STORE_KEY = 'vice-ledger-3-progress-v1';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function fmtMins(min) {
  if (!Number.isFinite(min) || min <= 0) return '—';
  const h = Math.floor(min / 60); const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
function fmtHours(min) { return `${(min / 60).toFixed(1)} h`; }
function todayIso() { return new Date().toISOString().slice(0, 10); }
function fmtDay(iso) {
  if (!iso) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${months[(m || 1) - 1]} ${y}`;
}

// ---------- saved progress ----------
function blankState() {
  return { earned: {}, notes: {}, counts: {}, spoilers: false, order: [], weeklyHours: 10, sessionHours: 2 };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return blankState();
    const p = JSON.parse(raw); const s = blankState();
    if (p && typeof p === 'object') {
      if (p.earned && typeof p.earned === 'object') s.earned = p.earned;
      if (p.notes && typeof p.notes === 'object') s.notes = p.notes;
      if (p.counts && typeof p.counts === 'object') s.counts = p.counts;
      s.spoilers = p.spoilers === true;
      if (Array.isArray(p.order)) s.order = p.order.filter((n) => Number.isInteger(n));
      if (Number.isFinite(p.weeklyHours) && p.weeklyHours > 0) s.weeklyHours = p.weeklyHours;
      if (Number.isFinite(p.sessionHours) && p.sessionHours > 0) s.sessionHours = p.sessionHours;
    }
    return s;
  } catch { return blankState(); }
}
function saveState(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* session continues in memory */ } }
const earned = (s, id) => typeof s.earned[id] === 'string';
function toggleEarned(s, id) {
  if (earned(s, id)) { delete s.earned[id]; s.order = s.order.filter((x) => x !== id); }
  else { s.earned[id] = todayIso(); s.order = [...s.order.filter((x) => x !== id), id]; }
}
function exportJson(s) { return JSON.stringify({ app: 'vice-ledger-3', version: 1, ...s }, null, 2); }
function importJson(text) {
  try {
    const p = JSON.parse(text);
    if (!p || typeof p !== 'object') return null;
    const s = blankState();
    if (p.earned && typeof p.earned === 'object') for (const [k, v] of Object.entries(p.earned)) if (Number.isInteger(Number(k)) && typeof v === 'string') s.earned[k] = v;
    if (p.notes && typeof p.notes === 'object') for (const [k, v] of Object.entries(p.notes)) if (typeof v === 'string') s.notes[k] = v;
    if (p.counts && typeof p.counts === 'object') for (const [k, v] of Object.entries(p.counts)) { const n = Math.floor(Number(v)); if (Number.isFinite(n) && n > 0) s.counts[k] = n; }
    s.spoilers = p.spoilers === true;
    if (Array.isArray(p.order)) s.order = p.order.filter((n) => Number.isInteger(n) && s.earned[n]);
    if (!s.order.length) s.order = Object.keys(s.earned).map(Number).sort((a, b) => a - b);
    if (Number.isFinite(p.weeklyHours) && p.weeklyHours > 0) s.weeklyHours = p.weeklyHours;
    if (Number.isFinite(p.sessionHours) && p.sessionHours > 0) s.sessionHours = p.sessionHours;
    return s;
  } catch { return null; }
}

// ---------- data helpers ----------
let DATA = null;
let state = loadState();
const ui = { view: 'checklist', kind: 'all', grade: 'all', sort: 'official', query: '', hideEarned: false, selectedId: 28 };

const byId = (id) => DATA.trophies.find((t) => t.id === id) ?? null;
const roadmapSort = (list) => [...list].sort((a, b) => a.roadmapStage - b.roadmapStage || a.id - b.id);
const routeSort = (list) => [...list].sort((a, b) => a.difficulty - b.difficulty || a.timeMinutes - b.timeMinutes || a.id - b.id);
function plannerOrder(list) {
  return roadmapSort(list).sort((a, b) => (a.roadmapStage - b.roadmapStage) || ((b.missable ? 1 : 0) - (a.missable ? 1 : 0)) || (a.id - b.id));
}
const remainingList = () => DATA.trophies.filter((t) => !earned(state, t.id) && t.grade !== 'platinum');
const usedSources = (t) => { const u = new Set(); for (const s of t.steps) for (const n of s.cites) u.add(n); return DATA.sources.filter((s) => u.has(s.n)); };
function shielded(t) { return state.spoilers && !earned(state, t.id) && (t.kind === 'story' || t.hidden); }
const shownName = (t) => shielded(t) ? (t.kind === 'story' ? 'Hidden story trophy' : 'Hidden trophy') : t.name;
const shownDesc = (t) => shielded(t) ? 'Hidden until earned — the spoiler shield is on.' : t.description;

// ---------- header / dashboard ----------
function renderDashboard() {
  const total = DATA.trophies.length;
  const got = DATA.trophies.filter((t) => earned(state, t.id)).length;
  $('earned-count').textContent = String(got);
  const pct = total ? Math.round((got / total) * 100) : 0;
  $('bar-fill').style.width = `${pct}%`;
  $('bar-pct').textContent = `${pct}% of the list`;
  $('grade-counts').innerHTML = GRADE_ORDER.map((g) => {
    const all = DATA.trophies.filter((t) => t.grade === g);
    const n = all.filter((t) => earned(state, t.id)).length;
    return `<span class="gcount g-${g}">${g} ${n}/${all.length}</span>`;
  }).join('');
  const rem = remainingList();
  const mins = rem.reduce((sum, t) => sum + (t.timeMinutes || 0), 0);
  $('forecast').innerHTML = got >= total
    ? '<strong>Platinum Forecast:</strong> complete — Vice Got a Price!'
    : `<strong>Platinum Forecast:</strong> about <strong>${fmtMins(mins)}</strong> of guided play left across ${rem.length} trophies (sum of the per-trophy estimates in each guide). The 100% Planner view breaks that total down by roadmap stage.`;
  $('kind-bars').innerHTML = KIND_ORDER.map((k) => {
    const all = DATA.trophies.filter((t) => t.kind === k);
    if (!all.length) return '';
    const n = all.filter((t) => earned(state, t.id)).length;
    const p = Math.round((n / all.length) * 100);
    return `<div class="kindbar"><span>${esc(KIND_LABELS[k])}</span><span class="kb-track"><span class="kb-fill" style="width:${p}%"></span></span><span>${n}/${all.length}</span></div>`;
  }).join('');
  $('stage-strip').innerHTML = [1, 2, 3, 4, 5, 6, 7].map((s) => {
    const all = DATA.trophies.filter((t) => t.roadmapStage === s);
    const n = all.filter((t) => earned(state, t.id)).length;
    const risk = all.some((t) => t.missable && !earned(state, t.id));
    return `<button type="button" class="stagechip${risk ? ' risk' : ''}" data-stage="${s}"><span class="sc-n">${s}</span><span>${esc(STAGE_TITLES[s])}</span><span class="sc-p">${n} of ${all.length} earned</span>${risk ? '<span class="sc-risk">missable open</span>' : ''}</button>`;
  }).join('');
}

function auditHtml() {
  const steps = DATA.trophies.flatMap((t) => t.steps);
  const cited = steps.filter((s) => s.cites && s.cites.length).length;
  const hidden = DATA.trophies.filter((t) => t.hidden).length;
  const miss = DATA.trophies.filter((t) => t.missable).length;
  const watch = DATA.trophies.filter((t) => t.watch).length;
  const open = DATA.trophies.filter((t) => t.confidence === 'OPEN').length;
  const single = DATA.trophies.filter((t) => t.confidence === '1 SRC').length;
  const differ = DATA.trophies.filter((t) => t.confidence === 'DIFFER' || t.dispute).length;
  const grades = GRADE_ORDER.map((g) => `${DATA.trophies.filter((t) => t.grade === g).length}${g[0].toUpperCase()}`).join(' ');
  const warned = steps.filter((s) => s.warn).length;
  const routed = DATA.trophies.filter((t) => t.steps.some((s) => s.route)).length;
  return `<strong>AUDIT</strong> · ${DATA.trophies.length} official · ${grades} · ${hidden} hidden · ${DATA.trophies.filter((t) => t.guide && t.guide.trim()).length}/${DATA.trophies.length} guides · ${cited}/${steps.length} steps cited · ${DATA.sources.length} sources read ${esc(DATA.sourcesRead)} · ${miss} missable · ${watch} watch · ${open} trigger unknown · ${single} single-source · ${differ} disagree · ${warned} step failure warnings · ${routed} routed trophies`;
}

// ---------- checklist ----------
function flagBits(t) {
  const bits = [];
  if (t.missable) bits.push('<span class="flag missable">MISSABLE</span>');
  if (t.watch) bits.push('<span class="flag watch">WATCH</span>');
  if (t.dispute) bits.push('<span class="flag dispute">SOURCES DISAGREE</span>');
  if (t.confidence === 'OPEN') bits.push('<span class="flag open">TRIGGER UNKNOWN</span>');
  if (t.confidence === '1 SRC') bits.push('<span class="flag single">1 SOURCE</span>');
  return bits.join(' ');
}
function rowHtml(t) {
  const isE = earned(state, t.id);
  const count = t.track ? `<span class="rowcount">${state.counts[t.id] ?? 0}/${t.track.target} ${esc(t.track.label)}</span>` : '';
  return `<div class="row${isE ? ' earned' : ''}${t.id === ui.selectedId ? ' selected' : ''}">
    <label><input type="checkbox" data-earn="${t.id}" ${isE ? 'checked' : ''} aria-label="Mark ${esc(t.name)} earned"></label>
    <button type="button" class="rowmain" data-open="${t.id}">
      <span class="rowname">${esc(shownName(t))}</span>
      <span class="rowdesc">${esc(shownDesc(t))}</span>
      <span class="rowmeta"><span class="grade g-${t.grade}">${t.grade}</span><span>${esc(KIND_LABELS[t.kind] ?? t.kind)} · Stage ${t.roadmapStage}</span>${flagBits(t)} ${count}</span>
    </button></div>`;
}
function visibleList() {
  let list = DATA.trophies.filter((t) => {
    if (ui.kind === 'missable') { if (!t.missable && !t.watch) return false; }
    else if (ui.kind !== 'all' && t.kind !== ui.kind) return false;
    if (ui.grade !== 'all' && t.grade !== ui.grade) return false;
    if (ui.hideEarned && earned(state, t.id)) return false;
    if (ui.query) {
      const hay = `${t.name} ${t.description} ${t.guide} ${KIND_LABELS[t.kind] ?? ''}`.toLowerCase();
      if (!hay.includes(ui.query.toLowerCase())) return false;
    }
    return true;
  });
  if (ui.sort === 'roadmap') list = roadmapSort(list);
  else if (ui.sort === 'route') list = routeSort(list);
  return list;
}
function renderChecklist() {
  $('audit-strip').innerHTML = auditHtml();
  const openMiss = DATA.trophies.filter((t) => t.missable && !earned(state, t.id));
  const banner = $('warn-banner');
  if (openMiss.length) {
    banner.hidden = false;
    banner.innerHTML = `⚠ <strong>${openMiss.length} missable ${openMiss.length === 1 ? 'trophy' : 'trophies'} still open</strong> — ${esc(openMiss[0].name)}: ${esc(openMiss[0].alert ?? 'see its guide before you move on.')}`;
  } else banner.hidden = true;
  const rem = remainingList();
  if (!rem.length) $('nextup-bar').innerHTML = '<strong>Next up:</strong> nothing — the platinum is yours.';
  else {
    const next = plannerOrder(rem)[0];
    const mins = rem.reduce((s, t) => s + (t.timeMinutes || 0), 0);
    $('nextup-bar').innerHTML = `<strong>Next up:</strong> <button type="button" class="linklike" data-open="${next.id}">${esc(next.name)}</button> <span class="plan-meta">${esc(next.description)} · Stage ${next.roadmapStage} · about ${esc(next.timeEstimate)} · ${rem.length} to go, ≈ ${fmtMins(mins)} left</span>`;
  }
  $('kind-chips').innerHTML = ['all', ...KIND_ORDER, 'missable'].map((k) => {
    const n = k === 'all' ? DATA.trophies.length : k === 'missable' ? DATA.trophies.filter((t) => t.missable || t.watch).length : DATA.trophies.filter((t) => t.kind === k).length;
    const label = k === 'all' ? 'All' : k === 'missable' ? 'Missable & watch' : KIND_LABELS[k];
    return `<button type="button" data-kind="${k}" class="${ui.kind === k ? 'on' : ''}">${esc(label)} · ${n}</button>`;
  }).join('');
  const list = visibleList();
  if (!list.length) { $('list').innerHTML = '<p class="empty">No trophies match these filters.</p>'; }
  else if (ui.sort === 'official') $('list').innerHTML = list.map(rowHtml).join('');
  else {
    let html = ''; let stage = null;
    for (const t of list) {
      if (t.roadmapStage !== stage) {
        stage = t.roadmapStage;
        const inStage = list.filter((x) => x.roadmapStage === stage);
        const done = inStage.filter((x) => earned(state, x.id)).length;
        html += `<div class="grouphead">Stage ${stage} — ${esc(STAGE_TITLES[stage])} · ${done}/${inStage.length} earned</div>`;
      }
      html += rowHtml(t);
    }
    $('list').innerHTML = html;
  }
  renderPane();
}

// ---------- guide pane + source rail ----------
function renderPane() {
  const t = byId(ui.selectedId);
  const pane = $('guide-pane'); const rail = $('source-rail');
  if (!t) { pane.innerHTML = '<div><h2>Pick a trophy</h2><p>Select any row on the left to read its cited guide here.</p></div>'; rail.innerHTML = ''; return; }
  const isE = earned(state, t.id);
  const confLabel = { OK: 'Backed by the guides', '1 SRC': 'Single source — flagged', DIFFER: 'Sources differ — both shown', OPEN: 'Trigger not yet confirmed' }[t.confidence] ?? t.confidence;
  const alert = t.alert ? `<div class="alert ${t.missable ? 'missable' : 'watch'}"><strong>${t.missable ? 'MISSABLE — read before you move on' : 'WATCH — timing matters'}.</strong> ${esc(t.alert)}</div>` : '';
  const dispute = t.dispute ? `<div class="dispute"><strong>Sources disagree — both versions shown.</strong><p>${esc(t.dispute.topic)}</p><p><span class="d-side">A</span> ${esc(t.dispute.a)} <em>(${esc(t.dispute.aFrom)})</em></p><p><span class="d-side">B</span> ${esc(t.dispute.b)} <em>(${esc(t.dispute.bFrom)})</em></p></div>` : '';
  let counter = '';
  if (t.track) {
    const cur = state.counts[t.id] ?? 0;
    const pct = Math.min(100, Math.round((cur / t.track.target) * 100));
    const prefix = t.track.prefix ?? '';
    counter = `<div class="counter"><span>Your count</span><button type="button" data-count="-1" aria-label="Decrease count">−</button><span>${prefix}${cur.toLocaleString('en-US')}</span><button type="button" data-count="1" aria-label="Increase count">+</button><span>/ ${prefix}${t.track.target.toLocaleString('en-US')} ${esc(t.track.label)}</span><span class="c-track"><span class="c-fill" style="width:${pct}%"></span></span></div>`;
  }
  const steps = t.steps.map((s, i) => {
    const extras = [
      s.route ? `<span class="step-route">↳ Route: ${esc(s.route)}</span>` : '',
      s.warn ? `<span class="step-warn">⚠ ${esc(s.warn)}</span>` : '',
      s.mins ? `<span class="step-mins">Step estimate: ≈ ${fmtMins(s.mins)}.</span>` : '',
    ].join('');
    return `<li><span class="step-n">${i + 1}</span><span>${esc(s.text)} ${s.cites.map((n) => `<sup class="cite">[${n}]</sup>`).join(' ')}${extras}</span></li>`;
  }).join('');
  pane.innerHTML = `<div class="pane-head"><span class="grade g-${t.grade}">${t.grade}</span><span class="pane-idx">#${t.id} of 55</span><button type="button" class="markbtn" data-mark="${t.id}">${isE ? 'Earned ✓ (tap to undo)' : 'Mark earned'}</button></div>
    <h2>${esc(shownName(t))}</h2>
    <p class="official"><span class="off-label">Official description</span> “${esc(shownDesc(t))}”</p>
    <p class="pane-meta">${esc(KIND_LABELS[t.kind] ?? t.kind)} · Stage ${t.roadmapStage} — ${esc(STAGE_TITLES[t.roadmapStage])}${t.hidden ? ' · Hidden on PlayStation' : ''} · about ${esc(t.timeEstimate)} · difficulty ${t.difficulty}/5 · ${esc(confLabel)}</p>
    ${alert}${dispute}${counter}
    <h3>In short</h3><p>${esc(t.guide)}</p>
    <h3>How to get it — steps</h3><ol class="steps">${steps}</ol>
    <div class="notebox"><label for="note-text">Your notes for this trophy</label><textarea id="note-text" data-note="${t.id}" rows="3" placeholder="Your own reminders — saved in this browser only.">${esc(state.notes[t.id] ?? '')}</textarea></div>
    ${shielded(t) ? '<p class="shield-note">The spoiler shield is hiding this trophy\'s name and description until you earn it. The guide stays readable so you can still plan.</p>' : ''}`;
  const usage = new Map(DATA.sources.map((s) => [s.n, 0]));
  for (const x of DATA.trophies) for (const s of usedSources(x)) usage.set(s.n, usage.get(s.n) + 1);
  const used = usedSources(t);
  rail.innerHTML = `<h3>Sources · read ${esc(DATA.sourcesRead)}</h3>` + used.map((s) =>
    `<div class="src"><span class="src-n">[${s.n}]</span> <strong>${esc(s.label)}</strong> — ${esc(s.role)}<br><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a><br><span class="src-meta">cited by ${usage.get(s.n)} of 55 guides · backs: ${esc(s.backs)}</span></div>`).join('') +
    `<p class="rail-foot">This guide cites ${used.length} of the ${DATA.sources.length} sources. The full list and the 55 × ${DATA.sources.length} matrix are under Sources and Source Matrix.</p>`;
}

// ---------- secondary views ----------
function chipFor(t) {
  const isE = earned(state, t.id);
  return `<button type="button" class="vchip${isE ? ' earned' : ''}" data-open="${t.id}"><span class="grade g-${t.grade}">${t.grade[0].toUpperCase()}</span><span>${isE ? '✓ ' : ''}${esc(shownName(t))}</span>${t.missable ? '<span class="flag missable">MISSABLE</span>' : ''}${t.watch ? '<span class="flag watch">WATCH</span>' : ''}<span class="vchip-meta">${esc(t.timeEstimate)}</span></button>`;
}
function roadmapHtml() {
  const blocks = [1, 2, 3, 4, 5, 6, 7].map((stage) => {
    const inStage = roadmapSort(DATA.trophies.filter((t) => t.roadmapStage === stage));
    const done = inStage.filter((t) => earned(state, t.id)).length;
    const pct = inStage.length ? Math.round((done / inStage.length) * 100) : 0;
    const budget = inStage.filter((t) => t.grade !== 'platinum').reduce((s, t) => s + (t.timeMinutes || 0), 0);
    return `<section class="stage-block"><div class="s-head"><h3>Stage ${stage} — ${esc(STAGE_TITLES[stage])}</h3><span>${done}/${inStage.length} · ≈ ${fmtHours(budget)}</span></div><p class="s-blurb">${esc(STAGE_BLURBS[stage])}</p><div class="bar slim"><div class="bar-fill" style="width:${pct}%"></div></div><div class="vchips">${inStage.map(chipFor).join('')}</div></section>`;
  }).join('');
  return `<h2>Roadmap to the platinum</h2><p class="view-intro">Seven stages in the order the published roadmaps work them: story first with the one Chapter 1 missable handled inside it, then strands, collectibles, activities, and the crime-and-100% tail. Stage hour budgets come from the 100% Completion Planner. Every chip opens that trophy's cited guide.</p>${blocks}`;
}
function missablesHtml() {
  const flagged = DATA.trophies.filter((t) => t.missable || t.watch);
  const rows = flagged.map((t) => {
    const isE = earned(state, t.id);
    return `<article class="miss-card"><h3>${isE ? '✓ ' : ''}<button type="button" class="linklike" data-open="${t.id}">${esc(shownName(t))}</button> <span class="flag ${t.missable ? 'missable' : 'watch'}">${t.missable ? 'MISSABLE' : 'WATCH'}</span></h3><p class="official">“${esc(t.description)}” · ${t.grade} · ${esc(KIND_LABELS[t.kind] ?? t.kind)} · Stage ${t.roadmapStage}</p><p>${esc(t.alert ?? t.guide)}</p></article>`;
  }).join('');
  return `<h2>Missables &amp; watch list</h2><p class="view-intro">Every trophy that can be lost or that punishes bad timing, with the reason in its guide's own words. ${flagged.filter((t) => !earned(state, t.id)).length} of ${flagged.length} are still open in your run.</p>${rows}`;
}
function plannerHtml() {
  const list = plannerOrder(remainingList());
  if (!list.length) return '<h2>Next Up</h2><p class="view-intro">Everything is earned — the platinum is complete.</p>';
  let cum = 0;
  const rows = list.slice(0, 12).map((t, i) => {
    cum += t.timeMinutes || 0;
    return `<div class="plan-row"><span class="step-n">${i + 1}</span><button type="button" class="linklike" data-open="${t.id}">${esc(shownName(t))}</button><span class="plan-meta">${t.grade} · Stage ${t.roadmapStage} · about ${esc(t.timeEstimate)}${t.missable ? ' · <span class="flag missable">MISSABLE</span>' : ''} · cumulative ≈ ${fmtMins(cum)}</span></div>`;
  }).join('');
  return `<h2>Next Up — your route from here</h2><p class="view-intro">The remaining trophies in roadmap order, missables pulled to the front of their stage, with a running total of estimated time to the platinum. For a full hour budget by stage, open the 100% Planner; for a single evening's route, open Tonight's Session.</p>${rows}`;
}

// NEW IN V3 — the 100% Completion Planner: per-stage hour budgets that
// re-flow live as trophies are earned, plus a pace projection.
function completionHtml() {
  const playable = DATA.trophies.filter((t) => t.grade !== 'platinum');
  const total = playable.reduce((s, t) => s + (t.timeMinutes || 0), 0);
  const doneList = playable.filter((t) => earned(state, t.id));
  const done = doneList.reduce((s, t) => s + (t.timeMinutes || 0), 0);
  const left = total - done;
  const avgPer = doneList.length ? done / doneList.length : 0;
  const weeks = state.weeklyHours > 0 ? left / 60 / state.weeklyHours : 0;
  const projDate = new Date(Date.now() + weeks * 7 * 86400000);
  const projText = left === 0 ? 'complete' : `${weeks.toFixed(1)} weeks at ${state.weeklyHours} h/week → around ${projDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const rows = [1, 2, 3, 4, 5, 6, 7].map((stage) => {
    const inStage = playable.filter((t) => t.roadmapStage === stage);
    const stTotal = inStage.reduce((s, t) => s + (t.timeMinutes || 0), 0);
    const stDone = inStage.filter((t) => earned(state, t.id)).reduce((s, t) => s + (t.timeMinutes || 0), 0);
    const stLeft = stTotal - stDone;
    const pct = stTotal ? Math.round((stDone / stTotal) * 100) : 100;
    const note = stage === 7 ? 'Platinum itself — automatic, no hours of its own.' : `${inStage.filter((t) => earned(state, t.id)).length}/${inStage.length} trophies earned`;
    return `<tr><td><strong>Stage ${stage}</strong> — ${esc(STAGE_TITLES[stage])}<br><span class="plan-meta">${note}</span></td><td class="num">${fmtHours(stTotal)}</td><td class="num">${fmtHours(stDone)}</td><td class="num">${fmtHours(stLeft)}</td><td><div class="bar slim"><div class="bar-fill" style="width:${pct}%"></div></div></td></tr>`;
  }).join('');
  const nextStage = [1, 2, 3, 4, 5, 6].find((stage) => playable.some((t) => t.roadmapStage === stage && !earned(state, t.id)));
  return `<h2>100% Completion Planner — NEW IN V3</h2>
  <p class="view-intro">Every cited per-trophy time estimate in this guide, turned into a plan. Each roadmap stage gets an hour budget; the moment you tick a trophy off, its hours move from “left” to “done” and every figure on this page re-flows. No other view in this guide — and no top leaderboard sheet we inspected — budgets the run in hours per stage or projects a finish date from your own pace.</p>
  <div class="plan-cards">
    <div class="plan-card"><div class="pc-label">Total hours to platinum</div><div class="pc-big">${fmtHours(total)}</div><div class="plan-meta">Sum of the cited estimates for the 54 non-platinum trophies. The platinum's own estimate is the whole run, so it is not double-counted.</div></div>
    <div class="plan-card"><div class="pc-label">Hours done</div><div class="pc-big">${fmtHours(done)}</div><div class="plan-meta">${doneList.length} trophies earned${avgPer ? ` · your pace so far: ≈ ${fmtMins(Math.round(avgPer))} per trophy` : ''}</div></div>
    <div class="plan-card"><div class="pc-label">Hours left</div><div class="pc-big">${fmtHours(left)}</div><div class="plan-meta">${remainingList().length} trophies remaining${nextStage ? ` · current stage: Stage ${nextStage} — ${esc(STAGE_TITLES[nextStage])}` : ''}</div></div>
    <div class="plan-card"><div class="pc-label">Projected finish</div><div class="pc-big" style="font-size:21px">${esc(projText)}</div><div class="plan-meta"><label>Your pace: <input id="weekly-hours" type="number" min="1" max="80" step="1" value="${state.weeklyHours}" style="width:64px"> hours / week</label></div></div>
  </div>
  <table class="budget"><thead><tr><th>Roadmap stage</th><th class="num">Budget</th><th class="num">Done</th><th class="num">Left</th><th>Progress</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="view-intro">Estimates are the cited per-trophy figures shown in each guide (sources [1], [2] and [7] disagree on the grand total — 200 h vs 250 h+ — and that dispute is shown in full in the platinum's guide pane rather than hidden here).</p>`;
}

// NEW IN V3 — Tonight's Session: a chosen time budget becomes an ordered,
// stage-aware route for one sitting, drawn from the planner's hour data.
function sessionPlan() {
  const budget = Math.round(state.sessionHours * 60);
  const ordered = plannerOrder(remainingList());
  const picked = []; let used = 0;
  for (const t of ordered) {
    const cost = t.timeMinutes || 0;
    if (cost <= budget - used) { picked.push(t); used += cost; }
  }
  return { budget, picked, used };
}
function sessionHtml() {
  const { budget, picked, used } = sessionPlan();
  let cum = 0;
  const rows = picked.map((t, i) => {
    cum += t.timeMinutes || 0;
    return `<div class="plan-row"><span class="step-n">${i + 1}</span><button type="button" class="linklike" data-open="${t.id}">${esc(shownName(t))}</button><span class="plan-meta">${t.grade} · Stage ${t.roadmapStage} · about ${esc(t.timeEstimate)}${t.missable ? ' · <span class="flag missable">MISSABLE</span>' : ''}${t.watch ? ' · <span class="flag watch">WATCH</span>' : ''} · running total ≈ ${fmtMins(cum)}</span></div>`;
  }).join('');
  const skipped = plannerOrder(remainingList()).filter((t) => !picked.includes(t)).slice(0, 3);
  const skippedHtml = skipped.length ? `<p class="view-intro">Held for a longer session: ${skipped.map((t) => `${esc(shownName(t))} (about ${esc(t.timeEstimate)})`).join(' · ')} — each was next in roadmap order but does not fit tonight's remaining budget whole, so the route skips it instead of starting a trophy you cannot finish.</p>` : '';
  return `<h2>Tonight's Session — NEW IN V3</h2>
  <p class="view-intro">Give it one evening's worth of time and it builds tonight's route: trophies in roadmap order, missables pulled forward inside their stage, packed whole into your budget from the same cited hour estimates the 100% Planner uses. It re-builds itself the moment your checklist changes — earn something and tonight's route re-flows.</p>
  <div class="session-tools"><label>Time tonight: <input id="session-hours" type="number" min="0.5" max="16" step="0.5" value="${state.sessionHours}"> hours</label><span class="plan-meta">Budget ${fmtMins(budget)} · planned ${fmtMins(used)} · ${picked.length} ${picked.length === 1 ? 'trophy' : 'trophies'} fit whole</span></div>
  ${rows || '<p class="view-intro">Nothing left that fits — either the platinum is complete or every remaining trophy needs a longer sitting.</p>'}
  ${skippedHtml}`;
}

function journeyHtml() {
  const entries = state.order.filter((id) => byId(id) && earned(state, id));
  if (!entries.length) return '<h2>Journey</h2><p class="view-intro">Nothing earned yet. As you tick trophies off, they will be logged here in the order you earned them, with the day each one landed.</p>';
  const rows = entries.map((id, i) => {
    const t = byId(id);
    return `<div class="plan-row"><span class="step-n">${i + 1}</span><button type="button" class="linklike" data-open="${id}">${esc(t.name)}</button><span class="plan-meta">${t.grade} · earned ${esc(fmtDay(state.earned[id]))}</span></div>`;
  }).join('');
  return `<h2>Journey — ${entries.length} earned, in the order you earned them</h2>${rows}`;
}
function sourcesHtml() {
  const cards = DATA.sources.map((s) => {
    const usedBy = DATA.trophies.filter((t) => usedSources(t).includes(s)).length;
    return `<article class="src-card"><h3><span class="src-n">[${s.n}]</span> ${esc(s.label)}</h3><p class="src-role">${esc(s.role)} · read ${esc(DATA.sourcesRead)}</p><p><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a></p><p>Backs: ${esc(s.backs)}</p><p class="src-meta">Cited in ${usedBy} of 55 guides.</p></article>`;
  }).join('');
  const disputes = DATA.trophies.filter((t) => t.dispute).map((t) =>
    `<article class="src-card"><h3>${esc(t.name)} — ${esc(t.dispute.topic)}</h3><p><span class="d-side">A</span> ${esc(t.dispute.a)} <em>(${esc(t.dispute.aFrom)})</em></p><p><span class="d-side">B</span> ${esc(t.dispute.b)} <em>(${esc(t.dispute.bFrom)})</em></p></article>`).join('');
  return `<h2>Sources — read ${esc(DATA.sourcesRead)}</h2><p class="view-intro">Every fact in every guide traces to one of these ${DATA.sources.length} sources, cited by number beside the step it backs. Links open only when you follow them; the app itself fetches nothing.</p><div class="src-grid">${cards}</div><h2>Where the sources disagree</h2><p class="view-intro">Both versions are shown, in the guide pane and here. Nothing is silently averaged.</p><div class="src-grid">${disputes}</div>`;
}
function matrixFlag(t) {
  if (t.confidence === 'OPEN') return '<span class="flag open">OPEN</span>';
  if (t.dispute || t.confidence === 'DIFFER') return '<span class="flag dispute">DIFFER</span>';
  if (usedSources(t).length <= 1) return '<span class="flag single">1 SRC</span>';
  return '<span class="flag ok">OK</span>';
}
function matrixHtml() {
  const head = DATA.sources.map((s) => `<th title="${esc(s.label)}">[${s.n}]</th>`).join('');
  const rows = DATA.trophies.map((t) => {
    const cells = DATA.sources.map((s) => {
      const n = t.steps.filter((st) => st.cites.includes(s.n)).length;
      return `<td class="${n ? 'hit' : 'miss'}">${n || '·'}</td>`;
    }).join('');
    return `<tr><td class="m-name"><button type="button" class="linklike" data-open="${t.id}">${esc(t.name)}</button></td>${cells}<td>${matrixFlag(t)}</td></tr>`;
  }).join('');
  return `<h2>Source Matrix — 55 × ${DATA.sources.length}</h2><p class="view-intro">Each cell counts how many of the trophy's steps cite that source. Flags: <span class="flag ok">OK</span> backed by two or more sources, <span class="flag single">1 SRC</span> a single source, <span class="flag dispute">DIFFER</span> the sources disagree, <span class="flag open">OPEN</span> the trigger is not yet confirmed.</p><div class="matrix-wrap"><table class="matrix"><thead><tr><th>Trophy</th>${head}<th>Flag</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ---------- Platinum Card ----------
const CARD_W = 1200; const CARD_H = 630;
function barSvg(x, y, w, pct, colour) {
  const filled = Math.max(0, Math.min(w, Math.round((w * pct) / 100)));
  return `<rect x="${x}" y="${y}" width="${w}" height="14" rx="7" fill="#2b2350"/><rect x="${x}" y="${y}" width="${filled}" height="14" rx="7" fill="${colour}"/>`;
}
function cardSvg() {
  const total = DATA.trophies.length;
  const earnedList = DATA.trophies.filter((t) => earned(state, t.id));
  const got = earnedList.length;
  const pct = total ? Math.round((got / total) * 100) : 0;
  const rem = remainingList();
  const minsLeft = rem.reduce((s, t) => s + (t.timeMinutes || 0), 0);
  const next = plannerOrder(rem).slice(0, 3);
  const gradeLine = GRADE_ORDER.map((g) => `${g} ${earnedList.filter((t) => t.grade === g).length}/${DATA.trophies.filter((t) => t.grade === g).length}`).join('   ·   ');
  const kindRows = KIND_ORDER.map((k, i) => {
    const all = DATA.trophies.filter((t) => t.kind === k);
    if (!all.length) return '';
    const n = all.filter((t) => earned(state, t.id)).length;
    const y = 372 + i * 27;
    return `<text x="70" y="${y + 12}" font-size="17" fill="#cfc8ee">${esc(KIND_LABELS[k])}</text>${barSvg(250, y, 300, (n / all.length) * 100, '#ff5e8a')}<text x="566" y="${y + 12}" font-size="17" fill="#cfc8ee">${n}/${all.length}</text>`;
  }).join('');
  const nextRows = next.map((t, i) => `<text x="660" y="${396 + i * 34}" font-size="19" fill="#ffffff">${i + 1}. ${esc(t.name)}</text><text x="660" y="${418 + i * 34}" font-size="15" fill="#9d94c8">${t.grade} · stage ${t.roadmapStage} · about ${esc(t.timeEstimate)}</text>`).join('');
  const headline = got >= total ? 'PLATINUM EARNED' : `${got} OF ${total} TROPHIES`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
  <rect width="${CARD_W}" height="${CARD_H}" fill="#17122b"/><rect width="${CARD_W}" height="10" fill="#ff5e8a"/>
  <text x="70" y="92" font-family="Georgia, serif" font-size="44" fill="#ffffff">VICE LEDGER 3</text>
  <text x="70" y="128" font-size="19" fill="#9d94c8">GTA VI · PlayStation 5 · platinum progress card · ${esc(fmtDay(todayIso()))}</text>
  <text x="70" y="238" font-family="Georgia, serif" font-size="76" fill="#ffb52e">${headline}</text>
  <text x="70" y="292" font-size="26" fill="#ffffff">${pct}% of the official list</text>
  ${barSvg(70, 312, 1060, pct, '#ffb52e')}
  <text x="70" y="352" font-size="19" fill="#cfc8ee">${esc(gradeLine)}</text>
  ${kindRows}
  <text x="660" y="360" font-size="17" fill="#9d94c8">NEXT UP ON THE ROUTE</text>
  ${nextRows || '<text x="660" y="396" font-size="19" fill="#ffffff">Nothing left — run complete.</text>'}
  <text x="660" y="530" font-size="19" fill="#cfc8ee">Estimated time to platinum: ${got >= total ? 'done' : 'about ' + esc(fmtMins(minsLeft))}</text>
  <text x="70" y="592" font-size="15" fill="#9d94c8">Unofficial fan tracker · guides cited from 8 published sources · progress stored only in the player's browser</text>
</svg>`;
}
function cardHtml() {
  return `<h2>Platinum Card — share your run</h2><p class="view-intro">A summary card of your platinum progress, drawn in your browser from your saved progress: earned count, grade split, per-kind completion, the next trophies on your route and the estimated time left. Download it as a PNG for posting, or as an SVG. Nothing is uploaded.</p><div class="card-preview">${cardSvg()}</div><div class="card-actions"><button type="button" id="btn-card-png">Download PNG</button><button type="button" id="btn-card-svg">Download SVG</button></div>`;
}
function downloadFile(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------- rendering / wiring ----------
const VIEW_RENDERERS = {
  roadmap: () => { $('view-roadmap').innerHTML = roadmapHtml(); },
  missables: () => { $('view-missables').innerHTML = missablesHtml(); },
  planner: () => { $('view-planner').innerHTML = plannerHtml(); },
  completion: () => { $('view-completion').innerHTML = completionHtml(); },
  session: () => { $('view-session').innerHTML = sessionHtml(); },
  journey: () => { $('view-journey').innerHTML = journeyHtml(); },
  sources: () => { $('view-sources').innerHTML = sourcesHtml(); },
  matrix: () => { $('view-matrix').innerHTML = matrixHtml(); },
  card: () => { $('view-card').innerHTML = cardHtml(); },
};
function renderView() {
  document.querySelectorAll('#tabs [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === ui.view));
  document.querySelectorAll('main .view').forEach((v) => { v.hidden = v.id !== `view-${ui.view}`; });
  if (ui.view === 'checklist') renderChecklist();
  else if (VIEW_RENDERERS[ui.view]) VIEW_RENDERERS[ui.view]();
}
function renderAll() { renderDashboard(); renderView(); }
function persist() { saveState(state); renderAll(); }

async function boot() {
  const res = await fetch('data/trophies.json');
  if (!res.ok) throw new Error(`trophies.json: HTTP ${res.status}`);
  DATA = await res.json();
  renderAll();

  document.addEventListener('click', (ev) => {
    const open = ev.target.closest('[data-open]');
    if (open) { ui.selectedId = Number(open.dataset.open); ui.view = 'checklist'; renderAll(); window.scrollTo({ top: 0 }); return; }
    const mark = ev.target.closest('[data-mark]');
    if (mark) { toggleEarned(state, Number(mark.dataset.mark)); persist(); return; }
    const countBtn = ev.target.closest('[data-count]');
    if (countBtn) {
      const t = byId(ui.selectedId);
      if (t && t.track) {
        const step = t.track.target >= 10000 ? 500 : 1;
        const next = Math.max(0, (state.counts[t.id] ?? 0) + Number(countBtn.dataset.count) * step);
        if (next === 0) delete state.counts[t.id]; else state.counts[t.id] = next;
        persist();
      }
      return;
    }
    const chip = ev.target.closest('[data-kind]');
    if (chip) { ui.kind = chip.dataset.kind; renderChecklist(); return; }
    const stage = ev.target.closest('[data-stage]');
    if (stage) {
      ui.sort = 'roadmap'; $('sort-order').value = 'roadmap';
      const first = DATA.trophies.find((t) => t.roadmapStage === Number(stage.dataset.stage));
      if (first) ui.selectedId = first.id;
      ui.view = 'checklist'; renderAll(); return;
    }
    const tab = ev.target.closest('#tabs [data-view]');
    if (tab) { ui.view = tab.dataset.view; renderView(); return; }
    if (ev.target.id === 'btn-card-svg') downloadFile('vice-ledger-3-platinum-card.svg', new Blob([cardSvg()], { type: 'image/svg+xml' }));
    if (ev.target.id === 'btn-card-png') {
      const url = URL.createObjectURL(new Blob([cardSvg()], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = CARD_W; canvas.height = CARD_H;
        canvas.getContext('2d').drawImage(img, 0, 0, CARD_W, CARD_H);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => { if (blob) downloadFile('vice-ledger-3-platinum-card.png', blob); }, 'image/png');
      };
      img.src = url;
    }
  });

  document.addEventListener('change', (ev) => {
    const earnBox = ev.target.closest('[data-earn]');
    if (earnBox) { toggleEarned(state, Number(earnBox.dataset.earn)); persist(); return; }
    if (ev.target.id === 'weekly-hours') {
      const v = Number(ev.target.value);
      if (Number.isFinite(v) && v > 0) { state.weeklyHours = v; saveState(state); $('view-completion').innerHTML = completionHtml(); }
      return;
    }
    if (ev.target.id === 'session-hours') {
      const v = Number(ev.target.value);
      if (Number.isFinite(v) && v > 0) { state.sessionHours = v; saveState(state); $('view-session').innerHTML = sessionHtml(); }
    }
  });

  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'search') { ui.query = ev.target.value; renderChecklist(); return; }
    const note = ev.target.closest('[data-note]');
    if (note) {
      const id = Number(note.dataset.note);
      if (note.value.trim()) state.notes[id] = note.value; else delete state.notes[id];
      saveState(state);
    }
  });

  $('grade-filter').addEventListener('change', (ev) => { ui.grade = ev.target.value; renderChecklist(); });
  $('sort-order').addEventListener('change', (ev) => { ui.sort = ev.target.value; renderChecklist(); });
  $('hide-earned').addEventListener('change', (ev) => { ui.hideEarned = ev.target.checked; renderChecklist(); });
  $('spoilers').checked = state.spoilers;
  $('spoilers').addEventListener('change', (ev) => { state.spoilers = ev.target.checked; persist(); });

  $('btn-export').addEventListener('click', () => downloadFile('vice-ledger-3-progress.json', new Blob([exportJson(state)], { type: 'application/json' })));
  $('btn-import').addEventListener('click', () => $('file-import').click());
  $('file-import').addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const next = importJson(await file.text());
    if (next) { state = next; $('spoilers').checked = state.spoilers; persist(); }
    ev.target.value = '';
  });
  $('btn-reset').addEventListener('click', () => {
    if (window.confirm('Reset all VICE LEDGER 3 progress in this browser?')) { state = blankState(); $('spoilers').checked = false; persist(); }
  });
}

boot().catch((err) => {
  document.querySelector('main').innerHTML = `<p class="empty">Could not load the trophy data: ${esc(err.message)}</p>`;
});
