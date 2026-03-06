/**
 * Gift wrap edit form - uses event delegation so it works after cart content is replaced via AJAX
 */
(function () {
  function handleEditClick(evt) {
    var editBtn = evt.target.closest('[data-giftwrap-edit]');
    if (!editBtn) return;
    evt.preventDefault();
    var block = editBtn.closest('[data-giftwrap-line]');
    if (!block) return;
    var messageEl = block.querySelector('[data-giftwrap-message]');
    var formEl = block.querySelector('[data-giftwrap-form]');
    var toInput = block.querySelector('[data-giftwrap-to]');
    if (messageEl) messageEl.hidden = true;
    if (formEl) {
      formEl.classList.add('cart-giftwrap-line__form--open');
      formEl.setAttribute('aria-hidden', 'false');
      if (toInput) toInput.focus();
    }
  }

  function handleCancelClick(evt) {
    var cancelBtn = evt.target.closest('[data-giftwrap-cancel]');
    if (!cancelBtn) return;
    evt.preventDefault();
    var block = cancelBtn.closest('[data-giftwrap-line]');
    if (!block) return;
    var messageEl = block.querySelector('[data-giftwrap-message]');
    var formEl = block.querySelector('[data-giftwrap-form]');
    if (formEl) {
      formEl.classList.remove('cart-giftwrap-line__form--open');
      formEl.setAttribute('aria-hidden', 'true');
    }
    if (messageEl) messageEl.hidden = false;
  }

  function handleUpdateClick(evt) {
    var updateBtn = evt.target.closest('[data-giftwrap-update]');
    if (!updateBtn) return;
    evt.preventDefault();
    var block = updateBtn.closest('[data-giftwrap-line]');
    if (!block) return;
    var formEl = block.querySelector('[data-giftwrap-form]');
    var toInput = block.querySelector('[data-giftwrap-to]');
    var fromInput = block.querySelector('[data-giftwrap-from]');
    var msgInput = block.querySelector('[data-giftwrap-message-input]');
    var messageEl = block.querySelector('[data-giftwrap-message]');
    if (!formEl) return;

    var line = parseInt(block.dataset.lineIndex, 10);
    var qty = parseInt(block.dataset.quantity, 10);
    var keyTo = block.dataset.keyTo;
    var keyFrom = block.dataset.keyFrom;
    var keyMessage = block.dataset.keyMessage;
    var keyGift = block.dataset.keyGift;
    var keyYes = block.dataset.keyYes;

    var props = {};
    block.querySelectorAll('.cart-giftwrap-line__prop').forEach(function (inp) {
      props[inp.dataset.propKey] = inp.dataset.propValue || '';
    });
    props[keyGift] = keyYes;
    if (keyTo) props[keyTo] = toInput ? toInput.value.trim() : '';
    if (keyFrom) props[keyFrom] = fromInput ? fromInput.value.trim() : '';
    if (keyMessage) props[keyMessage] = msgInput ? msgInput.value.trim() : '';

    updateBtn.disabled = true;
    var cartUrl = (window.Shopify && window.Shopify.routes && window.Shopify.routes.cart_url) || '/cart';
    var cartJsUrl = cartUrl + '.js';

    fetch(cartJsUrl)
      .then(function (r) { return r.json(); })
      .then(function (cartData) {
        var gwProdId = window.giftWrapProductId ? parseInt(window.giftWrapProductId, 10) : null;
        var gwVarId = window.giftWrapVariantId;
        var hasGw = false;
        if (gwProdId && cartData.items) {
          hasGw = cartData.items.some(function (item) { return item.product_id === gwProdId; });
        }

        var promise = Promise.resolve();
        // If it's missing from the cart, add 1 quantity of the gift wrap product first
        if (!hasGw && gwVarId) {
          var gwPayload = {
            id: gwVarId,
            quantity: 1,
            properties: {}
          };
          if (props[keyTo]) gwPayload.properties['Gift To'] = props[keyTo];
          if (props[keyFrom]) gwPayload.properties['Gift From'] = props[keyFrom];
          if (props[keyMessage]) gwPayload.properties['Gift Message'] = props[keyMessage];

          var addUrl = (window.Shopify && window.Shopify.routes && window.Shopify.routes.cart_add_url) || '/cart/add';
          if (!addUrl.endsWith('.js')) addUrl += '.js';

          promise = fetch(addUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ items: [gwPayload] })
          });
        }
        return promise;
      })
      .then(function () {
        var body = JSON.stringify({
          line: line,
          quantity: qty,
          properties: props,
          sections: 'cart-drawer',
          sections_url: window.location.pathname
        });
        var cartChangeUrl = (window.Shopify && window.Shopify.routes && window.Shopify.routes.cart_change_url) || '/cart/change';
        if (!cartChangeUrl.endsWith('.js')) cartChangeUrl += '.js';

        return fetch(cartChangeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: body
        });
      })
      .then(function (r) { return r.text(); })
      .then(function (text) {
        if (formEl) {
          formEl.classList.remove('cart-giftwrap-line__form--open');
          formEl.setAttribute('aria-hidden', 'true');
        }
        if (messageEl) messageEl.hidden = false;
        var state = JSON.parse(text);
        if (state.sections && state.sections['cart-drawer']) {
          var html = new DOMParser().parseFromString(state.sections['cart-drawer'], 'text/html');
          var newItems = html.querySelector('cart-drawer-items');
          var newFooter = html.querySelector('.cart-drawer__footer');
          if (newItems) {
            var current = document.querySelector('cart-drawer-items');
            if (current) current.replaceWith(newItems.cloneNode(true));
          }
          if (newFooter) {
            var currentFooter = document.querySelector('.drawer__footer .cart-drawer__footer');
            if (currentFooter) currentFooter.replaceWith(newFooter.cloneNode(true));
          }
        } else {
          fetch(cartUrl + '?section_id=cart-drawer').then(function (r) { return r.text(); }).then(function (htmlText) {
            var doc = new DOMParser().parseFromString(htmlText, 'text/html');
            var newItems = doc.querySelector('cart-drawer-items');
            var newFooter = doc.querySelector('.cart-drawer__footer');
            if (newItems) {
              var cur = document.querySelector('cart-drawer-items');
              if (cur) cur.replaceWith(newItems);
            }
            if (newFooter) {
              var curF = document.querySelector('.drawer__footer .cart-drawer__footer');
              if (curF) curF.replaceWith(newFooter);
            }
          });
        }
      })
      .catch(function () {
        if (formEl) formEl.classList.remove('cart-giftwrap-line__form--open');
        if (messageEl) messageEl.hidden = false;
      })
      .finally(function () { updateBtn.disabled = false; });
  }

  document.addEventListener('click', handleEditClick);
  document.addEventListener('click', handleCancelClick);
  document.addEventListener('click', handleUpdateClick);
})();
