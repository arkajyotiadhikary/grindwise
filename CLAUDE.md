# Project: DSA Mentor (Curriculum-Driven Spaced Repetition Tutor)

## Project Overview (North Star)

This project is an automated DSA learning system that teaches Data Structures &
Algorithms from beginner to advanced using a structured roadmap, spaced
repetition, and daily problem practice delivered via messaging channels
(WhatsApp/Discord/Telegram). The system prioritizes curriculum sequencing,
memory retention, and revision over random content delivery.

---

## Core Architecture

- Pattern: Modular Clean Architecture (Core Brain -\> Services -\>
  Infrastructure -\> Delivery)
- Design Style: Curriculum-driven + Event-driven scheduling
- Learning Model: Spaced Repetition + Active Recall + Roadmap Sequencing
- Content Flow: Scheduler → Curriculum Engine → Content Generator (AI) →
  Delivery Channels → Progress Memory Update

The system MUST NOT send random topics or problems. All content must follow the
roadmap order and user progress state.

---

## Tech Stack

- Language: TypeScript (Node.js)
- Database: SQLite (primary memory store)
- AI Engine: Ollama (local LLM for theory + explanations)
- Scheduler: node-cron (or equivalent)
- Problem Source: LeetCode API / MCP Server (leetcode-mcp-server)
- Messaging Channels:
  - WhatsApp (Primary)
  - Discord (Secondary)
  - Telegram (Optional)

---

## Design Principles (STRICT)

1.  Never use random topic generation.
2.  Always follow the DSA roadmap progression (NeetCode-style).
3.  Favor deterministic logic over AI decision-making.
4.  AI is ONLY used for:
    - Theory simplification
    - Solution explanation
    - Revision summaries
5.  Business logic must NOT depend directly on delivery channels.
6.  Favor composition over inheritance.
7.  Maintain separation of concerns between:
    - Curriculum logic
    - Scheduling
    - Content generation
    - Delivery
8.  All learning must support spaced repetition intervals.
9.  System must be stateful (progress-aware), not stateless.
10. Small, bite-sized content only (micro-learning format).

---

## Learning System Rules

- Daily:
  - Morning: New concept OR scheduled revision
  - Evening: 1--2 problems from the SAME topic
- Weekly:
  - Weekend: Test based on learned topics
- Revision Algorithm:
  - Day 1 → Learn Topic
  - Day 2 → Revision
  - Day 4 → Reinforcement
  - Day 7 → Test
  - Day 30 → Long-term revision

---

## Curriculum Source

Primary roadmap: NeetCode DSA Roadmap Example progression: 1. Arrays 2. Two
Pointers 3. Sliding Window 4. Stack 5. Binary Search 6. Linked List 7. Trees 8.
Graphs 9. Dynamic Programming 10. Advanced Topics

Problems MUST match the current topic tag.

---

## Core Modules (High-Level)

### 1. Curriculum Engine (Brain)

Responsible for: - Topic sequencing - Difficulty progression - Roadmap tracking

### 2. Scheduler Engine

Responsible for: - Daily topic dispatch - Revision scheduling - Weekend test
triggering

### 3. Content Generator Service

Uses Ollama to: - Generate theory notes - Create simplified explanations -
Produce solution walkthroughs

### 4. Progress & Memory Service

Handles: - User progress tracking - Revision intervals - Weak topic detection -
Test history

### 5. Problem Fetcher Service

Responsible for: - Fetching LeetCode problems by topic - Filtering by
difficulty - Avoiding random selection

### 6. Delivery Layer (Channel Adapters)

Abstract messaging layer: - WhatsApp Adapter - Discord Adapter - Telegram
Adapter

Core logic must NOT directly depend on channel APIs.

---

## Database Design (SQLite)

Primary Tables: - topics (roadmap structure) - progress (learning state +
revision intervals) - problems (tagged by topic) - tests (weekly performance
tracking) - schedules (next dispatch times)

Database is the long-term memory of the tutor system.

---

## Key Directories

/src /core curriculum-engine scheduler-engine spaced-repetition /services
content-generator problem-fetcher progress-service /infrastructure database
(sqlite) ollama-client leetcode-mcp-client /channels whatsapp discord telegram
/jobs daily-job.ts revision-job.ts weekly-test-job.ts /config /docs roadmap.md
database-schema.sql

---

## AI Usage Constraints

- Do NOT let AI decide curriculum order.
- Do NOT generate random study plans.
- AI must receive:
  - Topic name
  - Difficulty level
  - Context of previous learning
- AI outputs must be concise (micro-learning format).

---

## Scheduling Logic Constraints

- No random cron jobs.
- All schedules must reference user progress state.
- Revision jobs have higher priority than new topics.

---

## Performance & Scalability Considerations

- SQLite for MVP (single-user optimized)
- Future upgrade path: PostgreSQL for multi-user scaling
- Cache frequently used topics in memory
- Avoid excessive AI calls (cost + latency optimization)

---

## Documentation Sitemap

- High-Level Design: @docs/architecture.md
- Database Schema: @docs/database-schema.sql
- Roadmap Definition: @docs/roadmap.md
- API Design: @docs/api-spec.md

Claude must read these files during planning for any major feature
implementation.

---

