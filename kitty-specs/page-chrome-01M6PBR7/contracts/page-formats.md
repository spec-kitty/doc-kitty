# Contract: footer and head markup

Machine entry points, on every page:

```html
<nav class="dk-machine-links" aria-label="{configured label, default Machine-readable}">...</nav>
```

Page formats, on published docs pages:

```html
<nav class="dk-page-formats" aria-label="This page as data">
  <a class="dk-pill dk-pill--neutral" rel="alternate" type="application/json" href="...">JSON</a>
  <a class="dk-pill dk-pill--neutral" rel="alternate" type="text/markdown" href="...">OKF</a>
  <a class="dk-pill dk-pill--neutral" rel="alternate" type="application/atom+xml;type=entry" href="...">Atom</a>
  <a class="dk-pill dk-pill--neutral" href="...">source</a>
</nav>
```

`<head>` carries one `<link rel="alternate">` per format link above, excluding source. All links meet the 24×24 target size and show the focus ring, themed or not.
