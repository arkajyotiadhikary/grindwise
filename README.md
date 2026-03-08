# DSA Learning System — WhatsApp Bot

A personalized Data Structures & Algorithms learning system delivered via **WhatsApp** using **Baileys** (direct socket connection, no third-party API), with **SQLite** for persistence, **Ollama** for AI-generated content, and **TypeScript** as the backend.

---

## Architecture Overview

The project follows **Domain-Driven Design (DDD)** with **Hexagonal Architecture** (Ports & Adapters). All dependencies point inward — delivery and infrastructure depend on the domain, never the reverse.

```
WhatsApp ──► Baileys socket ──► socket.ts (Transport)
                                    │ messages.upsert
                               handlers.ts (Thin command router)
                                    │
                               DIContainer (resolves use cases)
                                    │
                              Use Cases (application layer)
                                    │ depends on ports
                         ┌──────────┼──────────┐
                   IMessenger  IRepositoryPort  IContentGeneratorPort
                         │          │                  │
                  BaileysMessenger  SqliteRepo   OllamaAdapter
                         │
                    WhatsApp (delivered)

Scheduled:
  node-cron ──► scheduler.ts ──► DIContainer ──► Use Cases ──► same path
```

### Layers

| Layer | Files | Responsibility |
|-------|-------|----------------|
| **Domain** | `domain/entities/`, `domain/value-objects/`, `domain/services/`, `domain/ports/` | Entities, value objects, domain service, port interfaces |
| **Application** | `application/use-cases/` | One use case class per user action — orchestrates domain logic via ports |
| **Adapters** | `adapters/persistence/sqlite/`, `adapters/content-generator/`, `adapters/problem-provider/`, `channels/` | Implement domain ports (driven side) |
| **Delivery** | `bot/socket.ts`, `bot/handlers.ts`, `services/scheduler.ts`, `index.ts` | Driving side — WhatsApp transport, HTTP admin API, cron scheduler |
| **Infrastructure** | `infrastructure/` | Low-level I/O clients (Ollama, OpenClaw) — no domain knowledge |
| **Composition** | `main.ts`, `di-container.ts` | Entry point and dependency wiring |

---

## Project Structure

```
src/
├── main.ts                          # Entry point & composition root
├── di-container.ts                  # Wires adapters into use cases
├── index.ts                         # Express server (admin endpoints)
│
├── domain/                          # Innermost layer (zero external deps)
│   ├── entities/                    # User, Topic, Problem, Progress
│   ├── value-objects/               # SpacedRepetitionVO, RoadmapPositionVO
│   ├── services/                    # CurriculumDomainService
│   └── ports/                       # IRepositoryPort, IMessenger,
│                                    # IContentGeneratorPort, IProblemProviderPort
│
├── application/                     # Orchestration layer
│   └── use-cases/                   # RegisterUser, SendDailyTopic, SendDailyProblem,
│                                    # SendSolution, HandleDifficultyRating,
│                                    # HandleReviewRating, SendDueReviews,
│                                    # SendWeeklyTest, SubmitTestAnswer,
│                                    # SendProgressReport, SendHelp
│
├── adapters/                        # Driven-side port implementations
│   ├── persistence/sqlite/          # SqliteRepositoryAdapter, database, seeder
│   ├── content-generator/           # OllamaContentGeneratorAdapter
│   └── problem-provider/            # LeetCodeProblemProviderAdapter
│
├── channels/                        # Messenger adapters (IMessenger impls)
│   ├── baileys-messenger.ts         # IMessenger via Baileys (primary)
│   └── openclaw-messenger.ts        # IMessenger via OpenClaw HTTP API (fallback)
│
├── infrastructure/                  # Low-level I/O clients
│   ├── ollama-client.ts             # Local LLM client
│   └── openclaw-client.ts           # OpenClaw WhatsApp API client
│
├── bot/                             # WhatsApp delivery (driving side)
│   ├── socket.ts                    # Baileys socket lifecycle, QR, reconnect
│   └── handlers.ts                  # Thin message router → use cases via DI
│
├── services/
│   └── scheduler.ts                 # Cron delivery (daily topics, weekly tests, SR)
│
├── config/
│   └── index.ts                     # Centralized env var reads
├── shared/
│   └── message-formatter.ts         # Presentation utility
├── data/
│   └── neetcode-roadmap.ts          # Full NeetCode topic + problem definitions
└── debug.ts                         # Manual test runner
```

