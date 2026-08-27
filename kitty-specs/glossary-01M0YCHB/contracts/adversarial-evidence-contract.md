# Contract — Adversarial evidence (plan/research)

Per the `plan` step contract's `supply_chain_security_check` + adversarial-evidence rule:
when a security-impacting or decision-bearing challenge is raised while planning, it must be
recorded with an explicit disposition — **no contested finding is silently dropped**.

## Disposition vocabulary

- `accepted` — the challenge stands; the plan already handles it (cite where).
- `changed` — the plan was altered in response (cite the ADR/section).
- `deferred_with_rationale` — postponed, with a stated reason and where it is tracked.

## Where recorded

`research.md` → "Adversarial evidence" table (AE-1..AE-5 for this mission). The dependency
additions (`remark-directive`, `mdast-util-directive`) carry the supply-chain evidence table
in the same file (registry authenticity, freshness, lifecycle-script discipline, Node LTS).

## Gate posture

Advisory in v1 — it adds no new blocking gate to the specify→plan commit boundary — but an
unexamined default is a gap, not a pass. A post-tasks adversarial squad re-challenges these
before implementation begins.
