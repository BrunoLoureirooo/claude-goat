#!/usr/bin/env node
// local-llm.mjs — talk to a local Ollama box in model tiers (large ≈ sonnet, small ≈ haiku).
//
//   node local-llm.mjs [--tier small|medium|large] [--system "text"] [--max N] ["prompt" | < stdin]
//        one chat completion; prints the reply. A tier whose model isn't installed falls back to the
//        next larger installed tier (the model actually used is reported on stderr).
//   node local-llm.mjs --probe [--timeout S]   prints JSON {up, url, tiers:{tier:model|null}} ; exit 0 if up, 1 if not
//   node local-llm.mjs --resolve <tier>        prints the model name that tier resolves to (for opencode -m ollama/<name>)
//   node local-llm.mjs --pull <tier>           asks the box to download that tier's configured model
//
// Config: ~/.claude/local-llm.json  { "url": ".../v1", "tiers": { "large": "...", "medium": "...", "small": "..." } }
// Env overrides: LOCAL_LLM_URL, LOCAL_LLM_MODEL (forces one model for every tier), LOCAL_LLM_TIMEOUT_S (default 300)
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ORDER = ["small", "medium", "large"]; // ascending
const DEFAULTS = {
  url: "http://100.65.125.13:11434/v1",
  tiers: { large: "bazobehram/qwen3-coder-next:latest", medium: "qwen3-coder:30b", small: "qwen3-coder:30b" },
};
let cfg = DEFAULTS;
try {
  const f = JSON.parse(readFileSync(join(homedir(), ".claude", "local-llm.json"), "utf8"));
  cfg = { url: f.url || DEFAULTS.url, tiers: { ...DEFAULTS.tiers, ...f.tiers } };
} catch {}
const url = (process.env.LOCAL_LLM_URL || cfg.url).replace(/\/$/, "");
const root = url.replace(/\/v1$/, ""); // Ollama native API lives beside /v1
const forced = process.env.LOCAL_LLM_MODEL;

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const val = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : undefined);
const timeoutS = Number(val("--timeout")) || Number(process.env.LOCAL_LLM_TIMEOUT_S) || 300;

async function installed(t = 5) {
  const res = await fetch(`${root}/api/tags`, { signal: AbortSignal.timeout(t * 1000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Set((await res.json()).models.map((m) => m.name));
}
// tier → installed model, falling back upward (small→medium→large), else null
function resolve(tier, have) {
  if (forced) return forced;
  for (const t of ORDER.slice(ORDER.indexOf(tier))) {
    const m = cfg.tiers[t];
    if (m && (have.has(m) || have.has(`${m}:latest`))) return m;
  }
  return null;
}
const fail = (msg) => { console.error(`local-llm: ${msg}`); process.exit(1); };
const tier = val("--tier") || "large";
if (!ORDER.includes(tier) && !flag("--probe")) fail(`unknown tier "${tier}" (small|medium|large)`);

if (flag("--probe")) {
  try {
    const have = await installed(Number(val("--timeout")) || 3);
    const tiers = Object.fromEntries(ORDER.map((t) => [t, resolve(t, have)]));
    console.log(JSON.stringify({ up: true, url, tiers, installed: [...have] }));
  } catch {
    console.log(JSON.stringify({ up: false, url }));
    process.exit(1);
  }
  process.exit(0);
}

if (flag("--resolve") || flag("--pull")) {
  const t = val("--resolve") || val("--pull");
  if (!ORDER.includes(t)) fail(`unknown tier "${t}"`);
  if (flag("--pull")) {
    const m = cfg.tiers[t];
    console.error(`pulling ${m} on ${root} (can take many minutes)…`);
    const res = await fetch(`${root}/api/pull`, { method: "POST", body: JSON.stringify({ model: m, stream: false }) }).catch((e) => fail(e.message));
    console.log(res.ok ? `pulled ${m}` : `pull failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    process.exit(res.ok ? 0 : 1);
  }
  try {
    const m = resolve(t, await installed());
    if (!m) fail(`no installed model for tier ${t} or above`);
    console.log(m);
  } catch (e) { fail(`box unreachable (${e.message})`); }
  process.exit(0);
}

let system = val("--system") || "";
const maxTokens = Number(val("--max")) || 4096;
const skip = new Set(["--tier", "--system", "--max", "--timeout"]);
const rest = argv.filter((a, i) => !a.startsWith("--") && !skip.has(argv[i - 1]));
let prompt = rest.join(" ");
if (!prompt && !process.stdin.isTTY) prompt = readFileSync(0, "utf8");
if (!prompt.trim()) fail("empty prompt (pass it as an argument or on stdin)");

try {
  const model = resolve(tier, forced ? new Set() : await installed());
  if (!model) fail(`no installed model for tier ${tier} or above`);
  if (model !== cfg.tiers[tier]) console.error(`local-llm: tier ${tier} → using ${model} (configured ${cfg.tiers[tier]} not installed)`);
  const messages = [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: prompt }];
  const res = await fetch(`${url}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, stream: false }),
    signal: AbortSignal.timeout(timeoutS * 1000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const text = (await res.json()).choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("empty reply");
  process.stdout.write(text + "\n");
} catch (e) {
  fail(`${e.name === "TimeoutError" ? `timed out after ${timeoutS}s` : e.message} (${url}) — is the Tailnet box up?`);
}
