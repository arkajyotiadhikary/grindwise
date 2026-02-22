# Project: DSA Mentor (Curriculum-Driven Spaced Repetition Tutor)

## Project Overview (North Star)

This project is an automated DSA learning system that teaches Data
Structures & Algorithms from beginner to advanced using a structured
roadmap, spaced repetition, and daily problem practice delivered via
messaging channels (WhatsApp/Discord/Telegram). The system prioritizes
curriculum sequencing, memory retention, and revision over random
content delivery.

------------------------------------------------------------------------

## Core Architecture

-   Pattern: Modular Clean Architecture (Core Brain -\> Services -\>
    Infrastructure -\> Delivery)
-   Design Style: Curriculum-driven + Event-driven scheduling
-   Learning Model: Spaced Repetition + Active Recall + Roadmap
    Sequencing
-   Content Flow: Scheduler → Curriculum Engine → Content Generator (AI)
    → Delivery Channels → Progress Memory Update

The system MUST NOT send random topics or problems. All content must
follow the roadmap order and user progress state.

------------------------------------------------------------------------

## Tech Stack

-   Language: TypeScript (Node.js)
-   Database: SQLite (primary memory store)
-   AI Engine: Ollama (local LLM for theory + explanations)
-   Automation/Agent Layer: OpenClaw (optional orchestration)
-   Scheduler: node-cron (or equivalent)
-   Problem Source: LeetCode API / MCP Server (leetcode-mcp-server)
-   Messaging Channels:
    -   WhatsApp (Primary)
    -   Discord (Secondary)
    -   Telegram (Optional)

------------------------------------------------------------------------

## Design Principles (STRICT)

1.  Never use random topic generation.
2.  Always follow the DSA roadmap progression (NeetCode-style).
3.  Favor deterministic logic over AI decision-making.
4.  AI is ONLY used for:
    -   Theory simplification
    -   Solution explanation
    -   Revision summaries
5.  Business logic must NOT depend directly on delivery channels.
6.  Favor composition over inheritance.
7.  Maintain separation of concerns between:
    -   Curriculum logic
    -   Scheduling
    -   Content generation
    -   Delivery
8.  All learning must support spaced repetition intervals.
9.  System must be stateful (progress-aware), not stateless.
10. Small, bite-sized content only (micro-learning format).

------------------------------------------------------------------------

## Learning System Rules

-   Daily:
    -   Morning: New concept OR scheduled revision
    -   Evening: 1--2 problems from the SAME topic
-   Weekly:
    -   Weekend: Test based on learned topics
-   Revision Algorithm:
    -   Day 1 → Learn Topic
    -   Day 2 → Revision
    -   Day 4 → Reinforcement
    -   Day 7 → Test
    -   Day 30 → Long-term revision

------------------------------------------------------------------------

## Curriculum Source

Primary roadmap: NeetCode DSA Roadmap Example progression: 1. Arrays 2.
Two Pointers 3. Sliding Window 4. Stack 5. Binary Search 6. Linked List
7. Trees 8. Graphs 9. Dynamic Programming 10. Advanced Topics

Problems MUST match the current topic tag.

------------------------------------------------------------------------

## Core Modules (High-Level)

### 1. Curriculum Engine (Brain)

Responsible for: - Topic sequencing - Difficulty progression - Roadmap
tracking

### 2. Scheduler Engine

Responsible for: - Daily topic dispatch - Revision scheduling - Weekend
test triggering

### 3. Content Generator Service

Uses Ollama to: - Generate theory notes - Create simplified
explanations - Produce solution walkthroughs

### 4. Progress & Memory Service

Handles: - User progress tracking - Revision intervals - Weak topic
detection - Test history

### 5. Problem Fetcher Service

Responsible for: - Fetching LeetCode problems by topic - Filtering by
difficulty - Avoiding random selection

### 6. Delivery Layer (Channel Adapters)

Abstract messaging layer: - WhatsApp Adapter - Discord Adapter -
Telegram Adapter

Core logic must NOT directly depend on channel APIs.

------------------------------------------------------------------------

## Database Design (SQLite)

Primary Tables: - topics (roadmap structure) - progress (learning
state + revision intervals) - problems (tagged by topic) - tests (weekly
performance tracking) - schedules (next dispatch times)

Database is the long-term memory of the tutor system.

------------------------------------------------------------------------

## Key Directories

/src /core curriculum-engine scheduler-engine spaced-repetition
/services content-generator problem-fetcher progress-service
/infrastructure database (sqlite) ollama-client leetcode-mcp-client
/channels whatsapp discord telegram /jobs daily-job.ts revision-job.ts
weekly-test-job.ts /config /docs roadmap.md database-schema.sql

------------------------------------------------------------------------

## AI Usage Constraints

-   Do NOT let AI decide curriculum order.
-   Do NOT generate random study plans.
-   AI must receive:
    -   Topic name
    -   Difficulty level
    -   Context of previous learning
-   AI outputs must be concise (micro-learning format).

------------------------------------------------------------------------

## Scheduling Logic Constraints

-   No random cron jobs.
-   All schedules must reference user progress state.
-   Revision jobs have higher priority than new topics.

------------------------------------------------------------------------

## OpenClaw Integration Notes

-   Use OpenClaw for automation orchestration ONLY.
-   Core learning logic must remain inside the TypeScript backend.
-   OpenClaw should call internal APIs instead of containing business
    logic.

------------------------------------------------------------------------

## Performance & Scalability Considerations

-   SQLite for MVP (single-user optimized)
-   Future upgrade path: PostgreSQL for multi-user scaling
-   Cache frequently used topics in memory
-   Avoid excessive AI calls (cost + latency optimization)

------------------------------------------------------------------------

## Documentation Sitemap

-   High-Level Design: @docs/architecture.md
-   Database Schema: @docs/database-schema.sql
-   Roadmap Definition: @docs/roadmap.md
-   API Design: @docs/api-spec.md

Claude must read these files during planning for any major feature
implementation.

------------------------------------------------------------------------

## Verification Rules (Before Any Code Suggestion)

-   Ensure roadmap sequencing is preserved
-   Ensure database state is updated after every learning event
-   Ensure channel abstraction is maintained
-   Ensure no random content generation is introduced
-   Ensure TypeScript strict typing is followed
