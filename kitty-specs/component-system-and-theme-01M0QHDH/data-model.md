# Data model: Component system + swappable theme

The "data" here is the theme contract and the structures the merge produces. No
datastore is involved (static site generation).

## DocKittyTheme

The theme record a consumer passes to `defineDocKittyIntegrations({ theme })`.

| Field | Type | Meaning |
|---|---|---|
| `name` | `string?` | Display/debug name of the theme. |
| `extends` | `DocKittyTheme?` | The layer this one refines (brand `extends` default; consumer `extends` brand). |
| `tokens` | `Record<string,string> \| string?` | `--dk-*` values (object) or a path to a css file declaring them. **`--dk-*` only** — never `--sl-*`. |
| `customCss` | `string[]?` | Extra stylesheet paths, layered **after** the token sheet, in precedence order. |
| `assets` | `{ logo?, favicon?, socialImage?, fonts?: string[] }?` | Forwarded to Starlight-native `logo`/`favicon`/`title` and `socialImage` → `dk:head`. |
| `slots` | `Partial<Record<DkSlotName,string>>?` | `dk:` slot name → `.astro` path; resolved per-carrier via the manifest. |
| `layouts` | `Partial<Record<Kind,string>>?` | `kind` → layout `.astro` path; resolved at the single `MarkdownContent` import site. |

**Invariants**:

- A theme sets `--dk-*` only; the base sheet owns every `--dk-*→--sl-*` bridge
  assignment. Brand/consumer emitted sheets contain zero `--sl-*:` declarations.
- `slots` keys are drawn from `DkSlotName`; `layouts` keys from the open `Kind`
  vocabulary (`schema.ts` `KINDS`).
- A theme never names a Starlight `components` entry; theme choice flows only through
  the manifest.

## Layer and the merge

Three ordered layers: **Default** (complete, shipped — the only layer that must set the
whole `--dk-*` catalog), **Brand** (a subset override), **Consumer** (the per-site last
word).

Merge = default → brand → consumer with:

- **per-key last-wins** for scalar keys (`name`, `assets.*` entries, each `slots`/
  `layouts` key);
- **`customCss` concatenates** in precedence order (default sheet first, then brand,
  then consumer);
- **`tokens` shallow-merge** (a later layer overrides only the `--dk-*` keys it names;
  un-named keys inherit).

State transition: `resolveTheme(theme?) → ResolvedTheme`. With no `theme`, the resolver
returns the M1 shape (single static `theme.css` `customCss` entry, Default catalog,
static layout map) — the byte-compatible degenerate case.

## Merged manifest

Produced from the resolved theme by the Astro integration; consumed by the carriers.

| Part | Shape | Consumed by |
|---|---|---|
| `layouts` | `kind → LayoutComponent` (statically imported) | `MarkdownContent` via synchronous `resolveLayout(kind)`; `Default` fallback |
| `slots` | `dkSlotName → Component` | the owning carrier (Head / PageTitle / MarkdownContent / Footer) |

**Invariant**: `resolveLayout(kind): LayoutComponent` is synchronous and preserves the
M1 signature so the `MarkdownContent` carrier body is byte-unchanged.

## Token catalog

The `--dk-*` set (surfaces, text, accent, state+`-bg`, type, spacing, radius, elevation,
widths) plus the `--dk-*→--sl-*` bridge. A **mode-varying subset** (the colour tokens)
is enumerated so the completeness check can assert each is re-declared under a theme's
dark selector. Non-colour tokens (spacing, radius, widths, type scale, shadow geometry)
are declared once.

## Persona passport (rendered structure)

Not a schema change — `Persona` is already in `KINDS`. The shell renders **existing
generic frontmatter** only:

| Slot in the passport | Source field |
|---|---|
| name (`<h1>`, display font) | `title` |
| avatar alt | `hero_image.alt` |
| `<dl>` field rows | `doc_status`, `updated`, `type`, `authors`, `tags` |

Persona-*attribute* fields (role, goals, responsibilities) are **not** introduced here
— that schema is M3.
