// ─── FACTSAATHI: WhatsApp Web Content Script ─────────────────────────────────
const BACKEND = 'https://factsaathi-backend.onrender.com/verify';
const processedMessages = new Set();

const style = document.createElement('style');
style.textContent = `
  @keyframes fsSlideIn { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
  .fs-badge { display:block; margin-top:6px; padding:5px 12px; border-radius:8px; font-size:11px; font-family:sans-serif; font-weight:600; max-width:320px; word-break:break-word; line-height:1.5; }
`;
document.head.appendChild(style);

function createBadge(type, verdict) {
  const configs = {
    verified:   { bg:'#064e3b', border:'#065f46', color:'#6ee7b7', icon:'✅', label:'REAL' },
    fake:       { bg:'#450a0a', border:'#7f1d1d', color:'#fca5a5', icon:'❌', label:'FAKE' },
    misleading: { bg:'#451a03', border:'#92400e', color:'#fcd34d', icon:'⚠️', label:'MISLEADING' },
  };
  const c = configs[type] || configs.verified;
  const short = verdict.replace(/\*\*/g,'').split('\n')[0].substring(0, 80);
  const badge = document.createElement('div');
  badge.className = 'fs-badge';
  badge.style.cssText = `background:${c.bg};border:1px solid ${c.border};color:${c.color};display:block;margin-top:6px;padding:5px 12px;border-radius:8px;font-size:11px;font-family:sans-serif;font-weight:600;max-width:320px;word-break:break-word;line-height:1.5;`;
  badge.textContent = `${c.icon} FactSaathi [${c.label}]: ${short}`;
  return badge;
}

function createLoadingBadge() {
  const badge = document.createElement('div');
  badge.style.cssText = `display:block;margin-top:6px;padding:5px 12px;border-radius:8px;font-size:11px;font-family:sans-serif;font-weight:600;background:#1a0f35;border:1px solid #2d1f52;color:#a855f7;max-width:320px;`;
  badge.textContent = '🔍 FactSaathi: Checking...';
  badge.className = 'fs-loading';
  return badge;
}

function showToast(type, text) {
  const existing = document.getElementById('fs-toast');
  if (existing) existing.remove();
  const configs = {
    verified:   { bg:'#064e3b', border:'#065f46', color:'#6ee7b7', icon:'✅', label:'REAL NEWS' },
    fake:       { bg:'#450a0a', border:'#7f1d1d', color:'#fca5a5', icon:'❌', label:'FAKE NEWS DETECTED' },
    misleading: { bg:'#451a03', border:'#92400e', color:'#fcd34d', icon:'⚠️', label:'MISLEADING' },
  };
  const c = configs[type];
  const toast = document.createElement('div');
  toast.id = 'fs-toast';
  toast.style.cssText = `position:fixed;top:20px;right:20px;z-index:99999;padding:12px 18px;border-radius:12px;max-width:280px;background:${c.bg};border:1px solid ${c.border};color:${c.color};font-family:sans-serif;font-size:12px;font-weight:600;box-shadow:0 4px 24px rgba(0,0,0,0.6);line-height:1.5;animation:fsSlideIn 0.3s ease;`;
  toast.innerHTML = `<div style="font-size:13px;font-weight:800;margin-bottom:3px">${c.icon} ${c.label}</div><div style="opacity:0.85">${text.substring(0,70)}...</div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

async function factCheck(text, bubble, loadingBadge) {
  // Only scan messages that look like news claims
  const words = text.split(' ');
  if (words.length < 6 || words.length > 50) {
    if (loadingBadge && loadingBadge.parentNode) loadingBadge.remove();
    return;
  }

  const skipPatterns = [
    /^(hi|hello|hey|hii|ok|okay|yes|no|thanks|thank you|bye|sure|hmm|haha|lol|please|bhai|yaar|kaise|acha|theek|haan|nahi|karo|bhejo|bol|bata|chal|namaste|salam|test)/i,
    /\?$/, // questions
    /^(when|where|how|what|who|why|can|will|shall|should|would|could|is there|are there)/i,
    /^@/, // mentions
    /congratulations|congrats|well done|great job|amazing work|celebrate|hackathon|participation|certificate/i,
    /^[0-9\s\+\-\(\)]+$/,
  ];

  if (skipPatterns.some(p => p.test(text.trim()))) {
    if (loadingBadge && loadingBadge.parentNode) loadingBadge.remove();
    return;
  }

  try {
    const res = await fetch(BACKEND, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await res.json();
    const verdict = (data.verdict || '').toLowerCase();

    let type = 'verified';
    if (verdict.includes('fake') || verdict.includes('false') || verdict.includes('hoax') ||
        verdict.includes('not true') || verdict.includes('no evidence') ||
        verdict.includes('debunked') || verdict.includes('fabricated') || verdict.includes('❌')) {
      type = 'fake';
    } else if (verdict.includes('misleading') || verdict.includes('partially') ||
               verdict.includes('disputed') || verdict.includes('⚠️')) {
      type = 'misleading';
    }

    if (loadingBadge && loadingBadge.parentNode) {
      loadingBadge.replaceWith(createBadge(type, data.verdict || ''));
    } else {
      bubble.appendChild(createBadge(type, data.verdict || ''));
    }

    if (type === 'fake' || type === 'misleading') {
      showToast(type, text);
    }

    const entry = {
      text: text.substring(0, 120),
      verdict: (data.verdict || '').replace(/\*\*/g, '').split('\n')[0].substring(0, 100),
      type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: Date.now()
    };

    chrome.storage.local.get(['checks', 'scanned', 'warnings', 'threats'], (d) => {
      const checks   = d.checks   || [];
      const scanned  = (d.scanned  || 0) + 1;
      const warnings = (d.warnings || 0) + (type === 'misleading' ? 1 : 0);
      const threats  = (d.threats  || 0) + (type === 'fake' ? 1 : 0);
      checks.unshift(entry);
      if (checks.length > 100) checks.pop();
      chrome.storage.local.set({ checks, scanned, warnings, threats });
    });

  } catch(e) {
    if (loadingBadge && loadingBadge.parentNode) {
      const offlineBadge = document.createElement('div');
      offlineBadge.style.cssText = `display:block;margin-top:4px;padding:3px 8px;border-radius:4px;font-size:10px;font-family:sans-serif;background:#1a0f35;color:#6b4fa0;border:1px solid #2d1f52;`;
      offlineBadge.textContent = '🛡 FactSaathi: Backend offline';
      loadingBadge.replaceWith(offlineBadge);
    }
  }
}

function scanMessages() {
  const msgElements = document.querySelectorAll('span[dir="ltr"]');
  msgElements.forEach(el => {
    const text = el.innerText?.trim();
    if (!text || text.length < 15) return;
    const container = el.closest('[data-id]');
    if (!container) return;
    const dataId = container.getAttribute('data-id');
    if (!dataId || processedMessages.has(dataId)) return;
    processedMessages.add(dataId);
    const bubble = el.closest('.copyable-text') || el.parentElement;
    const target = bubble || container;
    const loadingBadge = createLoadingBadge();
    target.appendChild(loadingBadge);
    factCheck(text, target, loadingBadge);
  });
}

function startObserver() {
  const observer = new MutationObserver(() => scanMessages());
  const root = document.querySelector('#main') || document.body;
  observer.observe(root, { childList: true, subtree: true });
  scanMessages();
}

function waitForWhatsApp() {
  const check = setInterval(() => {
    if (document.querySelector('#main') || document.querySelector('[data-id]')) {
      clearInterval(check);
      setTimeout(startObserver, 2000);
    }
  }, 1000);
}

waitForWhatsApp();
