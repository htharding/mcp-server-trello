# Security Audit: `mcp-server-trello`

Date: 2026-03-25
Repository base commit: `8afd4377b3e0d0d091d174533add14fac92690e2`
Working tree note: local modifications were already present in `src/index.ts` and `src/trello-client.ts` at audit time, so this report reflects the current filesystem state rather than a clean commit checkout.

## Executive Summary

Verdict: **not ready for security-sensitive or board-scoped use cases in its current state**.

Finding counts:

- High: 2
- Medium: 3
- Low: 1

Main blockers:

- The attachment tools can read arbitrary local `file://` paths and upload them to Trello.
- The production dependency graph contains known high-severity advisories, including direct hits on `@modelcontextprotocol/sdk` and `axios`.
- The server presents board-scoped UX, but several operations do not enforce board membership or active-board boundaries server-side.

Positive observations:

- The server uses `stdio` transport instead of exposing an HTTP listener (`src/index.ts:3`, `src/index.ts:1271`, `server.json:19`).
- Trello credentials are sourced from environment variables rather than hard-coded in the repo (`src/index.ts:14-19`).
- I did **not** find OAuth proxy logic, token passthrough behavior, or server-side session handling, so the MCP guidance for confused-deputy, token passthrough, and session hijacking appears largely not applicable here.

## Methodology

This audit followed the official MCP security themes plus a reproducible, evidence-based audit format:

- Official MCP Security Best Practices:
  - <https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices>
- MCP audit documentation / transparency model:
  - <https://github.com/ModelContextProtocol-Security/audit-db>

Review steps:

- Manual code review of:
  - `src/index.ts`
  - `src/trello-client.ts`
  - `src/health/health-endpoints.ts`
  - `src/health/health-monitor.ts`
  - `package.json`
  - `package-lock.json`
  - `README.md`
  - `docs/HEALTH_MONITORING.md`
- Dependency advisory check:
  - `npm.cmd audit --omit=dev --package-lock-only --json --cache .npm-cache`
- Package inspection:
  - `npm.cmd pack --dry-run --json --cache .npm-cache`

Applied MCP audit criteria:

- Local MCP server compromise
- Scope minimization / least privilege
- Error handling and information disclosure
- Supply-chain / dependency hygiene
- Transport and trust-boundary review

Limitations:

- No live Trello credentials were used during the audit.
- No destructive exploit demonstrations were executed.
- This was a source-level audit, not a penetration test against a deployed client integration.

## Findings

### High 1: Arbitrary local file exfiltration via attachment tools

Why this matters:

- MCP's official local-server guidance warns that local servers are dangerous when they can access the user's filesystem and other local resources without strong guardrails.
- This server allows a caller to provide a `file://` path, reads that file from the local machine, and uploads it to Trello as an attachment.

Evidence:

- `attach_file_to_card` accepts a free-form string for `fileUrl` (`src/index.ts:387-399`).
- `attach_image_to_card` delegates into the same file attachment path (`src/trello-client.ts:394-401`).
- The implementation explicitly detects `file://` URLs (`src/trello-client.ts:462`) and streams the local file (`src/trello-client.ts:480`) into Trello.
- The README documents local file-path support as an intended feature (`README.md:575`, `README.md:583`).

Impact:

- A prompt-injected model or other untrusted caller can exfiltrate any file readable by the MCP server process, including SSH keys, local source files, dotenv files, browser export files, and documents.
- Because the destination is Trello, this is direct third-party data exfiltration, not just local disclosure.

Example attack path:

- A malicious prompt asks the assistant to "attach the config file for troubleshooting."
- The model calls `attach_file_to_card` with something like `file:///C:/Users/user/.ssh/id_rsa` or `file:///C:/Users/user/Documents/secrets.txt`.
- The server reads the file and uploads it to Trello.

Recommendation:

- Remove `file://` support entirely unless your use case explicitly requires it.
- If local-file uploads are required, gate them behind an explicit opt-in configuration flag and a strict allowlist of directories.
- Mark the tool as dangerous in documentation and require user confirmation in the client before local file reads.
- Consider splitting local-file upload into a separate server or disabled-by-default feature.

### High 2: Known high-severity vulnerabilities in the production dependency graph

Why this matters:

- The production dependency set contains advisories that are current as of 2026-03-25.
- Two of the high-severity issues affect direct runtime dependencies.

