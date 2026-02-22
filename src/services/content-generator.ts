import { OllamaClient, OllamaGenerateOptions } from '../infrastructure/ollama-client';
import { Topic, Problem } from '../db/repository';

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface TheoryContent {
  /** 1-2 sentence core explanation of what the topic is and why it matters. */
  coreConcept: string;
  /** 3-5 bullet-point takeaways to remember. */
  keyTakeaways: string[];
  /** Optional minimal TypeScript code snippet. */
  codeExample?: string;
  /** Optional real-world analogy in one sentence. */
  analogy?: string;
}

export interface SolutionWalkthrough {
  /** High-level algorithm choice in one sentence. */
  approach: string;
  /** Ordered steps explaining the solution. */
  steps: string[];
  /** The "aha moment" — why this approach works. */
  keyInsight: string;
  /** e.g. O(n) */
  timeComplexity: string;
  /** e.g. O(1) */
  spaceComplexity: string;
}

export interface RevisionSummary {
  /** 1-2 sentence memory trigger recap. */
  recap: string;
  /** Must-remember facts for recall. */
  keyPoints: string[];
  /** Common pitfalls to watch out for. */
  commonMistakes: string[];
  /** How this topic connects to related DSA concepts. */
  connectsTo: string;
}

// ─── Section Parsers ──────────────────────────────────────────────────────────

/**
 * Extract a single-value section from a structured LLM response.
 * e.g. "CORE_CONCEPT:\n<content>\n\nNEXT_SECTION:" → "<content>"
 */
function extractSection(text: string, header: string): string {
  const pattern = new RegExp(
    `${header}:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z_]+:|$)`,
    'i',
  );
  const match = pattern.exec(text);
  return match ? match[1].trim() : '';
}

/**
 * Extract a bullet-list section and return each item as a clean string.
 */
function extractBullets(text: string, header: string): string[] {
  const block = extractSection(text, header);
  return block
    .split('\n')
    .map(line => line.replace(/^[-*•]\s*/, '').trim())
    .filter(line => line.length > 0);
}

/**
 * Extract a numbered list section and return each item as a clean string.
 */
function extractNumberedList(text: string, header: string): string[] {
  const block = extractSection(text, header);
  return block
    .split('\n')
    .map(line => line.replace(/^\d+[.)]\s*/, '').trim())
    .filter(line => line.length > 0);
}

/**
 * Strip markdown code fences from a code block string.
 */
function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

// ─── ContentGeneratorService ──────────────────────────────────────────────────

/**
 * Generates AI-powered DSA learning content via Ollama.
 *
 * Responsibilities:
 *  - Theory: bite-sized concept explanations
 *  - Solution walkthrough: step-by-step problem reasoning
 *  - Revision summary: spaced-repetition memory triggers
 *
 * All methods return null on Ollama failure so callers can fall back
 * to static content without crashing the learning flow.
 */
export class ContentGeneratorService {
  private readonly ollama: OllamaClient;

  constructor(ollama?: OllamaClient) {
    this.ollama = ollama ?? new OllamaClient();
  }

  // ── Theory Generation ───────────────────────────────────────────────────────

  /**
   * Generate a bite-sized theory explanation for a roadmap topic.
   * AI receives: topic name, category, difficulty, key concepts.
   * AI does NOT decide what to teach — only how to explain the given topic.
   */
  async generateTheory(topic: Topic): Promise<TheoryContent | null> {
    const keyConcepts = this.parseJson<string[]>(topic.key_concepts, []);

    const prompt = `You are a concise DSA tutor. Explain "${topic.name}" to a developer learning DSA.

Category: ${topic.category}
Difficulty: ${topic.difficulty}
Key concepts to cover: ${keyConcepts.join(', ')}

Respond using EXACTLY this structure. No extra text before or after the sections:

CORE_CONCEPT:
[1-2 sentences: what ${topic.name} is and why it matters for DSA]

KEY_TAKEAWAYS:
- [takeaway 1]
- [takeaway 2]
- [takeaway 3]

CODE_EXAMPLE:
[Minimal TypeScript snippet showing the core pattern — max 8 lines, no imports]

ANALOGY:
[One real-world analogy in 1 sentence]

Rules:
- Extremely concise (micro-learning format)
- No preamble phrases like "Sure!" or "Great question!"
- Code must be minimal and directly relevant to ${topic.name}`;

    return this.safeGenerate(
      prompt,
      raw => this.parseTheory(raw),
      { temperature: 0.3, maxTokens: 450 },
      'generateTheory',
    );
  }

