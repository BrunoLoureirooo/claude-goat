# Claude Code notes

Behaviour observed while building the worker agents and the orchestrator mode. Each line is what Claude Code did on the version named, checked with headless runs and hook logs, not a quote from its documentation. Recheck after an upgrade: the subagent model order has changed before.

## Agents

- **An agent with an empty body keeps the default system prompt** when it runs as the main thread (`--agent`, or the `agent` key in settings). The empty prompt is accepted; only a non-empty body replaces the default prompt. (2.1.322)
- **A main-thread agent with no `model` line follows the settings `model`.** With `--model` on the command line, that flag wins over an agent's own `model`; an agent's `model` wins over the settings `model`. (2.1.322)
- **Subagent model order:** the `model` passed on the call, then the agent definition's `model` (`inherit` means the main model), then `CLAUDE_CODE_SUBAGENT_MODEL`, then the main model. So the variable fills in only for agents that name no model; it does not override `inherit` or an explicit model unless `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`. (2.1.322)
- **Forks are on by default.** A fork runs on the main model with the whole conversation; `CLAUDE_CODE_FORK_SUBAGENT=0` turns them off. (2.1.322)

## Hooks

- **`SessionStart` does not fire for subagents.** A run that started one subagent fired `SessionStart` once (the main session) and `SubagentStart` once. (2.1.322)
- **`agent_id` is in the hook input only for calls made inside a subagent**, workflow agents included; main-thread calls have none. `agent_type` is also present on the main thread when it runs as an agent, so it can't tell the two apart. `SessionStart` input carries `agent_type` under `--agent` and none without an agent. (2.1.322)
- **`claude -p` runs report `CLAUDE_CODE_ENTRYPOINT=sdk-cli`** to hooks. (2.1.322)

## Settings

- **A settings `env` value overrides the shell** for the same variable: exporting it in the shell before starting `claude` changes nothing once the key is in a settings file. A variable set only in the shell does reach hooks. (2.1.322)

## CLI

- **`claude mcp get <server>` prints the server's headers, `Authorization` included, in clear.** Keep it out of logs, screen shares and transcripts. (2.1.322)
