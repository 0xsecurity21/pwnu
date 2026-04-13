const DNS_OVER_HTTPS = [
  'https://cloudflare-dns.com/dns-query',
  'https://dns.google/resolve'
];

const RECORD_TYPES = {
  A: 1,
  AAAA: 28,
  CNAME: 5,
  MX: 15,
  TXT: 16,
  NS: 2,
  SOA: 6,
  PTR: 12
};

class DNSService {
  constructor() {
    this.providers = DNS_OVER_HTTPS;
    this.currentProviderIndex = 0;
  }

  getProvider() {
    return this.providers[this.currentProviderIndex];
  }

  async fetchWithDoH(query, recordType = 'A') {
    const url = new URL(this.getProvider());
    url.searchParams.set('name', query);
    url.searchParams.set('type', recordType);
    url.searchParams.set('do', 'false');
    url.searchParams.set('cd', 'false');

    try {
      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/dns-json' },
        method: 'GET',
        mode: 'cors'
      });

      if (!response.ok) throw new Error(`DoH error: ${response.status}`);
      return await response.json();
    } catch (error) {
      this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
      if (this.currentProviderIndex === 0) throw error;
      return this.fetchWithDoH(query, recordType);
    }
  }

  async lookup(domain, recordType = 'A') {
    try {
      const result = await this.fetchWithDoH(domain, recordType);
      return {
        success: result.Status === 0,
        records: result.Answer || [],
        status: result.Status,
        type: recordType
      };
    } catch (error) {
      return { success: false, error: error.message, records: [], type: recordType };
    }
  }

  async lookupMultipleRecords(domain) {
    const types = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];
    const results = {};
    
    await Promise.all(types.map(async (type) => {
      results[type] = await this.lookup(domain, type);
    }));
    
    return results;
  }

  async resolveSubdomain(subdomain, domain) {
    const fullDomain = `${subdomain}.${domain}`;
    const results = { domain: fullDomain, resolved: false, records: {} };

    try {
      const [aResult, aaaaResult] = await Promise.all([
        this.lookup(fullDomain, 'A'),
        this.lookup(fullDomain, 'AAAA')
      ]);

      results.resolved = aResult.success || aaaaResult.success;
      results.records.A = aResult.records.filter(r => r.type === 1).map(r => r.data);
      results.records.AAAA = aaaaResult.records.filter(r => r.type === 28).map(r => r.data);

      if (aResult.success && aResult.records.length > 0) {
        results.records.CNAME = aResult.records
          .filter(r => r.type === 5)
          .map(r => r.data);
      }

      return results;
    } catch (error) {
      return { ...results, error: error.message };
    }
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
    return parts.slice(-2).join('.');
  }
}

const dnsService = new DNSService();
export { dnsService, RECORD_TYPES };
