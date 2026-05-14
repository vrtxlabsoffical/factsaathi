const BACKEND = 'https://factsaathi-backend.onrender.com/verify';
let currentTab = 'all';

const TAB_TITLES = {
  all:      '📋 All Scanned Messages',
  verified: '✅ Real News — Verified Messages',
  fake:     '❌ Fake News — False & Misleading Messages'
};

function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderReport(checks) {
  const filtered = currentTab === 'all'
    ? checks
    : currentTab === 'fake'
      ? checks.filter(c => c.type === 'fake' || c.type === 'misleading')
      : checks.filter(c => c.type === 'verified');

  document.getElementById('reportTitle').textContent  = TAB_TITLES[currentTab];
  document.getElementById('reportCount').textContent  = `${filtered.length} message${filtered.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('reportBody');
  if (filtered.length === 0) {
    const emptyMsg = currentTab === 'fake'
      ? 'No fake or misleading messages detected yet.'
      : currentTab === 'verified'
        ? 'No verified real news detected yet.'
        : 'No messages checked yet.<br/>Open <strong>WhatsApp Web</strong> — messages will be auto fact-checked.';
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">${currentTab==='fake'?'🚫':currentTab==='verified'?'✅':'💬'}</div><p>${emptyMsg}</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((c, i) => {
    const chipClass = c.type === 'verified' ? 'chip-verified' : c.type === 'fake' ? 'chip-fake' : 'chip-misleading';
    const chipLabel = c.type === 'verified' ? '✅ Real' : c.type === 'fake' ? '❌ Fake' : '⚠️ Misleading';
    return `<tr>
      <td class="td-num">${filtered.length - i}</td>
      <td class="td-msg">${escHtml(c.text)}</td>
      <td class="td-verdict">${escHtml(c.verdict)}</td>
      <td><span class="chip ${chipClass}">${chipLabel}</span></td>
      <td class="td-time">${c.time}</td>
    </tr>`;
  }).join('');
}

function loadDashboard() {
  chrome.storage.local.get(['checks','scanned','warnings','threats'], (data) => {
    const checks   = data.checks   || [];
    const scanned  = data.scanned  || 0;
    const warnings = data.warnings || 0;
    const threats  = data.threats  || 0;
    const verified = Math.max(0, scanned - warnings - threats);
    const fakeTotal = warnings + threats;

    document.getElementById('dScanned').textContent  = scanned;
    document.getElementById('dVerified').textContent = verified;
    document.getElementById('dThreats').textContent  = fakeTotal;
    document.getElementById('lastUpdated').textContent =
      'Updated ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});

    renderReport(checks);
  });
}

// TAB CLICKS on stat cards
document.querySelectorAll('.stat-card').forEach(card => {
  card.addEventListener('click', () => {
    currentTab = card.dataset.tab;
    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('tab-active'));
    card.classList.add('tab-active');
    loadDashboard();
  });
});

// BACKEND STATUS
function checkBackend() {
  const el = document.getElementById('backendStatus');
  const tl = document.getElementById('tavilyStatus');
  fetch('https://https://factsaathi-backend.onrender.com/docs', { signal: AbortSignal.timeout(2000) })
    .then(() => {
      el.className='status-on'; el.textContent='● CONNECTED';
      tl.className='status-on'; tl.textContent='● CONNECTED';
    })
    .catch(() => {
      el.className='status-off'; el.textContent='● OFFLINE';
      tl.className='status-off'; tl.textContent='● OFFLINE';
    });
}

// MANUAL VERIFY
document.getElementById('verifyBtn').addEventListener('click', () => {
  const input = document.getElementById('verifyInput').value.trim();
  if (!input) return;

  const btn = document.getElementById('verifyBtn');
  const box = document.getElementById('resultBox');
  btn.disabled = true;
  btn.textContent = '⏳ Verifying...';
  box.className = 'result-box show loading';
  document.getElementById('resultVerdict').textContent = 'Checking with AI...';
  document.getElementById('resultExplanation').textContent = '';

  fetch(BACKEND, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ text: input }),
    signal: AbortSignal.timeout(12000)
  })
  .then(r => r.json())
  .then(data => {
    const verdict = (data.verdict || '').toLowerCase();
    let type = 'verified';
    if (verdict.includes('fake')||verdict.includes('false')||verdict.includes('hoax')||verdict.includes('❌')||verdict.includes('not true')||verdict.includes('no evidence')||verdict.includes('debunked')) type='fake';
    else if (verdict.includes('misleading')||verdict.includes('partially')||verdict.includes('⚠️')||verdict.includes('disputed')||verdict.includes('unverified')) type='misleading';

    const lines = (data.verdict||'').split('\n').filter(Boolean);
    box.className = `result-box show ${type}`;
    document.getElementById('resultVerdict').textContent = lines[0]||data.verdict||'';
    document.getElementById('resultExplanation').textContent = lines.slice(1).join(' ').replace(/\*\*/g,'');

    const entry = {
      text: input.substring(0,120),
      verdict: (lines[0]||'').replace(/\*\*/g,'').substring(0,100),
      type,
      time: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
      timestamp: Date.now()
    };

    chrome.storage.local.get(['checks','scanned','warnings','threats'], (d) => {
      const checks   = d.checks   || [];
      const scanned  = (d.scanned  || 0) + 1;
      const warnings = (d.warnings || 0) + (type==='misleading'?1:0);
      const threats  = (d.threats  || 0) + (type==='fake'?1:0);
      checks.unshift(entry);
      if (checks.length > 100) checks.pop();
      chrome.storage.local.set({checks,scanned,warnings,threats}, loadDashboard);
    });

    btn.disabled=false; btn.textContent='🔍 Verify Now';
  })
  .catch(() => {
    box.className='result-box show loading';
    document.getElementById('resultVerdict').textContent='Backend offline. Start the server first.';
    btn.disabled=false; btn.textContent='🔍 Verify Now';
  });
});

// RESET
document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Clear all fact-check history?')) return;
  chrome.storage.local.clear(loadDashboard);
});

loadDashboard();
checkBackend();
setInterval(loadDashboard, 4000);
setInterval(checkBackend, 15000);
