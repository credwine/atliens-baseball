/* ATLiens Baseball -- site.js */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- year stamp ---------- */
  const y = $('#y');
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- nav: scrolled state + mobile toggle ---------- */
  const nav = $('.nav');
  const navToggle = $('.nav-toggle');
  const navLinks = $('.nav-links');
  const onScroll = () => { nav.classList.toggle('scrolled', window.scrollY > 40); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('.nav-links a').forEach(a => a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  /* ---------- hero image crossfade ---------- */
  const heroImgs = $$('.hero-img');
  let heroIdx = 0;
  if (heroImgs.length > 1) {
    setInterval(() => {
      heroImgs[heroIdx].classList.remove('active');
      heroIdx = (heroIdx + 1) % heroImgs.length;
      heroImgs[heroIdx].classList.add('active');
    }, 4200);
  }

  /* ---------- custom cursor (desktop) ---------- */
  const cursor = $('.fx-cursor');
  if (cursor && window.matchMedia('(hover: hover)').matches) {
    let cx = 0, cy = 0, tx = 0, ty = 0;
    window.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
    const tick = () => {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      cursor.style.transform = `translate(${cx - 20}px, ${cy - 20}px)`;
      requestAnimationFrame(tick);
    };
    tick();
    const hoverables = 'a, button, .bball-card, .jersey-card, .gal, .stats li, .join-card';
    document.addEventListener('mouseover', e => { if (e.target.closest(hoverables)) cursor.classList.add('hov'); });
    document.addEventListener('mouseout', e => { if (e.target.closest(hoverables)) cursor.classList.remove('hov'); });
  }

  /* ---------- scroll reveal ---------- */
  const tagReveal = () => {
    // hero ticker & content: always visible
    // generic targets:
    $$('.section-kicker, .section-title, .section-lede, .trophy-kicker, .trophy-title, .trophy-photo, .trophy-caption, .join-kicker, .join-title, .join-inner > p, .foot-inner').forEach(el => el.classList.add('reveal'));
    $$('.about-copy').forEach(el => el.classList.add('reveal-left'));
    $$('.stats').forEach(el => el.classList.add('reveal-right'));
    $$('.jersey-rail, .card-grid, .gal-grid, .join-cards, .join-cta').forEach(el => el.classList.add('stagger'));
  };
  tagReveal();

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        // word-flip title children
        if (e.target.classList.contains('section-title') || e.target.classList.contains('about-copy')) {
          $$('.word-flip', e.target).forEach((w, i) => setTimeout(() => w.classList.add('in'), 80 * i));
        }
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal, .reveal-left, .reveal-right, .stagger').forEach(el => io.observe(el));

  // trigger about-copy word-flip on view
  const aboutCopy = $('.about-copy');
  if (aboutCopy) {
    const ioAbout = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          $$('.word-flip', aboutCopy).forEach((w, i) => setTimeout(() => w.classList.add('in'), 120 * i));
          ioAbout.disconnect();
        }
      });
    }, { threshold: 0.4 });
    ioAbout.observe(aboutCopy);
  }

  /* ---------- stat counter ---------- */
  $$('.stat-num').forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    if (isNaN(target)) return;
    const ioStat = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const dur = 1600;
          const start = performance.now();
          const isYear = target >= 1900 && target <= 2100;
          const fmt = n => isYear ? String(n) : n.toLocaleString();
          const step = now => {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = fmt(Math.floor(target * eased));
            if (p < 1) requestAnimationFrame(step);
            else el.textContent = fmt(target);
          };
          requestAnimationFrame(step);
          ioStat.disconnect();
        }
      });
    }, { threshold: 0.6 });
    ioStat.observe(el);
  });

  /* ---------- baseball card flip + tilt ---------- */
  $$('.bball-card').forEach(card => {
    // flip on click / Enter
    card.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      card.classList.toggle('flipped');
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('flipped'); }
    });
    // tilt
    const inner = $('.bball-inner', card);
    const holo = $('.holo', card);
    let raf;
    card.addEventListener('mousemove', e => {
      if (card.classList.contains('flipped')) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      const rx = (0.5 - y) * 16;
      const ry = (x - 0.5) * 16;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        inner.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
        if (holo) holo.style.backgroundPosition = `${x * 100}% ${y * 100}%`;
      });
    });
    card.addEventListener('mouseleave', () => {
      if (!card.classList.contains('flipped')) inner.style.transform = '';
    });
  });

  /* ---------- gallery: subtle parallax ---------- */
  const gals = $$('.gal img');
  if (gals.length) {
    const ioGal = new IntersectionObserver(entries => {
      entries.forEach(e => e.target.dataset.vis = e.isIntersecting ? '1' : '0');
    }, { threshold: 0 });
    gals.forEach(g => ioGal.observe(g));
    window.addEventListener('scroll', () => {
      const vh = window.innerHeight;
      gals.forEach(g => {
        if (g.dataset.vis !== '1') return;
        const r = g.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        const p = (mid - vh / 2) / vh;
        g.style.transform = `translateY(${p * -18}px) scale(1.05)`;
      });
    }, { passive: true });
  }

  /* ---------- hero parallax scroll ---------- */
  const heroStack = $('.hero-stack');
  if (heroStack) {
    window.addEventListener('scroll', () => {
      const y = Math.min(window.scrollY, window.innerHeight);
      heroStack.style.transform = `translateY(${y * 0.25}px) scale(${1 + y * 0.0004})`;
    }, { passive: true });
  }
})();
