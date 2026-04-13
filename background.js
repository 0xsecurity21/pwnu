const DNS_OVER_HTTPS = [
  { url: 'https://cloudflare-dns.com/dns-query', type: 'doq' },
  { url: 'https://dns.google/resolve', type: 'json' }
];

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

class DNSResolver {
  constructor() {
    this.cache = new Map();
    this.providerIndex = 0;
    this.timeout = 8000;
  }

  getProvider() {
    return DNS_OVER_HTTPS[this.providerIndex];
  }

  async fetchDNS(domain, type = 'A') {
    const cacheKey = `${domain}:${type}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const provider = this.getProvider();
    let url;

    if (provider.type === 'json') {
      url = `${provider.url}?name=${encodeURIComponent(domain)}&type=${type}`;
    } else {
      url = `${provider.url}?name=${encodeURIComponent(domain)}&type=${type}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': provider.type === 'json' ? 'application/dns-json' : 'application/dns-message'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      let result;
      if (provider.type === 'json') {
        result = await response.json();
        return this.parseJSONResponse(result, type);
      } else {
        const text = await response.text();
        result = this.parseDoQResponse(text);
        return this.parseJSONResponse(result, type);
      }
    } catch (error) {
      this.providerIndex = (this.providerIndex + 1) % DNS_OVER_HTTPS.length;
      if (this.providerIndex === 0) {
        return { success: false, error: error.message, records: [] };
      }
      return this.fetchDNS(domain, type);
    }
  }

  parseJSONResponse(data, type) {
    const status = data.Status || 0;
    const answers = data.Answer || [];

    const records = answers.map(record => ({
      name: record.name,
      type: record.type,
      TTL: record.TTL,
      data: record.data,
      Priority: record.Priority
    }));

    return {
      success: status === 0,
      status,
      records,
      type
    };
  }

  parseDoQResponse(text) {
    return { Status: 0, Answer: [] };
  }

  async lookup(domain, type = 'A') {
    return this.fetchDNS(domain, type);
  }

  async resolveSubdomain(subdomain, domain) {
    const fullDomain = `${subdomain}.${domain}`;
    
    try {
      const [aResult, aaaaResult] = await Promise.all([
        this.lookup(fullDomain, 'A'),
        this.lookup(fullDomain, 'AAAA')
      ]);

      const resolved = aResult.success || aaaaResult.success;

      return {
        domain: fullDomain,
        subdomain,
        resolved,
        a: aResult.records.filter(r => r.type === 1).map(r => r.data),
        aaaa: aResult.records.filter(r => r.type === 28).map(r => r.data),
        cname: aResult.records.filter(r => r.type === 5).map(r => r.data),
        error: null
      };
    } catch (error) {
      return {
        domain: fullDomain,
        subdomain,
        resolved: false,
        a: [],
        aaaa: [],
        cname: [],
        error: error.message
      };
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

class BackgroundRecon {
  constructor() {
    this.activeScans = new Map();
    this.dns = new DNSResolver();
    this.concurrency = 15;
    this.batchDelay = 50;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  normalizeDomain(input) {
    let domain = input.trim().toLowerCase();
    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
    domain = domain.replace(/\/.*$/, '');
    return domain;
  }

  extractRootDomain(domain) {
    const parts = domain.split('.');
    if (parts.length <= 2) return domain;
    if (parts[0] === 'www') return parts.slice(1).join('.');
    return parts.slice(-2).join('.');
  }

  async checkHTTPStatus(url) {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(fullUrl, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.status || 200;
    } catch {
      try {
        const httpUrl = fullUrl.replace('https://', 'http://');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await fetch(httpUrl, {
          method: 'GET',
          mode: 'no-cors',
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return 'http-redirect';
      } catch {
        return 0;
      }
    }
  }

  async scanSubdomains(domain, wordlist, options = {}) {
    const scanId = `scan_${Date.now()}`;
    const normalizedDomain = this.normalizeDomain(domain);
    const rootDomain = this.extractRootDomain(normalizedDomain);

    const state = {
      scanId,
      domain: normalizedDomain,
      rootDomain,
      totalWords: wordlist.length,
      processed: 0,
      found: [],
      failed: 0,
      status: 'running',
      startTime: Date.now()
    };

    this.activeScans.set(scanId, state);
    const results = { scanId, subdomains: [], metadata: {} };

    const batches = this.chunkArray(wordlist, this.concurrency);

    for (let i = 0; i < batches.length; i++) {
      if (state.status === 'cancelled') break;

      const promises = batches[i].map(async (word) => {
        try {
          const result = await this.dns.resolveSubdomain(word, normalizedDomain);
          state.processed++;

          if (result.resolved) {
            result.httpStatus = await this.checkHTTPStatus(result.domain);
            state.found.push(result);
            return result;
          } else {
            state.failed++;
          }
          return null;
        } catch (error) {
          state.processed++;
          state.failed++;
          return null;
        }
      });

      const batchResults = (await Promise.all(promises)).filter(r => r !== null);
      results.subdomains.push(...batchResults);

      if (i < batches.length - 1 && state.status === 'running') {
        await this.sleep(this.batchDelay);
      }
    }

    state.status = 'completed';
    state.endTime = Date.now();

    results.metadata = {
      domain: normalizedDomain,
      rootDomain,
      duration: state.endTime - state.startTime,
      processed: state.processed,
      found: state.found.length,
      failed: state.failed,
      timestamp: new Date().toISOString()
    };

    return results;
  }

  async gatherInfo(domain) {
    const normalizedDomain = this.normalizeDomain(domain);
    const results = {
      domain: normalizedDomain,
      dns: {},
      ssl: {},
      http: {},
      ctf: { waf: [], techStack: [], interestingHeaders: [], misconfigs: [] },
      pentest: { securityScore: 0, missingHeaders: [], findings: [], attackVectors: [] },
      bounty: { attackSurface: [], dataLeaks: [], thirdParties: [], endpoints: [] }
    };

    try {
      const [aResult, aaaaResult, mxResult, txtResult, nsResult, cnameResult] = await Promise.all([
        this.dns.lookup(normalizedDomain, 'A'),
        this.dns.lookup(normalizedDomain, 'AAAA'),
        this.dns.lookup(normalizedDomain, 'MX'),
        this.dns.lookup(normalizedDomain, 'TXT'),
        this.dns.lookup(normalizedDomain, 'NS'),
        this.dns.lookup(normalizedDomain, 'CNAME')
      ]);

      results.dns = {
        A: aResult.records.filter(r => r.type === 1).map(r => r.data),
        AAAA: aaaaResult.records.filter(r => r.type === 28).map(r => r.data),
        MX: mxResult.records.filter(r => r.type === 15).map(r => ({
          priority: r.Priority || 10,
          exchange: r.data
        })),
        TXT: txtResult.records.filter(r => r.type === 16).map(r => r.data),
        NS: nsResult.records.filter(r => r.type === 2).map(r => r.data),
        CNAME: cnameResult.records.filter(r => r.type === 5).map(r => r.data)
      };
    } catch (error) {
      results.dns.error = error.message;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`https://${normalizedDomain}`, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const allHeaderNames = [
        'strict-transport-security', 'content-security-policy', 'x-frame-options',
        'x-content-type-options', 'x-xss-protection', 'referrer-policy', 'permissions-policy',
        'x-permitted-cross-domain-policies', 'cross-origin-embedder-policy', 'cross-origin-opener-policy',
        'cross-origin-resource-policy', 'access-control-allow-origin', 'access-control-allow-credentials',
        'server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator',
        'x-drupal-cache', 'x-varnish', 'via', 'x-cache', 'cf-ray', 'x-sucuri-id', 'x-sucuri-country',
        'server-timing', 'x-request-id', 'x-cdn', 'x-amz-cf-id', 'x-cloudtrace-context',
        'x-github-request-id', 'x-gitlab-stage', 'x-datadog-trace-id', 'x-hacker', 'x-bugsnag-notify'
      ];

      const headers = {};
      allHeaderNames.forEach(name => {
        const value = response.headers.get(name);
        if (value) headers[name] = value;
      });

      results.ssl = { available: true, securityHeaders: headers };
      results.http = {
        reachable: true,
        server: response.headers.get('server'),
        poweredBy: response.headers.get('x-powered-by'),
        headers
      };

      const headerStr = JSON.stringify(headers).toLowerCase();

      const wafSignatures = {
        'Cloudflare': ['cf-ray', '__cfuid', 'cf-cache-status', 'cf-request-id', 'cf-ray'],
        'AWS CloudFront': ['x-amz-cf-id', 'x-amz-cf-pop', 'cloudfront'],
        'Akamai': ['akamai-origin-fetch', 'akamai-x-cache', 'akamai'],
        'Sucuri': ['x-sucuri-id', 'x-sucuri-country', 'sucuri'],
        'Wordfence': ['wordfence', 'wordfence_lv'],
        'Imunify360': ['imunify', 'imav'],
        'Incapsula': ['incap', 'visid', 'incapsula'],
        'DDoS-Guard': ['ddg', 'ddos-guard'],
        'Fastly': ['x-served-by', 'x-cache-hits', 'fastly'],
        'Varnish': ['x-varnish', 'varnish'],
        'Nginx': ['nginx'],
        'ModSecurity': ['mod_security', 'modsecurity'],
        'EdgeSecure': ['edgesec']
      };

      Object.entries(wafSignatures).forEach(([waf, signatures]) => {
        signatures.forEach(sig => {
          if (headerStr.includes(sig.toLowerCase()) && !results.ctf.waf.includes(waf)) {
            results.ctf.waf.push(waf);
          }
        });
      });

      if (headers['server']) results.ctf.techStack.push(`Server: ${headers['server']}`);
      if (headers['x-powered-by']) results.ctf.techStack.push(`Powered: ${headers['x-powered-by']}`);
      if (headers['x-generator']) results.ctf.techStack.push(`Generator: ${headers['x-generator']}`);
      if (headers['x-aspnet-version']) results.ctf.techStack.push(`ASP.NET: ${headers['x-aspnet-version']}`);
      if (headers['x-aspnetmvc-version']) results.ctf.techStack.push(`ASP.NET MVC: ${headers['x-aspnetmvc-version']}`);
      if (headerStr.includes('drupal')) results.ctf.techStack.push('CMS: Drupal');
      if (headerStr.includes('wp-content') || headerStr.includes('wordpress')) results.ctf.techStack.push('CMS: WordPress');
      if (headerStr.includes('joomla')) results.ctf.techStack.push('CMS: Joomla');
      if (headerStr.includes('wp-json')) results.ctf.techStack.push('API: WordPress REST API');
      if (headerStr.includes('x-drupal-cache')) results.ctf.techStack.push('Drupal Cache');

      if (headers['x-request-id']) results.ctf.interestingHeaders.push(`X-Request-ID: ${headers['x-request-id']}`);
      if (headers['server-timing']) results.ctf.interestingHeaders.push(`Server-Timing: ${headers['server-timing'].substring(0, 80)}...`);
      if (headers['via']) results.ctf.interestingHeaders.push(`Via: ${headers['via']}`);
      if (headers['x-cdn']) results.ctf.interestingHeaders.push(`CDN: ${headers['x-cdn']}`);
      if (headers['x-github-request-id']) results.ctf.interestingHeaders.push(`GitHub Request: ${headers['x-github-request-id']}`);
      if (headers['x-datadog-trace-id']) results.ctf.interestingHeaders.push(`Datadog Trace: ${headers['x-datadog-trace-id']}`);
      if (headers['x-bugsnag-notify']) results.ctf.interestingHeaders.push(`Bugsnag: ${headers['x-bugsnag-notify']}`);

      if (headers['server'] && /^\w+\/[\d.]+/.test(headers['server'])) {
        results.ctf.misconfigs.push(`Version disclosure: ${headers['server']}`);
      }
      if (headers['x-powered-by']) results.ctf.misconfigs.push(`Tech stack leak: ${headers['x-powered-by']}`);

      const requiredHeaders = {
        'strict-transport-security': 'HSTS',
        'content-security-policy': 'CSP',
        'x-frame-options': 'X-Frame-Options',
        'x-content-type-options': 'X-Content-Type-Options',
        'referrer-policy': 'Referrer-Policy'
      };

      Object.entries(requiredHeaders).forEach(([header, name]) => {
        if (!headers[header]) results.pentest.missingHeaders.push(name);
      });
      results.pentest.securityScore = Math.max(0, 100 - (results.pentest.missingHeaders.length * 18));

      if (headers['access-control-allow-origin'] === '*') {
        results.pentest.findings.push('CORS Wildcard: Any origin can access resources');
      }
      if (headers['x-xss-protection'] === '0') {
        results.pentest.findings.push('X-XSS-Protection explicitly disabled');
      }
      if (headers['x-frame-options']?.toLowerCase() === 'allow') {
        results.pentest.findings.push('X-Frame-Options: ALLOW - Clickjacking possible');
      }
      if (!headers['strict-transport-security']) {
        results.pentest.findings.push('No HSTS - HTTPS not enforced');
      }
      if (headers['x-content-type-options'] !== 'nosniff') {
        results.pentest.findings.push('MIME sniffing enabled');
      }

      const attackVectors = [];
      if (headers['server']) attackVectors.push('Server version disclosure');
      if (headers['x-powered-by']) attackVectors.push('Technology fingerprinting possible');
      if (headers['access-control-allow-origin']) attackVectors.push('CORS misconfiguration');
      if (results.dns.MX?.length) attackVectors.push('SMTP attack surface via MX records');
      if (results.dns.TXT?.length) attackVectors.push('TXT records may expose SPF/DKIM config');
      if (results.dns.NS?.length) attackVectors.push('NS records reveal nameservers');
      if (headers['cf-ray']) attackVectors.push('Cloudflare IP leak possible');

      results.pentest.attackVectors = attackVectors;

      if (headers['cf-ray']) results.bounty.thirdParties.push('Cloudflare');
      if (headers['x-amz-cf-id']) results.bounty.thirdParties.push('AWS CloudFront');
      if (headers['x-sucuri-id']) results.bounty.thirdParties.push('Sucuri');
      if (headers['x-varnish']) results.bounty.thirdParties.push('Varnish Cache');
      if (headers['via']?.includes('varnish')) results.bounty.thirdParties.push('Varnish');

      if (headers['server']) results.bounty.endpoints.push(`Server: ${headers['server']}`);
      if (headers['x-generator']) results.bounty.endpoints.push(`Generator: ${headers['x-generator']}`);
      if (headerStr.includes('api')) results.bounty.endpoints.push('Possible API endpoints');
      if (headerStr.includes('graphql')) results.bounty.endpoints.push('GraphQL endpoint possible');
      if (headerStr.includes('swagger') || headerStr.includes('openapi')) {
        results.bounty.endpoints.push('API documentation possible');
      }

      const sensitivePatterns = [
        { pattern: /v=spf1/i, name: 'SPF Record (Email Security)' },
        { pattern: /google|_dmarc/i, name: 'DMARC Policy' },
        { pattern: /github|gitlab/i, name: 'Dev Platform Reference' },
        { pattern: /sendgrid|mailgun|ses/i, name: 'Email Service Integration' },
        { pattern: /stripe|paypal|braintree/i, name: 'Payment Integration' },
        { pattern: /heroku|vercel|netlify|firebase/i, name: 'Cloud Platform' },
        { pattern: /aws_access|aws_secret|s3\./i, name: 'AWS Configuration' }
      ];

      results.dns.TXT.forEach(txt => {
        sensitivePatterns.forEach(({ pattern, name }) => {
          if (pattern.test(txt) && !results.bounty.dataLeaks.includes(name)) {
            results.bounty.dataLeaks.push(name);
          }
        });
      });

      const surface = [];
      if (results.dns.A?.length) surface.push(`${results.dns.A.length} IPv4 address(es)`);
      if (results.dns.AAAA?.length) surface.push(`${results.dns.AAAA.length} IPv6 address(es)`);
      if (results.dns.MX?.length) surface.push(`${results.dns.MX.length} mail server(s)`);
      if (results.dns.NS?.length) surface.push(`${results.dns.NS.length} nameserver(s)`);
      if (results.dns.CNAME?.length) surface.push(`${results.dns.CNAME.length} CNAME(s)`);
      if (results.dns.TXT?.length) surface.push(`${results.dns.TXT.length} TXT record(s)`);

      results.bounty.attackSurface = surface;

    } catch {
      results.ssl = { available: false };
      results.http = { reachable: false };
    }

    results.timestamp = new Date().toISOString();
    return results;
  }

  generateWordlist(text) {
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

    const urlPattern = /(?:https?:\/\/)?([a-zA-Z0-9][a-zA-Z0-9-]*)\.[a-zA-Z]{2,}(?:\/|$)/gi;
    let urlMatch;
    while ((urlMatch = urlPattern.exec(text)) !== null) {
      const subdomain = urlMatch[1];
      if (subdomain && subdomain.length >= 2 && subdomain.length <= 20) {
        words.add(subdomain.toLowerCase());
      }
    }

    return Array.from(words).filter(w => w.length >= 2 && w.length <= 50);
  }

  mutateWordlist(words) {
    const mutations = new Set(words);
    const prefixes = ['dev-', 'test-', 'staging-', 'prod-', 'api-', 'v1-', 'old-', 'new-', 'beta-'];
    const suffixes = ['-dev', '-test', '-staging', '-prod', '-api', '-v1', '-old', '-new', '-beta'];

    words.forEach(word => {
      prefixes.forEach(p => mutations.add(p + word));
      suffixes.forEach(s => mutations.add(word + s));
      mutations.add(word + '1');
      mutations.add(word + '2');
      mutations.add(word + '-1');
      mutations.add(word + '-2');
    });

    return Array.from(mutations);
  }

  getStatus(scanId) {
    return this.activeScans.get(scanId) || null;
  }

  cancelScan(scanId) {
    const scan = this.activeScans.get(scanId);
    if (scan && scan.status === 'running') {
      scan.status = 'cancelled';
      return true;
    }
    return false;
  }
}

const backgroundRecon = new BackgroundRecon();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.action) {
        case 'scanSubdomains': {
          const wordlist = message.wordlist && message.wordlist.length > 0 
            ? message.wordlist 
            : DEFAULT_WORDLIST;
          const scanResults = await backgroundRecon.scanSubdomains(
            message.domain,
            wordlist,
            message.options || {}
          );
          sendResponse({ success: true, results: scanResults });
          break;
        }

        case 'gatherInfo': {
          const infoResults = await backgroundRecon.gatherInfo(message.domain);
          sendResponse({ success: true, results: infoResults });
          break;
        }

        case 'generateWordlist': {
          const baseWords = backgroundRecon.generateWordlist(message.text || '');
          const wordlist = message.mutate 
            ? backgroundRecon.mutateWordlist(baseWords) 
            : baseWords;
          sendResponse({ success: true, wordlist });
          break;
        }

        case 'getStatus': {
          const status = backgroundRecon.getStatus(message.scanId);
          sendResponse({ success: true, status });
          break;
        }

        case 'cancelScan': {
          const cancelled = backgroundRecon.cancelScan(message.scanId);
          sendResponse({ success: cancelled });
          break;
        }

        case 'getDefaultWordlist': {
          sendResponse({ success: true, wordlist: DEFAULT_WORDLIST });
          break;
        }

        case 'getCurrentDomain': {
          sendResponse({ success: true, domain: backgroundRecon.extractRootDomain(message.hostname || '') });
          break;
        }

        default:
          sendResponse({ success: false, error: `Unknown action: ${message.action}` });
      }
    } catch (error) {
      console.error('Background error:', error);
      sendResponse({ success: false, error: error.message || 'Unknown error' });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('pwnu extension installed');
});
