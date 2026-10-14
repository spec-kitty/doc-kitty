# Copied verbatim (below this header) from spec-kitty/spec-kitty:
#   https://github.com/spec-kitty/spec-kitty/blob/41552aa5e5ae687c4c7799ad9e6f245d06ba0d7c/tests/scenarios/init/init.feature
#   last-changed commit 41552aa5e5ae687c4c7799ad9e6f245d06ba0d7c, upstream blob 7bff1d2dac5d3f4c2609f8c915be1b8a0f81bb9e
# It is the motivating file of doc-kitty #120, embedded whole by
# example/docs/guides/scenarios-in-pages.md (`scenarios` is an includeRoot, not a
# `sources` dir, so it gets no generated page). Comments never render.

# Maintainer notes (not part of the behaviour description):
# - Each scenario restates a promise from `spec-kitty init --help`
#   (src/specify_cli/cli/commands/init_help.py, INIT_COMMAND_DOC).
# - Steps follow Arrange / Assume / Act / Assert; see tests/scenarios/README.md.
# - Untagged, so both scenarios run in the gating nightly.

Feature: Set up Spec Kitty in a repository
  As a developer adopting Spec Kitty
  I want `spec-kitty init` to set up my project without touching my git history
  So that I can add Spec Kitty to a new or existing repository, and re-run it to repair a damaged setup

  Scenario: Re-running init repairs a missing agent skill folder and keeps the rest of the project as it was
    Given a project already set up with Spec Kitty for the agents "claude,codex"
    And the folder ".claude/skills" has been deleted
    And the folder ".agents/skills" is present
    And the file ".kittify/config.yaml" is present
    When I run "spec-kitty init --non-interactive --ai claude,codex"
    Then the command succeeds
    And the folder ".claude/skills" exists
    And the folder ".claude/skills" is not empty
    And the folder ".agents/skills" is unchanged
    And the file ".kittify/config.yaml" is unchanged

  Scenario: Setting up a new project inside an existing repository leaves its git history alone
    Given an existing git repository with commit history
    And the repository has at least one commit
    When I run "spec-kitty init app --non-interactive --ai claude"
    Then the command succeeds
    And the folder "app/.kittify" exists
    And the folder "app/.claude" exists
    And no ".git" folder exists in "app"
    And the repository HEAD is unchanged
    And the repository has no new commits
