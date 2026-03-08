# 📚 DSA Learning System — WhatsApp Bot

A personalized Data Structures & Algorithms learning system delivered via **WhatsApp** using **Baileys** (direct socket connection, no third-party API), with **SQLite** for persistence and **TypeScript** as the backend.

---

## 🏗️ Architecture Overview

```
WhatsApp ──► Baileys socket ──► socket.ts (Transport)
                                    │ messages.upsert
                               handlers.ts (Command Router)
                                    │ routeUserCommand()
                             LearningService (Orchestration)
                                    │ IMessenger interface
                            BaileysMessenger (Delivery)
                                    │ sock.sendMessage()
                               WhatsApp (delivered)

Scheduled:
  node-cron ──► scheduler.ts ──► LearningService ──► same path
```

### Layers (top → bottom, dependencies flow downward only)

| Layer | Files | Responsibility |
|-------|-------|----------------|
| **Transport** | `bot/socket.ts` | Baileys socket lifecycle, QR, reconnect |
| **Handlers** | `bot/handlers.ts` | Message validation, command routing |
| **Services** | `services/learning.ts`, `services/scheduler.ts` | Domain orchestration |
| **Channels** | `channels/baileys-messenger.ts`, `channels/openclaw-messenger.ts` | `IMessenger` implementations |
| **Infrastructure** | `db/`, `infrastructure/` | SQLite, Ollama client |

The `IMessenger` interface (`domain/ports/messaging.port.ts`) decouples all business logic from the delivery channel — swapping WhatsApp for Discord or Telegram only requires a new adapter.

---

## 📁 Project Structure

```
src/
├── main.ts                          # Entry point (Baileys bot)
├── index.ts                         # Express server (admin endpoints)
├── config/
│   └── index.ts                     # Centralized env var reads
├── bot/
│   ├── socket.ts                    # Transport: Baileys socket lifecycle
│   └── handlers.ts                  # Incoming message routing
├── channels/
│   ├── messenger.interface.ts       # Re-exports IMessenger (from domain/ports)
│   ├── baileys-messenger.ts         # IMessenger via Baileys (primary)
│   └── openclaw-messenger.ts        # IMessenger via OpenClaw HTTP API (fallback)
├── domain/
│   ├── ports/
│   │   └── messaging.port.ts        # IMessenger, SendResult, ButtonOption, ListOption
│   └── ...
├── services/
│   ├── learning.ts                  # Core orchestration (injected IMessenger)
│   ├── scheduler.ts                 # Cron jobs (injected IMessenger)
│   ├── openclaw.ts                  # OpenClaw HTTP client + MessageFormatter
│   └── content-generator.ts        # Ollama-powered theory/solution generation
├── shared/
│   └── message-formatter.ts         # Typed MessageFormatter (domain entities)
├── core/
│   └── curriculum-engine/           # Topic sequencing, progress, roadmap tracking
├── db/
│   ├── init.ts                      # Schema creation
│   ├── seeder.ts                    # Seed roadmap & test questions
│   └── repository.ts                # All DB operations (CRUD)
├── data/
│   └── neetcode-roadmap.ts          # Full NeetCode topic + problem definitions
└── infrastructure/
    └── ollama-client.ts             # Local LLM client
```

---

## ⚙️ Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_STATE_PATH` | `auth_state` | Baileys session storage directory |
| `PORT` | `3000` | Express admin server port |
| `DAILY_MESSAGE_TIME` | `09:00` | When to deliver daily topics (HH:MM) |
| `WEEKLY_TEST_DAY` | `6` | Day of week for tests (0=Sun, 6=Sat) |
| `WEEKLY_TEST_TIME` | `10:00` | Time for weekly test delivery |

### 3. Start the Bot

```bash
# Development
npm run dev

# Production
npm run build && node dist/main.js
```

On first run, a QR code is printed to the terminal. Scan it with WhatsApp. The session is saved to `auth_state/` and reused on restart.

---

## 🔌 Delivery Channels

### Baileys (primary — `src/channels/baileys-messenger.ts`)

Direct WebSocket connection to WhatsApp. No API keys required.

