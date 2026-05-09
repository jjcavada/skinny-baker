/* ===== GALLERY PAGE — Filter + Lightbox ===== */

document.addEventListener('DOMContentLoaded', () => {

  /* --- Filter --- */
  const filterBtns = document.querySelectorAll('.gallery-filter__btn');
  const items = document.querySelectorAll('.masonry__item');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;

      items.forEach(item => {
        const category = item.dataset.category;
        if (filter === 'all' || category === filter) {
          item.style.display = '';
          if (typeof gsap !== 'undefined') {
            gsap.fromTo(item,
              { opacity: 0, scale: 0.9 },
              { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }
            );
          }
        } else {
          item.style.display = 'none';
        }
      });
    });
  });


  /* --- Lightbox --- */
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = lightbox.querySelector('.lightbox__image');
  const lightboxTag = lightbox.querySelector('.lightbox__tag');
  const lightboxTitle = lightbox.querySelector('.lightbox__title');
  const closeBtn = lightbox.querySelector('.lightbox__close');
  const prevBtn = lightbox.querySelector('.lightbox__prev');
  const nextBtn = lightbox.querySelector('.lightbox__next');

  let currentIndex = 0;
  let visibleItems = [];

  function getVisibleItems() {
    return Array.from(items).filter(item => item.style.display !== 'none');
  }

  function openLightbox(index) {
    visibleItems = getVisibleItems();
    currentIndex = index;
    updateLightbox();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (typeof gsap !== 'undefined') {
      gsap.fromTo(lightbox.querySelector('.lightbox__content'),
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out' }
      );
    }
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateLightbox() {
    const item = visibleItems[currentIndex];
    if (!item) return;

    const tag = item.querySelector('.masonry__tag')?.textContent || '';
    const title = item.querySelector('.masonry__title')?.textContent || '';
    const img = item.querySelector('img');
    const imgSrc = img ? img.src : '';

    lightboxTag.textContent = tag;
    lightboxTitle.textContent = title;
    lightboxImage.src = imgSrc;
    lightboxImage.alt = title;
  }

  function navigate(direction) {
    currentIndex = (currentIndex + direction + visibleItems.length) % visibleItems.length;
    updateLightbox();

    if (typeof gsap !== 'undefined') {
      gsap.fromTo(lightbox.querySelector('.lightbox__image-wrap'),
        { opacity: 0, x: direction * 30 },
        { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' }
      );
    }
  }

  // Click handlers
  items.forEach(item => {
    item.addEventListener('click', () => {
      openLightbox(getVisibleItems().indexOf(item));
    });
  });

  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', () => navigate(-1));
  nextBtn.addEventListener('click', () => navigate(1));

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });

  // Click outside to close
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
});