---

## Ports & Adapters

| Port | Purpose | Adapter(s) |
|------|---------|------------|
| `IRepositoryPort` | Persistence (users, topics, progress, problems) | `SqliteRepositoryAdapter` |
| `IMessenger` | Outbound messaging (text, buttons, lists) | `BaileysMessenger`, `OpenClawMessenger` |
| `IContentGeneratorPort` | AI-generated theory, solutions, revision summaries | `OllamaContentGeneratorAdapter` |
| `IProblemProviderPort` | Fetch & sync LeetCode problems by topic | `LeetCodeProblemProviderAdapter` |

---

## Setup

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
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `llama3` | Ollama model for content generation |

### 3. Start the Bot

```bash
# Development
npm run dev

# Production
npm run build && node dist/main.js
```

On first run, a QR code is printed to the terminal. Scan it with WhatsApp. The session is saved to `auth_state/` and reused on restart.

---

## Delivery Channels

### Baileys (primary — `src/channels/baileys-messenger.ts`)

Direct WebSocket connection to WhatsApp. No API keys required.

- Rate limited to 1 message/sec per recipient
- `sendButtons` / `sendList` fall back to numbered text menus (Baileys limitation on regular accounts)
- Session persisted via `useMultiFileAuthState` in `auth_state/`
- Exponential backoff reconnect: 3s -> 6s -> ... -> 60s max, 10 retries

### OpenClaw (fallback — `src/channels/openclaw-messenger.ts`)

HTTP API wrapper, used when the bot runs in webhook mode (e.g., for cloud deployments without persistent sockets). Requires `OPENCLAW_API_KEY` and `OPENCLAW_PHONE_NUMBER_ID`.

---

## NeetCode Roadmap Coverage

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

## Spaced Repetition (SM-2 Algorithm)

```
After each review, user rates recall quality (0-5):
  RECALL = 5 (Perfect recall)
  FUZZY  = 3 (Partially recalled)
  BLANK  = 0 (Complete blackout)

Next interval = previous_interval * ease_factor
ease_factor   = max(1.3, EF + 0.1 - (5-q)(0.08 + (5-q)*0.02))
```

**Initial intervals:** Day 1 -> Day 6 -> then exponentially increasing

---

## User Commands

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

## Admin API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/admin/register` | Register a user manually |
| `POST` | `/admin/send-daily` | Trigger daily topic delivery to all users |

---

## Key Design Decisions

1. **Hexagonal Architecture** — domain ports define abstractions; adapters implement them. Swapping SQLite for PostgreSQL or Baileys for Discord requires only a new adapter.
2. **DI Container** — `DIContainer` wires all adapters into use cases. `main.ts` is the single composition root. No singletons or hidden coupling.
3. **Use case per action** — each user command maps to a dedicated use case class with explicit port dependencies injected via constructor.
4. **Transport isolation** — `socket.ts` contains zero business logic; communicates upward via `onMessage`/`onReady` callbacks only.
5. **Deterministic curriculum** — `CurriculumDomainService` drives all topic ordering; AI is only used for content generation (theory, solutions, revision summaries).
6. **SM-2 spaced repetition** — `SpacedRepetitionVO` (pure value object) schedules review intervals of 1 -> 6 -> growing based on ease factor.
7. **Transaction-safe DB writes** via better-sqlite3 synchronous API.

---

## Extending the System

- **Add a new channel** (Discord, Telegram): implement `IMessenger` in `src/channels/`, register it in `DIContainer`
- **Add more topics**: extend `NEETCODE_ROADMAP` in `src/data/neetcode-roadmap.ts`
- **Add problems**: add entries to `NEETCODE_PROBLEMS` or use `LeetCodeProblemProviderAdapter.fetchProblemsForCategory()`
- **Support multiple roadmaps**: add `roadmap_id` to topics; the DB schema is already multi-roadmap capable
- **Swap persistence**: implement `IRepositoryPort` with a PostgreSQL adapter, swap it in `DIContainer`
