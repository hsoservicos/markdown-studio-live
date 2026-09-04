# RTK — Rust Token Killer (Claude Code)

**Purpose**: token-optimized CLI proxy. Cuts up to ~90% of bash output before it
reaches the model. In this repo it is wired into Claude Code through the
`PreToolUse` hook in `.claude/settings.json` (`rtk hook claude`) — the exact
counterpart of the OpenCode plugin at `~/.config/opencode/plugins/rtk.ts`.

## How it works here

- Every `Bash` tool call is intercepted by the hook and transparently rewritten
  (e.g. `git status` → `rtk git status`). Zero tokens of overhead, no manual step.
- The rewrite engine is the single source of truth (`rtk rewrite` / `rtk hook`).
- On a rewrite failure the raw command is passed through unchanged.

## Meta commands (run `rtk` directly)

```bash
rtk gain              # token-savings analytics
rtk gain --history    # command history with per-command savings
rtk discover          # scan agent history for missed opportunities
rtk proxy <cmd>       # run a command raw, bypassing all filtering (debug)
```

## Verify the integration

```bash
rtk --version                 # should print: rtk X.Y.Z
rtk init --show               # OpenCode plugin + (global) Claude hook status
echo '{"tool_name":"Bash","tool_input":{"command":"git status"}}' | rtk hook claude
```

## Bypass for one command

```bash
RTK_DISABLED=1 <command>       # return raw, unfiltered output
```

## Per-machine setup (both agents at once)

```bash
rtk init -g --auto-patch --opencode   # global Claude hook + OpenCode plugin
```

The project-level hook in `.claude/settings.json` already covers this repo even
without the global step; `rtk hook claude` is idempotent, so both may coexist.
