(function() {
  'use strict';

  function extractContent() {
    const content = {
      text: '',
      urls: [],
      emails: [],
      paths: [],
      meta: {},
      scripts: []
    };

    content.text = document.body ? document.body.innerText : document.documentElement.innerText;

    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.href;
      if (href && href.startsWith('http')) {
        content.urls.push(href);
      }
      const text = link.textContent.trim();
      if (text && text.length >= 2 && text.length <= 30) {
        content.paths.push(text.toLowerCase().replace(/[^a-z0-9]/g, ''));
      }
    });

    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = content.text.match(emailPattern);
    if (emailMatches) {
      content.emails = [...new Set(emailMatches)];
    }

    const metaTags = document.querySelectorAll('meta[name]');
    metaTags.forEach(meta => {
      const name = meta.getAttribute('name');
      const content_attr = meta.getAttribute('content');
      if (name && content_attr) {
        content.meta[name] = content_attr;
      }
    });

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      content.meta['og:title'] = ogTitle.getAttribute('content');
    }

    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
      const src = script.src;
      if (src) {
        content.scripts.push(src);
        const urlMatch = src.match(/[^\/]+$/);
        if (urlMatch) {
          const filename = urlMatch[0].replace(/\.[^.]+$/, '');
          if (filename && filename.length >= 2) {
            content.paths.push(filename.toLowerCase());
          }
        }
      }
    });

    const inlineScripts = document.querySelectorAll('script:not([src])');
    inlineScripts.forEach(script => {
      const text = script.textContent;
      if (text) {
        const pathPattern = /(?:src|href|url)\s*[=:]\s*['"]([^'"]+)['"]/gi;
        let match;
        while ((match = pathPattern.exec(text)) !== null) {
          const url = match[1];
          if (url && url.length >= 2) {
            const parts = url.split('/');
            const lastPart = parts[parts.length - 1].replace(/\.[^.]+$/, '');
            if (lastPart && lastPart.length >= 2) {
              content.paths.push(lastPart.toLowerCase());
            }
          }
        }

        const apiPattern = /(?:api|endpoint|route|path)\s*[=:]\s*['"]([^'"]+)['"]/gi;
        while ((match = apiPattern.exec(text)) !== null) {
          const apiPath = match[1];
          if (apiPath) {
            const segments = apiPath.split('/').filter(s => s.length >= 2);
            segments.forEach(seg => {
              content.paths.push(seg.toLowerCase().replace(/[^a-z0-9]/g, ''));
            });
          }
        }
      }
    });

    const images = document.querySelectorAll('img[src]');
    images.forEach(img => {
      const src = img.src;
      if (src) {
        const urlMatch = src.match(/[^\/]+$/);
        if (urlMatch) {
          const filename = urlMatch[0].replace(/\.[^.]+$/, '');
          if (filename && filename.length >= 2 && !filename.includes('.')) {
            content.paths.push(filename.toLowerCase());
          }
        }
      }
    });

    const allText = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, li, td, th');
    allText.forEach(el => {
      const text = el.textContent.trim();
      const camelCasePattern = /[a-z]+[A-Z][a-zA-Z]*/g;
      const matches = text.match(camelCasePattern);
      if (matches) {
        matches.forEach(match => {
          const parts = match.split(/(?=[A-Z])/);
          parts.forEach(part => {
            if (part.length >= 2 && part.length <= 20) {
              content.paths.push(part.toLowerCase());
            }
          });
        });
      }
    });

    return {
      text: content.text.substring(0, 50000),
      urls: content.urls.slice(0, 500),
      emails: content.emails,
      paths: [...new Set(content.paths)].filter(p => p.length >= 2 && p.length <= 30),
      meta: content.meta,
      scripts: content.scripts.slice(0, 100)
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractContent') {
      try {
        const content = extractContent();
        sendResponse({ success: true, content });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });

  if (typeof window !== 'undefined') {
    window.pwnuExtractor = {
      extract: extractContent
    };
  }
})();
