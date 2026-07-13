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
  document.body.classList.add('nav-open');
}

function closeNav() {
  navToggle.classList.remove('is-open');
  navOverlay.classList.remove('is-open');
  document.body.classList.remove('nav-open');
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
  const scaleVar = p.thumbnailScale ? ` style="--thumb-scale:${p.thumbnailScale}"` : '';
  item.innerHTML = `
    <div class="gallery-item-thumb">
      <img src="${p.thumbnail}" alt="${p.title}" loading="lazy"${scaleVar} />
      <div class="gallery-item-overlay"><span>${p.title}</span></div>
    </div>
    <div class="gallery-item-label">${p.title}</div>
  `;
  item.addEventListener('click', () => openProject(i));
  gallery.appendChild(item);
});

// ── Retry thumbnails that fail to load (transient network blips) ──
gallery.querySelectorAll('.gallery-item-thumb img').forEach(img => {
  const baseSrc = img.getAttribute('src');
  let attempts = 0;
  img.addEventListener('error', function onError() {
    attempts++;
    if (attempts > 3) return;
    const sep = baseSrc.includes('?') ? '&' : '?';
    setTimeout(() => { img.src = baseSrc + sep + 'retry=' + attempts; }, attempts * 800);
  });
});

// ── Project page ──
function buildProjectHTML(i) {
  const p = projects[i];
  const pg = p.page;

  let bodyHTML;
  if (pg.content) {
    // Group consecutive beforeafter items into ba-grid wrappers
    const chunks = [];
    let i = 0;
    while (i < pg.content.length) {
      if (pg.content[i].type === 'beforeafter') {
        const group = [];
        while (i < pg.content.length && pg.content[i].type === 'beforeafter') {
          group.push(pg.content[i]);
          i++;
        }
        chunks.push({ type: 'beforeafter-group', items: group });
      } else {
        chunks.push(pg.content[i]);
        i++;
      }
    }

    bodyHTML = chunks.map(item => {
      if (item.type === 'text')    return `<p class="project-page-description fade-in-item">${item.html}</p>`;
      if (item.type === 'caption') return `<p class="project-page-caption fade-in-item">${item.html}</p>`;
      if (item.type === 'instruction') return `<p class="project-page-instruction fade-in-item">${item.html}</p>`;
      if (item.type === 'heading') return `<h3 class="project-page-subheading fade-in-item">${item.text}</h3>`;
      if (item.type === 'bracket') return `<div class="project-page-bracket fade-in-item">[${item.label}]</div>`;
      if (item.type === 'mux' || item.type === 'video-embed') {
        const arStyle = item.aspectRatio ? ` style="aspect-ratio:${item.aspectRatio}"` : '';
        const narrowClass = item.narrow ? ' project-page-media-item--narrow' : '';
        if (item.endTime != null) {
          const playbackId = item.src.replace(/^https?:\/\/player\.mux\.com\//, '').split('?')[0];
          return `<div class="project-page-media-item${narrowClass} fade-in-item" data-end-time="${item.endTime}" style="aspect-ratio:16/9${item.aspectRatio ? ';aspect-ratio:' + item.aspectRatio : ''}"><mux-player playback-id="${playbackId}" end-time="${item.endTime}" thumbnail-time="0" autoplay muted style="width:100%;height:100%"></mux-player></div>`;
        }
        return `<div class="project-page-media-item${narrowClass} fade-in-item"><iframe src="${item.src}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen;" allowfullscreen${arStyle}></iframe></div>`;
      }
      if (item.type === 'video')
        return `<div class="project-page-media-item fade-in-item"><video src="${item.src}" controls playsinline></video></div>`;
      if (item.type === 'image' || item.type === 'gif')
        return `<div class="project-page-media-item fade-in-item"><img src="${item.src}" alt="${p.title}" /></div>`;
      if (item.type === 'beforeafter-group')
        return `<div class="ba-grid fade-in-item">${item.items.map(it =>
          `<div class="ba-compare"><img class="ba-after" src="${it.after}" alt="${p.title}" /><img class="ba-before" src="${it.before}" alt="${p.title} before" /><span class="ba-label">Before</span></div>`
        ).join('')}</div>`;
      if (item.type === 'text-media-row') {
        const rowStyle = item.gridCols ? ` style="--tmr-cols:${item.gridCols}"` : '';
        const textHTML = `<div class="project-text-media-row__text">${item.heading ? `<h3 class="project-page-subheading">${item.heading}</h3>` : ''}<p class="project-page-description">${item.text}</p></div>`;
        const mediaHTML = item.media.map(it => {
          let el = '';
          if (it.type === 'mux' || it.type === 'video-embed')
            el = `<iframe src="${it.src}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen;" allowfullscreen></iframe>`;
          else if (it.type === 'video')
            el = `<video src="${it.src}" controls playsinline></video>`;
          else if (it.type === 'image' || it.type === 'gif')
            el = `<img src="${it.src}" alt="${p.title}" />`;
          const cap = it.caption ? `<p class="project-page-caption">${it.caption}</p>` : '';
          return el + cap;
        }).join('');
        return `<div class="project-text-media-row fade-in-item"${rowStyle}>${textHTML}<div class="project-text-media-row__media">${mediaHTML}</div></div>`;
      }
      if (item.type === 'media-grid') {
        const cols = item.cols || 2;
        const cells = item.items.map(it => {
          let media = '';
          if (it.type === 'mux' || it.type === 'video-embed') {
            const arStyle = it.aspectRatio ? ` style="aspect-ratio:${it.aspectRatio}"` : '';
            media = `<iframe src="${it.src}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen;" allowfullscreen${arStyle}></iframe>`;
          }
          else if (it.type === 'video')
            media = `<video src="${it.src}" controls playsinline></video>`;
          else if (it.type === 'image' || it.type === 'gif')
            media = `<img src="${it.src}" alt="${p.title}" />`;
          const cap = it.caption ? `<p class="project-page-caption">${it.caption}</p>` : '';
          const spanStyle = it.span ? ` style="grid-column:span ${it.span}"` : '';
          return `<div class="project-media-grid-item"${spanStyle}>${media}${cap}</div>`;
        }).join('');
        return `<div class="project-media-grid fade-in-item" style="--cols:${cols}">${cells}</div>`;
      }
      return '';
    }).join('\n');
  } else {
    const mediaHTML = (pg.media || []).map(m => {
      if (m.type === 'mux' || m.type === 'video-embed')
        return `<iframe src="${m.src}" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen;" allowfullscreen></iframe>`;
      if (m.type === 'video') return `<video src="${m.src}" controls playsinline></video>`;
      return `<img src="${m.src}" alt="${p.title}" />`;
    }).join('');
    const descHTML = pg.description
      ? pg.description.trim().split(/\n\n+/).map(b => `<p class="project-page-description">${b.trim()}</p>`).join('')
      : '';
    bodyHTML = descHTML + (mediaHTML ? `<div class="project-page-media">${mediaHTML}</div>` : '');
  }

  const linksHTML = (pg.links || []).map(l =>
    `<a href="${l.url}" class="btn" target="_blank" rel="noopener">${l.label}</a>`
  ).join('');
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
      ${bodyHTML}
      ${linksHTML ? `<div class="project-page-links">${linksHTML}</div>` : ''}
      <nav class="project-nav">
        ${prevHTML}
        ${nextHTML}
      </nav>
    </div>
  `;
}

function setupMuxEndTimes(container) {
  container.querySelectorAll('[data-end-time]').forEach(function(wrapper) {
    const end = parseFloat(wrapper.dataset.endTime);
    const player = wrapper.querySelector('mux-player');
    if (!player) return;
    const timer = setInterval(function() {
      if (player.currentTime >= end) {
        player.pause();
        clearInterval(timer);
      }
    }, 100);
    wrapper._muxCleanup = function() { clearInterval(timer); };
  });
}

function openProject(i) {
  const p = projects[i];
  history.pushState({ projectIndex: i }, '', 'projects.html#' + (p.slug || i));
  projectContent.innerHTML = buildProjectHTML(i);
  mainContent.style.display = 'none';
  projectView.style.display = 'block';
  window.scrollTo(0, 0);
  setupMuxEndTimes(projectContent);
  requestAnimationFrame(() => {
    const page = projectContent.querySelector('.project-page');
    if (page) {
      page.classList.add('project-page--enter');
      requestAnimationFrame(() => page.classList.add('project-page--enter-active'));
    }
    if (typeof observeFadeItems === 'function') observeFadeItems(projectContent);
    projectContent.querySelectorAll('.ba-compare').forEach(el => {
      el.addEventListener('click', () => el.classList.toggle('is-before'));
    });
  });
}

// ── Gallery staggered fade-in ──
(function () {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('gallery-item--visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.gallery-item').forEach((item, i) => {
    item.style.transitionDelay = `${i * 60}ms`;
    observer.observe(item);
  });
}());

function closeProject(pushHistory = true) {
  if (pushHistory) history.pushState(null, '', 'projects.html');
  projectContent.querySelectorAll('[data-end-time]').forEach(function(w) {
    if (w._muxCleanup) { w._muxCleanup(); delete w._muxCleanup; }
  });
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

// Deep-link: open project if URL hash matches a slug on page load
(() => {
  const slug = window.location.hash.replace(/^#/, '');
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
