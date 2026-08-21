# Technical Specification — #001 ngrok tunnel fails on transient DNS

> Not a GitHub issue. This project is not a git repository and has no issue
> tracker, so there was nothing to fetch or load from `./specs/issues/`.
> Reported directly by the user with a terminal transcript (16 Aug 2026 22:16).

## Issue Summary
- **Title:** ngrok tunnel fails at `python_backend` startup — `failed to dial ngrok server ... lookup connect.ngrok-agent.com: no such host`
- **Description:** `python main.py` starts, opens the DB, loads the location cache, then pyngrok retries for ~15 s and dies. Uvicorn reports `Application startup complete` and serves on `0.0.0.0:5056` **with no tunnel**.
- **Labels:** bug, networking, resilience
- **Priority:** High — with no tunnel there is no public URL, so no Kirimi/Fonnte webhook can reach Python at all. The AI is unreachable while looking healthy.

## Problem Statement

The pasted failure is **not** an authentication, domain, or configuration fault. `connect.ngrok-agent.com` simply failed to resolve at 22:16:58. Verified after the fact:

| Check | Result |
|---|---|
| `nslookup` via local resolver (10.92.145.170) | resolves, 5×A + 5×AAAA |
| `nslookup` via 8.8.8.8 | resolves, identical set |
| TCP connect `54.255.3.198:443` from the venv | `connect_ex = 0` (OK) |
| `getaddrinfo(..., AF_INET6)` from the venv | `gaierror 11004` — **AAAA fails locally** |

So the network is fine now and the outage was transient — a flaky resolver, with an IPv6 path that is unreliable on this machine even when IPv4 works.

The **defect we own** is the response to it. `start_tunnel()` makes exactly **one** attempt, during lifespan startup. Any transient blip permanently disables the tunnel for the whole process lifetime, and nothing afterwards says so: startup is still declared complete, the port is still bound, and the health endpoint still answers. The user's process (PID 20564) was confirmed still running in exactly that state — listening on 5056, reachable by nobody.

A tunnel that cannot self-heal turns a 5-second network hiccup into an outage that lasts until a human notices and restarts the backend.

## Technical Approach

Three changes, smallest first:

1. **Classify the failure before reacting.** Retrying a bad auth token wastes 30 s and still fails; *not* retrying a DNS blip loses the tunnel for hours. Map the error text to `TRANSIENT` (DNS/dial/timeout/reset) vs `PERMANENT` (`ERR_NGROK_4018` bad token, `ERR_NGROK_334`/`108` domain already in use, missing binary) and act accordingly — permanent failures fail fast with the specific remedy.

2. **Retry transient failures, then keep retrying in the background.** Bounded backoff at startup (so boot isn't blocked for long), then a daemon thread that keeps attempting at a slow interval. The tunnel comes back on its own once DNS recovers; nobody restarts anything.

3. **Make the degraded state impossible to miss.** A loud banner when there is no tunnel, and `tunnel` state in `/health` so it is observable rather than inferred from scrollback.

Explicitly **not** doing: forcing IPv4 inside the ngrok agent. It is a Go binary we start via pyngrok; there is no supported knob for it, and IPv4 already works. A pre-flight check that *reports* which family resolves is enough, and it is honest about what it observed.

## Implementation Plan
1. `app/core/ngrok_diagnostics.py` — `classify_error()` and `preflight()` (pure, no I/O in `classify_error`, so it is trivially testable).
2. `app/core/ngrok_tunnel.py` — use the classifier; retry transient with backoff; start the background retry thread; keep the existing single-domain warnings intact.
3. `app/main.py` — report tunnel state in `/health`.
4. `tests/test_ngrok_tunnel.py` — TDD, then A/B-prove each assertion bites.

## Test Plan
1. **Unit — `classify_error()`**
   - the exact DNS string from this report → `TRANSIENT`
   - `ERR_NGROK_4018` / "authentication failed" → `PERMANENT`
   - `ERR_NGROK_334` / "domain is already in use" → `PERMANENT` with domain-conflict remedy
   - unknown text → `TRANSIENT` (retrying an unknown fault is cheap; giving up on it is not)
2. **Component — `start_tunnel()` with a faked `pyngrok`**
   - fails twice then succeeds → returns the URL, exactly 3 attempts
   - permanent error → **1** attempt, no retry loop
   - `ENABLE_NGROK=false` → 0 attempts
   - missing authtoken → 0 attempts, explicit message
   - tunnel failure never raises out of `start_tunnel()` (backend must still serve localhost)
3. **Integration**
   - `/health` reports `tunnel.active=false` + reason when no tunnel
   - real `preflight()` against the live network reports IPv4 reachable

## Files to Modify
- `python_backend/app/core/ngrok_tunnel.py`: classification, retry, background self-heal, degraded banner
- `python_backend/app/main.py`: expose tunnel state on `/health`

## Files to Create
- `python_backend/app/core/ngrok_diagnostics.py`: error classification + connectivity pre-flight
- `python_backend/tests/test_ngrok_tunnel.py`: regression suite

## Existing Utilities to Leverage
- `app/config.get_settings()`: `ENABLE_NGROK`, `NGROK_AUTHTOKEN`, `PYTHON_NGROK_DOMAIN`, `PYTHON_PORT`
- `app/core/ngrok_tunnel._node_backend_is_running()`: existing single-domain conflict detection
- `logging` via `elevan.python`: already UTF-8-forced by `terminal_logger`

## Success Criteria
- [x] A transient DNS failure at startup no longer permanently disables the tunnel
- [x] The tunnel re-establishes itself without restarting the backend
- [x] A bad token / domain conflict fails in one attempt with a specific remedy
- [x] No tunnel is loudly visible in the terminal and in `/health`
- [x] ngrok failure still never prevents the backend from serving localhost
- [x] Every new test A/B-proven non-vacuous

## Outcome (implemented 16 Aug 2026)
`tests/test_ngrok_tunnel.py` — **39/39**; full Python suite **165/165**.
A/B: disabling each of the four fixes individually fails the suite (retry → 5,
fail-fast → 2, self-heal → 1, DNS-before-wrapper ordering → 5).
`app/core/ngrok_tunnel.py` 295 lines, `ngrok_diagnostics.py` 151 — both within
the 300-line limit.

**Not verified end-to-end by me, deliberately:** actually opening a tunnel
would seize the account's single reserved domain — the production one on the
Kirimi dashboard. That is the user's call, not a side effect of a test run.
Network reachability *was* verified live (`preflight()` → IPv4 OK).

## Out of Scope
- The single-reserved-domain limit (needs a paid plan or a second account) — already documented, unchanged here
- Removing the orphaned `ngrok.exe` (PID 3648, started 23:06 by hand, no tunnel, no 4040) — user-launched, not ours to kill
- Any change to the Node.js production tunnel