Evidence:

- Direct runtime dependencies:
  - `@modelcontextprotocol/sdk` declared in `package.json:27`
  - `axios` declared in `package.json:28`
  - `mcp-evals` declared in `package.json:30`
- Installed versions from the lockfile:
  - `@modelcontextprotocol/sdk` `1.25.1` (`package-lock.json:850-852`)
  - `axios` `1.13.2` (`package-lock.json:1361-1366`)
  - `mcp-evals` `1.0.18` (`package-lock.json:3052-3068`)
- `npm audit` results:
  - 11 total vulnerabilities: 5 high, 5 moderate, 1 low
  - Direct high advisories:
    - `@modelcontextprotocol/sdk`: GHSA-8r9q-7v3j-jr4g, GHSA-345p-7cg4-v4c7
    - `axios`: GHSA-43fc-jf86-j433
  - Transitive high advisories include `@hono/node-server`, `hono`, and `undici`

Advisory references:

- <https://github.com/advisories/GHSA-8r9q-7v3j-jr4g>
- <https://github.com/advisories/GHSA-345p-7cg4-v4c7>
- <https://github.com/advisories/GHSA-43fc-jf86-j433>
- <https://github.com/advisories/GHSA-wc8c-qw6v-h7f6>
- <https://github.com/advisories/GHSA-q5qw-h33p-qvwr>

Impact:

- Even when some transitive issues are not directly reachable in the server's main execution path, shipping known-vulnerable runtime dependencies materially weakens the server's security posture and increases patching urgency.
- `mcp-evals` appears to be an evaluation-only dependency (`src/evals/evals.ts:3-5`) but is still installed as a production dependency, unnecessarily widening the runtime attack surface.

Recommendation:

- Upgrade `@modelcontextprotocol/sdk` beyond the affected advisory range.
- Upgrade `axios` beyond the affected advisory range.
- Move `mcp-evals` from `dependencies` to `devDependencies` unless it is truly needed at runtime.
- Re-run `npm audit` after dependency cleanup and block releases on high-severity findings.

### Medium 1: Board-scoped UX is not enforced server-side

Why this matters:

- MCP guidance emphasizes scope minimization and least privilege.
- The README says "all methods now accept an optional `boardId` parameter" (`README.md:221`), but several tool implementations either ignore `boardId` entirely or act directly on globally valid Trello object IDs.

Evidence:

- `get_cards_by_list_id` accepts `boardId` but calls the client with only `listId` and `fields` (`src/index.ts:61-77`).
- `addCard` accepts `boardId` but only sends `idList`, not a verified board binding (`src/trello-client.ts:292-309`).
- `updateCard` accepts `boardId` but updates by raw `cardId` (`src/trello-client.ts:316-337`).
- `archiveCard` accepts `boardId` but archives by raw `cardId` (`src/trello-client.ts:341-347`).
- `archiveList` accepts `boardId` but archives by raw `listId` (`src/trello-client.ts:378-384`).
- `attachFileToCard` and `attachImageToCard` accept `boardId` but do not validate card ownership against that board (`src/trello-client.ts:394-401`, `src/trello-client.ts:453-512`).

Impact:

- If the model learns a valid card ID, list ID, or checklist ID from any accessible board, it can often act on that object regardless of the selected active board.
- This breaks the mental model of "active board" safety and makes the server a poor fit for single-board containment use cases.

Recommendation:

- Enforce server-side ownership checks before every card/list/checklist mutation.
- Reject operations when the target object does not belong to the requested `boardId` or active board.
- Update the README to match actual behavior until enforcement exists.

### Medium 2: Health and diagnostic tools leak internal metadata and stack traces

Why this matters:

- The docs claim health endpoints sanitize errors and redact sensitive information (`docs/HEALTH_MONITORING.md:217-220`).
- The implementation returns detailed health data, raw error messages, board URLs, and stack traces.

Evidence:

- `get_health_detailed` returns the entire serialized health report (`src/health/health-endpoints.ts:93`).
- Health metadata includes board name and board URL (`src/health/health-monitor.ts:208-210`).
- Error metadata includes `error.stack` (`src/health/health-monitor.ts:542`).
- Generic error handling returns raw `error.message` to the caller (`src/index.ts:51`, `src/index.ts:430`).
- `createErrorResponse` also returns detailed error text (`src/health/health-endpoints.ts:495-514`).

