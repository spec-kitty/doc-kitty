# Quickstart: document your operating model

This walkthrough doubles as the acceptance smoke test, run in a temp directory.

```bash
# 1. One page from a template
node src/scripts/new-doc.mjs --template incident-response --base /tmp/om/docs
# → docs/operations/runbooks/incident-response.md (kind How-To, type Runbook)

# 2. A role
node src/scripts/new-doc.mjs --template role operating-model/roles/dpo --title "Data Protection Officer" --base /tmp/om/docs

# 3. The whole set (existing files are skipped)
node src/scripts/scaffold.mjs /tmp/om/docs --preset operating-model

# 4. Validate
node src/scripts/validate-frontmatter.mjs /tmp/om/docs
```

**Expected:** steps 1 to 3 write pages that are never overwritten, and step 4 reports 0 errors.

**Optional:** apply the preset snippet (`src/lib/templates/operating-model/sections.snippet.yaml`) to `/tmp/om/docs/_meta/sections.yaml`, then run step 4 again. The result is still 0 errors, now with the `Operations` type checked.
