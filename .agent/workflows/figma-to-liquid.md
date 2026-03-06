---
description: How to convert a Figma design to a Shopify Liquid snippet/section
---

# Figma → Liquid Workflow

Follow these steps in order when implementing a design from Figma into the Shopify Dawn-based theme.

## 1. Get Design Context

Use the Figma MCP tool to retrieve design context for the target node.

```
get_design_context(nodeId: "<node-id>", clientFrameworks: "shopify-liquid,tailwindcss", clientLanguages: "html,css,javascript,liquid")
```

If the response is a sparse metadata response (section-level), call `get_design_context` again on each relevant child node individually.

## 2. Check for Existing Dawn Component

Search the `sections/` and `snippets/` directories to see if a Dawn component already covers the design:

```bash
ls sections/ | grep <component-keyword>
ls snippets/ | grep <component-keyword>
```

If a Dawn component covers ~80%+ of the design, use it as a base and extend it, rather than building from scratch.

## 3. Check CORE Inventory

Open the [CORE inventory doc](https://www.notion.so/a2c9df4c0286426cbf22bbd70782b89b) and search for the component name. If it exists in CORE:
- Pull the component into the client site from the CORE branch.
- Extend or adapt as needed (do not fork beyond client-specific tweaks).

If it does **not** exist in CORE, proceed to build it client-side with backport in mind.

## 4. Map Design Tokens to Tailwind Classes

Review the Figma design tokens (spacing, colour, radius, typography) and map them to Tailwind scale values:

| Figma token | Raw value | Use |
|---|---|---|
| `--spacing/mobile/xs` | 4px | `tw-gap-1`, `tw-p-1` |
| `--spacing/mobile/s` | 8px | `tw-gap-2` |
| `--spacing/mobile/m` | 12px | `tw-gap-3` |
| `--spacing/mobile/l` | 16px | `tw-gap-4` |
| `--spacing/desktop/xs` | 8px | `tw-gap-2` |
| `--spacing/desktop/s` | 16px | `tw-gap-4` |
| `--spacing/desktop/m` | 24px | `tw-gap-6` |
| `--radius/desktop/100` | 4px | `tw-rounded` |
| `--radius/desktop/full` | 999px | `tw-rounded-full` |

⚠️ **Never** use `tw-p-[1.2rem]` style arbitrary values. If a value does not map to the default Tailwind scale, confirm with the designer that it should be rounded to the nearest standard size.

## 5. Build the Snippet

### File location

- **Self-contained component** → `snippets/<component-name>.liquid`
- **Page-level section** → `sections/<section-name>.liquid`

### Required doc-comment header

Every snippet **must** start with:

```liquid
{% comment %}
  [Snippet name]
  [Brief description if name is not self-explanatory]

  Accepts:
  - variable_name: {Object|String|Boolean|Number} - Description (Optional)

  Usage:
  {% render 'snippet-name', variable: value %}
{% endcomment %}
```

### Tailwind class rules

- Apply Tailwind classes directly to each element — do not batch them on a parent with `[&>*]`.
- If the same class list is used on ≥2 sibling elements in the same file, extract the element into its own snippet.
- If extraction is not possible, use `@apply` in a CSS file instead.

### Translation strings

All user-facing strings must use `t:` keys from `locales/en.default.json`:

```liquid
{{ 'giftwrap.add_label' | t }}
```

Add the key to `locales/en.default.json` (and the schema file `locales/en.default.schema.json` if it's a setting label).

### Markets URLs

Product links must be markets-aware:

```liquid
<a href="{{ product.url | within: collection }}">
```

## 6. Section Schema (if building a section)

Add a `{% schema %}` block at the bottom. Gate optional features with settings:

```liquid
{% schema %}
{
  "name": "Section Name",
  "settings": [
    {
      "type": "checkbox",
      "id": "enable_feature",
      "label": "Enable feature",
      "default": true
    }
  ]
}
{% endschema %}
```

For developer-only toggles, use a Liquid variable at the top of the file instead:

```liquid
{%- assign enable_feature = true -%}
```

## 7. JavaScript (if required)

Only add JS when HTML/CSS cannot achieve the interaction (prefer `<details>`/`<summary>` for toggles, CSS transitions for animations, etc.).

If JS is necessary:

```javascript
// Wrap top-level code in an IIFE
(() => {
  class GiftwrapAddon extends HTMLElement {
    connectedCallback() {
      this.checkboxEl = this.querySelector('[data-giftwrap-checkbox]');
      this.formEl = this.querySelector('[data-giftwrap-form]');
      this.checkboxEl.addEventListener('change', this.handleChange.bind(this));
    }

    disconnectedCallback() {
      this.checkboxEl.removeEventListener('change', this.handleChange.bind(this));
    }

    handleChange(event) {
      if (!event.target.checked) return;
      this.formEl.removeAttribute('hidden');
    }
  }

  customElements.define('giftwrap-addon', GiftwrapAddon);
})();
```

Rules:
- One JS file per liquid file (or keep inline if only used once per page).
- Use `const` by default, `let` only if reassignment is needed, never `var`.
- Use `async/await` instead of `.then()` chains.
- Use early returns to keep code flat.
- Use `querySelector`/`querySelectorAll` for DOM selection.
- Use JSDoc for type annotations.

## 8. PR into CORE

1. Create a branch on the CORE repo: `git checkout -b feature/<component-name>`.
2. Copy the snippet(s) and any required assets/locale keys.
3. Remove all client-specific references.
4. Confirm all required data (metafields, settings, etc.) is defined in CORE.
5. Open a PR with: theme URL, setting descriptions, variable descriptions, screenshots.
6. Ping for review on Slack.
7. Address change requests, then merge and delete the branch.
