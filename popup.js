(function() {
  const DEFAULT_WORDLIST = [
    'www', 'webmail', 'smtp', 'pop', 'ns1', 'dns1', 'dns2', 'mail', 'ftp', 'localhost',
    'web', 'owa', 'ns', 'mail2', 'new', 'mail3', 'email', 'live', 'imap', 'test',
    'ns2', 'mx', 'mx1', 'webdisk', 'ns22', 'hermes', 'mail1', 'security', 'lists',
    'support', 'docs', 'forum', 'news', 'vote', 'blog', 'admin', 'login', 'root', 'adm',
    'dev', 'development', 'staging', 'stage', 'prod', 'production', 'backup',
    'api', 'apis', 'rest', 'graphql', 'v1', 'v2', 'v3',
    'shop', 'store', 'cdn', 'static', 'assets', 'images',
    'db', 'database', 'mysql', 'mongodb', 'cache', 'redis',
    'proxy', 'gateway', 'monitor', 'metrics', 'logs',
    'internal', 'intranet', 'corp', 'mobile', 'app',
    'git', 'github', 'gitlab', 'jenkins', 'ci', 'cd',
    's3', 'aws', 'azure', 'cloud', 'heroku', 'vercel',
    'auth', 'oauth', 'saml', 'portal', 'sso',
    'crm', 'erp', 'hr', 'billing', 'accounting',
    'search', 'chat', 'video', 'media', 'upload',
    'test1', 'test2', 'staging1', 'staging2', 'dev1', 'dev2',
    'vpn', 'ssh', 'rdp', 'console', 'terminal',
    'demo', 'demos', 'sandbox', 'playground', 'trial',
    'jira', 'confluence', 'wiki', 'notion', 'slack',
    'old', 'legacy', 'archive', 'beta', 'alpha', 'release', 'stable',
    'pdf', 'doc', 'files', 'share', 'sharing', 'uploads',
    'portal', 'webmail', 'smtp', 'pop', 'imap', 'm', 'forum', 'blog', 'cdn',
    'redirect', 's', 'u', 'c', 'mail2', 'mx1', 'mx2', 'ns1', 'ns2',
    'v', 'en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'zh', 'ja', 'ko',
    'status', 'health', 'ping', 'up', 'down', 'ready',
    'jobs', 'queue', 'worker', 'workers', 'task', 'tasks'
  ];

  const MUTATION_PREFIXES = ['dev-', 'test-', 'staging-', 'prod-', 'api-', 'v1-', 'old-', 'new-', 'beta-'];
  const MUTATION_SUFFIXES = ['-dev', '-test', '-staging', '-prod', '-api', '-v1', '-old', '-new', '-beta'];

  let currentWordlist = [...DEFAULT_WORDLIST];
  let currentScanId = null;
  let isScanning = false;
  let extractedWords = [];
  let currentDomain = '';

  const domainInput = document.getElementById('domainInput');
  const infoDomainInput = document.getElementById('infoDomainInput');
  const startScanBtn = document.getElementById('startScanBtn');
  const gatherInfoBtn = document.getElementById('gatherInfoBtn');
  const useDefaultBtn = document.getElementById('useDefaultBtn');
  const uploadBtn = document.getElementById('uploadBtn');
  const generateBtn = document.getElementById('generateBtn');
  const fileUpload = document.getElementById('fileUpload');
  const wordlistFile = document.getElementById('wordlistFile');
  const wordlistSource = document.getElementById('wordlistSource');
  const scanProgress = document.getElementById('scanProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const foundCount = document.getElementById('foundCount');
  const subdomainResults = document.getElementById('subdomainResults');
  const infoLoading = document.getElementById('infoLoading');
  const infoResults = document.getElementById('infoResults');
  const extractPageBtn = document.getElementById('extractPageBtn');
  const enableMutations = document.getElementById('enableMutations');
  const extractedContent = document.getElementById('extractedContent');
  const extractedList = document.getElementById('extractedList');
  const generatedWordlist = document.getElementById('generatedWordlist');
  const copyWordlistBtn = document.getElementById('copyWordlistBtn');
  const exportWordlistBtn = document.getElementById('exportWordlistBtn');
  const clearWordlistBtn = document.getElementById('clearWordlistBtn');

  async function initCurrentDomain() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && tab.url.startsWith('http')) {
        const url = new URL(tab.url);
        const domain = extractRootDomain(url.hostname);
        currentDomain = domain;
        domainInput.value = domain;
        infoDomainInput.value = domain;
      }
    } catch (e) {
      console.log('Could not get current domain:', e);
    }
  }

  function extractRootDomain(hostname) {
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    if (parts[0] === 'www') return parts.slice(1).join('.');
    return parts.slice(-2).join('.');
  }

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  function updateWordlistSource(text) {
    wordlistSource.textContent = text;
  }

  useDefaultBtn.addEventListener('click', () => {
    currentWordlist = [...DEFAULT_WORDLIST];
    updateWordlistSource(`Using default wordlist (${currentWordlist.length} words)`);
    fileUpload.style.display = 'none';
  });

  uploadBtn.addEventListener('click', () => {
    fileUpload.style.display = 'block';
  });

  wordlistFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const words = text.split(/[\r\n]+/).filter(w => w.trim() && !w.startsWith('#'));
      currentWordlist = words.map(w => w.trim().toLowerCase().replace(/[^a-z0-9\-\._]/g, ''));
      updateWordlistSource(`Loaded: ${file.name} (${currentWordlist.length} words)`);
    } catch (error) {
      updateWordlistSource('Error loading file');
    }
  });

  generateBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.startsWith('http')) {
      try {
        const results = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
        if (results && results.content) {
          extractedWords = generateWordsFromText(results.content);
          currentWordlist = extractedWords;
          updateWordlistSource(`Generated from page: ${currentWordlist.length} words`);
          fileUpload.style.display = 'none';
        }
      } catch (error) {
        updateWordlistSource('Could not extract from page');
      }
    }
  });

  function generateWordsFromText(text) {
    const words = new Set();

    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    text.match(emailPattern)?.forEach(email => {
      const local = email.split('@')[0];
      if (local.length >= 2) {
        words.add(local.toLowerCase().replace(/[^a-z0-9]/g, ''));
      }
    });

    const pathPattern = /\/([a-zA-Z][a-zA-Z0-9_-]*)(?:\/|$)/g;
    let match;
    while ((match = pathPattern.exec(text)) !== null) {
      if (match[1].length >= 2 && match[1].length <= 30) {
        words.add(match[1].toLowerCase());
      }
    }

    const snakePattern = /[a-z]+[A-Z][a-zA-Z]*/g;
    text.match(snakePattern)?.forEach(m => {
      m.split(/(?=[A-Z])/).forEach(p => {
        if (p.length >= 2) words.add(p.toLowerCase());
      });
    });

    const urlPattern = /(?:https?:\/\/)?(?:[\w-]+\.)*([a-zA-Z0-9][a-zA-Z0-9-]*)\.[a-zA-Z]{2,}/gi;
    let urlMatch;
    while ((urlMatch = urlPattern.exec(text)) !== null) {
      const subdomain = urlMatch[1];
      if (subdomain.length >= 2 && subdomain.length <= 20) {
        words.add(subdomain.toLowerCase());
      }
    }

    return Array.from(words).filter(w => w.length >= 2);
  }

  function applyMutations(words) {
    if (!enableMutations.checked) return words;

    const mutations = new Set(words);
    words.forEach(word => {
      MUTATION_PREFIXES.forEach(p => mutations.add(p + word));
      MUTATION_SUFFIXES.forEach(s => mutations.add(word + s));
      mutations.add(word + '1');
      mutations.add(word + '2');
      mutations.add(word + '-1');
      mutations.add(word + '-2');
    });

    return Array.from(mutations);
  }

  startScanBtn.addEventListener('click', async () => {
    const domain = domainInput.value.trim();
    if (!domain) {
      alert('Please enter a domain');
      return;
    }

    if (isScanning) {
      cancelScan();
      return;
    }

    isScanning = true;
    startScanBtn.textContent = 'Cancel Scan';
    startScanBtn.disabled = false;
    scanProgress.style.display = 'block';
    subdomainResults.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    const words = applyMutations(currentWordlist);
    const normalizedDomain = normalizeDomain(domain);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'scanSubdomains',
        domain: normalizedDomain,
        wordlist: words
      });

      if (response.success) {
        displayScanResults(response.results);
      } else {
        subdomainResults.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">❌</div>
            <div class="empty-text">Scan failed: ${response.error || 'Unknown error'}</div>
          </div>
        `;
      }
    } catch (error) {
      subdomainResults.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <div class="empty-text">Error: ${error.message}</div>
        </div>
      `;
    }

    isScanning = false;
    startScanBtn.textContent = 'Start Scan';
    scanProgress.style.display = 'none';
  });

  async function cancelScan() {
    if (currentScanId) {
      await chrome.runtime.sendMessage({
        action: 'cancelScan',
        scanId: currentScanId
      });
    }
    isScanning = false;
    startScanBtn.textContent = 'Start Scan';
  }

  function displayScanResults(results) {
    if (!results || !results.subdomains || results.subdomains.length === 0) {
      subdomainResults.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-text">No subdomains found</div>
        </div>
      `;
      return;
    }

    subdomainResults.innerHTML = results.subdomains.map(sub => {
      const ip = sub.a?.[0] || sub.aaaa?.[0] || '';
      const httpStatus = sub.httpStatus || 0;
      let badgeClass = 'badge-info';
      let badgeText = 'found';

      if (httpStatus >= 200 && httpStatus < 300) {
        badgeClass = 'badge-success';
        badgeText = httpStatus;
      } else if (httpStatus >= 300 && httpStatus < 400) {
        badgeClass = 'badge-warning';
        badgeText = httpStatus;
      }

      return `
        <div class="results-item">
          <span class="results-domain">${escapeHtml(sub.domain)}</span>
          ${ip ? `<span style="color: var(--text-secondary); font-size: 11px;">${ip}</span>` : ''}
          <span class="results-badge ${badgeClass}">${badgeText}</span>
        </div>
      `;
    }).join('');

    if (results.metadata) {
      console.log(`Scan completed: ${results.metadata.found} found in ${results.metadata.duration}ms`);
    }
  }

  gatherInfoBtn.addEventListener('click', async () => {
    const domain = infoDomainInput.value.trim();
    if (!domain) {
      alert('Please enter a domain');
      return;
    }

    infoLoading.style.display = 'flex';
    infoResults.innerHTML = '';

    const normalizedDomain = normalizeDomain(domain);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'gatherInfo',
        domain: normalizedDomain
      });

      if (response.success) {
        displayInfoResults(response.results);
      } else {
        infoResults.innerHTML = `<div class="empty-state"><div class="empty-text">Error: ${response.error}</div></div>`;
      }
    } catch (error) {
      infoResults.innerHTML = `<div class="empty-state"><div class="empty-text">Error: ${error.message}</div></div>`;
    }

    infoLoading.style.display = 'none';
  });

  function displayInfoResults(results) {
    const dns = results.dns || {};
    const ssl = results.ssl || {};
    const http = results.http || {};
    const ctf = results.ctf || {};
    const pentest = results.pentest || {};
    const bounty = results.bounty || {};

    let html = '';

    html += `
      <div class="info-section">
        <div class="info-title">DNS Records</div>
        ${dns.A?.length ? `<div class="info-row"><span class="info-key">A</span><span class="info-value">${dns.A.join(', ')}</span></div>` : ''}
        ${dns.AAAA?.length ? `<div class="info-row"><span class="info-key">AAAA</span><span class="info-value">${dns.AAAA.join(', ')}</span></div>` : ''}
        ${dns.CNAME?.length ? `<div class="info-row"><span class="info-key">CNAME</span><span class="info-value">${dns.CNAME.join(', ')}</span></div>` : ''}
        ${dns.MX?.length ? `<div class="info-row"><span class="info-key">MX</span><span class="info-value">${dns.MX.map(m => `${m.priority} ${m.exchange}`).join(', ')}</span></div>` : ''}
        ${dns.NS?.length ? `<div class="info-row"><span class="info-key">NS</span><span class="info-value">${dns.NS.join(', ')}</span></div>` : ''}
        ${dns.TXT?.length ? `<div class="info-row"><span class="info-key">TXT</span><span class="info-value">${dns.TXT.slice(0, 2).join(', ')}${dns.TXT.length > 2 ? '...' : ''}</span></div>` : ''}
      </div>
    `;

    if (ssl.available !== undefined) {
      const hsts = ssl.securityHeaders?.['strict-transport-security'];
      const csp = ssl.securityHeaders?.['content-security-policy'];
      const xframe = ssl.securityHeaders?.['x-frame-options'];

      html += `
        <div class="info-section">
          <div class="info-title">SSL / Security</div>
          <div class="info-row">
            <span class="info-key">HTTPS</span>
            <span class="info-value">${ssl.available ? '✓ Available' : '✗ Not available'}</span>
          </div>
          ${hsts ? `<div class="info-row"><span class="info-key">HSTS</span><span class="info-value">${hsts.substring(0, 50)}${hsts.length > 50 ? '...' : ''}</span></div>` : ''}
          ${csp ? `<div class="info-row"><span class="info-key">CSP</span><span class="info-value" style="font-size: 10px; max-height: 60px; overflow-y: auto;">${csp.substring(0, 100)}${csp.length > 100 ? '...' : ''}</span></div>` : ''}
          ${xframe ? `<div class="info-row"><span class="info-key">X-Frame</span><span class="info-value">${xframe}</span></div>` : ''}
        </div>
      `;
    }

    if (ctf.waf?.length || ctf.techStack?.length || ctf.interestingHeaders?.length || ctf.misconfigs?.length) {
      const wafBadges = ctf.waf.map(w => `<span class="results-badge badge-warning">${escapeHtml(w)}</span>`).join('');
      const techBadges = ctf.techStack.map(t => `<span class="extracted-tag">${escapeHtml(t)}</span>`).join('');
      const misconfigBadges = ctf.misconfigs.map(m => `<span class="results-badge badge-info">${escapeHtml(m)}</span>`).join('');

      html += `
        <div class="info-section">
          <div class="info-title">🎯 CTF Player</div>
          ${ctf.waf?.length ? `<div class="info-row"><span class="info-key">WAF/Protection</span><span class="info-value">${wafBadges}</span></div>` : ''}
          ${ctf.techStack?.length ? `<div class="extracted-list" style="margin-bottom: 8px;">${techBadges}</div>` : ''}
          ${ctf.interestingHeaders?.length ? `
            <div class="info-row" style="flex-direction: column; gap: 4px;">
              <span class="info-key">Interesting Headers</span>
              ${ctf.interestingHeaders.map(h => `<span class="info-value" style="font-size: 10px;">${escapeHtml(h)}</span>`).join('')}
            </div>
          ` : ''}
          ${ctf.misconfigs?.length ? `<div class="extracted-list">${misconfigBadges}</div>` : ''}
        </div>
      `;
    }

    if (pentest.securityScore !== undefined || pentest.missingHeaders?.length || pentest.findings?.length || pentest.attackVectors?.length) {
      const scoreColor = pentest.securityScore >= 70 ? 'var(--success)' : pentest.securityScore >= 40 ? 'var(--warning)' : 'var(--error)';
      const missingBadges = pentest.missingHeaders.map(h => `<span class="results-badge badge-info">${escapeHtml(h)}</span>`).join('');
      const findingBadges = pentest.findings.map(f => `<span class="results-badge badge-warning">${escapeHtml(f)}</span>`).join('');
      const vectorBadges = pentest.attackVectors.map(v => `<span class="extracted-tag">${escapeHtml(v)}</span>`).join('');

      html += `
        <div class="info-section">
          <div class="info-title">🛡️ Pentester</div>
          <div class="info-row">
            <span class="info-key">Security Score</span>
            <span class="info-value" style="font-size: 18px; font-weight: 700; color: ${scoreColor};">${pentest.securityScore}/100</span>
          </div>
          ${pentest.missingHeaders?.length ? `<div class="info-row"><span class="info-key">Missing</span><span class="info-value">${missingBadges}</span></div>` : ''}
          ${pentest.findings?.length ? `<div class="extracted-list" style="margin-bottom: 8px;">${findingBadges}</div>` : ''}
          ${pentest.attackVectors?.length ? `
            <div class="info-row" style="flex-direction: column; gap: 4px;">
              <span class="info-key">Attack Vectors</span>
              <div class="extracted-list">${vectorBadges}</div>
            </div>
          ` : ''}
        </div>
      `;
    }

    if (bounty.attackSurface?.length || bounty.dataLeaks?.length || bounty.thirdParties?.length || bounty.endpoints?.length) {
      const surfaceBadges = bounty.attackSurface.map(s => `<span class="extracted-tag">${escapeHtml(s)}</span>`).join('');
      const leakBadges = bounty.dataLeaks.map(l => `<span class="results-badge badge-warning">${escapeHtml(l)}</span>`).join('');
      const thirdPartyBadges = bounty.thirdParties.map(t => `<span class="results-badge badge-info">${escapeHtml(t)}</span>`).join('');
      const endpointBadges = bounty.endpoints.map(e => `<span class="extracted-tag">${escapeHtml(e)}</span>`).join('');

      html += `
        <div class="info-section">
          <div class="info-title">🐛 Bug Hunter</div>
          ${bounty.attackSurface?.length ? `<div class="extracted-list" style="margin-bottom: 8px;">${surfaceBadges}</div>` : ''}
          ${bounty.dataLeaks?.length ? `<div class="info-row"><span class="info-key">Data Leaks</span><span class="info-value">${leakBadges}</span></div>` : ''}
          ${bounty.thirdParties?.length ? `<div class="info-row"><span class="info-key">3rd Parties</span><span class="info-value">${thirdPartyBadges}</span></div>` : ''}
          ${bounty.endpoints?.length ? `
            <div class="info-row" style="flex-direction: column; gap: 4px;">
              <span class="info-key">Endpoints</span>
              <div class="extracted-list">${endpointBadges}</div>
            </div>
          ` : ''}
        </div>
      `;
    }

    if (!html) {
      html = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-text">No information gathered</div>
        </div>
      `;
    }

    infoResults.innerHTML = html;
  }

  extractPageBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.startsWith('http')) {
      alert('Cannot extract from this page');
      return;
    }

    try {
      const results = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
      if (results && results.content) {
        extractedWords = generateWordsFromText(results.content);
        displayExtractedWords();
      }
    } catch (error) {
      alert('Could not extract content from page');
    }
  });

  function displayExtractedWords() {
    if (extractedWords.length === 0) {
      extractedContent.style.display = 'none';
      return;
    }

    extractedContent.style.display = 'block';
    const displayWords = extractedWords.slice(0, 50);
    const remaining = extractedWords.length - 50;

    extractedList.innerHTML = displayWords.map(w =>
      `<span class="extracted-tag">${escapeHtml(w)}</span>`
    ).join('');

    if (remaining > 0) {
      extractedList.innerHTML += `<span class="extracted-tag">+${remaining} more</span>`;
    }
  }

  enableMutations.addEventListener('change', () => {
    const finalWordlist = applyMutations(extractedWords);
    displayGeneratedWordlist(finalWordlist);
  });

  function displayGeneratedWordlist(words) {
    if (words.length === 0) {
      generatedWordlist.innerHTML = `
        <div class="empty-state">
          <div class="empty-text">No words generated yet</div>
        </div>
      `;
      copyWordlistBtn.disabled = true;
      exportWordlistBtn.disabled = true;
      return;
    }

    generatedWordlist.innerHTML = words.slice(0, 100).map(w => `
      <div class="results-item">
        <span class="results-domain">${escapeHtml(w)}</span>
      </div>
    `).join('') + (words.length > 100 ? `
      <div class="results-item" style="justify-content: center; color: var(--text-secondary);">
        + ${words.length - 100} more words
      </div>
    ` : '');

    copyWordlistBtn.disabled = false;
    exportWordlistBtn.disabled = false;
  }

  copyWordlistBtn.addEventListener('click', async () => {
    const wordlist = applyMutations(extractedWords).join('\n');
    await navigator.clipboard.writeText(wordlist);
    copyWordlistBtn.textContent = 'Copied!';
    setTimeout(() => { copyWordlistBtn.textContent = 'Copy'; }, 2000);
  });

  exportWordlistBtn.addEventListener('click', () => {
    const wordlist = applyMutations(extractedWords).join('\n');
    const blob = new Blob([wordlist], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wordlist.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  clearWordlistBtn.addEventListener('click', () => {
    extractedWords = [];
    extractedContent.style.display = 'none';
    generatedWordlist.innerHTML = `
      <div class="empty-state">
        <div class="empty-text">No words generated yet</div>
      </div>
    `;
    copyWordlistBtn.disabled = true;
    exportWordlistBtn.disabled = true;
  });

  function normalizeDomain(input) {
    let domain = input.trim().toLowerCase();
    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
    domain = domain.replace(/\/.*$/, '');
    return domain;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  initCurrentDomain();
  updateWordlistSource(`Using default wordlist (${currentWordlist.length} words)`);
})();
