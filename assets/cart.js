class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0, event);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      return this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    const maxVal = parseInt(event.target.max) || parseInt(event.target.dataset.max) || 999;
    const stepVal = parseInt(event.target.step) || parseInt(event.target.dataset.step) || 1;
    let message = '';

    if (inputValue < parseInt(event.target.dataset.min || 0)) {
      message = (window.quickOrderListStrings && window.quickOrderListStrings.min_error)
        ? window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min)
        : '';
    } else if (inputValue > maxVal) {
      message = (window.quickOrderListStrings && window.quickOrderListStrings.max_error)
        ? window.quickOrderListStrings.max_error.replace('[max]', maxVal)
        : '';
    } else if (stepVal > 1 && inputValue % stepVal !== 0) {
      message = (window.quickOrderListStrings && window.quickOrderListStrings.step_error)
        ? window.quickOrderListStrings.step_error.replace('[step]', stepVal)
        : '';
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      if (event.target.setCustomValidity) event.target.setCustomValidity('');
      if (event.target.reportValidity) event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        event,
        (document.activeElement && document.activeElement.getAttribute('name')) || event.target.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    if (!event.target.dataset.index && !event.target.matches('.quantity__input, .quantity__select, .cart-quantity-select')) return;
    this.validateQuantity(event);
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      return fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, event, name, variantId) {
    const eventTarget = event.currentTarget instanceof CartRemoveButton ? 'clear' : 'change';
    const cartPerformanceUpdateMarker = CartPerformance.createStartingMarker(`${eventTarget}:user-action`);

    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);

        CartPerformance.measure(`${eventTarget}:paint-updated-sections`, () => {
          const quantityElement =
            document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
          const items = document.querySelectorAll('.cart-item');

          if (parsedState.errors) {
            quantityElement.value = quantityElement.getAttribute('value');
            this.updateLiveRegions(line, parsedState.errors);
            return;
          }

          this.classList.toggle('is-empty', parsedState.item_count === 0);
          const cartDrawerWrapper = document.querySelector('cart-drawer');
          const cartFooter = document.getElementById('main-cart-footer');

          if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
          if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

          this.getSectionsToRender().forEach((section) => {
            const elementToReplace =
              document.getElementById(section.id).querySelector(section.selector) ||
              document.getElementById(section.id);
            elementToReplace.innerHTML = this.getSectionInnerHTML(
              parsedState.sections[section.section],
              section.selector
            );
          });
          const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
          let message = '';
          if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
            if (typeof updatedValue === 'undefined') {
              message = window.cartStrings.error;
            } else {
              message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
            }
          }
          this.updateLiveRegions(line, message);

          const lineItem =
            document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
          if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
            cartDrawerWrapper
              ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
              : lineItem.querySelector(`[name="${name}"]`).focus();
          } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
          } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
          }
        });

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
      })
      .catch(() => {
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
        CartPerformance.measureFromMarker(`${eventTarget}:user-action`, cartPerformanceUpdateMarker);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } }).then(() =>
              CartPerformance.measureFromEvent('note-update:user-action', event)
            );
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}

// Global subscriber to synchronize gift wrap quantity based on cart items
console.log('[GiftWrapSync] Script loaded. Checking for PUB_SUB_EVENTS...');
console.log('[GiftWrapSync] typeof subscribe:', typeof subscribe);
console.log('[GiftWrapSync] typeof PUB_SUB_EVENTS:', typeof PUB_SUB_EVENTS);
console.log('[GiftWrapSync] window.PUB_SUB_EVENTS:', window.PUB_SUB_EVENTS);

