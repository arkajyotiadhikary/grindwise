import {
  OllamaClient,
  OllamaGenerateOptions,
} from '@grindwise/infrastructure/ollama-client';
import {
  IContentGeneratorPort,
  TheoryContent,
  SolutionWalkthrough,
  RevisionSummary,
} from '@grindwise/domain/ports/content-generator.port';
import { Topic } from '@grindwise/domain/entities/topic.entity';
import { Problem } from '@grindwise/domain/entities/problem.entity';

function extractSection(text: string, header: string): string {
  const pattern = new RegExp(
    `${header}:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z_]+:|$)`,
    'i',
  );
  const match = pattern.exec(text);
  return match ? match[1].trim() : '';
}

function extractBullets(text: string, header: string): string[] {
  const block = extractSection(text, header);
  return block
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

function extractNumberedList(text: string, header: string): string[] {
  const block = extractSection(text, header);
  return block
    .split('\n')
    .map((line) => line.replace(/^\d+[.)]\s*/, '').trim())
    .filter((line) => line.length > 0);
}

function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```[\w]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

export class OllamaContentGeneratorAdapter implements IContentGeneratorPort {
  private readonly ollama: OllamaClient;

  constructor(ollama: OllamaClient) {
    this.ollama = ollama;
  }

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
      (raw) => this.parseTheory(raw),
      { temperature: 0.3, maxTokens: 450 },
      'generateTheory',
    );
  }

  private parseTheory(raw: string): TheoryContent {
    const codeMatch = /CODE_EXAMPLE:\s*([\s\S]*?)(?=\nANALOGY:|$)/i.exec(raw);
    const codeBlock = codeMatch
      ? stripCodeFences(codeMatch[1].trim())
      : undefined;

    return {
      coreConcept: extractSection(raw, 'CORE_CONCEPT'),
      keyTakeaways: extractBullets(raw, 'KEY_TAKEAWAYS'),
      codeExample: codeBlock && codeBlock.length > 0 ? codeBlock : undefined,
      analogy: extractSection(raw, 'ANALOGY') || undefined,
    };
  }

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
      (raw) => this.parseSolutionWalkthrough(raw),
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
      (raw) => this.parseRevisionSummary(raw),
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
      content.keyTakeaways.forEach((t) => parts.push(`  • ${t}`));
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

    parts.push(
      `⏱ *Time:* ${topic.time_complexity}  💾 *Space:* ${topic.space_complexity}`,
    );
    parts.push('');
    parts.push("_Reply *PROBLEM* to get today's practice problem._");

    return parts.join('\n');
  }

  formatSolutionMessage(
    problem: Problem,
    walkthrough: SolutionWalkthrough,
  ): string {
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

  formatRevisionMessage(
    topic: Topic,
    summary: RevisionSummary,
    daysAgo: number,
  ): string {
    const parts: string[] = [
      `🔄 *Review: ${topic.name}*`,
      `_You learned this ${daysAgo} days ago — time to reinforce!_`,
      '',
      summary.recap,
      '',
      '━━━━━━━━━━━━━━━━━━━━',
      '📌 *Must Remember:*',
      ...summary.keyPoints.map((p) => `  • ${p}`),
    ];

    if (summary.commonMistakes.length > 0) {
      parts.push('');
      parts.push('⚠️ *Common Mistakes:*');
      summary.commonMistakes.forEach((m) => parts.push(`  • ${m}`));
    }

    if (summary.connectsTo) {
      parts.push('');
      parts.push(`🔗 *Connects to:* ${summary.connectsTo}`);
    }

    parts.push('');
    parts.push(
      '_Reply *RECALL* (easy), *FUZZY* (partial), or *BLANK* (forgot)_',
    );

    return parts.join('\n');
  }

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
      console.warn(
        `[OllamaContentGeneratorAdapter] ${context} failed:`,
        (err as Error).message,
      );
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
