/* ===== MENU PAGE — Filter Logic ===== */

document.addEventListener('DOMContentLoaded', () => {
  const filterBtns = document.querySelectorAll('.menu-filter__btn');
  const menuCards = document.querySelectorAll('.menu-card');
  const menuCategories = document.querySelectorAll('.menu-category');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;

      if (filter === 'all') {
        // Show all categories and cards
        menuCategories.forEach(cat => {
          cat.style.display = '';
        });
        menuCards.forEach(card => {
          card.style.display = '';
          if (typeof gsap !== 'undefined') {
            gsap.fromTo(card, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
          }
        });
        // Show all dividers
        document.querySelectorAll('.divider').forEach(d => d.style.display = '');
      } else {
        // Hide all categories first
        menuCategories.forEach(cat => cat.style.display = 'none');
        document.querySelectorAll('.divider').forEach(d => d.style.display = 'none');

        // Show matching cards
        menuCards.forEach(card => {
          const category = card.dataset.category;
          if (category === filter) {
            card.style.display = '';
            card.closest('.menu-category').style.display = '';
            if (typeof gsap !== 'undefined') {
              gsap.fromTo(card, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', delay: 0.05 });
            }
          } else {
            card.style.display = 'none';
          }
        });
      }
    });
  });
});