if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
  console.log('[GiftWrapSync] Attaching subscriber to PUB_SUB_EVENTS.cartUpdate');
  subscribe(PUB_SUB_EVENTS.cartUpdate, function (event) {
    console.log('\n=======================================');
    console.log('[GiftWrapSync] CART UPDATE TRIGGERED!');
    console.log('[GiftWrapSync] Event payload:', event);

    if (event.source === 'giftwrap-sync') {
      console.log('[GiftWrapSync] Event ignored: source is giftwrap-sync (preventing infinite loop).');
      return;
    }

    var cartData = event.cartData;
    if (!cartData || !cartData.items) {
      console.log('[GiftWrapSync] Event ignored: cartData or cartData.items is missing.', cartData);
      return;
    }

    var gwVarId = window.giftWrapVariantId;
    var gwProdIdKey = window.giftWrapProductId;
    console.log('[GiftWrapSync] Configured GW Variant ID:', gwVarId);
    console.log('[GiftWrapSync] Configured GW Product ID:', gwProdIdKey);

    if (!gwVarId || !gwProdIdKey) {
      console.log('[GiftWrapSync] Event ignored: missing GW IDs in global variables.');
      return;
    }

    var gwProdIdInt = parseInt(gwProdIdKey, 10);
    var targetGwQty = 0;

    var gwPropKey = window.giftWrapPropertyKey || '_Gift Wrap';
    var gwPropVal = window.giftWrapPropertyValue || 'Yes';
    console.log(`[GiftWrapSync] Looking for property mapping: "${gwPropKey}" = "${gwPropVal}"`);

    var div = document.createElement('div');
    div.innerHTML = gwPropKey;
    var cleanPropKey = div.textContent || div.innerText || gwPropKey;

    div.innerHTML = gwPropVal;
    var cleanPropVal = div.textContent || div.innerText || gwPropVal;

    var rawPropKeyStr = String(gwPropKey).toLowerCase().trim();
    var rawPropValStr = String(gwPropVal).toLowerCase().trim();
    var cleanPropKeyStr = String(cleanPropKey).toLowerCase().trim();
    var cleanPropValStr = String(cleanPropVal).toLowerCase().trim();

    console.log(`[GiftWrapSync] Loop starting across ${cartData.items.length} items...`);
    cartData.items.forEach(function (item, index) {
      console.log(`  -> Checking Item ${index}: ${item.title} (Product ID: ${item.product_id}) x ${item.quantity}`);
      if (item.product_id === gwProdIdInt) {
        console.log(`    -> Skipped: This is the gift wrap product itself.`);
        return;
      }
      if (!item.properties) {
        console.log(`    -> Skipped: No properties on this item.`);
        return;
      }

      var isGiftWrapped = false;
      if (Array.isArray(item.properties)) {
        isGiftWrapped = item.properties.some(function (p) {
          if (!p || p.length < 2) return false;
          var kStr = String(p[0]).toLowerCase().trim();
          var vStr = String(p[1]).toLowerCase().trim();
          console.log(`      -> Prop Match Check (Array): "${kStr}" === "${vStr}"`);
          return (kStr === rawPropKeyStr || kStr === cleanPropKeyStr) &&
            (vStr === rawPropValStr || vStr === cleanPropValStr || vStr === 'yes');
        });
      } else {
        var keys = Object.keys(item.properties);
        for (var i = 0; i < keys.length; i++) {
          var kStr = String(keys[i]).toLowerCase().trim();
          var vStr = String(item.properties[keys[i]]).toLowerCase().trim();
          console.log(`      -> Prop Match Check (Object): "${kStr}" === "${vStr}"`);
          if ((kStr === rawPropKeyStr || kStr === cleanPropKeyStr) &&
            (vStr === rawPropValStr || vStr === cleanPropValStr || vStr === 'yes')) {
            isGiftWrapped = true;
            break;
          }
        }
      }

      if (isGiftWrapped) {
        console.log(`    -> 🌟 ITEM IS GIFT WRAPPED! Adding ${item.quantity} to target quantity.`);
        targetGwQty += item.quantity;
      } else {
        console.log(`    -> Item is NOT gift wrapped.`);
      }
    });

    console.log(`[GiftWrapSync] Target calculated GW Qty: ${targetGwQty}`);

    var gwItem = cartData.items.find(function (item) { return item.product_id === gwProdIdInt; });
    var currentGwQty = gwItem ? gwItem.quantity : 0;
    console.log(`[GiftWrapSync] Current actual GW Qty in cart: ${currentGwQty}`);

    if (currentGwQty !== targetGwQty) {
      console.log(`[GiftWrapSync] Mismatch! Updating GW product quantity from ${currentGwQty} to ${targetGwQty}...`);
      if (targetGwQty === 0 && !gwItem) {
        console.log(`[GiftWrapSync] Already 0 and no item in cart. Doing nothing.`);
        return;
      }

      var body = JSON.stringify({
        id: gwItem ? gwItem.key : gwVarId,
        quantity: targetGwQty,
        sections: 'cart-drawer,cart-icon-bubble',
        sections_url: window.location.pathname
      });

      var cartChangeUrl = (window.routes && window.routes.cart_change_url) ? window.routes.cart_change_url : '/cart/change';
      if (!cartChangeUrl.endsWith('.js')) {
        cartChangeUrl += '.js';
      }

      console.log(`[GiftWrapSync] Firing POST to ${cartChangeUrl}`);
      fetch(cartChangeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: body
      })
        .then(function (r) { return r.json(); })
        .then(function (state) {
          console.log(`[GiftWrapSync] Successfully fetched cart/change. Applying UI update...`);
          if (!state.sections) return;
          var drawer = document.querySelector('cart-drawer');
          if (drawer && drawer.renderContents) {
            drawer.renderContents(state);
          } else {
            publish(PUB_SUB_EVENTS.cartUpdate, { source: 'giftwrap-sync', cartData: state });
          }
        })
        .catch(function (err) { console.error('[GiftWrapSync] API Request Failed:', err); });
    } else {
      console.log('[GiftWrapSync] Match! No quantity update required.');
    }
    console.log('=======================================\n');
  });
} else {
  console.log('[GiftWrapSync] ERROR: Cannot attach subscriber because PUB_SUB_EVENTS is undefined!');
}
