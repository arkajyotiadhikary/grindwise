# Architecture — DSA Mentor

## Pattern

**Domain-Driven Design (DDD)** with **Hexagonal Architecture** (Ports & Adapters).

All dependencies point inward: delivery and infrastructure depend on the domain — never the reverse.

```
┌──────────────────────────────────────────────────────────────────┐
│                      Delivery / Driving Side                     │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │ WhatsApp │  │ Express HTTP │  │ Cron Scheduler             │ │
│  │ Bot      │  │ Admin API    │  │ (daily topic, weekly test,  │ │
│  │          │  │              │  │  spaced repetition)         │ │
│  └────┬─────┘  └──────┬───────┘  └────────────┬───────────────┘ │
│       │               │                       │                  │
│       └───────────────┼───────────────────────┘                  │
│                       ▼                                          │
│              ┌─────────────────┐                                 │
│              │  DI Container   │  ← composition root             │
│              └────────┬────────┘                                 │
│                       ▼                                          │
├──────────────────────────────────────────────────────────────────┤
│                    Application Layer                              │
│                                                                  │
│  Use Cases (one class per action):                               │
│    RegisterUser, SendDailyTopic, SendDailyProblem,               │
│    SendSolution, HandleDifficultyRating, HandleReviewRating,     │
│    SendDueReviews, SendWeeklyTest, SubmitTestAnswer,             │
│    SendProgressReport, SendHelp                                  │
│                                                                  │
│  Each use case receives ports via constructor injection.          │
├──────────────────────────────────────────────────────────────────┤
│                      Domain Layer                                │
│                                                                  │
│  Entities:       User, Topic, Problem, Progress                  │
│  Value Objects:  SpacedRepetitionVO, RoadmapPositionVO           │
│  Domain Service: CurriculumDomainService                         │
│  Ports:          IRepositoryPort, IMessenger,                    │
│                  IContentGeneratorPort, IProblemProviderPort      │
├──────────────────────────────────────────────────────────────────┤
│                   Infrastructure / Driven Side                   │
│                                                                  │
│  Adapters (implement ports):                                     │
│    SqliteRepositoryAdapter      → IRepositoryPort                │
│    BaileysMessenger             → IMessenger                     │
│    OpenClawMessenger            → IMessenger                     │
│    OllamaContentGeneratorAdapter → IContentGeneratorPort         │
│    LeetCodeProblemProviderAdapter → IProblemProviderPort          │
│                                                                  │
│  Infrastructure clients (low-level I/O, used by adapters):       │
│    OllamaClient, OpenClawClient, SQLite Database                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## Directory Map

```
src/
├── main.ts                          ← entry point & composition root
├── di-container.ts                  ← wires adapters into use cases
├── index.ts                         ← Express HTTP delivery
│
├── domain/                          ← innermost layer (zero external deps)
│   ├── entities/                    User, Topic, Problem, Progress
│   ├── value-objects/               SpacedRepetitionVO, RoadmapPositionVO
│   ├── services/                    CurriculumDomainService
│   └── ports/                       IRepositoryPort, IMessenger,
│                                    IContentGeneratorPort, IProblemProviderPort
│
├── application/                     ← orchestration layer
│   └── use-cases/                   One class per user action
│
├── adapters/                        ← driven-side implementations
│   ├── persistence/sqlite/          SqliteRepositoryAdapter, database, seeder
│   ├── content-generator/           OllamaContentGeneratorAdapter
│   └── problem-provider/            LeetCodeProblemProviderAdapter
│
├── channels/                        ← messenger adapters (IMessenger impls)
│   ├── baileys-messenger.ts
│   └── openclaw-messenger.ts
│
├── infrastructure/                  ← low-level clients (no domain knowledge)
│   ├── ollama-client.ts
│   └── openclaw-client.ts
│
├── bot/                             ← WhatsApp delivery (driving side)
│   ├── socket.ts                    Baileys socket lifecycle
│   └── handlers.ts                  Thin message router → use cases
│
├── services/
│   └── scheduler.ts                 Cron delivery (driving side)
│
├── config/                          Environment variables
├── shared/                          MessageFormatter (presentation utility)
└── data/                            Static roadmap & problem definitions
```

---

## Dependency Rules

1. **Domain** depends on nothing. Ports are interfaces defined here.
2. **Application** depends on Domain only (ports + entities).
3. **Adapters** implement Domain ports. They may use infrastructure clients.
4. **Delivery** (bot, HTTP, scheduler) depends on the DI container to get use cases. No business logic in delivery.
5. **Infrastructure** clients are low-level I/O wrappers. They have no knowledge of domain concepts.

---

## Composition Root

`src/main.ts` is the single place where concrete classes are instantiated:

1. Initializes SQLite database and seeds roadmap
2. Starts the WhatsApp bot
3. On connection, creates `BaileysMessenger` + `DIContainer`
4. Passes `DIContainer` to handlers, scheduler, and Express server

`DIContainer` (src/di-container.ts) instantiates all adapters and exposes a getter per use case. No business logic lives in the container.

---

## Ports

| Port | Purpose | Adapter(s) |
|------|---------|------------|
| `IRepositoryPort` | Persistence (users, topics, progress, problems) | `SqliteRepositoryAdapter` |
| `IMessenger` | Outbound messaging (text, buttons, lists) | `BaileysMessenger`, `OpenClawMessenger` |
| `IContentGeneratorPort` | AI-generated theory, solutions, revision summaries | `OllamaContentGeneratorAdapter` |
| `IProblemProviderPort` | Fetch & sync LeetCode problems | `LeetCodeProblemProviderAdapter` |

---

## Use Case Pattern

Every use case follows the same shape:

```typescript
export class SomeUseCase {
  constructor(
    private readonly repo: IRepositoryPort,
    private readonly messenger: IMessenger,
    // ...other ports as needed
  ) {}

  async execute(user: User, ...args): Promise<void> {
    // orchestrate domain logic, call ports
  }
}
```

- Single responsibility: one action per class
- Dependencies are abstractions (ports), never concrete adapters
- All async, all wrapped in try/catch

---

## Key Design Decisions

- **Anemic entities** — entities are interfaces (contracts), not rich classes. Domain logic lives in `CurriculumDomainService` and value objects.
- **No DI framework** — `DIContainer` is a hand-rolled composition root. Sufficient for a single-user MVP.
- **Scheduler as delivery** — cron jobs are treated as a driving adapter (like HTTP or WebSocket), not as domain logic.
- **AI is constrained** — `IContentGeneratorPort` is called by use cases with explicit topic/difficulty context. AI never decides curriculum order.
