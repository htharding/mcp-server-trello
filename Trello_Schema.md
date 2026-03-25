# Trello Schema

This file defines the canonical schema for an AI-managed Trello board used to track a single game development project's status.

The rules below are normative. The AI should treat them as the source of truth for how cards, lists, and labels must be interpreted and maintained.

## Schema Summary

```yaml
schema_version: 1.0
schema_name: game-dev-project-status-board
board_scope: single_project
core_principle:
  lists_encode: status
  primary_labels_encode: epic_domain
  secondary_labels_encode: card_qualifier
card_requirements:
  status_list: exactly_one
  primary_label: exactly_one
  secondary_label: zero_or_one
derived_card_types:
  feature: no_secondary_label
  bug: orange_secondary_label
  analysis: green_secondary_label
  polish: pink_secondary_label
canonical_lists:
  - key: backlog_post_launch
    exact_name: Backlog Post-Launch
    order: 1
  - key: backlog_beta
    exact_name: Backlog Beta
    order: 2
  - key: up_next
    exact_name: Up Next
    order: 3
  - key: in_progress
    exact_name: In Progress
    order: 4
  - key: testing
    exact_name: Testing
    order: 5
  - key: done
    exact_name: Done
    order: 6
primary_labels:
  - key: epic_game_content
    color: blue
    recommended_name: Epic: Game Content
  - key: epic_infrastructure
    color: yellow
    recommended_name: Epic: Infrastructure
  - key: epic_business
    color: red
    recommended_name: Epic: Business
secondary_labels:
  - key: bug
    color: orange
    recommended_name: Type: Bug
  - key: analysis
    color: green
    recommended_name: Type: Analysis
  - key: polish
    color: pink
    recommended_name: Type: Polish
```

## Canonical Meaning

### Lists

Lists are status only. They do not encode epic, priority, team, or card type.

| Key | Exact Trello List Name | Meaning |
| --- | --- | --- |
| `backlog_post_launch` | `Backlog Post-Launch` | Approved work explicitly deferred until after launch. |
| `backlog_beta` | `Backlog Beta` | Work that must be completed before Beta opens. |
| `up_next` | `Up Next` | Curated shortlist of the next items to pull. |
| `in_progress` | `In Progress` | Work currently being executed. |
| `testing` | `Testing` | Work implemented and awaiting verification. |
| `done` | `Done` | Work completed and accepted. |

### Primary Labels

Every card must have exactly one primary label.

| Key | Trello Color | Meaning |
| --- | --- | --- |
| `epic_game_content` | `blue` | Gameplay and content work such as guns, enemies, abilities, maps, modes, progression, and other player-facing content. |
| `epic_infrastructure` | `yellow` | Technical infrastructure such as servers, metrics, backend services, pipelines, builds, tooling, and operational systems. |
| `epic_business` | `red` | Store page, marketing, monetization, community, launch operations, and other business-side work. |

### Secondary Labels

A card may have zero or one secondary label.

| Key | Trello Color | Meaning |
| --- | --- | --- |
| `bug` | `orange` | A defect, broken behavior, regression, or reliability issue. |
| `analysis` | `green` | Investigation, research, planning, evaluation, or design analysis. |
| `polish` | `pink` | Feel, presentation, UX, tuning, cleanup, or finishing-pass work. |

If a card has no secondary label, its derived card type is `feature`.

## Card Invariants

The AI must enforce these invariants:

1. Every active card is in exactly one canonical list.
2. Every active card has exactly one primary label.
3. Every active card has at most one secondary label.
4. A card with no secondary label is a `feature`.
5. A card must never have two primary labels.
6. A card must never have two secondary labels.
7. The AI must not create or apply labels outside this schema unless the schema is intentionally extended.
8. Checklists, comments, attachments, due dates, and assignees are optional metadata and do not replace status or label meaning.

## Naming Rules

Card names should be short and stable.

| Card Type | Naming Rule | Example |
| --- | --- | --- |
| `feature` | Use a concise feature or content name. Prefer noun phrases over sentences. | `Shotguns` |
| `bug` | Use `Fix <problem>` naming. | `Fix servers crashing when full` |
| `analysis` | Use `Analyze <topic>` or `Investigate <topic>` naming. | `Investigate retention drop after tutorial` |
| `polish` | Use `Polish <feature or area>` naming. | `Polish shotgun reload feel` |

The AI should preserve existing valid names unless the user explicitly requests a rename.

## Description Rules

The card description is freeform support data, but the AI must follow these rules:

1. Only add information the user provided or clearly implied.
2. Do not invent requirements, acceptance criteria, reproduction steps, owners, or dates.
3. If details are added, prefer concise markdown.
4. Status, epic, and qualifier are determined by list and labels, not by parsing the description.

## Status Transition Rules

The normal forward workflow is:

`Backlog Post-Launch` or `Backlog Beta` -> `Up Next` -> `In Progress` -> `Testing` -> `Done`

The AI may also apply these controlled moves:

1. `Testing` -> `In Progress` when testing fails or new work is required.
2. `Done` -> `In Progress` only if the user explicitly states the work is no longer complete or has regressed.
3. `Backlog Beta` <-> `Backlog Post-Launch` only when the user explicitly changes the milestone commitment.

