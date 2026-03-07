class CartDrawerRecommendations extends HTMLElement {
    constructor() {
        super();
        this.addEventListener('click', this.onClick.bind(this));
        this.addEventListener('submit', this.onSubmit.bind(this));
    }

    connectedCallback() {
        this.fetchRecommendations();
    }

    fetchRecommendations() {
        const url = this.dataset.url;
        if (!url) return;

        fetch(url)
            .then((response) => response.text())
            .then((text) => {
                const html = document.createElement('div');
                html.innerHTML = text;
                const recommendations = html.querySelector('cart-drawer-recommendations');

                if (recommendations && recommendations.innerHTML.trim().length) {
                    this.innerHTML = recommendations.innerHTML;
                }
            })
            .catch((e) => {
                console.error('[CartDrawerRecommendations] Error fetching recommendations', e);
            });
    }

    onClick(e) {
        const prevBtn = e.target.closest('[data-upsell-prev]');
        const nextBtn = e.target.closest('[data-upsell-next]');
        const track = this.querySelector('[data-upsell-track]');

        if (prevBtn && track) {
            e.preventDefault();
            track.scrollBy({ left: -track.offsetWidth * 0.8, behavior: 'smooth' });
            return;
        }

        if (nextBtn && track) {
            e.preventDefault();
            track.scrollBy({ left: track.offsetWidth * 0.8, behavior: 'smooth' });
            return;
        }

        const addBtn = e.target.closest('button[type="submit"]');
        if (addBtn) {
            const form = addBtn.closest('[data-upsell-add-form]');
            if (form) {
                e.preventDefault();
                this.onSubmit({ target: form, preventDefault: () => { } });
            }
        }
    }

    onSubmit(e) {
        const form = e.target.closest('[data-upsell-add-form]');
        if (!form) return;

        e.preventDefault();
        console.log('[CartDrawerRecommendations] Add to cart submitted for form:', form);

        const btn = form.querySelector('button[type="submit"]');
        if (btn?.disabled) return;

        try {
            const formData = new FormData(form);
            const cartDrawer = document.querySelector('cart-drawer');
            const routes = window.routes || {};

            let items = [{
                id: formData.get('id'),
                quantity: parseInt(formData.get('quantity') || 1, 10),
                properties: {}
            }];

            for (let [key, value] of formData.entries()) {
                if (key.startsWith('properties[')) {
                    const propName = key.replace('properties[', '').replace(']', '');
                    items[0].properties[propName] = value;
                }
            }

            const giftWrapCheckbox = form.querySelector('[data-giftwrap-checkbox]');
            const variantId = window.giftWrapVariantId;

            if (giftWrapCheckbox?.checked && variantId) {
                const addon = form.querySelector('[data-giftwrap-addon]');
                const toKeyForm = addon?.dataset.giftwrapToKey || '_Gift To';
                const fromKeyForm = addon?.dataset.giftwrapFromKey || '_Gift From';
                const msgKeyForm = addon?.dataset.giftwrapMessageKey || '_Gift Message';

                const toVal = items[0].properties[toKeyForm]?.trim() || '';
                const fromVal = items[0].properties[fromKeyForm]?.trim() || '';
                const msgVal = items[0].properties[msgKeyForm]?.trim() || '';

                const gwItem = {
                    id: variantId,
                    quantity: 1,
                    properties: {}
                };
                if (toVal) gwItem.properties['Gift To'] = toVal;
                if (fromVal) gwItem.properties['Gift From'] = fromVal;
                if (msgVal) gwItem.properties['Gift Message'] = msgVal;

                items.push(gwItem);
            }

            const payload = { items: items };

            if (cartDrawer?.getSectionsToRender) {
                const sections = cartDrawer.getSectionsToRender().map((s) => s.id || s.section).filter(Boolean);
                payload.sections = sections.join(',');
                payload.sections_url = window.location.pathname;
            }

            console.log('[CartDrawerRecommendations] Payload:', payload);
            btn.disabled = true;
            btn.classList.add('loading');

            let addUrl = routes.cart_add_url || '/cart/add';
            if (!addUrl.endsWith('.js')) addUrl += '.js';

            fetch(addUrl, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
            })
                .then((r) => r.json())
                .then((data) => {
                    console.log('[CartDrawerRecommendations] Success:', data);
                    if (data.status && data.status !== 200) {
                        if (data.description) alert(data.description);
                        return;
                    }
                    if (data.sections && cartDrawer?.renderContents) {
                        cartDrawer.renderContents(data);
                    }
                    if (typeof window.publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined' && PUB_SUB_EVENTS.cartUpdate) {
                        window.publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-drawer-upsell', cartData: data });
                    }
                })
                .catch((err) => {
                    console.error('[CartDrawerRecommendations] Form submit fetch error:', err);
                    form.submit();
                })
                .finally(() => {
                    if (btn) {
                        btn.disabled = false;
                        btn.classList.remove('loading');
                    }
                });
        } catch (err) {
            console.error('[CartDrawerRecommendations] Handled submit error:', err);
            e.target.submit();
        }
    }
}

customElements.define('cart-drawer-recommendations', CartDrawerRecommendations);
