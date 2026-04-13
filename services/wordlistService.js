const DEFAULT_WORDLIST = [
  'www', 'webmail', 'smtp', 'pop', 'ns1', 'dns1', 'dns2', 'mail', 'ftp', 'localhost',
  'web', 'owa', 'ns', 'mail2', 'new', 'mail3', 'email', 'live', 'imap', 'test',
  'ns2', 'mx', 'mx1', 'webdisk', 'ns22', 'hermes', 'mail1', 'security', 'lists',
  'support', 'docs', 'forum', 'news', 'vote', 'blog', 'pdf', 'doc', 'apps',
  'admin', 'administrator', 'login', 'root', 'adm', 'tester', 'testing', 'demo',
  'dev', 'development', 'staging', 'stage', 'prod', 'production', 'backup',
  'old', 'legacy', 'archive', 'beta', 'alpha', 'release', 'stable', 'canary',
  'api', 'apis', 'rest', 'restapi', 'graphql', 'graphqlv2', 'graphql-api',
  'v1', 'v2', 'v3', 'v4', 'v5', 'v1api', 'v2api',
  'shop', 'store', 'shopify', 'magento', 'woocommerce', 'prestashop',
  'crm', 'erp', 'hr', 'finance', 'accounting', 'billing', 'invoice',
  'cpanel', 'whm', 'plesk', 'directadmin', 'virtualmin', 'cyberpanel',
  'git', 'gitlab', 'github', 'bitbucket', 'jenkins', 'travis', 'circleci',
  's3', 'aws', 'azure', 'gcloud', 'digitalocean', 'linode', 'vultr',
  'cdn', 'static', 'assets', 'media', 'images', 'img', 'video', 'videos',
  'db', 'database', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
  'cache', 'redis', 'memcached', 'varnish',
  'proxy', 'gateway', 'loadbalancer', 'lb', 'haproxy', 'nginx', 'apache',
  'monitor', 'metrics', 'grafana', 'prometheus', 'kibana', 'logstash',
  'kafka', 'rabbitmq', 'activemq', 'zeromq',
  'vault', 'secrets', 'credentials', 'keys', 'tokens',
  'auth', 'oauth', 'saml', 'ldap', 'ad', 'active-directory',
  'portal', 'sso', 'saml-idp', 'okta', 'auth0',
  'search', 'solr', 'sphinx',
  'chat', 'slack', 'discord', 'teams', 'telegram', 'bot',
  'internal', 'intranet', 'extranet', 'corp', 'corporate',
  'mobile', 'm', 'app', 'iphone', 'android',
  'redirect', 'router', 'gateway',
  'files', 'uploads', 'share', 'sharing',
  'cms', 'wordpress', 'drupal', 'joomla', 'hubspot',
  'help', 'helpdesk', 'support-ticket', 'zendesk',
  'billing', 'payments', 'checkout', 'cart', 'ecommerce',
  'analytics', 'stats', 'tracking', 'segment',
  'campaign', 'marketing', 'email-campaigns',
  'events', 'calendar', 'scheduler',
  'tasks', 'projects', 'jira', 'asana', 'trello',
  'wiki', 'confluence', 'notion', 'knowledge',
  'reports', 'reporting', 'dashboards', 'bi',
  'data', 'warehouse', 'etl', 'pipeline',
  'deploy', 'ci', 'cd', 'pipeline', 'build',
  'registry', 'harbor', 'nexus',
  'kube', 'kubernetes', 'k8s', 'eks', 'gke',
  'docker', 'container', 'swarm',
  'terraform', 'ansible', 'puppet', 'chef',
  'logs', 'logging', 'elk', 'splunk',
  'snap', 'snapshot', 'snapshots',
  'backups', 'backup',
  'staging', 'preprod', 'pre-production',
  'uat', 'qa', 'quality',
  'sandbox', 'playground',
  'demo', 'demos',
  'trial', 'free', 'guest',
  'temp', 'tmp', 'temporary',
  'cache', 'varnish', 'fastly', 'cloudflare',
  'mirror', 'repos', 'repository',
  'svn', 'cvs', 'bzr',
  'maven', 'gradle', 'npm', 'yarn', 'pip',
  'ruby', 'rails', 'python', 'django', 'flask', 'node', 'nodejs',
  'java', 'spring', 'tomcat', 'jboss', 'wildfly',
  'php', 'laravel', 'symfony', 'codeigniter',
  'golang', 'go', 'rust', 'rs',
  'dotnet', 'aspnet', 'netcore',
  'angular', 'react', 'vue', 'ember',
  'spa', 'ssr', 'ssg',
  'graphql', 'apollo', 'urql',
  'grpc', 'thrift', 'avro',
  'websocket', 'socket', 'signalr',
  'mailhog', 'mailcatcher', 'maildev',
  'phpmyadmin', 'adminer', 'pgadmin', 'robomongo',
  'grafana', 'prometheus', 'datadog', 'newrelic',
  'sentry', 'bugsnag', 'rollbar',
  'pagerduty', 'opsgenie', 'victorops',
  'terraform-cloud', 'terraform-enterprise',
  'vault', 'consul', 'nomad',
  'jenkins-x', 'tekton', 'argocd',
  'harbor', 'quay', 'ecr', 'gcr', 'acr'
];