- Rate limited to 1 message/sec per recipient
- `sendButtons` / `sendList` fall back to numbered text menus (Baileys limitation on regular accounts)
- Session persisted via `useMultiFileAuthState` in `auth_state/`
- Exponential backoff reconnect: 3s → 6s → ... → 60s max, 10 retries

### OpenClaw (fallback — `src/channels/openclaw-messenger.ts`)

HTTP API wrapper, used when the bot runs in webhook mode (e.g., for cloud deployments without persistent sockets). Requires `OPENCLAW_API_KEY` and `OPENCLAW_PHONE_NUMBER_ID`.

---

## 📅 NeetCode Roadmap Coverage

### Week 1 — Arrays & Hashing + Stack
| Day | Topic | Category |
|-----|-------|----------|
| 1 | Arrays: Fundamentals | Arrays & Hashing |
| 2 | Hash Maps & Sets | Arrays & Hashing |
| 3 | Sliding Window | Arrays & Hashing |
| 4 | Two Pointers | Arrays & Hashing |
| 5 | Stack & Monotonic Stack | Stack |

### Week 2 — Binary Search, Linked Lists, Trees, Heap
| Day | Topic | Category |
|-----|-------|----------|
| 1 | Binary Search | Binary Search |
| 2 | Linked Lists | Linked List |
| 3 | Binary Trees & Traversals | Trees |
| 4 | Binary Search Trees | Trees |
| 5 | Heap / Priority Queue | Heap |

### Week 3 — Graphs & Dynamic Programming
| Day | Topic | Category |
|-----|-------|----------|
| 1 | Graphs: BFS & DFS | Graphs |
| 2 | Dynamic Programming: 1D | Dynamic Programming |
| 3 | Dynamic Programming: 2D | Dynamic Programming |
| 4 | Backtracking | Backtracking |
| 5 | Tries (Prefix Trees) | Tries |

---

## 🔄 Spaced Repetition (SM-2 Algorithm)

```
After each review, user rates recall quality (0-5):
  RECALL = 5 (Perfect recall)
  FUZZY  = 3 (Partially recalled)
  BLANK  = 0 (Complete blackout)

Next interval = previous_interval × ease_factor
ease_factor   = max(1.3, EF + 0.1 - (5-q)(0.08 + (5-q)×0.02))
```

**Initial intervals:** Day 1 → Day 6 → then exponentially increasing

---

## 💬 User Commands

| Command | Action |
|---------|--------|
| `TOPIC` | Get today's topic |
| `PROBLEM` | Get practice problem |
| `SOLUTION` | Reveal solution |
| `EASY / MEDIUM / HARD` | Rate after solving |
| `REVIEW` | Get due spaced-repetition topic |
| `RECALL / FUZZY / BLANK` | Rate recall quality |
| `TEST` | Start weekly assessment |
| `PROGRESS` | View your stats |
| `HELP` | Show all commands |

---

## 📡 Admin API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/admin/register` | Register a user manually |
| `POST` | `/admin/send-daily` | Trigger daily topic delivery to all users |

---

## 🔑 Key Design Decisions

1. **`IMessenger` interface** decouples all business logic from delivery — swap Baileys for any channel by implementing one interface
2. **Dependency injection** — `LearningService` and `scheduler` receive a messenger instance; no singletons or hidden coupling
3. **Transport isolation** — `socket.ts` contains zero business logic; communicates upward via `onMessage`/`onReady` callbacks only
4. **SM-2 spaced repetition** schedules review intervals of 1 → 6 → growing based on ease factor
5. **Deterministic curriculum** — `CurriculumEngine` drives all topic ordering; AI is only used for content formatting
6. **Transaction-safe DB writes** via better-sqlite3 synchronous API

---

## 🚀 Extending the System

- **Add a new channel** (Discord, Telegram): implement `IMessenger` in `src/channels/`, pass it to `startScheduler()` and `startExpressServer()`
- **Add more topics**: extend `NEETCODE_ROADMAP` in `src/data/neetcode-roadmap.ts`
- **Add problems**: add entries to `NEETCODE_PROBLEMS` or use `LeetCodeService.fetchProblemsForCategory()`
- **Support multiple roadmaps**: add `roadmap_id` to topics; the DB schema is already multi-roadmap capable
