---
title: Page feedback (edit this page and comments)
description: "Research on letting readers edit a page through its git host and leave comments, page-wide or section by section, without a database."
doc_status: draft
updated: 2026-11-11T00:00:00Z
type: Architecture
kind: Explanation
tags: [feedback, comments, giscus, edit-link, portal]
related:
  - plans/features/page-feedback
  - architecture/research/mission-status-portal
---

# Page feedback (edit this page and comments)

An idea for two reader-facing affordances that a site turns on in its main
config: an **edit this page** link and **comments**. This page is a proposal,
not a decision. The plan is the [page feedback feature](../../plans/features/page-feedback.md).

> **First implementation: GitHub and giscus only.** The edit link and the
> comments ship for `repository.provider: github` first, with giscus as the only
> comments provider. GitLab, Bitbucket, Hypothesis and a self-hosted backend
> are later slices. The analysis below keeps them in view so the config shape
> does not have to change when they land.

The use cases are the kitty ecosystem's own sites: plan and ADR pages in each
repository, and the open-pack sites, where each pack gets a section and each
artefact a verbatim page that consumers can review and suggest changes to.

## What exists today

- The chrome options already take a `repository` setting (`provider` is
  `github`, `gitlab` or `bitbucket`, plus `repo`, `branch` and `siteDir`). See
  `src/lib/chrome-options.ts`.
- `sourceLink()` in `src/lib/page-formats.ts` already builds a *view* URL for a
  page's source file. It returns nothing for a generated page, a draft, or a
  page with no file. Those are the same pages that must not get an edit link.
- Starlight has its own `editLink.baseUrl`. doc-kitty does not set it, and the
  article footer still renders Starlight's `EditLink` slot.
- Each page has a machine payload at `/api/pages/<slug>.json`. An agent prompt
  can point to it.

## Edit this page

### Raw web edit (first slice)

An edit URL is the view URL with a different path segment, so this is one more
table next to `SOURCE_VIEW`:

| Provider | Edit URL |
|---|---|
| GitHub | `https://github.com/<repo>/edit/<branch>/<path>` |
| GitLab | `https://gitlab.com/<repo>/-/edit/<branch>/<path>` |
| Bitbucket Cloud | `https://bitbucket.org/<repo>/src/<branch>/<path>?mode=edit` |

The GitHub editor forks the repository for a reader without write access and
opens a pull request. GitLab does the same. In Bitbucket Cloud, a reader without
write access cannot edit, and Bitbucket shows the view page instead. A static
link cannot know the reader's permissions.

There are two ways to render it:

1. Set Starlight's `editLink.baseUrl` from `repository`. This is cheap, but
   Starlight joins a base URL and the entry path. That breaks for
   Bitbucket's `?mode=edit` suffix and ignores the draft and generated-page
   rules.
2. Override the `EditLink` slot with a component that calls a new
   `editLink(entry, repository)` helper. That helper reuses `sourceLink`'s
   guards. **Recommended**: one rule for every provider, and it is testable
   the same way `sourceLink` is.

One gap remains: the hosts are hard-coded to the hosted services. Self-hosted
GitLab, Bitbucket Data Center and GitHub Enterprise need an optional `origin`
setting. Bitbucket Data Center also uses a different path shape
(`/projects/<P>/repos/<R>/browse/<path>?at=<ref>`), so it needs its own
provider value rather than a different origin.

### Agent prompt (later slice)

The same button can open a small panel that holds a ready-to-copy prompt for
any agent harness:

```text
In the repository <repo> (branch <branch>), edit <path>.
The page's metadata and outline: <site>/api/pages/<slug>.json
Follow the docs convention in docs/context/convention.md.
Change requested: <reader types here>
```

This needs no backend: the prompt is built from data the page already has. A
`mode: web | agent | both` option picks what the button offers. Keep the
prompt text in a template file so a site can override it.

## Comments

### Options

