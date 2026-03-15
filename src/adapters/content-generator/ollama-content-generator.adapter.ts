import {
  OllamaClient,
  OllamaGenerateOptions,
} from '@grindwise/infrastructure/ollama-client';
import {
  IContentGeneratorPort,
  TheoryContent,
  SolutionWalkthrough,
  RevisionSummary,
  DsaAnswerResult,
  PhaseEvaluationResult,
  PriorPhaseContext,
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

  async askDsaQuestion(question: string): Promise<DsaAnswerResult | null> {
    const prompt = `You are a strict DSA (Data Structures & Algorithms) tutor bot. You ONLY answer questions related to DSA topics such as: arrays, strings, linked lists, stacks, queues, trees, graphs, hash maps, heaps, sorting, searching, recursion, dynamic programming, greedy algorithms, backtracking, bit manipulation, tries, union-find, segment trees, and related algorithmic concepts.

User question: "${question}"

First, determine if this question is about DSA or programming concepts directly related to DSA.

If the question IS about DSA, respond with EXACTLY this format:
DSA_RELATED: YES
ANSWER:
[Your concise answer here — micro-learning format, max 200 words]

If the question is NOT about DSA (e.g., general chat, other programming topics, personal questions, etc.), respond with EXACTLY:
DSA_RELATED: NO

Rules:
- Be concise and direct
- No preamble phrases
- Code examples in TypeScript if needed, max 8 lines
- Only answer DSA questions — be strict about this`;

    return this.safeGenerate(
      prompt,
      (raw) => this.parseDsaAnswer(raw),
      { temperature: 0.3, maxTokens: 500 },
      'askDsaQuestion',
    );
  }

  private parseDsaAnswer(raw: string): DsaAnswerResult {
    const isDsaRelated = /DSA_RELATED:\s*YES/i.test(raw);
    if (!isDsaRelated) {
      return { isDsaRelated: false, answer: '' };
    }
    const answer = extractSection(raw, 'ANSWER');
    return { isDsaRelated: true, answer: answer || raw };
  }

  async evaluateExplanation(
    userExplanation: string,
    problem: Problem,
    topic: Topic,
    priorPhases?: PriorPhaseContext[],
  ): Promise<PhaseEvaluationResult | null> {
    return this.evaluatePhase('explanation', userExplanation, problem, topic, priorPhases);
  }

  async evaluatePseudoCode(
    userPseudo: string,
    problem: Problem,
    topic: Topic,
    priorPhases?: PriorPhaseContext[],
  ): Promise<PhaseEvaluationResult | null> {
    return this.evaluatePhase('pseudocode', userPseudo, problem, topic, priorPhases);
  }

  async evaluateCode(
    userCode: string,
    problem: Problem,
    topic: Topic,
    priorPhases?: PriorPhaseContext[],
  ): Promise<PhaseEvaluationResult | null> {
    return this.evaluatePhase('code', userCode, problem, topic, priorPhases);
  }

  private buildPriorContext(priorPhases?: PriorPhaseContext[]): string {
    if (!priorPhases || priorPhases.length === 0) return '';

    const lines = priorPhases.map(
      (p) => `- ${p.phase} (scored ${p.score}/5): "${p.summary}"`,
    );
    return `\nEarlier in this session you reviewed their work:\n${lines.join('\n')}\nUse this for continuity — acknowledge progress or recurring issues briefly, but focus on the current submission.\n`;
  }

  private async evaluatePhase(
    phase: string,
    submission: string,
    problem: Problem,
    topic: Topic,
    priorPhases?: PriorPhaseContext[],
  ): Promise<PhaseEvaluationResult | null> {
    const descSnippet = problem.description?.slice(0, 400) ?? '';
    const priorContext = this.buildPriorContext(priorPhases);

    const prompt = `You are a friendly DSA tutor talking directly to the learner. Evaluate their ${phase} and give feedback addressed to them using "you/your".
Problem: ${problem.title} (${problem.difficulty}), Topic: ${topic.name}
${descSnippet ? `Description: ${descSnippet}` : ''}${priorContext}
Their submission: """${submission}"""

Respond EXACTLY in this format (no extra text):
SCORE: [0-5]
FEEDBACK: [1-3 sentences speaking directly to the learner — use "you/your", be encouraging, point out what they did well and what to improve]
ACCEPTABLE: [YES/NO]`;

    return this.safeGenerate(
      prompt,
      (raw) => this.parsePhaseEvaluation(raw),
      { temperature: 0.2, maxTokens: 300 },
      `evaluate_${phase}`,
    );
  }

  private parsePhaseEvaluation(raw: string): PhaseEvaluationResult {
    const scoreMatch = /SCORE:\s*(\d)/i.exec(raw);
    const score = scoreMatch ? Math.min(5, Math.max(0, parseInt(scoreMatch[1]!, 10))) : 3;

    const feedbackMatch = /FEEDBACK:\s*([\s\S]*?)(?=\nACCEPTABLE:|$)/i.exec(raw);
    const feedback = feedbackMatch ? feedbackMatch[1]!.trim() : 'Submission received.';

    const acceptableMatch = /ACCEPTABLE:\s*(YES|NO)/i.exec(raw);
    const isAcceptable = acceptableMatch
      ? acceptableMatch[1]!.toUpperCase() === 'YES'
      : score >= 3;

    return { score, feedback, isAcceptable };
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
