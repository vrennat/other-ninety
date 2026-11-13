# Restyling existing screens

A restyle changes how a screen looks, never what it does. The usual breakage is
JSX reshaped to read cleaner, which drops a conditional wrapper or moves a key.

- **Leave alone:** event handlers, conditionals and the elements they wrap,
  `key` and `ref`, inline styles driven by state (`display: open ? …`), `id`,
  `data-*` and `aria-*` attributes (add missing `aria-*`, remove none).
- **Free to change:** class strings, stylesheet and token values, inline styles
  with constant values, and the flex or grid settings of existing elements.
- **Both at once:** in `class={active ? 'a' : 'b'}`, keep the expression and
  change only the names. A wrapper div whose purpose is unclear stays; style
  around it.
- **Check the diff:** before calling it done, scan it for any changed handler,
  conditional, key, ref or attribute above. Each one either goes back or gets
  named to the user as a behaviour change.
