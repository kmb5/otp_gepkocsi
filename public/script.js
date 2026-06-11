'use strict';

const API   = '/check/';
const DELAY       = 250;             // ms between requests
const RETRY_DELAY = 3000;            // ms to wait after a 429
const MAX         = 20;              // max IDs per run
const STORAGE_KEY = 'otp-gepkocsi-ids';

let checking = false;

// ── DOM refs ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = {
  input:    $('ids-input'),
  badge:    $('count-badge'),
  checkBtn: $('check-btn'),
  warnBox:  $('warn-box'),
  progCard: $('progress-card'),
  pFill:    $('p-fill'),
  pFrac:    $('p-frac'),
  sDot:     $('s-dot'),
  sMsg:     $('s-msg'),
  summary:  $('summary'),
  sumCar:   $('sum-car'),
  sumCash:  $('sum-cash'),
  sumTotal: $('sum-total'),
  sumErrs:  $('sum-errors'),
  results:  $('results'),
  resetBtn: $('reset-btn'),
  copyBtn:  $('copy-btn'),
};

// ── Helpers ────────────────────────────────────────────────────────
function parseIds(text) {
  // Deduplicate, require 6–12 digit strings
  return [...new Set(
    text
      .split(/[\n,;\s]+/)
      .map(s => s.trim())
      .filter(s => /^\d{6,12}$/.test(s))
  )];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── URL & persistence ────────────────────────────────────────────
function updateUrl(ids) {
  const url = new URL(window.location);
  if (ids.length > 0) {
    url.searchParams.set('ids', ids.join(','));
  } else {
    url.searchParams.delete('ids');
  }
  history.replaceState(null, '', url);
}

function loadSaved() {
  // URL params take priority over localStorage
  const fromUrl = new URLSearchParams(window.location.search).get('ids');
  if (fromUrl) {
    el.input.value = fromUrl.split(',').join('\n');
    refreshCounter();
    return;
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    el.input.value = saved;
    refreshCounter();
  }
}

// ── Per-ID fetch with 429 retry ─────────────────────────────────────
async function checkOne(id, attempt = 0) {
  const res = await fetch(`${API}${id}`);
  if (res.status === 429) {
    if (attempt < 2) {
      setStatus(`Rate limit — várakozás ${RETRY_DELAY / 1000}s…`, true);
      await sleep(RETRY_DELAY);
      return checkOne(id, attempt + 1);
    }
    throw new Error('Rate limit elérve — próbáld újra később');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(window.location.href);
  } catch {
    // Fallback for non-HTTPS / older browsers
    const ta = Object.assign(document.createElement('textarea'), {
      value: window.location.href,
      style: 'position:fixed;opacity:0',
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  const label = el.copyBtn.querySelector('.copy-label');
  el.copyBtn.classList.add('copied');
  label.textContent = 'Másolva!';
  setTimeout(() => {
    el.copyBtn.classList.remove('copied');
    label.textContent = 'URL másolása';
  }, 2000);
}

function fmtDate(str) {
  if (!str) return null;
  try {
    return new Date(str).toLocaleDateString('hu-HU', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch { return str; }
}

/**
 * Classify an API response into one of three outcomes:
 *   'car'   – won, car details present (can still receive the car)
 *   'cash'  – won, but no car details (older win → cash equivalent)
 *   'lost'  – did not win
 */
function classify(data) {
  if (!data.sweepstakes || data.sweepstakes.length === 0) return 'lost';
  const sw = data.sweepstakes[0];
  return (sw.carType && sw.carType.trim() !== '') ? 'car' : 'cash';
}

// ── Inline SVGs ────────────────────────────────────────────────────
const SVG = {
  clock: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="6" cy="6" r="4.5" stroke="#3a5e3e" stroke-width="1.2"/>
    <path d="M6 3.5V6l1.5 1.5" stroke="#3a5e3e" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,

  checkGreen: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2.5 6l2.5 2.5 4.5-5" stroke="#4ade80" stroke-width="1.6"
      stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  checkAmber: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2.5 6l2.5 2.5 4.5-5" stroke="#fbbf24" stroke-width="1.6"
      stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  cross: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="#2d4a30" stroke-width="1.2"
      stroke-linecap="round"/>
  </svg>`,

  warn: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M5.13 2.3a1 1 0 011.74 0l4 7A1 1 0 0110 11H2a1 1 0 01-.87-1.5l4-7z"
      stroke="#f87171" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M6 5v2.5M6 9v.4" stroke="#f87171" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,

  spinner: `<div class="spin"></div>`,
};

// ── Counter refresh ────────────────────────────────────────────────
function refreshCounter() {
  const ids = parseIds(el.input.value);
  const n   = ids.length;
  el.badge.textContent = `${n} / ${MAX}`;
  el.badge.className   = n === 0 ? 'count-badge' : n > MAX ? 'count-badge warn' : 'count-badge active';
  el.warnBox.classList.toggle('show', n > MAX);
  el.checkBtn.disabled = n === 0 || checking;
  el.copyBtn.disabled  = n === 0;
  updateUrl(ids);
}

// ── Create a result row (pending state) ────────────────────────────
function makeRow(id, delay) {
  const div = document.createElement('div');
  div.className = 'ri';
  div.id = `ri-${id}`;
  div.style.animationDelay = `${delay}ms`;
  div.setAttribute('role', 'listitem');
  div.innerHTML = `
    <div class="ri-icon">${SVG.clock}</div>
    <div class="ri-body">
      <div class="ri-id">${id}</div>
      <div class="ri-detail"></div>
    </div>
    <div class="ri-badge">várakozás</div>
  `;
  return div;
}

// ── Update a result row ────────────────────────────────────────────
function setRow(id, state, payload) {
  const row = $(`ri-${id}`);
  if (!row) return;

  row.className = `ri s-${state}`;

  const icon   = row.querySelector('.ri-icon');
  const detail = row.querySelector('.ri-detail');
  const badge  = row.querySelector('.ri-badge');

  switch (state) {

    case 'checking':
      icon.innerHTML    = SVG.spinner;
      badge.textContent = 'ellenőrzés…';
      break;

    case 'car': {
      icon.innerHTML    = SVG.checkGreen;
      badge.textContent = 'NYERTES · AUTÓ';
      const sw = payload?.sweepstakes?.[0];
      const dateStr = sw?.lotDate ? fmtDate(sw.lotDate) : null;
      detail.innerHTML = [
        `<strong>${sw?.carType}</strong>`,
        dateStr ? `Sorsolás dátuma: ${dateStr}` : null,
      ].filter(Boolean).join('<br>');
      break;
    }

    case 'cash':
      icon.innerHTML    = SVG.checkAmber;
      badge.textContent = 'NYERTES · KÉSZPÉNZ';
      detail.innerHTML  =
        'A sorsolás régebbi keletű — a nyeremény <strong>készpénzben igényelhető</strong> az OTP Banknál.';
      break;

    case 'lost':
      icon.innerHTML    = SVG.cross;
      badge.textContent = 'nem nyert';
      detail.textContent = 'Ez az azonosító sajnos nem nyertes.';
      break;

    case 'error':
      icon.innerHTML    = SVG.warn;
      badge.textContent = 'hiba';
      detail.textContent = payload?.msg || 'Hálózati hiba — próbáld újra.';
      break;
  }
}

// ── Status bar helpers ─────────────────────────────────────────────
function setStatus(msg, alive = false) {
  el.sMsg.textContent = msg;
  el.sDot.className   = `s-dot${alive ? ' alive' : ''}`;
}

function setProgress(done, total) {
  el.pFrac.textContent = `${done} / ${total}`;
  el.pFill.style.width = `${(done / total) * 100}%`;
}

// ── Main check loop ────────────────────────────────────────────────
async function runCheck() {
  if (checking) return;

  const ids = parseIds(el.input.value).slice(0, MAX);
  if (!ids.length) return;

  localStorage.setItem(STORAGE_KEY, ids.join('\n'));
  checking = true;
  el.checkBtn.disabled = true;

  // Reset previous state
  el.results.innerHTML = '';
  el.summary.classList.remove('show');
  el.resetBtn.classList.remove('show');

  // Show progress bar
  el.progCard.classList.add('show');
  setProgress(0, ids.length);
  setStatus('Elindítás…', false);

  // Pre-render all rows so the user sees the full queue
  ids.forEach((id, i) => el.results.appendChild(makeRow(id, i * 35)));

  let carWins = 0, cashWins = 0, errors = 0;

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];

    // Rate-limit pause between requests
    if (i > 0) {
      setStatus(`Kérések közötti szünet… (${(DELAY / 1000).toFixed(1)} s)`, true);
      await sleep(DELAY);
    }

    setRow(id, 'checking');
    setStatus(`Ellenőrzés: ${id}`, true);

    try {
      const data    = await checkOne(id);
      const outcome = classify(data);

      if      (outcome === 'car')  { carWins++;  setRow(id, 'car',  data); }
      else if (outcome === 'cash') { cashWins++; setRow(id, 'cash', data); }
      else                         {             setRow(id, 'lost', data); }

    } catch (err) {
      errors++;
      setRow(id, 'error', {
        msg: err instanceof TypeError
          ? 'CORS-hiba vagy hálózati probléma — ellenőrizd a kapcsolatot.'
          : err.message,
      });
    }

    setProgress(i + 1, ids.length);
  }

  // Done
  setStatus(`Kész — ${ids.length} azonosító ellenőrizve.`, false);

  el.sumCar.textContent   = carWins;
  el.sumCash.textContent  = cashWins;
  el.sumTotal.textContent = ids.length;
  el.sumErrs.textContent  = errors;
  el.summary.classList.add('show');

  checking = false;
  el.resetBtn.classList.add('show');
}

// ── Reset ──────────────────────────────────────────────────────────
function doReset() {
  el.input.value = '';
  el.results.innerHTML = '';
  el.progCard.classList.remove('show');
  el.summary.classList.remove('show');
  el.resetBtn.classList.remove('show');
  history.replaceState(null, '', window.location.pathname);
  refreshCounter();
  el.input.focus();
}

// ── Events ─────────────────────────────────────────────────────────
el.input.addEventListener('input', refreshCounter);
el.checkBtn.addEventListener('click', runCheck);
el.resetBtn.addEventListener('click', doReset);
el.copyBtn.addEventListener('click', copyUrl);

// Ctrl/Cmd+Enter to submit from textarea
el.input.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !el.checkBtn.disabled) {
    runCheck();
  }
});

loadSaved();