  private parseTheory(raw: string): TheoryContent {
    // CODE_EXAMPLE needs special handling to strip code fences
    const codeMatch = /CODE_EXAMPLE:\s*([\s\S]*?)(?=\nANALOGY:|$)/i.exec(raw);
    const codeBlock = codeMatch ? stripCodeFences(codeMatch[1].trim()) : undefined;

    return {
      coreConcept: extractSection(raw, 'CORE_CONCEPT'),
      keyTakeaways: extractBullets(raw, 'KEY_TAKEAWAYS'),
      codeExample: codeBlock && codeBlock.length > 0 ? codeBlock : undefined,
      analogy: extractSection(raw, 'ANALOGY') || undefined,
    };
  }

  // ── Solution Walkthrough ────────────────────────────────────────────────────

  /**
   * Generate a step-by-step solution walkthrough for a LeetCode problem.
   * AI receives: problem title, difficulty, topic, brief description.
   * AI does NOT choose which problem to explain — only how to explain it.
   */
  async generateSolutionWalkthrough(
    problem: Problem,
    topic: Topic,
  ): Promise<SolutionWalkthrough | null> {
    const descSnippet = problem.description?.slice(0, 400) ?? '';

    const prompt = `You are a concise DSA tutor explaining a LeetCode solution.

Problem: ${problem.title} (${problem.difficulty})
Topic: ${topic.name} (${topic.category})${descSnippet ? `\nProblem summary: ${descSnippet}` : ''}

Respond using EXACTLY this structure. No extra text before or after:

APPROACH:
[1 sentence: the high-level algorithm / strategy]

STEPS:
1. [step 1]
2. [step 2]
3. [step 3]
4. [step 4 if needed]

KEY_INSIGHT:
[1-2 sentences: the "aha moment" — why this approach is correct and efficient]

TIME_COMPLEXITY: [e.g. O(n)]
SPACE_COMPLEXITY: [e.g. O(1)]

Rules:
- Extremely concise
- Focus on reasoning, not code transcription
- Assume the reader understands basic ${topic.category}`;

    return this.safeGenerate(
      prompt,
      raw => this.parseSolutionWalkthrough(raw),
      { temperature: 0.2, maxTokens: 420 },
      'generateSolutionWalkthrough',
    );
  }

  private parseSolutionWalkthrough(raw: string): SolutionWalkthrough {
    return {
      approach: extractSection(raw, 'APPROACH'),
      steps: extractNumberedList(raw, 'STEPS'),
      keyInsight: extractSection(raw, 'KEY_INSIGHT'),
      timeComplexity: extractSection(raw, 'TIME_COMPLEXITY'),
      spaceComplexity: extractSection(raw, 'SPACE_COMPLEXITY'),
    };
  }

  // ── Revision Summary ────────────────────────────────────────────────────────

  /**
   * Generate a spaced-repetition revision card for a topic.
   * reviewCount is passed so the AI can calibrate recall vs. re-teach tone.
   * Higher reviewCount → shorter, more recall-focused output.
   */
  async generateRevisionSummary(
    topic: Topic,
    reviewCount: number,
  ): Promise<RevisionSummary | null> {
    const prompt = `You are a DSA tutor creating a spaced repetition review card.

Topic: ${topic.name} (${topic.category})
Difficulty: ${topic.difficulty}
Review session #${reviewCount} for this user

Respond using EXACTLY this structure. No extra text before or after:

RECAP:
[1-2 sentences: a memory trigger recap of ${topic.name} — not a re-teach, just a recall cue]

KEY_POINTS:
- [must-remember fact 1]
- [must-remember fact 2]
- [must-remember fact 3]

COMMON_MISTAKES:
- [mistake 1 to avoid]
- [mistake 2 to avoid]

CONNECTS_TO:
[1 sentence: how this topic connects to other DSA patterns or topics]

Rules:
- This is a recall exercise, not a lesson
- Be brief — shorter is better for spaced repetition
- Higher review session # → more terse and recall-focused`;

    return this.safeGenerate(
      prompt,
      raw => this.parseRevisionSummary(raw),
      { temperature: 0.3, maxTokens: 380 },
      'generateRevisionSummary',
    );
  }

