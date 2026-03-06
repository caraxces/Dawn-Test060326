if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        if (this.cart) {
          formData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id || section.section).filter(Boolean)
          );
          formData.append('sections_url', routes.root_url || '/');
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButtonText.classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');
            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                cartData: response,
              }).then(() => {
                CartPerformance.measureFromMarker('add:wait-for-subscribers', startMarker);
              });
            this.error = false;

            const addGiftWrapAndRender = (cartResponse) => {
              const giftWrapCheckbox = this.form.querySelector('[data-giftwrap-checkbox]');
              const variantId = window.giftWrapVariantId;
              if (!giftWrapCheckbox?.checked || !variantId) {
                this.cart.renderContents(cartResponse);
                return;
              }
              const addon = this.form.querySelector('[data-giftwrap-addon]');
              const toKeyForm = addon?.dataset.giftwrapToKey || '_Gift To';
              const fromKeyForm = addon?.dataset.giftwrapFromKey || '_Gift From';
              const msgKeyForm = addon?.dataset.giftwrapMessageKey || '_Gift Message';
              const toKey = 'Gift To';
              const fromKey = 'Gift From';
              const msgKey = 'Gift Message';
              const toVal = (this.form.querySelector(`[name="properties[${toKeyForm}]"]`)?.value || '').trim();
              const fromVal = (this.form.querySelector(`[name="properties[${fromKeyForm}]"]`)?.value || '').trim();
              const msgVal = (this.form.querySelector(`[name="properties[${msgKeyForm}]"]`)?.value || '').trim();

              const gwFormData = new FormData();
              gwFormData.append('id', variantId);
              gwFormData.append('quantity', '1');
              if (toKey) gwFormData.append(`properties[${toKey}]`, toVal);
              if (fromKey) gwFormData.append(`properties[${fromKey}]`, fromVal);
              if (msgKey) gwFormData.append(`properties[${msgKey}]`, msgVal);
              gwFormData.append('sections', this.cart.getSectionsToRender().map((s) => s.id || s.section).filter(Boolean).join(','));
              gwFormData.append('sections_url', routes.root_url || '/');

              const gwConfig = { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, body: gwFormData };
              fetch(routes.cart_add_url, gwConfig)
                .then((r) => r.json())
                .then((gwRes) => {
                  if (gwRes.sections) {
                    this.cart.renderContents(gwRes);
                  } else {
                    this.cart.renderContents(cartResponse);
                  }
                  publish(PUB_SUB_EVENTS.cartUpdate, { source: 'product-form', cartData: gwRes });
                })
                .catch(() => {
                  this.cart.renderContents(cartResponse);
                });
            };

            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    CartPerformance.measure("add:paint-updated-sections", () => {
                      addGiftWrapAndRender(response);
                    });
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              CartPerformance.measure("add:paint-updated-sections", () => {
                addGiftWrapAndRender(response);
              });
            }
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading__spinner').classList.add('hidden');

            CartPerformance.measureFromEvent("add:user-action", evt);
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
