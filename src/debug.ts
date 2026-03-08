/**
 * debug.ts — Manual test runner for any service/method.
 *
 * Usage:
 *   npx ts-node src/debug.ts
 *
 * Uncomment the section you want to test, then run the file.
 * Only ONE section should be active at a time.
 */

import dotenv from 'dotenv';
dotenv.config();

import { SqliteRepositoryAdapter } from '@Vrind/adapters/persistence/sqlite/sqlite-repository.adapter';
import { getDatabase } from '@Vrind/adapters/persistence/sqlite/database';
import { CurriculumDomainService } from '@Vrind/domain/services/curriculum.domain-service';
import { OllamaClient } from '@Vrind/infrastructure/ollama-client';
import { OllamaContentGeneratorAdapter } from '@Vrind/adapters/content-generator/ollama-content-generator.adapter';
import { LeetCodeProblemProviderAdapter } from '@Vrind/adapters/problem-provider/leetcode-problem-provider.adapter';
import { NEETCODE_ROADMAP, NEETCODE_PROBLEMS } from '@Vrind/data/neetcode-roadmap';
import { startBot } from '@Vrind/bot/socket';
import { BaileysMessenger } from '@Vrind/channels/baileys-messenger';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const repo = new SqliteRepositoryAdapter(getDatabase());
const ollama = new OllamaClient();
const contentGen = new OllamaContentGeneratorAdapter(ollama);

/** Grab any topic from the DB for testing (falls back to roadmap data). */
function getTestTopic() {
  return repo.getTopicById('arrays-basics') ?? {
    id: 'arrays-basics',
    roadmap_id: 'neetcode',
    name: 'Arrays: Fundamentals',
    description: 'Understanding arrays, indexing, and basic operations',
    category: 'Arrays & Hashing',
    difficulty: 'Beginner' as const,
    day_number: 1,
    week_number: 1,
    order_index: 1,
    content: '',
    key_concepts: JSON.stringify(['O(1) access', 'index-based', 'contiguous memory']),
    time_complexity: 'O(n)',
    space_complexity: 'O(1)',
    created_at: new Date().toISOString(),
  };
}

/** Grab any problem from the DB for testing (falls back to inline stub). */
function getTestProblem() {
  const topic = getTestTopic();
  return repo.getProblemForTopic(topic.id) ?? {
    id: 'stub-two-sum',
    topic_id: 'arrays-basics',
    leetcode_id: undefined,
    leetcode_slug: 'two-sum',
    title: 'Two Sum',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    difficulty: 'Easy' as const,
    solution_code: `function twoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) return [map.get(complement)!, i];
    map.set(nums[i], i);
  }
  return [];
}`,
    solution_explanation: 'Use a hash map to store each number and check for its complement in O(n).',
    hints: JSON.stringify(['Think about what complement you need', 'Use a hash map for O(1) lookup']),
    tags: JSON.stringify(['array', 'hash-table']),
    url: 'https://leetcode.com/problems/two-sum/',
    fetched_at: undefined,
  };
}

// ─── SECTION 1: Ollama connectivity ──────────────────────────────────────────

async function debugOllamaHealth(): Promise<void> {
  console.log('--- Ollama Health Check ---');
  const available = await ollama.isAvailable();
  console.log('Available:', available);
}

// ─── SECTION 2: Raw Ollama generate ──────────────────────────────────────────

async function debugOllamaGenerate(): Promise<void> {
  console.log('--- Raw Ollama Generate ---');
  const result = await ollama.generate('Say hello in one sentence.', {
    temperature: 0.5,
    maxTokens: 60,
  });
  console.log('Response:\n', result);
}

// ─── SECTION 3: ContentGenerator — Theory ────────────────────────────────────

async function debugGenerateTheory(): Promise<void> {
  console.log('--- ContentGenerator: generateTheory ---');
  const topic = getTestTopic();
  console.log('Topic:', topic.name);

  const content = await contentGen.generateTheory(topic);
  if (!content) { console.log('⚠️  Returned null (Ollama unavailable or parse failed)'); return; }

  console.log('\nParsed TheoryContent:');
  console.log('  coreConcept:', content.coreConcept);
  console.log('  keyTakeaways:', content.keyTakeaways);
  console.log('  codeExample:', content.codeExample ?? '(none)');
  console.log('  analogy:', content.analogy ?? '(none)');

  console.log('\nFormatted message:\n');
  console.log(contentGen.formatTheoryMessage(topic, content, 1, 1));
}

// ─── SECTION 4: ContentGenerator — Solution Walkthrough ──────────────────────

async function debugGenerateSolutionWalkthrough(): Promise<void> {
  console.log('--- ContentGenerator: generateSolutionWalkthrough ---');
  const topic = getTestTopic();
  const problem = getTestProblem();
  console.log('Problem:', problem.title);

  const walkthrough = await contentGen.generateSolutionWalkthrough(problem, topic);
  if (!walkthrough) { console.log('⚠️  Returned null (Ollama unavailable or parse failed)'); return; }

  console.log('\nParsed SolutionWalkthrough:');
  console.log('  approach:', walkthrough.approach);
  console.log('  steps:', walkthrough.steps);
  console.log('  keyInsight:', walkthrough.keyInsight);
  console.log('  timeComplexity:', walkthrough.timeComplexity);
  console.log('  spaceComplexity:', walkthrough.spaceComplexity);

  console.log('\nFormatted message:\n');
  console.log(contentGen.formatSolutionMessage(problem, walkthrough));
}

// ─── SECTION 5: ContentGenerator — Revision Summary ──────────────────────────

