import axios from 'axios';
import { Repository } from '@Vrind/db/repository';

// alfa-leetcode-api base URL — override with ALFA_LEETCODE_API_URL env var
// to point at a self-hosted docker instance (recommended for development)
const BASE_URL =
  process.env.ALFA_LEETCODE_API_URL ?? 'https://alfa-leetcode-api.onrender.com';

// Maps NeetCode categories to alfa-leetcode-api tag slugs
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

export interface LeetCodeProblem {
  questionId: string;
  title: string;
  titleSlug: string;
  content: string;
  difficulty: string;
  topicTags: Array<{ name: string; slug: string }>;
  hints: string[];
}

interface ProblemListItem {
  questionId: string;
  title: string;
  titleSlug: string;
  difficulty: string;
}

export class LeetCodeService {
  private repo: Repository;

  constructor() {
    this.repo = new Repository();
  }

  async fetchProblemBySlug(slug: string): Promise<LeetCodeProblem | null> {
    try {
      const response = await axios.get(`${BASE_URL}/select`, {
        params: { titleSlug: slug },
        timeout: 10000,
      });

      const data = response.data;
      if (!data?.questionId) return null;

      return {
        questionId: data.questionId,
        title: data.title,
        titleSlug: data.titleSlug,
        content: data.content ?? '',
        difficulty: data.difficulty,
        topicTags: data.topicTags ?? [],
        hints: data.hints ?? [],
      };
    } catch (error: any) {
      console.warn(`Failed to fetch LeetCode problem "${slug}":`, error.message);
      return null;
    }
  }

  async syncProblemForTopic(topicId: string, slug: string): Promise<void> {
    const problem = await this.fetchProblemBySlug(slug);
    if (!problem) return;

    const cleanContent = problem.content
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
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

    console.log(`✅ Synced LeetCode problem: ${problem.title}`);
  }

  // GET /problems?tags=tag1+tag2&difficulty=EASY&limit=<limit>
  async fetchProblemsForCategory(category: string, topicId: string, limit = 3): Promise<void> {
    const tags = CATEGORY_TO_TAGS[category] ?? [];
    if (!tags.length) return;

    // Use the primary tag for the category; the API supports + joined multi-tag filtering
    const tagParam = tags[0];

    try {
      const response = await axios.get(`${BASE_URL}/problems`, {
        params: {
          tags: tagParam,
          difficulty: 'EASY',
          limit,
        },
        timeout: 10000,
      });

      const problems: ProblemListItem[] = response.data?.problemsetQuestionList ?? [];

      for (const p of problems.slice(0, limit)) {
        await this.syncProblemForTopic(topicId, p.titleSlug);
        await delay(500); // avoid hammering the API
      }
    } catch (error: any) {
      console.warn(`LeetCode API fetch failed for category "${category}":`, error.message);
    }
  }

  close(): void {
    this.repo.close();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
