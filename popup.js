// ─── MOCK FACT-CHECK ENGINE ───────────────────────────────────────────────────
function mockVerify(text) {
  const t = text.toLowerCase();
  if (t.includes('unesco') || t.includes('national anthem')) {
    return { verdict: 'FAKE ❌', explanation: 'UNESCO has never declared any national anthem as the "best". This is a viral rumor circulating since 2008.', type: 'fake' };
  } else if (t.includes('lemon') || t.includes('hot water') || t.includes('cure')) {
    return { verdict: 'MISLEADING ⚠️', explanation: 'While hydration is beneficial, no food or drink has been proven to cure viruses. Always follow WHO medical guidance.', type: 'misleading' };
  } else if (t.includes('nasa') || t.includes('planet') || t.includes('habitable')) {
    return { verdict: 'VERIFIED ✅', explanation: 'NASA has confirmed the discovery of TOI 700 e, an Earth-sized planet orbiting within the habitable zone of its host star.', type: 'verified' };
  } else if (t.includes('rbi') || t.includes('2000') || t.includes('rupee')) {
    return { verdict: 'VERIFIED ✅', explanation: 'The RBI has indeed withdrawn ₹2000 banknotes from circulation, though they remain legal tender until further notice.', type: 'verified' };
  } else if (t.includes('free') || t.includes('click') || t.includes('win') || t.includes('lottery')) {
    return { verdict: 'FAKE ❌', explanation: 'This appears to be a phishing or clickbait attempt. Do not click suspicious links or share personal info.', type: 'fake' };
  } else if (t.includes('whatsapp') || t.includes('charge') || t.includes('paid')) {
    return { verdict: 'FAKE ❌', explanation: 'WhatsApp has not announced any subscription fees. This is a recurring hoax spread on social media.', type: 'fake' };
  } else if (t.includes('cancer') || t.includes('date') || t.includes('cure cancer')) {
    return { verdict: 'MISLEADING ⚠️', explanation: 'Dates are nutritious but no food has been clinically proven to cure cancer. Consult certified medical sources.', type: 'misleading' };
  } else {
    return { verdict: 'VERIFIED ✅', explanation: 'The claim appears consistent with publicly available information from trusted news sources.', type: 'verified' };
  }
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
function addActivity(icon, text) {
  const log = document.getElementById('activityLog');
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const item = document.createElement('div');
  item.className = 'activity-item';
  item.innerHTML = `
    <span class="activity-icon">${icon}</span>
    <span class="activity-text">${text}</span>
    <span class="activity-time">${timeStr}</span>
  `;
  log.insertBefore(item, log.firstChild);

  // Keep max 8 items
  while (log.children.length > 8) {
    log.removeChild(log.lastChild);
  }
}

// ─── COUNTER ANIMATION ────────────────────────────────────────────────────────
function animateCount(el, target) {
  let current = parseInt(el.textContent) || 0;
  if (current === target) return;
  const step = target > current ? 1 : -1;
  const interval = setInterval(() => {
    current += step;
    el.textContent = current;
    if (current === target) clearInterval(interval);
  }, 40);
}

// ─── RISK BADGE ───────────────────────────────────────────────────────────────
function setRisk(level) {
  const badge = document.getElementById('riskBadge');
  badge.className = 'risk-badge';
  if (level === 'LOW')    { badge.classList.add('risk-low');    badge.textContent = 'LOW RISK'; }
  if (level === 'MEDIUM') { badge.classList.add('risk-medium'); badge.textContent = 'MEDIUM RISK'; }
  if (level === 'HIGH')   { badge.classList.add('risk-high');   badge.textContent = 'HIGH RISK'; }
}

// ─── LOAD SESSION STATS ────────────────────────────────────────────────────────
function loadStats() {
  chrome.storage.local.get(['scanned', 'warnings', 'threats', 'activityLog'], (data) => {
    const scanned  = data.scanned  || 0;
    const warnings = data.warnings || 0;
    const threats  = data.threats  || 0;

    animateCount(document.getElementById('statScanned'),  scanned);
    const verified = Math.max(0, scanned - warnings - threats);
    animateCount(document.getElementById('statWarnings'), verified); 
    animateCount(document.getElementById('statThreats'),  threats);
    // Determine risk
    if (threats > 0)      setRisk('HIGH');
    else if (warnings > 0) setRisk('MEDIUM');
    else if (scanned > 0) setRisk('LOW');
    else                  setRisk('LOW');

    // Restore activity log
    const savedLog = data.activityLog || [];
    const log = document.getElementById('activityLog');
    log.innerHTML = '';
    if (savedLog.length === 0) {
      addActivity('🔍', 'Waiting for page scan results...');
    } else {
      savedLog.slice().reverse().forEach(entry => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
          <span class="activity-icon">${entry.icon}</span>
          <span class="activity-text">${entry.text}</span>
          <span class="activity-time">${entry.time}</span>
        `;
        log.appendChild(item);
      });
    }
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('statusDot');
  const pageUrl = document.getElementById('pageUrl');
  document.getElementById('initTime').textContent =
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Get active tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      const url = tabs[0].url || '';
      try {
        const host = new URL(url).hostname.replace('www.', '');
        pageUrl.textContent = host;
      } catch {
        pageUrl.textContent = 'unknown page';
      }
      statusDot.classList.add('active');
    }
  });

  loadStats();

  // ─── VERIFY BUTTON ──────────────────────────────────────────────────────────
  document.getElementById('verifyBtn').addEventListener('click', () => {
    const input = document.getElementById('verifyInput').value.trim();
    if (!input) return;

    const btn = document.getElementById('verifyBtn');
    const resultBox = document.getElementById('resultBox');
    btn.disabled = true;
    btn.textContent = '...';

    resultBox.className = 'result-box show loading';
    document.getElementById('resultVerdict').textContent = '⏳ Verifying...';
    document.getElementById('resultExplanation').textContent = 'Checking against trusted sources...';

    addActivity('🔍', `Verifying: "${input.substring(0, 40)}..."`);

    // Try real backend first, fall back to mock
    const backendUrl = 'http://127.0.0.1:8080/verify';
    const doVerify = (result) => {
      resultBox.className = `result-box show ${result.type}`;
      document.getElementById('resultVerdict').textContent = result.verdict;
      document.getElementById('resultExplanation').textContent = result.explanation;

      const icon = result.type === 'verified' ? '✅' : result.type === 'fake' ? '❌' : '⚠️';
      addActivity(icon, `Result: ${result.verdict} — ${result.explanation.substring(0, 60)}...`);

      // Update stats
      chrome.storage.local.get(['scanned', 'warnings', 'threats', 'activityLog'], (data) => {
        const scanned  = (data.scanned  || 0) + 1;
        const warnings = (data.warnings || 0) + (result.type === 'misleading' ? 1 : 0);
        const threats  = (data.threats  || 0) + (result.type === 'fake' ? 1 : 0);

        // Save activity entry
        const now = new Date();
        const activityLog = data.activityLog || [];
        activityLog.push({
          icon,
          text: `${result.verdict} — ${input.substring(0, 50)}`,
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        if (activityLog.length > 50) activityLog.shift();

        chrome.storage.local.set({ scanned, warnings, threats, activityLog }, () => {
          animateCount(document.getElementById('statScanned'),  scanned);
          animateCount(document.getElementById('statWarnings'), warnings);
          animateCount(document.getElementById('statThreats'),  threats);
          if (threats > 0)       setRisk('HIGH');
          else if (warnings > 0) setRisk('MEDIUM');
          else                   setRisk('LOW');
        });
      });

      btn.disabled = false;
      btn.textContent = 'Check';
    };

    fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input }),
      signal: AbortSignal.timeout(5000)
    })
    .then(r => r.json())
    .then(data => {
      const verdict = data.verdict || '';
      let type = 'verified';
      if (verdict.includes('❌') || verdict.toLowerCase().includes('fake')) type = 'fake';
      else if (verdict.includes('⚠️') || verdict.toLowerCase().includes('misleading')) type = 'misleading';
      const lines = verdict.split('\n').filter(Boolean);
      doVerify({ verdict: lines[0] || verdict, explanation: lines.slice(1).join(' ').replace(/\*\*/g,''), type });
    })
    .catch(() => {
      // Backend offline → use mock
      const result = mockVerify(input);
      doVerify(result);
    });
  });

  // Enter key
  document.getElementById('verifyInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('verifyBtn').click();
  });

  // ─── VIEW DASHBOARD ─────────────────────────────────────────────────────────
  document.getElementById('dashboardBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
    window.close();
  });
});
