/*
 * Scoops landing page decoration for AEM Edge Delivery Services.
 *
 * Doc structure (sections separated by ---):
 *   1. Hero:     H1, description paragraph, "Support | Privacy Policy" links
 *   2. Gallery:  banner image, screenshots image
 *   The first image on the page always becomes the full-width hero banner,
 *   wherever it sits in the doc; other images become the screenshot gallery.
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

/** Remove now-empty wrappers (p, block, section) left behind after moving an image. */
function pruneEmpty(el, main) {
  let node = el;
  while (node && node !== main) {
    const parent = node.parentElement;
    const empty = !node.textContent.trim() && !node.querySelector('picture, img, video, iframe');
    if (!empty) break;
    node.remove();
    node = parent;
  }
}

/**
 * The first image anywhere on the page becomes a full-width banner at the very
 * top of the hero section, no matter how the doc is split into sections.
 */
function buildHeroBanner(main, hero) {
  const pic = main.querySelector('picture');
  if (!pic) return;
  const oldParent = pic.parentElement;

  const img = pic.querySelector('img');
  if (img) {
    if (!img.alt) img.alt = 'Scoops app banner';
    // Banner is the LCP image: load it right away.
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
  pruneEmpty(oldParent, main);
}

/**
 * Every other image (screenshots) goes into one gallery section placed right
 * after the hero. Reuses an images-only section if the doc has one.
 */
function buildGallery(main, hero) {
  const pictures = [...main.querySelectorAll('picture')]
    .filter((pic) => !pic.closest('.landing-hero-media'));
  if (!pictures.length) return;

  let section = [...main.querySelectorAll(':scope > .section')].find((s) => s !== hero
    && s.querySelector('picture')
    && !s.querySelector('h1, h2, h3, ul, ol')
    && !s.textContent.trim());
  if (!section) {
    section = document.createElement('div');
    section.className = 'section';
    if (hero.dataset.sectionStatus) section.dataset.sectionStatus = hero.dataset.sectionStatus;
    hero.after(section);
  }
  section.classList.add('landing-gallery');

  let wrapper = section.querySelector(':scope > .default-content-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'default-content-wrapper';
    section.append(wrapper);
  }

  const container = document.createElement('div');
  container.className = 'landing-media';

  pictures.forEach((pic) => {
    const oldParent = pic.parentElement;
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
    if (oldParent && !section.contains(oldParent)) pruneEmpty(oldParent, main);
  });

  wrapper.querySelectorAll('p').forEach((p) => {
    if (!p.textContent.trim() && !p.querySelector('picture, img')) p.remove();
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
  const hero = sections.find((s) => s.querySelector('h1')) || sections[0];
  if (!hero) return;

  hero.classList.add('landing-hero');
  buildHeroBanner(main, hero);
  buildGallery(main, hero);
  decorateHero(hero);

  main.querySelectorAll(':scope > .section').forEach((section) => {
    const h2 = section.querySelector('h2');
    if (!h2 || section === hero) return;
    if (/support/i.test(h2.textContent)) {
      section.classList.add('landing-support', 'landing-doc');
      decorateFaq(section);
    } else if (/privacy/i.test(h2.textContent)) {
      section.classList.add('landing-policy', 'landing-doc');
      const updated = section.querySelector('h2 + p > em:only-child');
      if (updated) updated.parentElement.classList.add('landing-updated');
    }
  });

  fixAnchorLinks(main);
}