async function debugGenerateRevisionSummary(): Promise<void> {
  console.log('--- ContentGenerator: generateRevisionSummary ---');
  const topic = getTestTopic();
  const reviewCount = 2;

  const summary = await contentGen.generateRevisionSummary(topic, reviewCount);
  if (!summary) { console.log('⚠️  Returned null (Ollama unavailable or parse failed)'); return; }

  console.log('\nParsed RevisionSummary:');
  console.log('  recap:', summary.recap);
  console.log('  keyPoints:', summary.keyPoints);
  console.log('  commonMistakes:', summary.commonMistakes);
  console.log('  connectsTo:', summary.connectsTo);

  console.log('\nFormatted message:\n');
  console.log(contentGen.formatRevisionMessage(topic, summary, 7));
}

// ─── SECTION 6: Repository queries ───────────────────────────────────────────

function debugRepository(): void {
  console.log('--- Repository ---');
  const topic = repo.getTopicById('arrays-basics');
  console.log('Topic by ID:', topic?.name ?? '(not seeded)');

  const allTopics = repo.getAllTopics('neetcode');
  console.log('Total topics in DB:', allTopics.length);

  const users = repo.getAllActiveUsers();
  console.log('Active users:', users.length);
  users.forEach(u => console.log(' -', u.phone_number, `W${u.current_week}D${u.current_day}`));
}

// ─── SECTION 7: CurriculumDomainService ──────────────────────────────────────

function debugCurriculumEngine(): void {
  console.log('--- CurriculumDomainService ---');
  const curriculum = new CurriculumDomainService(repo);

  const users = repo.getAllActiveUsers();
  if (!users.length) { console.log('No active users in DB.'); return; }

  const user = users[0];
  if (!user) return;

  const topic = curriculum.getCurrentTopic(user);
  console.log(`User ${user.phone_number} → current topic: ${topic?.name ?? '(complete)'}`);

  const progress = curriculum.getProgress(user);
  console.log('Progress:', progress);
}

// ─── SECTION 8: Static roadmap data ──────────────────────────────────────────

function debugRoadmapData(): void {
  console.log('--- NEETCODE_ROADMAP ---');
  console.log('Total topics defined:', NEETCODE_ROADMAP.length);
  NEETCODE_ROADMAP.forEach(t =>
    console.log(`  W${t.week_number}D${t.day_number} [${t.difficulty}] ${t.name}`),
  );

  console.log('\n--- NEETCODE_PROBLEMS ---');
  Object.entries(NEETCODE_PROBLEMS).forEach(([topicId, problems]) => {
    console.log(`  ${topicId}: ${problems.length} problem(s)`);
  });
}

// ─── SECTION 9: Messenger — manual send ──────────────────────────────────────

const DEBUG_TO = process.env.DEBUG_MESSENGER_TO ?? '';
const DEBUG_MESSAGE = process.env.DEBUG_MESSENGER_MSG ?? '👋 Debug test from DSA Mentor bot';

async function debugMessengerSend(): Promise<void> {
  if (!DEBUG_TO) {
    console.error('[debugMessenger] Set DEBUG_MESSENGER_TO=<phone_number> in .env and retry.');
    return;
  }

  console.log(`--- Messenger debug: sending to ${DEBUG_TO} ---`);

  await startBot(
    async () => { /* ignore incoming messages */ },
    async sock => {
      const messenger = new BaileysMessenger(sock);

      console.log('Sending text message...');
      const textResult = await messenger.sendText(DEBUG_TO, DEBUG_MESSAGE);
      console.log('sendText result:', textResult);

      console.log('Sending buttons (falls back to numbered text)...');
      const buttonsResult = await messenger.sendButtons(
        DEBUG_TO,
        'Which topic do you want to review?',
        [
          { id: 'arrays', title: 'Arrays' },
          { id: 'trees', title: 'Trees' },
          { id: 'graphs', title: 'Graphs' },
        ],
        'DSA Revision',
      );
      console.log('sendButtons result:', buttonsResult);

      console.log('Sending list (falls back to lettered text)...');
      const listResult = await messenger.sendList(
        DEBUG_TO,
        'Pick a difficulty level:',
        'Select',
        [
          { id: 'easy', title: 'Easy', description: 'Warm-up problems' },
          { id: 'medium', title: 'Medium', description: 'Core interview problems' },
          { id: 'hard', title: 'Hard', description: 'Advanced challenges' },
        ],
      );
      console.log('sendList result:', listResult);

      console.log('✅ All debug sends complete. Waiting 3s for socket to flush...');
      await new Promise<void>(resolve => setTimeout(resolve, 3000));
      process.exit(0);
    },
  );
}

// ─── SECTION 10: LeetCode service ────────────────────────────────────────────

async function debugLeetCode(): Promise<void> {
  console.log('--- LeetCodeProblemProviderAdapter ---');
  const lc = new LeetCodeProblemProviderAdapter(repo);
  const problem = await lc.fetchProblemBySlug('two-sum');
  console.log('Fetched:', problem?.title ?? '(null)');
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    // await debugOllamaHealth();
    // await debugOllamaGenerate();
    // await debugGenerateTheory();
    // await debugGenerateSolutionWalkthrough();
    // await debugGenerateRevisionSummary();
    // debugRepository();
    // debugCurriculumEngine();
    // debugRoadmapData();
    // await debugLeetCode();
    await debugMessengerSend();
  } finally {
    repo.close();
  }
}

main().catch(err => {
  console.error('Debug error:', err);
  repo.close();
  process.exit(1);
});
