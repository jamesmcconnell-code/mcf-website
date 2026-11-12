/*
 * Scoops landing page decoration for AEM Edge Delivery Services.
 *
 * Expected doc structure (sections separated by ---):
 *   1. Hero:     H1, description paragraph, "Support | Privacy Policy" links
 *   2. Gallery:  banner image, screenshots image (images only)
 *   3. Support:  H2 Support, text, list, H3 FAQ + Q&A paragraphs
 *   4. Policy:   H2 Privacy Policy and sub-sections
 *
 * Usage (scripts/scripts.js):
 *   import decorateLanding from './landing.js';
 *   ...
 *   async function loadEager(doc) {
 *     ...
 *     decorateMain(main);
 *     decorateLanding(main);   // <-- add this line
 *     ...
 *   }
 */

const slugify = (text) => text
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

function isLandingPage() {
  const path = window.location.pathname.replace(/\/$/, '');
  return path === '' || path === '/index';
}

/** Make sure every heading has an id so the in-page links always resolve. */
function ensureHeadingIds(main) {
  main.querySelectorAll('h1, h2, h3').forEach((h) => {
    if (!h.id) h.id = slugify(h.textContent);
  });
}

/**
 * Google Docs heading links (#h.xxxx) don't exist on the live site.
 * Point every in-page link at the heading whose text matches the link text.
 */
function fixAnchorLinks(main) {
  const headings = [...main.querySelectorAll('h1, h2, h3')];
  main.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    let hash = '';
    try {
      const url = new URL(href, window.location.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname) {
        hash = url.hash;
      }
    } catch (e) {
      return;
    }
    if (!hash && !href.startsWith('#')) return;
    const target = hash ? main.querySelector(`[id="${CSS.escape(hash.slice(1))}"]`) : null;
    if (target) return;
    const label = a.textContent.trim().toLowerCase();
    const match = headings.find((h) => h.textContent.trim().toLowerCase() === label);
    if (match) a.setAttribute('href', `#${match.id}`);
  });
}

function decorateHero(section) {
  section.classList.add('landing-hero');
  const linksPara = [...section.querySelectorAll('p')].find((p) => p.querySelectorAll('a').length >= 2);
  if (!linksPara) return;
  const nav = document.createElement('nav');
  nav.className = 'landing-links';
  nav.setAttribute('aria-label', 'App information');
  linksPara.querySelectorAll('a').forEach((a, i) => {
    a.className = i === 0 ? 'landing-btn landing-btn-primary' : 'landing-btn';
    a.removeAttribute('title');
    nav.append(a);
  });
  linksPara.replaceWith(nav);
}

/**
 * The first image on the page becomes the hero banner at the very top of the
 * hero section (above the title). Remaining images stay in the gallery.
 */
function moveBannerToHero(hero, gallery) {
  const pic = gallery.querySelector('picture');
  if (!pic) return;

  const img = pic.querySelector('img');
  if (img) {
    if (!img.alt) img.alt = 'Scoops app banner';
    // Banner is now the LCP image: load it right away.
    img.loading = 'eager';
    img.setAttribute('fetchpriority', 'high');
  }

  const media = document.createElement('div');
  media.className = 'landing-hero-media';
  const figure = document.createElement('figure');
  figure.className = 'landing-banner';
  figure.append(pic);
  media.append(figure);
  hero.prepend(media);
}

function decorateGallery(section) {
  section.classList.add('landing-gallery');
  const wrapper = section.querySelector('.default-content-wrapper') || section;
  const pictures = [...section.querySelectorAll('picture')];

  wrapper.querySelectorAll('p').forEach((p) => {
    if (!p.textContent.trim() && !p.querySelector('picture, img')) p.remove();
  });

  // Nothing left once the banner moved to the hero: drop the empty section.
  if (!pictures.length) {
    section.remove();
    return;
  }

  const container = document.createElement('div');
  container.className = 'landing-media';

  pictures.forEach((pic) => {
    const img = pic.querySelector('img');
    if (img && !img.alt) img.alt = 'Scoops app screenshots';
    const figure = document.createElement('figure');
    figure.className = 'landing-screens';
    figure.append(pic);
    // Lets the screenshot strip scroll sideways on small phones.
    const scroller = document.createElement('div');
    scroller.className = 'landing-screens-scroller';
    scroller.tabIndex = 0;
    scroller.setAttribute('aria-label', 'App screenshots, scroll horizontally');
    scroller.append(figure);
    container.append(scroller);
  });

  wrapper.prepend(container);
}

/** Turn "<strong>Question?</strong><br>Answer" paragraphs into FAQ cards. */
function decorateFaq(section) {
  const faqHeading = section.querySelector('h3');
  if (!faqHeading) return;
  const list = document.createElement('div');
  list.className = 'landing-faq';
  let el = faqHeading.nextElementSibling;
  while (el && el.tagName === 'P') {
    const next = el.nextElementSibling;
    const q = el.querySelector(':scope > strong:first-child');
    if (q) {
      el.classList.add('landing-faq-item');
      list.append(el);
    }
    el = next;
  }
  if (list.children.length) faqHeading.after(list);
}

export default function decorateLanding(main) {
  if (!main || !isLandingPage()) return;
  document.body.classList.add('landing');

  ensureHeadingIds(main);

  const sections = [...main.querySelectorAll(':scope > .section')];
  const isGallery = (s) => s.querySelector('picture')
    && !s.querySelector('h1, h2, h3, ul, ol')
    && !s.textContent.trim();
  const hero = sections.find((s) => s.querySelector('h1'));
  const firstGallery = sections.find(isGallery);
  if (hero && firstGallery) moveBannerToHero(hero, firstGallery);

  sections.forEach((section) => {
    const h1 = section.querySelector('h1');
    const h2 = section.querySelector('h2');

    if (h1) decorateHero(section);
    else if (section === firstGallery || isGallery(section)) decorateGallery(section);
    else if (h2 && /support/i.test(h2.textContent)) {
      section.classList.add('landing-support', 'landing-doc');
      decorateFaq(section);
    } else if (h2 && /privacy/i.test(h2.textContent)) {
      section.classList.add('landing-policy', 'landing-doc');
      const updated = section.querySelector('h2 + p > em:only-child');
      if (updated) updated.parentElement.classList.add('landing-updated');
    }
  });

  fixAnchorLinks(main);
}