## Verification Rules (Before Any Code Suggestion)

- Ensure roadmap sequencing is preserved
- Ensure database state is updated after every learning event
- Ensure channel abstraction is maintained
- Ensure no random content generation is introduced
- Ensure TypeScript strict typing is followed

---

## Coding Standards

### Async Style

- Use `async/await` exclusively. Raw `.then()/.catch()` chains are forbidden.

### Typing

- No `any` type unless explicitly justified with a comment (exception: untyped
  third-party modules).
- Enable strict mode: `strict: true`, `noImplicitAny: true`,
  `strictNullChecks: true`, `strictFunctionTypes: true`,
  `strictPropertyInitialization: true`, `noImplicitReturns: true`,
  `noUncheckedIndexedAccess: true`.
- Target: ES2020, module: commonjs, moduleResolution: node.

### Naming

- Variables: descriptive
- Functions: verbNoun format (e.g., `fetchTopics`, `buildReply`)
- Classes: PascalCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case

### Exports

- Services use named exports only. Default exports allowed only in entry points
  (`index.ts`, `main.ts`).

### Types vs Interfaces

- Prefer `interface` for object shapes; `type` for unions/aliases.
- Generic type parameters must have constraints where applicable.
- Prefer `const enum`.

### Null Handling

- Never assume a value is non-null. Always check explicitly before accessing.

### Return Types

- All exported functions must have explicit return types.

### Architecture

- Each module has a single responsibility. No coupling of unrelated concerns in
  one file.

### Import Order

1. Node builtins
2. External packages
3. Internal modules
4. Relative imports

### Comments

- Add comments for complex logic only. Commented-out code is prohibited.

### Error Handling

- Every async function body must be wrapped in `try/catch`.
- Empty catch blocks are forbidden — every caught error must be logged or
  re-thrown.
- Error logs must include: error message, function/module name, relevant
  sanitized input context.
  - Format: `logger.error('[ModuleName] description', { error, context })`
- Either handle the error at the catch site or re-throw with additional context.
- Define domain-specific Error classes (e.g., `AuthError`, `ConnectionError`)
  for predictable categorization.
- Register a process-level `unhandledRejection` handler. All promise rejections
  must be handled.

---

## WhatsApp (Baileys) Integration Rules

### Package

- Use `@whiskeysockets/baileys` with named imports only.

### Architecture — 4 Layers (top → bottom, dependency flows downward only)

1. **Transport** — socket lifecycle, connection events, raw message I/O
   (`src/bot/socket.ts`)
2. **Handlers** — business logic triggered by events (`src/bot/handlers.ts`)
3. **Services** — domain operations (`src/services/`)
4. **Config** — environment variables (`src/config/index.ts`)

Transport must not call service/handler logic directly; use event emitters or
callbacks.

### Initialization

- All socket setup must occur inside `async function startBot(): Promise<void>`.
- `startBot()` is the only caller of `makeWASocket()` and must be invoked from
  the main entry point only.
- No module-level mutable variables holding socket or auth state.

### Auth Persistence

- Always use `useMultiFileAuthState`. Storage path must be configurable via
  environment variable.
- Register `sock.ev.on('creds.update', saveCreds)` immediately after socket
  init. Missing this causes session loss on restart.
- On startup, verify auth state exists; log a clear message if no prior session
  found (first-time QR scan).
- Print QR code to terminal using `qrcode-terminal` on first run.

### Reconnection

- Reconnect automatically on non-401 disconnect codes.
- Never reconnect on `DisconnectReason.loggedOut` (401).
- Use exponential backoff: initial 3s, multiplier 2×, max 60s, max 10 retries.

### Required Event Subscriptions

- `connection.update` — monitor socket state (open, close, QR)
- `messages.upsert` — receive incoming messages
- `creds.update` — persist updated credentials

### Message Validation (on `messages.upsert`)

```ts
const msg = messages[0];
if (!msg || !msg.message || msg.key.fromMe) return;
const remoteJid = msg.key.remoteJid;
if (!remoteJid) return;
```

### Event Handler Isolation

- Each subscription must delegate to a named handler function. Inline arrow
  functions must not exceed 3 lines.

### Outbound Messaging

- Always use `sock.sendMessage()`. Never call it with business logic inline.
  - Wrong:
    `await sock.sendMessage(jid, { text: await generateAIResponse(msg) })`
  - Correct:
    `const response = await messageService.buildReply(msg); await messenger.send(jid, response);`
- Validate `remoteJid` is a non-empty string ending with `@s.whatsapp.net` or
  group suffix before sending.
- Sanitize outgoing text: strip control characters, trim whitespace, enforce
  4096-char max.
- Supported message types: text, image (with caption), document. No
  bulk/broadcast/template.

### Safety (Critical)

- **Prohibited**: bulk messaging, auto-DM to unknown contacts, contact scraping,
  spam automation, fake presence/typing indicators.
- Rate limit: ~1 message/second per recipient in automated flows.
- Tight reconnect loops (no delay) are forbidden — risk account bans.
- Do not log full message content at INFO or higher in production (treat as PII;
  debug level only).
- Add `auth_state/` to `.gitignore`.
- Any automated message must be in response to an explicit user-initiated action
  or opt-in subscription.
