// ── Year ──
document.getElementById('year').textContent = new Date().getFullYear();

// ── Header height CSS var ──
(function() {
  const hdr = document.querySelector('.site-header');
  function setH() { document.documentElement.style.setProperty('--header-h', hdr.offsetHeight + 'px'); }
  setH();
  window.addEventListener('resize', setH);
})();

// ── Mobile nav ──
const navToggle = document.getElementById('navToggle');
const navOverlay = document.getElementById('navOverlay');
const mainContent = document.getElementById('main-content');
const projectView = document.getElementById('project-view');
const projectContent = document.getElementById('projectContent');

function openNav() {
  navToggle.classList.add('is-open');
  navOverlay.classList.add('is-open');
}

function closeNav() {
  navToggle.classList.remove('is-open');
  navOverlay.classList.remove('is-open');
}

navToggle.addEventListener('click', () => {
  navToggle.classList.contains('is-open') ? closeNav() : openNav();
});

navOverlay.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProject(); });

// ── Emoji bounce on nav hover ──
document.querySelectorAll('.site-header nav a').forEach(link => {
  const emoji = link.querySelector('.nav-emoji');
  if (!emoji) return;

  let hovered = false;

  link.addEventListener('mouseenter', () => {
    hovered = true;
    if (!emoji.classList.contains('bouncing')) {
      emoji.classList.add('bouncing');
    }
  });

  link.addEventListener('mouseleave', () => {
    hovered = false;
    emoji.addEventListener('animationiteration', () => {
      if (!hovered) emoji.classList.remove('bouncing');
    }, { once: true });
  });
});

// ── Build gallery ──
const gallery = document.getElementById('gallery');

projects.forEach((p, i) => {
  const item = document.createElement('div');
  item.className = 'gallery-item';
  item.dataset.index = i;
  item.innerHTML = `
    <img src="${p.thumbnail}" alt="${p.title}" loading="lazy" />
    <div class="gallery-item-label">${p.title}</div>
  `;
  item.addEventListener('click', () => openProject(i));
  gallery.appendChild(item);
});

// ── Project page ──
function buildProjectHTML(i) {
  const p = projects[i];
  const pg = p.page;
  const mediaHTML = (pg.media || []).map(m => {
    if (m.type === 'mux' || m.type === 'video-embed') {
      return `<iframe src="${m.src}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen;" allowfullscreen></iframe>`;
    } else if (m.type === 'video') {
      return `<video src="${m.src}" controls playsinline></video>`;
    } else {
      return `<img src="${m.src}" alt="${p.title}" />`;
    }
  }).join('');
  const linksHTML = (pg.links || []).map(l =>
    `<a href="${l.url}" class="btn" target="_blank" rel="noopener">${l.label}</a>`
  ).join('');
  const descHTML = pg.description
    ? pg.description.trim().split(/\n\n+/).map(p => `<p class="project-page-description">${p.trim()}</p>`).join('')
    : '';
  const prev = projects[i - 1] || null;
  const next = projects[i + 1] || null;
  const prevHTML = prev
    ? `<button class="project-nav-link project-nav-link--prev" onclick="openProject(${i - 1})">
        <span class="project-nav-arrow">←</span>
        <span class="project-nav-label">${prev.title}</span>
       </button>`
    : `<span></span>`;
  const nextHTML = next
    ? `<button class="project-nav-link project-nav-link--next" onclick="openProject(${i + 1})">
        <span class="project-nav-label">${next.title}</span>
        <span class="project-nav-arrow">→</span>
       </button>`
    : `<span></span>`;

  return `
    <div class="project-page">
      <h1 class="project-page-title">${p.title}</h1>
      ${descHTML}
      ${mediaHTML ? `<div class="project-page-media">${mediaHTML}</div>` : ''}
      ${linksHTML ? `<div class="project-page-links">${linksHTML}</div>` : ''}
      <nav class="project-nav">
        ${prevHTML}
        ${nextHTML}
      </nav>
    </div>
  `;
}

function openProject(i) {
  const p = projects[i];
  history.pushState({ projectIndex: i }, '', '/' + (p.slug || i));
  projectContent.innerHTML = buildProjectHTML(i);
  mainContent.style.display = 'none';
  projectView.style.display = 'block';
  window.scrollTo(0, 0);
}

function closeProject(pushHistory = true) {
  if (pushHistory) history.pushState(null, '', '/');
  projectView.style.display = 'none';
  projectContent.querySelectorAll('iframe').forEach(f => f.src = f.src);
  projectContent.innerHTML = '';
  mainContent.style.display = '';
}

// Handle browser back/forward
window.addEventListener('popstate', e => {
  if (e.state && e.state.projectIndex != null) {
    const i = e.state.projectIndex;
    projectContent.innerHTML = buildProjectHTML(i);
    mainContent.style.display = 'none';
    projectView.style.display = 'block';
    window.scrollTo(0, 0);
  } else {
    projectView.style.display = 'none';
    projectContent.innerHTML = '';
    mainContent.style.display = '';
  }
});

// Deep-link: open project if URL matches a slug on page load
(() => {
  const slug = window.location.pathname.replace(/^\//, '');
  if (slug) {
    const i = projects.findIndex(p => p.slug === slug);
    if (i !== -1) openProject(i);
  }
})();

// ── Scrollbar fade ──
let scrollTimer;
document.addEventListener('scroll', () => {
  document.documentElement.classList.add('is-scrolling');
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => document.documentElement.classList.remove('is-scrolling'), 900);
}, { passive: true });
