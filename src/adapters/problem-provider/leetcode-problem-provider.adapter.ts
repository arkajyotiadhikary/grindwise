import axios from 'axios';
import { IRepositoryPort } from '@grindwise/domain/ports/repository.port';
import { IProblemProviderPort, LeetCodeProblem } from '@grindwise/domain/ports/problem-provider.port';

const BASE_URL =
  process.env['ALFA_LEETCODE_API_URL'] ?? 'https://alfa-leetcode-api.onrender.com';

const CATEGORY_TO_TAGS: Record<string, string[]> = {
  'Arrays & Hashing': ['array', 'hash-table'],
  'Two Pointers': ['two-pointers'],
  'Sliding Window': ['sliding-window'],
  'Stack': ['stack', 'monotonic-stack'],
  'Binary Search': ['binary-search'],
  'Linked List': ['linked-list'],
  'Trees': ['binary-tree', 'binary-search-tree'],
  'Heap / Priority Queue': ['heap-priority-queue'],
  'Backtracking': ['backtracking'],
  'Tries': ['trie'],
  'Graphs': ['graph', 'depth-first-search', 'breadth-first-search'],
  'Dynamic Programming': ['dynamic-programming'],
};

interface ProblemListItem {
  questionId: string;
  title: string;
  titleSlug: string;
  difficulty: string;
}

export class LeetCodeProblemProviderAdapter implements IProblemProviderPort {
  constructor(private readonly repo: IRepositoryPort) {}

  async fetchProblemBySlug(slug: string): Promise<LeetCodeProblem | null> {
    try {
      const response = await axios.get(`${BASE_URL}/select`, {
        params: { titleSlug: slug },
        timeout: 10000,
      });

      const data = response.data as Record<string, unknown> | null;
      if (!data?.['questionId']) return null;

      return {
        questionId: String(data['questionId']),
        title: String(data['title'] ?? ''),
        titleSlug: String(data['titleSlug'] ?? ''),
        content: String(data['content'] ?? ''),
        difficulty: String(data['difficulty'] ?? ''),
        topicTags: (data['topicTags'] as Array<{ name: string; slug: string }>) ?? [],
        hints: (data['hints'] as string[]) ?? [],
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[LeetCodeProblemProviderAdapter] fetchProblemBySlug failed for "${slug}"`, { error: msg });
      return null;
    }
  }

  async syncProblemForTopic(topicId: string, slug: string): Promise<void> {
    try {
      const problem = await this.fetchProblemBySlug(slug);
      if (!problem) return;

      const cleanContent = problem.content
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 2000);

      this.repo.upsertProblem({
        topic_id: topicId,
        leetcode_id: parseInt(problem.questionId),
        leetcode_slug: problem.titleSlug,
        title: problem.title,
        description: cleanContent,
        difficulty: problem.difficulty,
        hints: JSON.stringify(problem.hints),
        tags: JSON.stringify(problem.topicTags.map(t => t.name)),
        url: `https://leetcode.com/problems/${problem.titleSlug}/`,
      });

      console.log(`[LeetCodeProblemProviderAdapter] Synced: ${problem.title}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[LeetCodeProblemProviderAdapter] syncProblemForTopic failed', { error: msg, topicId, slug });
    }
  }

  async fetchProblemsForCategory(category: string, topicId: string, limit = 3): Promise<void> {
    const tags = CATEGORY_TO_TAGS[category] ?? [];
    if (tags.length === 0) return;

    const tagParam = tags[0];

    try {
      const response = await axios.get(`${BASE_URL}/problems`, {
        params: { tags: tagParam, difficulty: 'EASY', limit },
        timeout: 10000,
      });

      const data = response.data as Record<string, unknown> | null;
      const problems = (data?.['problemsetQuestionList'] as ProblemListItem[]) ?? [];

      for (const p of problems.slice(0, limit)) {
        await this.syncProblemForTopic(topicId, p.titleSlug);
        await delay(500);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[LeetCodeProblemProviderAdapter] fetchProblemsForCategory failed for "${category}"`, { error: msg });
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