Impact:

- A caller can learn board URLs, internal stack traces, local file paths, and other implementation details that should not be broadly exposed to the model.
- This increases the blast radius of prompt injection and weakens operational secrecy.

Recommendation:

- Remove stack traces from tool responses.
- Redact board URLs, local paths, and internal error details unless an explicit debug mode is enabled.
- Make the docs accurate: either sanitize responses or stop claiming they are sanitized.

### Medium 3: `perform_system_repair` changes persistent active-board state without an explicit target

Why this matters:

- A health tool should not silently broaden or redirect the operational scope of future write actions.
- Here, the "repair" action can select the first open board and persist it.

Evidence:

- The repair tool is exposed as `perform_system_repair` (`src/index.ts:1261`).
- Repair logic calls `setActiveBoard(openBoards[0].id)` when no active board is configured (`src/health/health-endpoints.ts:473`).
- Active board selection is persisted to disk in `~/.trello-mcp/config.json` (`README.md:228`, `src/trello-client.ts:113`).

Impact:

- A model can be induced to "repair" the server, after which later board mutations may hit a board the user did not intend to target.
- This is especially risky in multi-board workspaces.

Recommendation:

- Remove auto-selection behavior from repair flows.
- Require an explicit board ID for any state-changing repair action.
- Prefer returning a recommendation over mutating persistent configuration automatically.

### Low 1: Unbounded base64 attachment handling can be used for local denial-of-service

Why this matters:

- `attach_image_data_to_card` accepts unbounded base64 input and converts it into an in-memory `Buffer`.

Evidence:

- The tool accepts free-form `imageData` with no size limit (`src/index.ts:441-453`).
- The implementation does `Buffer.from(imageData, 'base64')` (`src/trello-client.ts:427`).

Impact:

- Very large inputs can spike memory usage or crash the process.
- This is primarily an availability issue rather than a confidentiality/integrity issue.

Recommendation:

- Enforce a strict maximum payload size before decoding.
- Reject oversized data URLs and base64 bodies early.
- Prefer streaming or temporary-file approaches if large uploads are required.

## Readiness Assessment

Based on this security audit alone:

- **Not ready** for security-sensitive use cases.
- **Not ready** for deployments that depend on strong board-level containment.
- **Potentially usable only after remediation** for a fully trusted, single-user, local workflow where:
  - the attachment tools cannot read arbitrary local files,
  - high-severity dependency advisories are cleared,
  - health/debug output is sanitized,
  - board scoping is enforced or the risk is explicitly accepted.

## Recommended Remediation Order

1. Remove or hard-gate `file://` attachment support.
2. Upgrade vulnerable direct dependencies and re-audit.
3. Enforce board ownership checks on all card/list/checklist mutations.
4. Sanitize health and error responses.
5. Remove state-changing behavior from `perform_system_repair`.
6. Add payload size limits and release-time security checks.

## Additional Hardening Notes

- Prefer shorter-lived Trello tokens; the README still demonstrates `expiration=never` (`README.md:110`, `README.md:121`).
- Consider making dangerous tools opt-in through environment flags.
- Add automated security regression tests for:
  - local file access rejection
  - cross-board mutation rejection
  - error redaction
  - dependency audit failures in CI

## Remediation Update

Status update: 2026-03-25

The following audit items have now been addressed in the working tree:

- `@modelcontextprotocol/sdk` upgraded to `^1.28.0`
- `axios` upgraded to `^1.13.6`
- `mcp-evals` moved from `dependencies` to `devDependencies` and upgraded to `^2.0.1`
- Release path now includes `audit:security` and `prepublishOnly` gates in `package.json`
- Local `file://` attachment uploads are disabled by default and require `TRELLO_ENABLE_LOCAL_FILE_ATTACHMENTS=true`
- Health and tool errors now redact internal diagnostics unless `TRELLO_DEBUG=true`

Post-fix verification completed:

- `npm.cmd run audit:security` now reports `found 0 vulnerabilities`

Remaining caveats:

- A full `npm audit` without `--omit=dev` still reports development-only vulnerabilities from the dev toolchain.
- `npm run build` could not be executed in this environment because `bun` is not installed here.
- A full TypeScript compile could not be completed in this environment because `tsc` exhausted the available Node heap.