The AI must not use `Up Next` as a dumping ground. New cards should only go to `Up Next` when the user indicates they are near-term priority.

## Creation Rules

When creating a new card, the AI must determine all of the following:

1. Card name
2. Status list
3. Primary label
4. Optional secondary label
5. Optional description content

Creation rules:

1. If the user explicitly says the work must be completed before Beta, place it in `Backlog Beta`.
2. If the user explicitly says the work is post-launch or after launch, place it in `Backlog Post-Launch`.
3. If the user explicitly says the work is next priority, place it in `Up Next`.
4. If the user explicitly says the work has started, place it in `In Progress`.
5. If the user explicitly says the work is ready for validation, place it in `Testing`.
6. If the user explicitly says the work is complete, place it in `Done`.
7. If milestone placement is required but not clear, the AI must ask rather than guess, because this schema has no neutral intake list.

## Update Rules

When the user describes project progress, the AI should interpret it as one of these intents:

| Intent | Required AI Action |
| --- | --- |
| `complete_card` | Find the existing card and move it to `Done`. |
| `start_card` | Find the existing card and move it to `In Progress`. |
| `send_to_testing` | Find the existing card and move it to `Testing`. |
| `reprioritize_card` | Move an existing card between backlog lists or to `Up Next` based on the user's instruction. |
| `create_card` | Create a new card using the creation rules. |
| `rename_card` | Rename only when the user explicitly requests a rename. |
| `annotate_card` | Add user-provided details to the description or comments without changing schema fields unless requested. |

## Card Lookup Rules

To prevent board drift, the AI must be conservative when matching user language to an existing card.

### Normalization

When comparing a user-supplied card reference to card names, normalize both sides by:

1. trimming leading and trailing whitespace
2. collapsing repeated internal whitespace to a single space
3. comparing case-insensitively

### Match Policy

1. If there is exactly one normalized exact match, use it.
2. If there are multiple exact matches, do not guess. Ask the user which card they meant.
3. If there is no exact match, do not automatically mutate the closest fuzzy match.
4. If there is no exact match and the user is clearly reporting new work, create a new card.
5. If there is no exact match and the user appears to mean an existing card, ask before changing anything.

### Duplicate Policy

The AI must not create a new active card if a normalized exact-name match already exists in any non-archived canonical list, unless the user explicitly asks for a separate card.

## Epic Inference Rules

When the user does not name the epic directly, the AI may infer it only when the domain is clear:

1. Weapons, enemies, maps, abilities, progression, and gameplay content -> `epic_game_content`
2. Servers, metrics, backend systems, analytics plumbing, builds, tools, and pipelines -> `epic_infrastructure`
3. Store page, trailers, marketing beats, wishlists, monetization, and community-facing business work -> `epic_business`

If more than one epic is plausible and no dominant owner is obvious, the AI must ask rather than guess.

## Qualifier Inference Rules

1. Broken behavior, regressions, crashes, incorrect results, or reliability issues -> `bug`
2. Research, discovery, evaluation, or uncertainty reduction -> `analysis`
3. Feel, presentation, cleanup, tuning, readability, or finish work -> `polish`
4. If none of the above applies, the card is a `feature`

## Schema Drift Rules

Schema drift means the board no longer matches this contract. Examples:

1. A required list is missing.
2. A card has no primary label.
3. A card has two primary labels.
4. A card has two secondary labels.
5. Non-schema labels are being used as hidden status or type markers.
6. Duplicate active cards exist for the same normalized title.

When drift is detected, the AI should:

1. avoid making the board messier
2. report the drift clearly
3. only normalize automatically when the correction is unambiguous

## Recommended Board Bootstrap

For reliable AI operation, the Trello board should contain:

1. all six canonical lists with the exact names above
2. one unique board label for each primary semantic key
3. one unique board label for each secondary semantic key

Recommended Trello label names:

1. `Epic: Game Content` with color `blue`
2. `Epic: Infrastructure` with color `yellow`
3. `Epic: Business` with color `red`
4. `Type: Bug` with color `orange`
5. `Type: Analysis` with color `green`
6. `Type: Polish` with color `pink`

Using these names is not required by the conceptual model, but it makes AI lookup and MCP-based automation much safer than relying on color alone.

## Worked Examples

### Example A

User statement:

`I have finished all the Shotguns.`

Expected interpretation:

```yaml
intent: complete_card
card_lookup_name: Shotguns
expected_card_type: feature
expected_primary_label: epic_game_content
expected_destination_list: done
```

Expected board action:

Move the existing `Shotguns` card from its current list to `Done`.

### Example B

User statement:

`I found a bug where the servers crash when full. Log this as a bug that needs to be fixed before Beta.`

Expected interpretation:

```yaml
intent: create_card
name: Fix servers crashing when full
primary_label: epic_infrastructure
secondary_label: bug
destination_list: backlog_beta
```

Expected board action:

Create a new card named `Fix servers crashing when full`, apply the infrastructure and bug labels, store any user-provided details, and place it in `Backlog Beta`.