const MUTATION_PREFIXES = ['dev-', 'test-', 'staging-', 'prod-', 'api-', 'v1-', 'v2-', 'old-', 'new-', 'beta-'];
const MUTATION_SUFFIXES = ['-dev', '-test', '-staging', '-prod', '-api', '-v1', '-v2', '-old', '-new', '-beta'];
const MUTATION_PATTERNS = [
  (w) => `${w}1`, (w) => `${w}2`, (w) => `${w}01`, (w) => `${w}02`,
  (w) => `${w}-1`, (w) => `${w}-2`, (w) => `${w}.dev`, (w) => `${w}.test`,
  (w) => `_${w}`, (w) => `-${w}`, (w) => `${w}_`, (w) => `${w}-`
];

class WordlistService {
  constructor() {
    this.customWordlists = new Map();
    this.mutationsEnabled = true;
    this.maxMutationsPerWord = 10;
  }

  loadDefaultWordlist() {
    return [...DEFAULT_WORDLIST];
  }

  async loadWordlistFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const words = e.target.result
          .split(/[\r\n]+/)
          .map(w => w.trim())
          .filter(w => w.length > 0 && !w.startsWith('#'));
        resolve(words);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  async loadRemoteWordlist(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      return text
        .split(/[\r\n]+/)
        .map(w => w.trim())
        .filter(w => w.length > 0 && !w.startsWith('#'));
    } catch (error) {
      throw new Error(`Failed to fetch wordlist: ${error.message}`);
    }
  }

  normalizeWord(word) {
    return word
      .toLowerCase()
      .replace(/[^a-z0-9\-\._]/g, '')
      .replace(/\.+/g, '.')
      .replace(/-+/g, '-')
      .replace(/_+/g, '_')
      .trim();
  }

  generateMutations(words) {
    if (!this.mutationsEnabled) return words;

    const mutations = new Set(words);
    const seen = new Set(words.map(w => this.normalizeWord(w)));

    words.forEach(word => {
      MUTATION_PREFIXES.forEach(prefix => {
        const mutated = this.normalizeWord(`${prefix}${word}`);
        if (!seen.has(mutated)) {
          mutations.add(mutated);
          seen.add(mutated);
        }
      });

      MUTATION_SUFFIXES.forEach(suffix => {
        const mutated = this.normalizeWord(`${word}${suffix}`);
        if (!seen.has(mutated)) {
          mutations.add(mutated);
          seen.add(mutated);
        }
      });

      MUTATION_PATTERNS.slice(0, this.maxMutationsPerWord).forEach(pattern => {
        const mutated = this.normalizeWord(pattern(word));
        if (!seen.has(mutated) && mutated !== word) {
          mutations.add(mutated);
          seen.add(mutated);
        }
      });
    });

    return Array.from(mutations);
  }

  mergeWordlists(...wordlists) {
    const merged = new Set();
    wordlists.forEach(list => {
      list.forEach(word => {
        const normalized = this.normalizeWord(word);
        if (normalized) merged.add(normalized);
      });
    });
    return Array.from(merged);
  }

  saveWordlist(name, words) {
    this.customWordlists.set(name, words);
    return { name, count: words.length };
  }

  getSavedWordlists() {
    return Array.from(this.customWordlists.entries()).map(([name, words]) => ({
      name,
      count: words.length
    }));
  }

  extractFromURLs(urls) {
    const extracted = new Set();
    const urlPattern = /(?:https?:\/\/)?(?:[\w-]+\.)*([a-zA-Z0-9][a-zA-Z0-9-]*)\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;
    
    urls.forEach(url => {
      let match;
      while ((match = urlPattern.exec(url)) !== null) {
        const subdomain = match[1];
        if (subdomain.length >= 2 && subdomain.length <= 20) {
          extracted.add(this.normalizeWord(subdomain));
        }
      }
    });
    
    return Array.from(extracted);
  }

  extractFromText(text) {
    const words = new Set();
    
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    text.match(emailPattern)?.forEach(email => {
      const localPart = email.split('@')[0];
      if (localPart.length >= 2) {
        words.add(this.normalizeWord(localPart));
      }
    });

    const pathPattern = /\/([a-zA-Z][a-zA-Z0-9_-]*)(?:\/|$)/g;
    let match;
    while ((match = pathPattern.exec(text)) !== null) {
      if (match[1].length >= 2 && match[1].length <= 30) {
        words.add(this.normalizeWord(match[1]));
      }
    }

    const snakeCasePattern = /[a-z]+[A-Z][a-zA-Z]*/g;
    text.match(snakeCasePattern)?.forEach(match => {
      const parts = match.split(/(?=[A-Z])/);
      parts.forEach(part => {
        if (part.length >= 2) {
          words.add(this.normalizeWord(part.toLowerCase()));
        }
      });
    });

    return Array.from(words);
  }

  filterByLength(words, minLen = 2, maxLen = 50) {
    return words.filter(w => w.length >= minLen && w.length <= maxLen);
  }

  removeDuplicates(words) {
    return [...new Set(words.map(w => this.normalizeWord(w)))];
  }
}

const wordlistService = new WordlistService();
export { wordlistService, DEFAULT_WORDLIST };
