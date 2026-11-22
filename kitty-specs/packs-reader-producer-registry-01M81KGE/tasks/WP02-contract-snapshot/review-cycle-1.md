---
affected_files: []
cycle_number: 1
mission_slug: packs-reader-producer-registry-01M81KGE
reproduction_command:
reviewed_at: '2026-11-22T13:19:56Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP02
---

# WP02 review feedback (cycle 1): claude::reviewer-renata

Verdict: **changes requested**. One blocking finding. The rest of the WP holds up.

## Blocking

### B1. `packs:sync-contract` accepts a moving ref without a word and writes it into the lock as `tag`

FR-003 takes `--ref <tag-or-sha>`. The script accepts any ref the checkout can resolve:
a branch, `HEAD` or a short sha. It records that ref as the lock's `tag`.
Reproduced against a checkout of spec-kitty-charter at `contract-packs-v0.1.0-rc.1`,
using `--from <checkout> --to <copy of the snapshot>`:

| `--ref`                      | exit | lock `tag`                   |
|------------------------------|------|------------------------------|
| `contract-packs-v0.1.0-rc.1` | 0    | `contract-packs-v0.1.0-rc.1` (lock byte-identical) |
| `moving` (a branch)          | 0    | `moving`                     |
| `HEAD`                       | 0    | `HEAD`                       |
| `69ec326` (short sha)        | 0    | `69ec326`                    |
| full 40-hex sha              | 0    | (none)                       |

Without `--from`, `cloneCharter` fetches whatever `<ref>` names on the remote. A
branch such as `main` is fetched, and the script then creates a local
`refs/tags/<ref>` for it. A maintainer who types a branch name gets that branch's
current tip, and the lock claims it as a tag. The lock is the snapshot's
provenance record, so a branch name in `tag` misstates where the snapshot came from.

Fix (narrow):
- Accept `--ref` only when it is a full 40-lower-hex sha or a tag. With `--from`,
  check `git -C <from> rev-parse --verify --quiet refs/tags/<ref>^{commit}`. Without
  `--from`, fetch `refs/tags/<ref>:refs/tags/<ref>` explicitly, so a branch of the
  same name can never be fetched.
- Otherwise exit 1 with a message naming the ref and saying a tag or a full sha is
  required.
- Record `tag` only for that tag case.
- Add tests in `packs-sync-contract.test.ts`, still offline against the throwaway
  repo: a branch ref fails, `HEAD` fails, a short sha fails, and the lock is left
  untouched in each case.

## Non-blocking (fix while there, or leave with a note)

1. When both `--ref` and `--commit` are given, `--ref` wins silently. Refuse the
   combination, or document the precedence.
2. `snapshotFiles` treats a symlink as a file and `readFileSync` follows it, so a
   symlink to a byte-identical file outside the snapshot passes verification.
   For a consumer `packs.contract` directory (FR-012), think about refusing symlinks.
3. A consumer snapshot whose lock leaves out `file-kinds.yaml` reaches
   `loadContract`'s parse step and fails with "file-kinds.yaml does not parse:
   ENOENT". It still carries `[dk-packs]`, but "is missing" would say what is wrong.
4. If a `git show` fails halfway through a sync, the files already written are left
   and the lock is not rewritten. Verification catches the mismatch afterwards, so
   no harm is silent, but writing to a temp dir and renaming it into place would
   keep the snapshot whole.

## Verified (no action)

- The snapshot is byte-identical to spec-kitty-charter `contracts/packs/` at
  `69ec326179246c9a79eca1ba1d424f059f5153e2`, for all 7 files. The lock lists
  exactly those 7, with matching sha256s. Keys are sorted, the indent is two
  spaces, and there is a trailing newline.
- `.gitattributes` `-text` lands in the same commit as the snapshot (d85c949).
  `git ls-files --eol` shows `attr/-text` on every snapshot file.
- Re-syncing from the tag leaves the lock byte-identical.
- Red first: d85c949 fails because the loader is missing, and cbbb2fd fails
  because the script is missing. Both test files are unchanged afterwards. No
  existing test was edited.
- Mutation: disabling the sha256 comparison fails "fails on one changed byte".
- Error and warning names match the spec and the data model: `[dk-packs]` on lock
  drift, and `contract-unknown-key` / `contract-unknown-content-form` as warnings.
- `pnpm lint` and `pnpm typecheck` are clean. The fast vitest project gives 193
  files and 4044 tests, all green.
