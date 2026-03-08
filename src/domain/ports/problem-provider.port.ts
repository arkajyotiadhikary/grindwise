export interface LeetCodeProblem {
  questionId: string;
  title: string;
  titleSlug: string;
  content: string;
  difficulty: string;
  topicTags: Array<{ name: string; slug: string }>;
  hints: string[];
}

export interface IProblemProviderPort {
  fetchProblemBySlug(slug: string): Promise<LeetCodeProblem | null>;
  syncProblemForTopic(topicId: string, slug: string): Promise<void>;
  fetchProblemsForCategory(
    category: string,
    topicId: string,
    limit?: number,
  ): Promise<void>;
}
