(function () {
  document.addEventListener('click', function (e) {
    const prevBtn = e.target.closest('[data-upsell-prev]');
    const nextBtn = e.target.closest('[data-upsell-next]');
    const block = (prevBtn || nextBtn)?.closest('[data-cart-drawer-upsell]');
    const track = block?.querySelector('[data-upsell-track]');
    if (prevBtn && track) {
      e.preventDefault();
      track.scrollBy({ left: -track.offsetWidth * 0.8, behavior: 'smooth' });
    } else if (nextBtn && track) {
      e.preventDefault();
      track.scrollBy({ left: track.offsetWidth * 0.8, behavior: 'smooth' });
    }
  });

  document.addEventListener('submit', function (e) {
    if (!e.target?.matches?.('[data-upsell-add-form]')) return;
    const form = e.target;
    e.preventDefault();
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      if (btn?.disabled) return;

      const formData = new FormData(form);
      const cartDrawer = form.closest('cart-drawer') || document.querySelector('cart-drawer');
      const routes = window.routes || {};
      if (cartDrawer?.getSectionsToRender) {
        const sections = cartDrawer.getSectionsToRender().map((s) => s.id || s.section).filter(Boolean);
        formData.append('sections', sections.join(','));
        formData.append('sections_url', routes.root_url || window.shopUrl || '/');
      }

      btn.disabled = true;
      btn.classList.add('loading');

      fetch(routes.cart_add_url || '/cart/add', {
        method: 'POST',
        body: formData,
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.status && data.status !== 200) {
            if (data.description) alert(data.description);
            return;
          }
          if (data.sections && cartDrawer?.renderContents) {
            cartDrawer.renderContents(data);
          }
          if (typeof window.publish === 'function' && window.PUB_SUB_EVENTS?.cartUpdate) {
            window.publish(window.PUB_SUB_EVENTS.cartUpdate, { source: 'cart-drawer-upsell', cartData: data });
          }
        })
        .catch(() => {
          form.submit();
        })
        .finally(() => {
          btn.disabled = false;
          btn.classList.remove('loading');
        });
  });

})();
