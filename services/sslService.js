class SSLService {
  constructor() {
    this.cache = new Map();
  }

  async fetchCertificateInfo(hostname) {
    const cacheKey = `ssl:${hostname}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`https://${hostname}`, {
        method: 'HEAD',
        mode: 'no-cors'
      });

      const result = {
        hostname,
        available: true,
        certificate: null,
        headers: this.parseSecurityHeaders(response.headers)
      };

      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      const result = { hostname, available: false, error: error.message };
      this.cache.set(cacheKey, result);
      return result;
    }
  }

  async fetchWithTLSSession(hostname, port = 443) {
    return new Promise((resolve) => {
      const result = {
        hostname,
        port,
        available: false,
        certificate: null,
        tlsVersion: null,
        cipher: null
      };

      const xhr = new XMLHttpRequest();
      xhr.open('GET', `https://${hostname}:${port}`, true);
      xhr.timeout = 10000;

      xhr.onload = () => {
        result.available = true;
        result.tlsVersion = xhr.getResponseHeader('X-TLS-Version') || 'TLS 1.2+';
        result.cipher = xhr.getResponseHeader('X-Cipher') || 'Unknown';
        resolve(result);
      };

      xhr.onerror = () => {
        result.error = 'Connection failed';
        resolve(result);
      };

      xhr.ontimeout = () => {
        result.error = 'Timeout';
        resolve(result);
      };

      try {
        xhr.send();
      } catch (e) {
        result.error = e.message;
        resolve(result);
      }

      setTimeout(() => {
        if (!result.available) {
          result.error = 'Timeout';
          resolve(result);
        }
      }, 10000);
    });
  }

  parseSecurityHeaders(headers) {
    const securityHeaders = {};
    const headerNames = [
      'strict-transport-security',
      'content-security-policy',
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'referrer-policy',
      'permissions-policy'
    ];

    headerNames.forEach(name => {
      const value = headers.get(name);
      if (value) securityHeaders[name] = value;
    });

    return securityHeaders;
  }

  async getSSLLabsInfo(hostname) {
    try {
      const response = await fetch(
        `https://api.ssllabs.com/api/v3/analyze?host=${hostname}&startNew=on`,
        { mode: 'cors' }
      );
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  }

  formatExpiryDate(expiryDate) {
    if (!expiryDate) return null;
    const date = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    
    return {
      date: date.toISOString(),
      daysRemaining: daysUntilExpiry,
      expired: daysUntilExpiry < 0,
      warning: daysUntilExpiry < 30
    };
  }

  parseCertificateBasicConstraints(constraints) {
    if (!constraints) return null;
    const caMatch = constraints.match(/CA:(TRUE|FALSE)/i);
    const pathMatch = constraints.match(/pathlen:(\d+)/i);
    
    return {
      isCA: caMatch ? caMatch[1].toUpperCase() === 'TRUE' : null,
      pathLength: pathMatch ? parseInt(pathMatch[1]) : null
    };
  }

  clearCache() {
    this.cache.clear();
  }
}

const sslService = new SSLService();
export { sslService };
