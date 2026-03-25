---
name: trello-game-dev-board-manager
description: Strict Trello board management for a game development project that uses canonical status lists plus epic/type labels. Use when Codex needs to interpret natural-language project updates, map them to the board schema, create or update cards through the Trello MCP server, validate board drift, or bootstrap missing schema labels before mutating the board.
---

# Trello Game Dev Board Manager

## Overview

Interpret project-update language using the bundled schema, convert it into a concrete Trello action plan, and then execute the required MCP tool calls without letting the board drift from the workflow.

Read [references/game-dev-board-schema.md](./references/game-dev-board-schema.md) before mutating the board.

Treat that reference as the source of truth for canonical lists, primary labels, secondary labels, matching policy, status transitions, and drift rules.

## Operating Rules

Follow these rules every time:

1. Use exact canonical list names from the schema.
2. Require exactly one primary label and at most one secondary label per card.
3. Use exact normalized name matching when resolving existing cards.
4. Do not fuzzy-update the nearest card when the match is unclear.
5. Do not invent requirements, dates, owners, or acceptance criteria.
6. Prefer adding a comment over overwriting an existing description unless the user explicitly wants the description changed.
7. Stop and ask when board context or card identity is ambiguous.

## Workflow

### 1. Establish Board Context

1. Call `get_active_board_info`.
2. If no active board is set, ask the user which board to use or resolve it with `list_boards` and then call `set_active_board`.
3. Do not mutate any Trello data until the active board is known.

### 2. Validate Schema Surface

1. Call `get_lists` and map canonical list names to list IDs.
2. Call `get_board_labels` and map schema label keys to board label IDs.
3. Resolve labels by exact recommended name first.
4. If the recommended name does not exist, fall back to color only when exactly one board label exists for that schema color.
5. If a required schema label is missing, create it with `create_label` using the recommended name and color from the schema.
6. If a required canonical list is missing, stop and tell the user. Do not auto-create lists unless the user explicitly wants bootstrap help, because this MCP does not expose list ordering controls.

### 3. Translate the User Input into an Internal Action Plan

Build this mental structure before any mutation:

```yaml
action_plan:
  intent: create_card | complete_card | start_card | send_to_testing | reprioritize_card | annotate_card | rename_card
  board_id: "<active board>"
  card_lookup_name: "<user-supplied or inferred>"
  card_name_canonical: "<final Trello card name>"
  target_list_key: "<schema list key>"
  primary_label_key: "<schema primary label key>"
  secondary_label_key: "<schema secondary label key or null>"
  description_payload: "<new card description or null>"
  comment_payload: "<comment to add or null>"
  requires_confirmation: true | false
  reason: "<brief explanation of the mapping>"
```

Map requests using the schema:

1. Completion language like `finished`, `done`, `completed` -> `complete_card`
2. Started language like `working on`, `started`, `in progress` -> `start_card`
3. Validation language like `ready for testing`, `needs QA` -> `send_to_testing`
4. New issue or work logging -> `create_card`
5. Priority or milestone changes -> `reprioritize_card`
6. Extra details without state change -> `annotate_card`
7. Explicit rename request -> `rename_card`

### 4. Resolve the Target Card for Update Intents

For any non-creation intent:

1. Fetch cards from all six canonical lists with `get_cards_by_list_id`.
2. Normalize the user reference and card names by trimming whitespace, collapsing internal whitespace, and comparing case-insensitively.
3. If exactly one exact normalized match exists, use it.
4. If multiple exact matches exist, ask the user which card they meant.
5. If no exact match exists and the user appears to mean an existing card, ask before changing anything.

### 5. Execute the Minimal Safe Mutation

Use the smallest tool sequence that satisfies the request:

1. `create_card`
   Use `add_card_to_list` with the target list ID, canonical card name, description payload, and resolved label IDs.
2. `complete_card`
   Use `move_card` to send the resolved card to `Done`.
3. `start_card`
   Use `move_card` to send the resolved card to `In Progress`.
4. `send_to_testing`
   Use `move_card` to send the resolved card to `Testing`.
5. `reprioritize_card`
   Use `move_card` to place the card in the schema-approved list named by the action plan.
6. `annotate_card`
   Prefer `add_comment`. Use `update_card_details` only when the user explicitly wants the description or labels changed.
7. `rename_card`
   Use `update_card_details` with the new name only.

When changing labels on an existing card:

1. Call `get_card` first to preserve any existing valid schema label that should remain.
2. Set exactly one primary label.
3. Set zero or one secondary label.
4. Remove schema-invalid extra primary or secondary labels only when the correction is unambiguous.

## Trello MCP Playbook

Use these tools as the default toolkit:

1. `get_active_board_info` to confirm context
2. `get_lists` to map canonical statuses to list IDs
3. `get_board_labels` to map schema labels to label IDs
4. `create_label` to bootstrap missing schema labels
5. `get_cards_by_list_id` to discover candidate cards
6. `get_card` to inspect full card details before non-trivial updates
7. `add_card_to_list` to create a new card
8. `move_card` to change status
9. `update_card_details` for rename, description, and label edits
10. `add_comment` for supplemental notes

## Drift Handling

Treat these as drift signals:

1. A canonical list is missing
2. Schema labels are missing or duplicated ambiguously
3. A card has multiple primary labels
4. A card has multiple secondary labels
5. Duplicate active cards exist for the same normalized title

When drift is detected:

1. Avoid making the board messier
2. Fix it automatically only if the correction is obvious
3. Otherwise report the issue and ask for confirmation before continuing

## Examples

User:

`I have finished all the Shotguns.`

Internal mapping:

```yaml
intent: complete_card
card_lookup_name: Shotguns
target_list_key: done
primary_label_key: epic_game_content
secondary_label_key: null
```

Typical tool flow:

1. `get_active_board_info`
2. `get_lists`
3. `get_cards_by_list_id` across canonical lists
4. `move_card`

User:

`I found a bug where the servers crash when full. Log this as a bug that needs to be fixed before Beta.`

Internal mapping:

```yaml
intent: create_card
card_name_canonical: Fix servers crashing when full
target_list_key: backlog_beta
primary_label_key: epic_infrastructure
secondary_label_key: bug
```

Typical tool flow:

1. `get_active_board_info`
2. `get_lists`
3. `get_board_labels`
4. `create_label` for any missing schema labels
5. `add_card_to_list`
