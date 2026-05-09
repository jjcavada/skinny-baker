/* ===== SKINNY BAKER — Main JS (Redesigned) ===== */

document.addEventListener('DOMContentLoaded', () => {

  /* --- Navigation --- */
  const nav = document.querySelector('.nav');
  const hamburger = document.querySelector('.nav__hamburger');
  const navLinks = document.querySelector('.nav__links');
  const navItems = document.querySelectorAll('.nav__link');

  const handleNavScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);
  };
  window.addEventListener('scroll', handleNavScroll);
  handleNavScroll();

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      navLinks.classList.toggle('open');
      document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
    });
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      hamburger?.classList.remove('open');
      navLinks?.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  // Active page
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  navItems.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });


  /* --- Cursor Glow (desktop only) --- */
  const cursorGlow = document.getElementById('cursorGlow');
  if (cursorGlow && window.matchMedia('(hover: hover)').matches) {
    let mouseX = 0, mouseY = 0;
    let glowX = 0, glowY = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorGlow.classList.add('active');
    });

    document.addEventListener('mouseleave', () => {
      cursorGlow.classList.remove('active');
    });

    function animateGlow() {
      glowX += (mouseX - glowX) * 0.08;
      glowY += (mouseY - glowY) * 0.08;
      cursorGlow.style.left = glowX + 'px';
      cursorGlow.style.top = glowY + 'px';
      requestAnimationFrame(animateGlow);
    }
    animateGlow();
  }


  /* --- GSAP Animations --- */
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    // Default ease for all tweens
    gsap.defaults({ ease: 'power3.out' });

    // Reveal animations — staggered with more dramatic movement
    document.querySelectorAll('.reveal').forEach(el => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 1,
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none'
        }
      });
    });

    document.querySelectorAll('.reveal-left').forEach(el => {
      gsap.to(el, {
        opacity: 1,
        x: 0,
        duration: 1,
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      });
    });

    document.querySelectorAll('.reveal-right').forEach(el => {
      gsap.to(el, {
        opacity: 1,
        x: 0,
        duration: 1,
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      });
    });

    document.querySelectorAll('.reveal-scale').forEach(el => {
      gsap.to(el, {
        opacity: 1,
        scale: 1,
        duration: 1,
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      });
    });

    // Staggered children
    document.querySelectorAll('[data-stagger]').forEach(group => {
      const children = group.children;
      gsap.set(children, { opacity: 0, y: 40 });
      ScrollTrigger.create({
        trigger: group,
        start: 'top 90%',
        once: true,
        onEnter: () => {
          gsap.to(children, {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.12,
            ease: 'power3.out'
          });
        }
      });
    });

    // Refresh ScrollTrigger after all images load
    window.addEventListener('load', () => {
      ScrollTrigger.refresh();
    });

    // Parallax backgrounds
    document.querySelectorAll('.parallax-bg').forEach(bg => {
      gsap.to(bg, {
        yPercent: 25,
        ease: 'none',
        scrollTrigger: {
          trigger: bg.parentElement,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.5
        }
      });
    });

    // Floating elements — gentle, organic motion
    document.querySelectorAll('.float-element').forEach((el, i) => {
      gsap.to(el, {
        y: -15 - (i * 8),
        rotation: 3 + (i * 2),
        duration: 4 + (i * 0.7),
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      });
    });

    // Animated counters
    document.querySelectorAll('[data-count]').forEach(counter => {
      const target = parseInt(counter.getAttribute('data-count'));
      const suffix = counter.getAttribute('data-suffix') || '';
      gsap.to(counter, {
        innerText: target,
        duration: 2.5,
        snap: { innerText: 1 },
        ease: 'power2.out',
        scrollTrigger: {
          trigger: counter,
          start: 'top 85%',
          toggleActions: 'play none none none'
        },
        onUpdate: function() {
          counter.textContent = Math.round(parseFloat(counter.textContent)) + suffix;
        }
      });
    });

    // Marquee
    document.querySelectorAll('.marquee__track').forEach(track => {
      const clone = track.innerHTML;
      track.innerHTML += clone;
      gsap.to(track, {
        xPercent: -50,
        duration: 25,
        ease: 'none',
        repeat: -1
      });
    });

    // Magnetic buttons
    document.querySelectorAll('.btn--magnetic').forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        gsap.to(btn, { x: x * 0.25, y: y * 0.25, duration: 0.3, ease: 'power2.out' });
      });
      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      });
    });

    /* --- Hero: Logo Composition Entrance --- */
    const heroSection = document.getElementById('heroSection');
    const frameIntro = document.getElementById('heroFrameIntro');

    if (heroSection && frameIntro) {
      const heroWhisk = frameIntro.querySelector('.hero-logo__whisk');
      const heroPin = frameIntro.querySelector('.hero-logo__pin');
      const heroSprigLeft = frameIntro.querySelector('.hero-logo__sprig--left');
      const heroSprigRight = frameIntro.querySelector('.hero-logo__sprig--right');
      const heroEyebrow = frameIntro.querySelector('.hero-logo__eyebrow');
      const heroTitleThe = frameIntro.querySelector('.hero-logo__title-the');
      const heroTitleScript = frameIntro.querySelector('.hero-logo__title-script');
      const heroRuleParts = frameIntro.querySelectorAll('.hero-logo__rule-line, .hero-logo__rule-diamond');
      const heroSubtitle = frameIntro.querySelector('.hero-logo__subtitle');

      // Utensils swing in from sides
      if (heroWhisk) gsap.fromTo(heroWhisk, { opacity: 0, rotation: -30, x: -40 }, { opacity: 1, rotation: 15, x: 0, duration: 1.2, ease: 'power3.out', delay: 0.1 });
      if (heroPin) gsap.fromTo(heroPin, { opacity: 0, rotation: 30, x: 40 }, { opacity: 1, rotation: -15, x: 0, duration: 1.2, ease: 'power3.out', delay: 0.2 });

      // Botanical sprigs grow in from edges
      if (heroSprigLeft) gsap.fromTo(heroSprigLeft, { opacity: 0, x: 60, scale: 0.7 }, { opacity: 1, x: 0, scale: 1, duration: 1.4, ease: 'power3.out', delay: 0.5 });
      if (heroSprigRight) gsap.fromTo(heroSprigRight, { opacity: 0, x: -60, scale: 0.7 }, { opacity: 1, x: 0, scale: 1, duration: 1.4, ease: 'power3.out', delay: 0.6 });

      // Eyebrow fades in
      if (heroEyebrow) gsap.fromTo(heroEyebrow, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.3 });

      // "The" drops in with letter-spacing animation
      if (heroTitleThe) gsap.fromTo(heroTitleThe, { opacity: 0, y: -20, letterSpacing: '0.8em' }, { opacity: 1, y: 0, letterSpacing: '0.35em', duration: 1, ease: 'power3.out', delay: 0.5 });

      // "Skinny Baker" script sweeps in
      if (heroTitleScript) gsap.fromTo(heroTitleScript, { opacity: 0, scale: 0.85, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 1.4, ease: 'power3.out', delay: 0.65 });

      // Rule lines expand from center
      if (heroRuleParts.length) gsap.fromTo(heroRuleParts, { opacity: 0, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: 0.8, stagger: 0.1, ease: 'power3.out', delay: 1 });

      // Subtitle fades up
      if (heroSubtitle) gsap.fromTo(heroSubtitle, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 1.2 });
    }

    // Page header oversized letter parallax
    document.querySelectorAll('.page-header').forEach(header => {
      gsap.to(header, {
        '--letter-y': '30px',
        ease: 'none',
        scrollTrigger: {
          trigger: header,
          start: 'top top',
          end: 'bottom top',
          scrub: 1
        }
      });
    });
  }


  /* --- Smooth anchor scrolling --- */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });


  /* --- Feedback Carousel (GSAP-powered) --- */
  const carousel = document.getElementById('feedbackCarousel');
  if (carousel && typeof gsap !== 'undefined') {
    const images = carousel.querySelectorAll('.feedback-carousel__img');
    const prevBtn = carousel.querySelector('.feedback-carousel__arrow--prev');
    const nextBtn = carousel.querySelector('.feedback-carousel__arrow--next');
    const currentEl = carousel.querySelector('.feedback-carousel__current');
    const progressBar = document.getElementById('carouselProgress');
    const screen = carousel.querySelector('.feedback-carousel__screen');
    let current = 0;
    let isAnimating = false;
    let autoplayTimer;
    const total = images.length;

    function goToSlide(next, direction) {
      if (isAnimating || next === current) return;
      isAnimating = true;

      const outImg = images[current];
      const inImg = images[next];
      const xOut = direction > 0 ? -30 : 30;
      const xIn = direction > 0 ? 30 : -30;

      // Timeline: outgoing fades + slides out, incoming fades + slides in with scale
      const tl = gsap.timeline({
        onComplete: () => {
          outImg.classList.remove('active');
          current = next;
          isAnimating = false;
        }
      });

      tl.to(outImg, {
        opacity: 0,
        x: xOut,
        scale: 0.92,
        duration: 0.45,
        ease: 'power3.in'
      })
      .fromTo(inImg,
        { opacity: 0, x: xIn, scale: 1.1 },
        {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.55,
          ease: 'power3.out',
          onStart: () => inImg.classList.add('active')
        },
        '-=0.15'
      );

      // Counter animation
      gsap.to(currentEl, {
        y: -15, opacity: 0, duration: 0.2, ease: 'power2.in',
        onComplete: () => {
          currentEl.textContent = String(next + 1).padStart(2, '0');
          gsap.fromTo(currentEl, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' });
        }
      });

      // Progress bar
      gsap.to(progressBar, { width: ((next + 1) / total * 100) + '%', duration: 0.5, ease: 'power3.out' });
    }

    prevBtn.addEventListener('click', () => {
      const next = (current - 1 + total) % total;
      goToSlide(next, -1);
      resetAutoplay();
    });

    nextBtn.addEventListener('click', () => {
      const next = (current + 1) % total;
      goToSlide(next, 1);
      resetAutoplay();
    });

    // Touch/swipe on phone screen
    let touchStartX = 0;
    screen.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    screen.addEventListener('touchend', (e) => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) {
        const dir = diff > 0 ? 1 : -1;
        goToSlide((current + dir + total) % total, dir);
        resetAutoplay();
      }
    });

    // Autoplay
    function startAutoplay() {
      autoplayTimer = setInterval(() => {
        const next = (current + 1) % total;
        goToSlide(next, 1);
      }, 4500);
    }
    function resetAutoplay() { clearInterval(autoplayTimer); startAutoplay(); }
    startAutoplay();
    carousel.addEventListener('mouseenter', () => clearInterval(autoplayTimer));
    carousel.addEventListener('mouseleave', startAutoplay);
  }


  /* --- Lazy loading --- */
  if ('IntersectionObserver' in window) {
    const lazyImages = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      });
    }, { rootMargin: '100px' });
    lazyImages.forEach(img => imageObserver.observe(img));
  }

});