  private parseRevisionSummary(raw: string): RevisionSummary {
    return {
      recap: extractSection(raw, 'RECAP'),
      keyPoints: extractBullets(raw, 'KEY_POINTS'),
      commonMistakes: extractBullets(raw, 'COMMON_MISTAKES'),
      connectsTo: extractSection(raw, 'CONNECTS_TO'),
    };
  }

  // ── Message Formatters ──────────────────────────────────────────────────────

  /**
   * Format an AI-generated theory as a WhatsApp-ready message string.
   */
  formatTheoryMessage(
    topic: Topic,
    content: TheoryContent,
    dayNumber: number,
    weekNumber: number,
  ): string {
    const parts: string[] = [
      `📚 *Day ${dayNumber}, Week ${weekNumber}: ${topic.name}*`,
      `_${topic.category} • ${topic.difficulty}_`,
      '',
      content.coreConcept,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
    ];

    if (content.keyTakeaways.length > 0) {
      parts.push('🔑 *Key Takeaways:*');
      content.keyTakeaways.forEach(t => parts.push(`  • ${t}`));
      parts.push('');
    }

    if (content.codeExample) {
      parts.push('```typescript');
      parts.push(content.codeExample);
      parts.push('```');
      parts.push('');
    }

    if (content.analogy) {
      parts.push(`💡 *Analogy:* ${content.analogy}`);
      parts.push('');
    }

    parts.push(`⏱ *Time:* ${topic.time_complexity}  💾 *Space:* ${topic.space_complexity}`);
    parts.push('');
    parts.push("_Reply *PROBLEM* to get today's practice problem._");

    return parts.join('\n');
  }

  /**
   * Format an AI-generated solution walkthrough as a WhatsApp-ready message string.
   * Appends stored solution code if available.
   */
  formatSolutionMessage(problem: Problem, walkthrough: SolutionWalkthrough): string {
    const parts: string[] = [
      `✅ *Solution: ${problem.title}*`,
      '',
      `📌 *Approach:* ${walkthrough.approach}`,
      '',
      '*Step-by-step:*',
      ...walkthrough.steps.map((s, i) => `  ${i + 1}. ${s}`),
      '',
      `💡 *Key Insight:* ${walkthrough.keyInsight}`,
      '',
      `⏱ *Time:* ${walkthrough.timeComplexity}  💾 *Space:* ${walkthrough.spaceComplexity}`,
    ];

    if (problem.solution_code) {
      parts.push('');
      parts.push('```typescript');
      parts.push(problem.solution_code);
      parts.push('```');
    }

    parts.push('');
    parts.push('_How did you do? Reply: *EASY*, *MEDIUM*, or *HARD*_');

    return parts.join('\n');
  }

  /**
   * Format an AI-generated revision summary as a WhatsApp-ready message string.
   */
  formatRevisionMessage(topic: Topic, summary: RevisionSummary, daysAgo: number): string {
    const parts: string[] = [
      `🔄 *Review: ${topic.name}*`,
      `_You learned this ${daysAgo} days ago — time to reinforce!_`,
      '',
      summary.recap,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '📌 *Must Remember:*',
      ...summary.keyPoints.map(p => `  • ${p}`),
    ];

    if (summary.commonMistakes.length > 0) {
      parts.push('');
      parts.push('⚠️ *Common Mistakes:*');
      summary.commonMistakes.forEach(m => parts.push(`  • ${m}`));
    }

    if (summary.connectsTo) {
      parts.push('');
      parts.push(`🔗 *Connects to:* ${summary.connectsTo}`);
    }

    parts.push('');
    parts.push('_Reply *RECALL* (easy), *FUZZY* (partial), or *BLANK* (forgot)_');

    return parts.join('\n');
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Wraps an Ollama generate call with error handling.
   * Returns null on any failure so the caller can fall back to static content.
   */
  private async safeGenerate<T>(
    prompt: string,
    parser: (raw: string) => T,
    options: OllamaGenerateOptions,
    context: string,
  ): Promise<T | null> {
    try {
      const raw = await this.ollama.generate(prompt, options);
      return parser(raw);
    } catch (err) {
      console.warn(`[ContentGenerator] ${context} failed:`, (err as Error).message);
      return null;
    }
  }

  private parseJson<T>(raw: string, fallback: T): T {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
}
