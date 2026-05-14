// ─── BACKGROUND SERVICE WORKER ───────────────────────────────────────────────
// Listens for messages from content scripts and updates storage stats.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PAGE_SCAN_COMPLETE') {
    const { scanned, warnings, threats, url } = message.data;

    chrome.storage.local.get(['scanned', 'warnings', 'threats', 'activityLog', 'recentPages'], (data) => {
      const newScanned  = (data.scanned  || 0) + scanned;
      const newWarnings = (data.warnings || 0) + warnings;
      const newThreats  = (data.threats  || 0) + threats;

      const now = new Date();
      const activityLog = data.activityLog || [];
      const recentPages = data.recentPages || [];

      activityLog.push({
        icon: threats > 0 ? '❌' : warnings > 0 ? '⚠️' : '✅',
        text: `Page scanned: ${url} — ${scanned} items checked`,
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      if (activityLog.length > 50) activityLog.shift();

      recentPages.push({
        url,
        scanned,
        warnings,
        threats,
        risk: threats > 0 ? 'HIGH' : warnings > 0 ? 'MEDIUM' : 'LOW',
        time: now.toISOString()
      });
      if (recentPages.length > 20) recentPages.shift();

      chrome.storage.local.set({
        scanned: newScanned,
        warnings: newWarnings,
        threats: newThreats,
        activityLog,
        recentPages
      });
    });

    sendResponse({ ok: true });
  }
});