| Option | Storage | Hosts | Inline anchoring | Notes |
|---|---|---|---|---|
| [giscus](https://giscus.app/) | GitHub Discussions | GitHub only | No, one thread per *term* | GitHub App and Discussions must be enabled. Readers sign in with GitHub. |
| utterances | GitHub Issues | GitHub only | No | Similar to giscus, but uses Issues and looks older. |
| [Hypothesis](https://web.hypothes.is/) | Hypothesis service (can be self-hosted) | Any | **Yes**, W3C text selectors | A separate account system. Data is not in the repository. |
| Remark42 / Isso / Cusdis | Their own server and store | Any | No | Needs a server and storage. That is what we want to avoid. |
| Build-time ingest (our own) | The host's discussions, issues or PR comments | Adapter per host | Yes, by convention | Static and stale until the next build. Needs a token in CI. |

The reference implementation is the patterns site
(`patterns.sddevelopment.be`). It uses giscus with one discussion per page, for
example discussion #79 for `concepts/systems_thinking`.

### Hypothesis compared with a self-hosted comment app

[Hypothesis](https://web.hypothes.is/) is a web annotation tool from a
nonprofit. Its server ([`hypothesis/h`](https://github.com/hypothesis/h)) and
client ([`hypothesis/client`](https://github.com/hypothesis/client)) are
BSD-2-Clause. Check the LICENSE files before relying on that. A site embeds it with one
script tag, and readers can also annotate any page through the browser
extension. The server and API are documented at <https://h.readthedocs.io/>. Its
data model follows the [W3C Web Annotation model](https://www.w3.org/TR/annotation-model/).

- **Storage.** By default, comments are on the hosted service at hypothes.is,
  in PostgreSQL with Elasticsearch for search. Each annotation stores the page
  URL, its selectors (the quoted text with the words around it, the character
  position, and the DOM range), the body, and the author and group. Groups can
  be public, private, or restricted (anyone reads, members post).
  Self-hosting is possible, but the stack is heavy (Postgres, Elasticsearch,
  RabbitMQ, h, client build), and the project does not support it for
  production use.
- **Why it works on any git host.** It does not use the host at all.
  Annotations attach to the published page's URL, not to a repository, issue
  or discussion. As a result, comments do not reach the repository unless a
  step pulls them out through the API. Comments are also left behind when a
  page's URL changes; `<link rel="canonical">` reduces that.

Compared with a simple self-hosted CRUD app (API, database, container):

| | Hypothesis | Own CRUD app |
|---|---|---|
| Re-anchoring after edits | Built in: fuzzy matching of the quote and its surrounding text, and unplaced comments shown as orphans | Must be built; this is the hard part |
| Selection and sidebar UI | Built in, including threads and mobile | Must be built |
| Accounts, moderation, spam | Built in, with its own account system | Must be built; costs more over time than the database |
| Running cost | None on the hosted service | Small, but it is ours to run |
| Data ownership | Third party, through its API | Ours; easy to ingest at build time |
| Sign-in | A separate Hypothesis account | Can reuse GitHub, Bitbucket or company SSO |
| Theming | Little control | Full control |

A middle path exists: a small backend that stores W3C Web Annotation JSON,
with anchoring taken from open libraries rather than written by us
(`@recogito/text-annotator` for the selection UI, Apache Annotator to turn
stored selectors back into page positions). Because the data follows the
standard, a site can later switch to Hypothesis or import from it.

Position: keep the provider pluggable. giscus serves GitHub sites. A
standard-format self-hosted backend is the strategic option for other hosts.
Hypothesis is the low-effort one.

### Page-level (first slice)

giscus with `mapping: pathname` (or `specific` with the page slug as the term,
which survives a change of base path) in a component after the article. Config
carries `repo`, `repoId`, `category`, `categoryId`, theme and language. Map the
theme to Starlight's light and dark modes. giscus can follow the color scheme
with `preferred_color_scheme`, but the site's manual toggle needs a
`postMessage` to the iframe.

### Inline, section by section

The goal is the Confluence or Google Docs model: a comment belongs to a section,
and the page shows a count or a marker next to that section. Three designs,
from cheapest to richest:

**A. One giscus thread per section.** Each `h2`/`h3` gets a small comment
button. It mounts giscus lazily in a drawer, with `mapping: specific` and the
term `<slug>#<heading-id>`. This uses only the documented giscus API. Its
weaknesses: there are no counts until a reader opens the drawer, and a heading
that is renamed orphans its thread. Mitigation: let an author pin an id
(`{#stable-id}`), and add a build check that lists terms whose anchor is gone.

**B. Build-time ingest.** In CI, list the discussions in the category through
GraphQL, map each term to a page and section, and bake counts and excerpts into
the static page and its `/api/pages` payload. It pairs with A: A is the write
path and B the read path. It also gives agents the feedback in machine form,
which fits the planning and ADR use case well. The cost is a token in CI, and
counts that are only as fresh as the last build.

**C. Hypothesis.** This is true text-range anchoring and works on any host. It
is the only option here that gives real inline comments without our own
backend. The cost is a third-party identity and data that live outside the
repository.

The anchors are not free. Starlight already gives every heading an id. A design
needs an id that survives edits, and it must also work for verbatim open-pack
artefacts, whose headings the site does not control.

### Bitbucket and other hosts

Bitbucket Cloud has no Discussions equivalent, and its issue tracker is
optional and limited. Realistic choices:

- **Hypothesis**. It ignores the host entirely.
- **"Discuss" as a link**, not an embed: a link that opens a new issue on the
  host's tracker (or Jira) with the page path and section in the title. This
  needs no embed, works on every host, and B can ingest it later.
- **Suggest changes through the edit link**. A pull request is already a
  comment thread on the exact lines. The ingest step (B) could surface open PRs
  that touch a page as "pending suggestions".

So the comments option should, in time, be a provider switch: `giscus | hypothesis |
issue-link | none`. giscus is the default when `repository.provider` is
`github`. issue-link is the fallback elsewhere.

## Config shape (sketch)

```ts
defineDocKittyIntegrations({
  repository: { provider: 'github', repo: 'spec-kitty/doc-kitty', branch: 'main' },
  feedback: {
    editLink: { mode: 'web' },            // 'web' | 'agent' | 'both'; false to disable
    comments: {
      provider: 'giscus',                 // 'giscus' | 'hypothesis' | 'issue-link'
      scope: 'page',                      // 'page' | 'section'
      sections: ['plans', 'adr'],         // registry section ids; omit for all
      giscus: { repoId: '…', category: 'Docs feedback', categoryId: '…' },
    },
  },
});
```

Per page, the frontmatter key `feedback: false` opts out. A section can turn it
on through `sections.yaml`, so a site can enable comments on plans and ADRs
only. The usual guards apply: no feedback on a generated page or a draft, and
no edit link on a verbatim open-pack artefact whose source is in another
repository, unless `repository` is set for that section.

## Open questions

1. Should an accepted ADR take comments? It is immutable. Comments there might
   rather link to "propose a superseding ADR".
2. Where do open-pack artefact pages live? They need the artefact's own repo,
   not the site's, so the edit and comment targets are per section.
3. Is a GitHub sign-in acceptable for the open-pack audience, or does
   Hypothesis's own sign-in fit them better?
4. Should the ingested feedback be in the agent payload (`/api/pages`), so an
   agent can work through review comments?
