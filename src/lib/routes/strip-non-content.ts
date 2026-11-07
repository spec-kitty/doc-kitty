/** Removes what an Atom entry's `<content>` should not carry (page-chrome FR-020). No Astro imports, so tests can load it. */
/**
 * Markup a feed reader cannot use and that is not the page's content: HTML
 * comments, `<script>` and `<style>` elements, and `<link>` tags (the glossary
 * definitions JSON, Expressive Code's stylesheet link, markdownlint comments).
 *
 * No HTML parser is a production dependency of the toolkit (`sax` is dev-only,
 * and `parse5`/`rehype-parse` are only transitive through Astro), so this is a
 * single left-to-right scan. It is safe here because the input is Astro's own
 * serialised output of a Markdown page, not arbitrary HTML: text is entity-escaped
 * (a `<script>` shown in a code block is `&lt;script&gt;`), and the end rules are
 * the HTML ones: a comment ends at the first `-->`, a raw-text element at the first
 * matching `</script` / `</style`. Comments are the first alternative, so a tag
 * inside a comment goes with it. A `<link>` match is attribute-aware, so a `>`
 * inside a quoted value does not end it early. A name must end where `(?![\w-])` says,
 * since `\b` also matches inside a custom element such as `<link-card>` or `<style-guide>`.
 *
 * Expressive Code's copy control goes too: `<div class="copy">`, its empty live
 * region and its `<button data-code="..."><div></div></button>` (matched in exactly that shape, so
 * an authored `<div class="copy"><button>` is kept). In a feed reader the button does
 * nothing, and `data-code` repeats the whole snippet. The code's own
 * `<div class="code">` lines are not touched. The button's attributes are matched
 * like a `<link>`'s, so a `>` inside `data-code` does not end it early.
 */
const NON_CONTENT = /<!--[\s\S]*?-->|<script(?![\w-])[\s\S]*?<\/script\s*>|<style(?![\w-])[\s\S]*?<\/style\s*>|<link(?![\w-])(?:"[^"]*"|'[^']*'|[^>"'])*>|<div class="copy">\s*(?:<div(?:"[^"]*"|'[^']*'|[^>"'])*>\s*<\/div>\s*)?<button(?![\w-])(?:"[^"]*"|'[^']*'|[^>"'])*?\sdata-code=(?:"[^"]*"|'[^']*')(?:"[^"]*"|'[^']*'|[^>"'])*>(?:<div><\/div>)?<\/button>\s*<\/div>/gi;

export function stripNonContent(html: string): string {
  return replaceAstroImagePlaceholders(html.replace(NON_CONTENT, ''));
}

/**
 * Astro's image pipeline leaves `<img __ASTRO_IMAGE_="{...json...}">` with no `src`
 * in rendered HTML for a local image: the optimised file is only resolved when a
 * page is written. A feed reader cannot show that, so the placeholder becomes its
 * `alt` text (HTML-escaped), or goes when it has none. An `<img src>` is untouched.
 */
const ASTRO_IMAGE = /<img(?![\w-])(?:"[^"]*"|'[^']*'|[^>"'])*?\s__ASTRO_IMAGE_=(?:"([^"]*)"|'([^']*)')(?:"[^"]*"|'[^']*'|[^>"'])*>/gi;

const NAMED_ENTITIES: Record<string, string> = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" };

function decodeEntities(value: string): string {
  return value.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (whole, hex, dec, name) => {
    if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
    const code = hex ? parseInt(hex, 16) : parseInt(dec, 10);
    return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

const escapeHtmlText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function replaceAstroImagePlaceholders(html: string): string {
  return html.replace(ASTRO_IMAGE, (_whole, double?: string, single?: string) => {
    try {
      const alt = (JSON.parse(decodeEntities(double ?? single ?? '')) as { alt?: unknown }).alt;
      return typeof alt === 'string' ? escapeHtmlText(alt) : '';
    } catch {
      return '';
    }
  });
}
