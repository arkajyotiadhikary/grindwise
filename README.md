# 📚 DSA Learning System — WhatsApp Bot

A personalized Data Structures & Algorithms learning system delivered via **WhatsApp** using **OpenClaw**, with **SQLite** for persistence and **TypeScript** as the backend.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       DSA Learning System                        │
├─────────────────┬───────────────────────────────────────────────┤
│   Scheduler     │  Cron jobs for daily topics, weekly tests,     │
│  (node-cron)    │  and spaced repetition reminders               │
├─────────────────┼───────────────────────────────────────────────┤
│  Webhook Server │  Express.js server receiving WhatsApp messages  │
│   (Express)     │  from OpenClaw and routing user commands        │
├─────────────────┼───────────────────────────────────────────────┤
│ Learning Service│  Core business logic: topic delivery, progress  │
│                 │  tracking, test generation, review scheduling   │
├─────────────────┼───────────────────────────────────────────────┤
│ OpenClaw Client │  WhatsApp message delivery (text, buttons,      │
│                 │  interactive lists for MCQ tests)               │
├─────────────────┼───────────────────────────────────────────────┤
│ LeetCode API    │  Fetches real problems aligned with each topic  │
│   (GraphQL)     │                                                 │
├─────────────────┼───────────────────────────────────────────────┤
│  SQLite (DB)    │  Users, progress, spaced repetition schedule,   │
│                 │  problems, tests, message logs                  │
└─────────────────┴───────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
dsa-learning-system/
├── src/
│   ├── index.ts                  # App entry point & bootstrap
│   ├── data/
│   │   └── neetcode-roadmap.ts   # Full NeetCode DSA topic definitions
│   ├── db/
│   │   ├── init.ts               # Database schema creation
│   │   ├── seeder.ts             # Seed roadmap & test questions
│   │   └── repository.ts         # All database operations (CRUD)
│   └── services/
│       ├── openclaw.ts           # OpenClaw API + message formatting
│       ├── leetcode.ts           # LeetCode GraphQL API integration
│       ├── learning.ts           # Core learning orchestration
│       ├── scheduler.ts          # Cron jobs for automated delivery
│       └── webhook.ts            # Incoming message handler & command router
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 🗄️ Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Phone, name, current day/week, streak |
| `topics` | Full NeetCode roadmap with content & code |
| `problems` | LeetCode problems linked to each topic |
| `user_progress` | Per-user topic status & rating |
| `spaced_repetition` | SM-2 algorithm state per user/topic |
| `weekly_tests` | Test instances with questions & scores |
| `test_questions` | Question bank per topic |
| `message_logs` | Full audit trail of all messages |
| `scheduled_jobs` | Job queue for future messages |

---

## ⚙️ Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials:
# - OPENCLAW_API_KEY
# - OPENCLAW_PHONE_NUMBER_ID
# - OPENCLAW_VERIFY_TOKEN
```

### 3. Start the System
```bash
# Development
npm run dev

# Production
npm run build && npm start
```

### 4. Register Your OpenClaw Webhook
Point your OpenClaw dashboard webhook to:
```
https://your-server.com/api/webhook
```

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

The system implements the **SuperMemo SM-2** algorithm:

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

## 📡 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/webhook` | OpenClaw webhook verification |
| `POST` | `/api/webhook` | Incoming WhatsApp messages |
| `POST` | `/admin/register` | Register a user manually |
| `POST` | `/admin/send-daily` | Trigger daily delivery manually |

---

## 🔑 Key Design Decisions

1. **Respond 200 immediately** to webhook before processing — prevents OpenClaw timeouts
2. **SM-2 spaced repetition** schedules intervals of 1 → 6 → growing based on ease factor
3. **Interactive WhatsApp messages** (lists/buttons) used for tests to enable one-tap answers
4. **LeetCode GraphQL API** fetches real problems dynamically per topic
5. **Transaction-safe DB writes** via better-sqlite3 synchronous API
6. **Modular architecture**: OpenClaw, LeetCode, Learning, and Scheduler are independent services

---

## 🚀 Extending the System

- **Add more topics**: Extend `NEETCODE_ROADMAP` in `src/data/neetcode-roadmap.ts`
- **Add problems**: Add entries to `NEETCODE_PROBLEMS` or let `LeetCodeService.fetchProblemsForCategory()` auto-populate
- **Add languages**: Translate `MessageFormatter` in `src/services/openclaw.ts`
- **Support multiple roadmaps**: Add `roadmap_id` entries; the system is already multi-roadmap capable
