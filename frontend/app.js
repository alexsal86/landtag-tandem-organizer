async function fetchIndex() {
  // Erst versuchen: sessions_index.json
  try {
    const res = await fetch('../data/sessions_index.json', { cache: 'no-store' });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}
  // Fallback: heuristisch (nicht ideal – optional)
  return { sessions: [] };
}

const state = {
  index: null,
  currentSession: null,
  currentSessionData: null,
  filter: {
    search: '',
    party: '',
    role: '',
    onlySpeakerLines: false,
  }
};

const el = (sel) => document.querySelector(sel);

document.addEventListener('DOMContentLoaded', init);

async function init() {
  state.index = await fetchIndex();
  renderSessionList();
}

function renderSessionList() {
  const container = el('#session-list');
  container.innerHTML = '';
  if (!state.index.sessions || !state.index.sessions.length) {
    container.innerHTML = '<div class="loading">Keine sessions_index.json gefunden oder leer.</div>';
    return;
  }
  state.index.sessions
    .sort((a,b) => {
      if (a.legislative_period === b.legislative_period) {
        return (a.number || 0) - (b.number || 0);
      }
      return (a.legislative_period||0) - (b.legislative_period||0);
    })
    .forEach(sess => {
      const div = document.createElement('div');
      div.className = 'session-item';
      div.innerHTML = `
        <div><strong>${sess.legislative_period || '?'} / ${sess.number || '?'}</strong> – ${sess.date || '???'}</div>
        <div class="small">Reden: ${sess.speeches ?? '-'} | Seiten: ${sess.pages ?? '-'}</div>
      `;
      div.addEventListener('click', () => loadSession(sess));
      container.appendChild(div);
    });
}

async function loadSession(meta) {
  if (state.currentSession === meta.file) return;
  state.currentSession = meta.file;
  markActive(meta.file);
  const url = '../data/' + meta.file;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    alert('Fehler beim Laden der Session-Datei: ' + meta.file);
    return;
  }
  state.currentSessionData = await res.json();
  buildPartyFilterOptions();
  renderSessionMeta();
  renderSpeeches();
  setupControls();
}

function markActive(file) {
  document.querySelectorAll('.session-item').forEach(div => {
    if (div.innerHTML.includes(file)) { // naive
      div.classList.add('active');
    } else {
      div.classList.remove('active');
    }
  });
}

function renderSessionMeta() {
  const d = state.currentSessionData;
  const metaEl = el('#session-meta');
  const sess = d.session || {};
  const stats = d.stats || {};
  metaEl.innerHTML = `
    <h2>Sitzung ${sess.legislative_period || '?'} / ${sess.number || '?'} – ${sess.date || 'unbekannt'}</h2>
    <div class="meta-grid">
      <div><strong>URL:</strong><br>${escapeHtml(sess.source_pdf_url || '-')}</div>
      <div><strong>Extrahiert:</strong><br>${escapeHtml(sess.extracted_at || '-')}</div>
      <div><strong>Reden:</strong><br>${stats.speeches ?? '-'}</div>
      <div><strong>Seiten:</strong><br>${stats.pages ?? '-'}</div>
    </div>
  `;
}

function buildPartyFilterOptions() {
  const select = el('#party-filter');
  const speeches = state.currentSessionData?.speeches || [];
  const parties = new Set();
  speeches.forEach(s => {
    const p = s.speaker?.party;
    if (p) parties.add(p);
  });
  const existing = [...select.querySelectorAll('option')].map(o => o.value);
  parties.forEach(p => {
    if (!existing.includes(p)) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.innerText = p;
      select.appendChild(opt);
    }
  });
}

function setupControls() {
  const controls = el('#controls');
  controls.classList.remove('hidden');
  el('#search').oninput = (e) => {
    state.filter.search = e.target.value.trim().toLowerCase();
    renderSpeeches();
  };
  el('#party-filter').onchange = (e) => {
    state.filter.party = e.target.value;
    renderSpeeches();
  };
  el('#role-filter').onchange = (e) => {
    state.filter.role = e.target.value;
    renderSpeeches();
  };
  el('#only-speaker-lines').onchange = (e) => {
    state.filter.onlySpeakerLines = e.target.checked;
    renderSpeeches();
  };
  el('#reset-filters').onclick = () => {
    state.filter = { search: '', party: '', role: '', onlySpeakerLines: false };
    el('#search').value = '';
    el('#party-filter').value = '';
    el('#role-filter').value = '';
    el('#only-speaker-lines').checked = false;
    renderSpeeches();
  };
  el('#copy-json').onclick = copyCurrentJson;
}

function copyCurrentJson() {
  if (!state.currentSessionData) return;
  const text = JSON.stringify(state.currentSessionData, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    el('#copy-json').innerText = 'Kopiert!';
    setTimeout(() => el('#copy-json').innerText = 'Copy JSON', 1500);
  });
}

function renderSpeeches() {
  const container = el('#speeches-container');
  container.innerHTML = '';
  const data = state.currentSessionData;
  if (!data) return;
  const speeches = data.speeches || [];
  let filtered = speeches;

  const { search, party, role } = state.filter;
  if (party) {
    filtered = filtered.filter(s => (s.speaker?.party || '') === party);
  }
  if (role) {
    filtered = filtered.filter(s => (s.speaker?.role || '') === role);
  }
  if (search) {
    filtered = filtered.filter(s => {
      const full = (s.text || '') + ' ' + (s.speaker?.raw || '');
      return full.toLowerCase().includes(search);
    });
  }

  updateStats(filtered, speeches.length);

  filtered.forEach(s => {
    const div = document.createElement('div');
    div.className = 'speech';

    const partyCls = s.speaker?.party ? `party-badge ${cssSafe(s.speaker.party)}` : '';
    const partyHtml = s.speaker?.party ? `<span class="party-badge ${partyCls}">${escapeHtml(s.speaker.party)}</span>` : '';
    const roleHtml = s.speaker?.role ? `<span class="speaker-role">${escapeHtml(s.speaker.role)}</span>` : '';
    const pages = (s.start_page && s.end_page)
      ? (s.start_page === s.end_page ? `${s.start_page}` : `${s.start_page}-${s.end_page}`)
      : '?';

    let bodyText = s.text || '';
    // Annotationen am Ende hinzufügen (oder separat)
    if (s.annotations && s.annotations.length) {
      const ann = s.annotations.map(a => `[${a.type}] ${a.text}`).join('\n');
      bodyText += `\n\n${ann}`;
    }

    const speakerLine = escapeHtml(s.speaker?.raw || 'Unbekannt');
    const preContent = state.filter.onlySpeakerLines ? '' : escapeHtml(bodyText);

    div.innerHTML = `
      <div class="speech-header">
        <span class="speaker-name">${speakerLine}</span>
        ${roleHtml}
        ${partyHtml}
        <span class="speech-pages">Seiten: ${pages}</span>
        <span class="speech-pages">#${s.index}</span>
      </div>
      <pre>${preContent}</pre>
    `;
    container.appendChild(div);
  });
}

function updateStats(filtered, total) {
  const statsBar = el('#stats-bar');
  statsBar.innerHTML = `
    <div>Gefiltert: ${filtered.length} / ${total}</div>
    <div>Suchbegriff: ${state.filter.search ? escapeHtml(state.filter.search) : '—'}</div>
    <div>Partei: ${state.filter.party || 'alle'}</div>
    <div>Rolle: ${state.filter.role || 'alle'}</div>
  `;
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function cssSafe(str) {
  return String(str).replace(/[^A-Za-z0-9_-]/g, '_');
}
