@AGENTS.md

## Before calling a task done

After any significant change, all three must be done before saying the task is finished:
1. `README.md` updated (see README below).
2. `docs/architecture.html` updated, with new pieces added and PLANNED pieces marked with their goal (see Architecture docs below).
3. `node docs/sync-architecture.mjs` run, and it passes.

## README

When a change affects what the app takes in or gives back, what happens in between, how to run
it, or where things live in the repo, update `README.md` in the same change. Keep the edit small
and limited to the affected section; the owner reviews README changes. Write in plain, everyday
wording for people new to the repo: no function or variable names, no marketing language.

## Architecture docs

After any significant change (new/renamed/removed screen, API client function, Flask route,
service function, data file, or external API; or a change to the data an endpoint passes, or to
how a function works), update the architecture docs in the same change:
- Edit the `graph-data` JSON in `docs/architecture.html`. It is the single source of truth: each
  node is a real file/function with `file`, `symbol`, `what`, step-by-step `how`, and edges
  labelled with the call and the data passed. Rewrite `how` steps when behaviour changes.
- Keep `PLANNED` nodes and their `goal` current: when a planned item ships, set
  `status: "live"` (drop the goal or reword it if work remains); when new work is decided, add a
  `planned` node or a `goal` on the live node it will change.
- Then run `node docs/sync-architecture.mjs`. It must pass. It fails on nodes pointing at code
  that no longer exists or code with no node, warns when a PLANNED node's code now exists, and
  regenerates the Mermaid diagram and PLANNED table in `ARCHITECTURE.md` (never hand-edit
  between the `GENERATED` markers).
