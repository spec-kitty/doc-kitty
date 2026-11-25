# Contract: `subprocessors.xml` (RSS 2.0)

The feed is served only when the catalog exists and is valid. The route is
prerendered.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{site title}: sub-processor changes</title>
    <link>https://site.example/</link>
    <atom:link href="https://site.example/subprocessors.xml" rel="self" type="application/rss+xml" />
    <description>Additions and removals of sub-processors, including announced future changes.</description>
    <item>
      <title>Added: Beta Mail Ltd</title>
      <link>https://site.example/api/subprocessors.json</link>
      <guid isPermaLink="false">https://site.example/subprocessors.xml#beta-mail-added-2027-03-01</guid>
      <pubDate>Mon, 01 Mar 2027 00:00:00 GMT</pubDate>
      <category>added</category>
      <description>Beta Mail Ltd (beta-mail), from 2027-03-01. Processing: … Location: IE.</description>
    </item>
  </channel>
</rss>
```

Rules:

- **Items.** There is one `<item>` per ChangeEntry, in ChangeEntry order (newest
  date first).
- **Dates.** `pubDate` is the change date at 00:00:00 UTC, formatted with
  `Date.prototype.toUTCString()`.
- **Titles.** `Added: <name>` or `Removed: <name>`.
- **Guid.** It is stable: the feed URL, then `#<id>-<kind>-<date>`.
- **Link.** Until the generated page exists (FR-017), the link points at the API
  document. After that it points at the page.
- **No build time.** There is no `lastBuildDate` and no other clock-derived value.
  The output is byte-identical across days (NFR-001).
- **Escaping.** All text is XML-escaped with the shared `xmlEscape`. URLs come
  from the shared `absolute` helper, which is base-aware.
- **Empty catalog.** An empty catalog yields a valid channel with no items.
- **⚖ Notice.** Whether this feed satisfies a contract's notice clause is for
  counsel. The channel description makes no legal claim.
