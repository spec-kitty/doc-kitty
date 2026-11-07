# Contract: consumer options

Additions to `DocKittyOptions`. All are optional.

```ts
sidebar?: StarlightSidebar | {
  indexLabel?: string;
  collapsed?: boolean;     // default true
  titleIsIndex?: boolean;  // default false; throws together with indexLabel
};
metadataBlocks?: { collapsed?: boolean };           // default true
footer?: { machineEntryPoints?: false | { label: string } };
pageFormats?: { atom?: boolean };                   // default true
repository?: {
  provider: 'github' | 'gitlab' | 'bitbucket';  // hosted services only
  repo: string;      // owner/name
  branch: string;
  siteDir?: string;  // repo-relative site folder
};
```

Frontmatter: `sidebar.icon?: string`. Registry: `icon?: string` per entry in `sections.yaml`.

Validation throws at config time with a `[dk-config]` message naming the key. Unknown `sidebar` keys stay rejected.
