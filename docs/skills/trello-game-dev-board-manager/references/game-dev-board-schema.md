# Game Dev Board Schema

Use this reference as the strict Trello contract for the skill.

## Core Model

1. Lists encode status only.
2. Primary labels encode epic/domain only.
3. Secondary labels encode card qualifier only.
4. Every card must have exactly one primary label and zero or one secondary label.
5. No secondary label means the card is a `feature`.

## Canonical Lists

| Key | Exact Name | Meaning |
| --- | --- | --- |
| `backlog_post_launch` | `Backlog Post-Launch` | Approved work explicitly deferred until after launch. |
| `backlog_beta` | `Backlog Beta` | Work that must be complete before Beta opens. |
| `up_next` | `Up Next` | Curated shortlist of the next items to pull. |
| `in_progress` | `In Progress` | Work currently being executed. |
| `testing` | `Testing` | Work awaiting verification. |
| `done` | `Done` | Work completed and accepted. |

Normal forward flow:

`Backlog Post-Launch` or `Backlog Beta` -> `Up Next` -> `In Progress` -> `Testing` -> `Done`

Allowed reverse or special moves:

1. `Testing` -> `In Progress` when testing fails
2. `Done` -> `In Progress` only when the user explicitly says the work regressed or is no longer done
3. `Backlog Beta` <-> `Backlog Post-Launch` only when the user explicitly changes milestone commitment

## Primary Labels

Every card must have exactly one of these:

| Key | Color | Recommended Name | Meaning |
| --- | --- | --- | --- |
| `epic_game_content` | `blue` | `Epic: Game Content` | Gameplay and content work such as guns, enemies, maps, abilities, modes, progression, and player-facing content. |
| `epic_infrastructure` | `yellow` | `Epic: Infrastructure` | Technical infrastructure such as servers, metrics, backend systems, builds, pipelines, tooling, and operations. |
| `epic_business` | `red` | `Epic: Business` | Store page, marketing, monetization, launch operations, and other business-side work. |

## Secondary Labels

Cards may have zero or one of these:

| Key | Color | Recommended Name | Meaning |
| --- | --- | --- | --- |
| `bug` | `orange` | `Type: Bug` | A defect, regression, crash, or broken behavior. |
| `analysis` | `green` | `Type: Analysis` | Research, investigation, evaluation, planning, or design analysis. |
| `polish` | `pink` | `Type: Polish` | Tuning, finishing-pass work, UX cleanup, presentation improvement, or feel improvement. |

No secondary label means `feature`.

## Card Naming Rules

| Card Type | Rule | Example |
| --- | --- | --- |
| `feature` | Use a short noun phrase. | `Shotguns` |
| `bug` | Use `Fix <problem>`. | `Fix servers crashing when full` |
| `analysis` | Use `Analyze <topic>` or `Investigate <topic>`. | `Investigate retention drop after tutorial` |
| `polish` | Use `Polish <feature or area>`. | `Polish shotgun reload feel` |

## Matching Rules

When matching user input to an existing card:

1. Trim leading and trailing whitespace
2. Collapse repeated internal whitespace to a single space
3. Compare case-insensitively
4. Use only exact normalized matches for automatic updates
5. If multiple exact matches exist, ask the user
6. If no exact match exists and the user seems to mean an existing card, ask before mutating

## Creation Rules

When logging a new card:

1. Determine the canonical card name
2. Determine the target status list
3. Determine the primary epic label
4. Determine the optional secondary qualifier label
5. Use only user-provided or clearly implied details in the description

Status placement rules:

1. Before Beta -> `Backlog Beta`
2. After launch or post-launch -> `Backlog Post-Launch`
3. Near-term next priority -> `Up Next`
4. Already started -> `In Progress`
5. Ready for verification -> `Testing`
6. Already complete -> `Done`

If the milestone or status implication is unclear and the card is new, ask rather than guessing.

## Intent Mapping

| Intent | Meaning | Standard Mutation |
| --- | --- | --- |
| `create_card` | New work, issue, analysis, or polish item | Create a card in the correct list with correct labels |
| `complete_card` | Work is finished | Move card to `Done` |
| `start_card` | Work has begun | Move card to `In Progress` |
| `send_to_testing` | Work is ready for validation | Move card to `Testing` |
| `reprioritize_card` | Milestone or scheduling change | Move card to the requested backlog or `Up Next` |
| `annotate_card` | Add information without a state change | Add comment or explicitly requested description update |
| `rename_card` | User explicitly wants a new title | Rename the card |

## Inference Rules

Epic inference:

1. Weapons, enemies, maps, abilities, progression, and gameplay content -> `epic_game_content`
2. Servers, metrics, backend systems, builds, tools, and pipelines -> `epic_infrastructure`
3. Store page, marketing, wishlists, monetization, and community-facing business work -> `epic_business`

Qualifier inference:

1. Broken behavior, crash, regression, reliability issue -> `bug`
2. Research, discovery, evaluation, planning -> `analysis`
3. Tuning, cleanup, presentation, feel, finish work -> `polish`
4. Otherwise -> `feature`

If inference is not clear, ask.

## Drift Rules

Drift examples:

1. A canonical list is missing
2. A card has no primary label
3. A card has multiple primary labels
4. A card has multiple secondary labels
5. Duplicate active cards exist for the same normalized title

When drift is detected:

1. Avoid compounding it
2. Auto-fix only if the correction is unambiguous
3. Otherwise explain the drift and ask for confirmation
