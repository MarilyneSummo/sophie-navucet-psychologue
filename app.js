/**
 * Site de Sophie NAVUCET
 * Lecture du contenu Markdown et génération dynamique des sections.
 */

(async function () {
  'use strict';

  const response = await fetch('content.md?v=2');
  const md = await response.text();
  const sections = parseMarkdown(md);

  populate('tagline', sections['tagline']);
  populate('accueil', sections['accueil']);
  populate('qui-suis-je', sections['qui-suis-je']);
  populate('presentation', sections['presentation']);
  renderCards('activites', sections['activites']);
  renderAccordion('outils', sections['outils']);
  renderPricing('tarifs', sections['tarifs']);
  renderContact('contact', sections['contact']);
  renderResources('ressources', sections['ressources']);

  initNavigation();
  initScrollReveal();
  initBackToTop();
  updateYear();

  // ---------- Parsing ----------

  function parseMarkdown(text) {
    const lines = text.split(/\r?\n/);
    const result = {};
    let currentKey = null;
    let currentLevel = 0;
    let buffer = [];

    function flush() {
      if (!currentKey) return;
      result[currentKey] = {
        level: currentLevel,
        markdown: buffer.join('\n').trim()
      };
    }

    for (const raw of lines) {
      const line = raw.trimEnd();
      // Only # and ## are treated as section boundaries.
      // ### headings stay inside their parent section for cards/accordion rendering.
      const match = line.match(/^(#{1,2})\s+(.+)$/);
      if (match) {
        flush();
        currentLevel = match[1].length;
        currentKey = normalizeKey(match[2]);
        buffer = [];
      } else {
        buffer.push(line);
      }
    }
    flush();
    return result;
  }

  function normalizeKey(title) {
    return title
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ---------- Render helpers ----------

  function populate(key, section) {
    if (!section) return;
    const container = document.querySelector(`[data-content-key="${key}"]`);
    if (!container) return;
    container.innerHTML = markdownToHtml(section.markdown, section.level);
  }

  function renderCards(key, section) {
    if (!section) return;
    const container = document.querySelector(`[data-content-key="${key}"]`);
    if (!container) return;
    const children = extractSubsections(section.markdown);
    container.innerHTML = children.map(child => `
      <article class="card reveal">
        <h3>${escapeHtml(child.title)}</h3>
        <div class="card__body">${markdownToHtml(child.body, 3)}</div>
      </article>
    `).join('');
  }

  function renderAccordion(key, section) {
    if (!section) return;
    const container = document.querySelector(`[data-content-key="${key}"]`);
    if (!container) return;
    const children = extractSubsections(section.markdown);
    container.innerHTML = children.map((child, i) => `
      <div class="accordion__item reveal">
        <button class="accordion__trigger" aria-expanded="false" aria-controls="acc-panel-${i}"
          id="acc-trigger-${i}">
          ${escapeHtml(child.title)}
        </button>
        <div class="accordion__panel" id="acc-panel-${i}" role="region" aria-labelledby="acc-trigger-${i}">
          ${markdownToHtml(child.body, 3)}
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.accordion__trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.accordion__item');
        const isOpen = item.classList.contains('is-open');
        const expanded = trigger.getAttribute('aria-expanded') === 'true';

        // Optional: close others
        container.querySelectorAll('.accordion__item.is-open').forEach(openItem => {
          if (openItem !== item) {
            openItem.classList.remove('is-open');
            openItem.querySelector('.accordion__trigger').setAttribute('aria-expanded', 'false');
          }
        });

        item.classList.toggle('is-open', !isOpen);
        trigger.setAttribute('aria-expanded', String(!expanded));
      });
    });
  }

  function renderPricing(key, section) {
    if (!section) return;
    const container = document.querySelector(`[data-content-key="${key}"]`);
    if (!container) return;

    const blocks = splitByH3(section.markdown);
    container.innerHTML = blocks.map(block => {
      const title = block.title;
      const body = markdownToHtml(block.body, 3);
      const priceMatch = body.match(/(Consultation|Évaluation cognitive|Formation professionnelle)[^<]*<strong>([\s\S]*?)<\/strong>/i) ||
                         body.match(/<strong>(\d[^<]+€[^<]*)<\/strong>/);
      let priceHtml = '';
      let cleanedBody = body;

      if (title === 'tarifs' && priceMatch) {
        // handled below per card
      }

      // Highlight first strong price as big price
      const firstStrong = body.match(/<strong>(\d[^<]+€[^<]*)<\/strong>/);
      if (firstStrong) {
        priceHtml = `<p class="price">${firstStrong[1]}</p>`;
        cleanedBody = body.replace(firstStrong[0], '');
      }

      return `
        <div class="price-card reveal">
          <h3>${escapeHtml(title)}</h3>
          ${priceHtml}
          ${cleanedBody}
        </div>
      `;
    }).join('');
  }

  function renderContact(key, section) {
    if (!section) return;
    const container = document.querySelector(`[data-content-key="${key}"]`);
    if (!container) return;
    const children = extractSubsections(section.markdown);
    container.innerHTML = children.map(child => `
      <div class="contact__box reveal">
        <h3>${escapeHtml(child.title)}</h3>
        ${markdownToHtml(child.body, 3)}
      </div>
    `).join('');
  }

  function renderResources(key, section) {
    if (!section) return;
    const container = document.querySelector(`[data-content-key="${key}"]`);
    if (!container) return;
    const children = extractSubsections(section.markdown);
    container.innerHTML = children.map(child => `
      <div class="resource-group reveal">
        <h3>${escapeHtml(child.title)}</h3>
        ${markdownToHtml(child.body, 3)}
      </div>
    `).join('');
  }

  // ---------- Markdown conversion (lightweight) ----------

  function markdownToHtml(md, baseLevel) {
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // headings (only ### inside section bodies)
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');

    // bold / italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // line breaks (skip after headings so they stay clean)
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/(<\/h[34]>)<br>/g, '$1');

    // lists: convert leading "- " into <li>
    html = html.replace(/(?:<br>|^)-\s+(.+?)(?=(?:<br>-\s+)|(?:<br><br>)|$)/g, (match, item, offset, string) => {
      return `<li>${item}</li>`;
    });

    // wrap consecutive <li> in <ul>
    html = html.replace(/(<li>.*?<\/li>)(?=(?:<br>)?<li>|$)/gs, (match) => {
      return `<ul>${match}</ul>`;
    });
    html = html.replace(/<\/ul>(?:<br>)?<ul>/g, '');

    // numbered lists: leading "1. " etc
    html = html.replace(/(?:<br>|^)(\d+)\.\s+(.+?)(?=(?:<br>\d+\.\s+)|(?:<br><br>)|$)/g, (match, num, item) => {
      return `<li>${item}</li>`;
    });
    html = html.replace(/(<li>.*?<\/li>)(?=(?:<br>)?<li>|$)/gs, (match, p1, offset, string) => {
      // only wrap if not already in ul
      if (string.slice(0, offset).endsWith('<ul>')) return match;
      return `<ol>${match}</ol>`;
    });

    // clean excessive br
    html = html.replace(/(<br>){3,}/g, '<br><br>');
    html = html.replace(/^(<br>)+|(<br>)+$/g, '');

    return html;
  }

  function extractSubsections(md) {
    const lines = md.split('\n');
    const children = [];
    let currentTitle = null;
    let buffer = [];

    for (const raw of lines) {
      const line = raw.trimEnd();
      const match = line.match(/^###\s+(.+)$/);
      if (match) {
        if (currentTitle) {
          children.push({ title: currentTitle, body: buffer.join('\n').trim() });
        }
        currentTitle = match[1];
        buffer = [];
      } else {
        buffer.push(line);
      }
    }
    if (currentTitle) {
      children.push({ title: currentTitle, body: buffer.join('\n').trim() });
    }
    return children;
  }

  function splitByH3(md) {
    const lines = md.split('\n');
    const blocks = [];
    let currentTitle = 'Informations';
    let buffer = [];

    for (const raw of lines) {
      const line = raw.trimEnd();
      const match = line.match(/^###\s+(.+)$/);
      if (match) {
        if (buffer.length) {
          blocks.push({ title: currentTitle, body: buffer.join('\n').trim() });
        }
        currentTitle = match[1];
        buffer = [];
      } else {
        buffer.push(line);
      }
    }
    if (buffer.length) {
      blocks.push({ title: currentTitle, body: buffer.join('\n').trim() });
    }
    return blocks;
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ---------- UI interactions ----------

  function initNavigation() {
    const header = document.querySelector('.site-header');
    const toggle = document.querySelector('.nav__toggle');
    const menu = document.querySelector('.nav__menu');
    const links = menu.querySelectorAll('a');

    window.addEventListener('scroll', () => {
      header.classList.toggle('is-scrolled', window.scrollY > 20);
    }, { passive: true });

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      menu.classList.toggle('is-open', !expanded);
      toggle.setAttribute('aria-label', expanded ? 'Ouvrir le menu' : 'Fermer le menu');
    });

    links.forEach(link => {
      link.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Ouvrir le menu');
        menu.classList.remove('is-open');
      });
    });

    // Active section highlighting
    const sections = Array.from(links).map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach(link => {
            link.removeAttribute('aria-current');
            if (link.getAttribute('href') === `#${id}`) {
              link.setAttribute('aria-current', 'page');
            }
          });
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });

    sections.forEach(section => observer.observe(section));
  }

  function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(el => observer.observe(el));
  }

  function initBackToTop() {
    const btn = document.querySelector('.back-to-top');
    window.addEventListener('scroll', () => {
      btn.hidden = window.scrollY < 500;
    }, { passive: true });
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function updateYear() {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }
})();
