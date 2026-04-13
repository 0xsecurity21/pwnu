import { dnsService } from './dnsService.js';
import { sslService } from './sslService.js';
import { wordlistService } from './wordlistService.js';

class ReconService {
  constructor() {
    this.activeScans = new Map();
    this.scanResults = new Map();
    this.concurrency = 10;
    this.delayBetweenBatches = 100;
  }

  createScanId() {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async scanSubdomains(domain, wordlist, options = {}) {
    const scanId = this.createScanId();
    const normalizedDomain = dnsService.normalizeDomain(domain);
    const rootDomain = dnsService.extractRootDomain(normalizedDomain);
    
    const state = {
      scanId,
      domain: normalizedDomain,
      rootDomain,
      totalWords: wordlist.length,
      processed: 0,
      found: [],
      failed: [],
      status: 'running',
      startTime: Date.now(),
      options
    };

    this.activeScans.set(scanId, state);
    this.scanResults.set(scanId, { subdomains: [], metadata: {} });

    const batches = this.chunkArray(wordlist, this.concurrency);

    for (let i = 0; i < batches.length; i++) {
      if (state.status === 'cancelled') break;

      const batchPromises = batches[i].map(async (word) => {
        try {
          const result = await dnsService.resolveSubdomain(word, normalizedDomain);
          state.processed++;

          if (result.resolved) {
            const httpStatus = await this.checkHTTPStatus(result.domain);
            result.httpStatus = httpStatus;
            state.found.push(result);
            return result;
          } else {
            state.failed.push(word);
          }
          return null;
        } catch (error) {
          state.processed++;
          state.failed.push(word);
          return null;
        }
      });

      const results = await Promise.all(batchPromises);
      const validResults = results.filter(r => r !== null);

      if (validResults.length > 0) {
        const currentResults = this.scanResults.get(scanId);
        currentResults.subdomains.push(...validResults);
      }

      if (i < batches.length - 1 && state.status === 'running') {
        await this.sleep(this.delayBetweenBatches);
      }
    }

    state.status = 'completed';
    state.endTime = Date.now();

    const finalResults = this.scanResults.get(scanId);
    finalResults.metadata = {
      domain: normalizedDomain,
      scanDuration: state.endTime - state.startTime,
      totalProcessed: state.processed,
      totalFound: state.found.length,
      timestamp: new Date().toISOString()
    };

    return finalResults;
  }

  async checkHTTPStatus(url) {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    
    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      return { status: response.status || 0, redirected: false };
    } catch (error) {
      if (error.message.includes('redirect')) {
        return { status: 0, redirected: true, error: 'CORS redirect' };
      }
      try {
        const httpUrl = fullUrl.replace('https://', 'http://');
        const response = await fetch(httpUrl, {
          method: 'GET',
          mode: 'no-cors'
        });
        return { status: response.status || 0, redirected: true };
      } catch {
        return { status: 0, error: 'unreachable' };
      }
    }
  }

  async gatherDomainInfo(domain) {
    const normalizedDomain = dnsService.normalizeDomain(domain);
    
    const [dnsResults, sslResults] = await Promise.all([
      this.gatherDNSInfo(normalizedDomain),
      this.gatherSSLInfo(normalizedDomain)
    ]);

    const httpResults = await this.gatherHTTPInfo(normalizedDomain);

    return {
      domain: normalizedDomain,
      dns: dnsResults,
      ssl: sslResults,
      http: httpResults,
      timestamp: new Date().toISOString()
    };
  }

  async gatherDNSInfo(domain) {
    const records = await dnsService.lookupMultipleRecords(domain);
    
    return {
      A: records.A.records.map(r => r.data),
      AAAA: records.AAAA.records.map(r => r.data),
      CNAME: records.CNAME?.records?.map(r => r.data) || [],
      MX: records.MX.records.map(r => ({ priority: r.Priority, exchange: r.data })),
      TXT: records.TXT.records.map(r => r.data),
      NS: records.NS?.records?.map(r => r.data) || []
    };
  }

  async gatherSSLInfo(domain) {
    const sslResult = await sslService.fetchCertificateInfo(domain);
    
    return {
      available: sslResult.available,
      headers: sslResult.headers,
      hsts: sslResult.headers?.['strict-transport-security'] || null,
      csp: sslResult.headers?.['content-security-policy'] || null,
      xframe: sslResult.headers?.['x-frame-options'] || null
    };
  }

  async gatherHTTPInfo(domain) {
    try {
      const response = await fetch(`https://${domain}`, {
        method: 'GET',
        mode: 'no-cors'
      });

      return {
        reachable: true,
        headers: this.extractInterestingHeaders(response.headers),
        technologies: []
      };
    } catch {
      return {
        reachable: false,
        headers: {},
        technologies: []
      };
    }
  }

  extractInterestingHeaders(headers) {
    const interesting = [
      'server', 'x-powered-by', 'x-aspnet-version', 'x-Generator',
      'x-drupal-cache', 'x-nextjs-cache', 'x-served-by',
      'cf-ray', 'x-request-id', 'x-runtime'
    ];

    const result = {};
    interesting.forEach(name => {
      const value = headers.get(name);
      if (value) result[name] = value;
    });

    return result;
  }

  async virtualHostFuzz(targetIP, domain, wordlist) {
    const results = [];
    const batches = this.chunkArray(wordlist, this.concurrency);

    for (const batch of batches) {
      const promises = batch.map(async (word) => {
        const hostHeader = `${word}.${domain}`;
        try {
          const response = await fetch(`http://${targetIP}`, {
            method: 'GET',
            headers: { 'Host': hostHeader },
            mode: 'cors'
          });
          return {
            host: hostHeader,
            word,
            status: response.status,
            matched: response.status >= 200 && response.status < 400
          };
        } catch {
          return { host: hostHeader, word, error: true };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults.filter(r => r.matched));
    }

    return results;
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

  getScanStatus(scanId) {
    return this.activeScans.get(scanId);
  }

  cancelScan(scanId) {
    const scan = this.activeScans.get(scanId);
    if (scan && scan.status === 'running') {
      scan.status = 'cancelled';
      return true;
    }
    return false;
  }

  getScanResults(scanId) {
    return this.scanResults.get(scanId);
  }

  clearOldScans(maxAge = 3600000) {
    const now = Date.now();
    for (const [scanId, scan] of this.activeScans) {
      if (scan.endTime && (now - scan.endTime) > maxAge) {
        this.activeScans.delete(scanId);
        this.scanResults.delete(scanId);
      }
    }
  }
}

const reconService = new ReconService();
export { reconService };
