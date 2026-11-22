/**
 * The pack reader's public surface (#330, ADR-0079). Nothing outside
 * `src/lib/packs/` reads pack files; it calls these.
 *
 * @module packs
 */
export { readPack, packContentHash } from './read.mjs';
export { parsePackDocument } from './readme.mjs';
export { loadContract, verifyContractLock } from './contract.mjs';
export { classify, createClassifier } from './classify.mjs';
