# Quickstart

```bash
# Read one pack
node src/scripts/read-pack.mjs ../spec-kitty-open-packs/packs/qa --json \
  --charter-lock ../spec-kitty-open-packs/charter.lock.yaml

# Refresh the contract snapshot from a charter checkout
pnpm packs:sync-contract --ref contract-packs-v0.1.0-rc.1 --from ../spec-kitty-charter

# Tests
cd src && npx vitest run tests/producers.test.ts tests/packs-*.test.ts
DK_OPEN_PACKS_DIR=../spec-kitty-open-packs pnpm test:packs-corpus
```

```js
// astro.config.mjs
defineDocKittyIntegrations({
  packs: { charterLock: '../charter.lock.yaml' },
});
```
