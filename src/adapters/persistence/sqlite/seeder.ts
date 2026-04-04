import { getDatabase } from './database';
import {
  NEETCODE_ROADMAP,
  NEETCODE_PROBLEMS,
} from '@grindwise/data/neetcode-roadmap';
import { v4 as uuidv4 } from 'uuid';

export function seedRoadmap(): void {
  const db = getDatabase();

  const insertTopic = db.prepare(`
    INSERT OR REPLACE INTO topics
      (id, roadmap_id, name, description, category, difficulty, day_number, week_number, order_index, content, key_concepts, time_complexity, space_complexity)
    VALUES
      (@id, @roadmap_id, @name, @description, @category, @difficulty, @day_number, @week_number, @order_index, @content, @key_concepts, @time_complexity, @space_complexity)
  `);

  const insertProblem = db.prepare(`
    INSERT OR REPLACE INTO problems
      (id, topic_id, leetcode_slug, title, difficulty, solution_code, solution_explanation, hints, url)
    VALUES
      (@id, @topic_id, @leetcode_slug, @title, @difficulty, @solution_code, @solution_explanation, @hints, @url)
  `);

  const insertTestQuestion = db.prepare(`
    INSERT OR REPLACE INTO test_questions
      (id, topic_id, question, type, options, correct_answer, explanation, difficulty)
    VALUES
      (@id, @topic_id, @question, @type, @options, @correct_answer, @explanation, @difficulty)
  `);

  const seedAll = db.transaction(() => {
    // Remove all test questions and re-seed with deterministic IDs.
    // Old UUID-keyed rows were duplicated on every app restart.
    db.prepare(`DELETE FROM test_questions`).run();

    for (const topic of NEETCODE_ROADMAP) {
      insertTopic.run({
        ...topic,
        key_concepts: JSON.stringify(topic.key_concepts),
      });

      const problems = NEETCODE_PROBLEMS[topic.id] ?? [];
      for (const problem of problems) {
        insertProblem.run({
          id: uuidv4(),
          topic_id: topic.id,
          leetcode_slug: problem.leetcode_slug,
          title: problem.title,
          difficulty: problem.difficulty,
          solution_code: problem.solution_code,
          solution_explanation: problem.solution_explanation,
          hints: JSON.stringify(problem.hints),
          url: `https://leetcode.com/problems/${problem.leetcode_slug}/`,
        });
      }

      seedTestQuestionsForTopic(
        insertTestQuestion,
        topic.id,
        topic.name,
        topic.key_concepts,
      );
    }
  });

  seedAll();
  console.log(`✅ Seeded ${NEETCODE_ROADMAP.length} topics`);
  db.close();
}

interface SeedQuestion {
  question: string;
  type: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty: string;
}

const TOPIC_QUESTIONS: Record<string, SeedQuestion[]> = {
  'arrays-basics': [
    {
      question: 'What is the time complexity of accessing an element in an array by index?',
      type: 'mcq',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
      correct_answer: 'O(1)',
      explanation: 'Arrays store elements in contiguous memory. Index calculation (base + i × size) is constant time.',
      difficulty: 'Easy',
    },
    {
      question: 'Which technique uses two indices moving toward each other to solve array problems?',
      type: 'mcq',
      options: ['Sliding Window', 'Two Pointer', 'Divide and Conquer', 'Greedy'],
      correct_answer: 'Two Pointer',
      explanation: 'Two Pointer places pointers at opposite ends of the array and moves them toward each other.',
      difficulty: 'Easy',
    },
    {
      question: 'What is the time complexity of inserting an element at the beginning of an array?',
      type: 'mcq',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
      correct_answer: 'O(n)',
      explanation: 'Inserting at position 0 requires shifting every existing element one position to the right.',
      difficulty: 'Easy',
    },
  ],
  'hashing-basics': [
    {
      question: 'What is the average time complexity of lookup in a hash map?',
      type: 'mcq',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
      correct_answer: 'O(1)',
      explanation: 'Hash maps compute an index from the key in constant time, giving O(1) average lookup.',
      difficulty: 'Easy',
    },
    {
      question: 'What happens when two different keys produce the same hash index?',
      type: 'mcq',
      options: ['Segmentation fault', 'Hash collision', 'Stack overflow', 'Key is rejected'],
      correct_answer: 'Hash collision',
      explanation: 'A collision occurs when different keys map to the same bucket. Resolved via chaining or open addressing.',
      difficulty: 'Easy',
    },
    {
      question: 'Which data structure is best for checking if an element exists in O(1) average time?',
      type: 'mcq',
      options: ['Array', 'Linked List', 'Hash Set', 'Binary Tree'],
      correct_answer: 'Hash Set',
      explanation: 'Hash sets use hashing to provide O(1) average membership checks.',
      difficulty: 'Easy',
    },
  ],
  'sliding-window': [
    {
      question: 'What is the typical time complexity of a sliding window solution?',
      type: 'mcq',
      options: ['O(n²)', 'O(n)', 'O(n log n)', 'O(log n)'],
      correct_answer: 'O(n)',
      explanation: 'Each element enters and leaves the window at most once, giving O(n) total work.',
      difficulty: 'Easy',
    },
    {
      question: 'Which problem type is best solved with a variable-size sliding window?',
      type: 'mcq',
      options: [
        'Sorting an array',
        'Longest substring without repeating characters',
        'Finding median of array',
        'Reversing a linked list',
      ],
      correct_answer: 'Longest substring without repeating characters',
      explanation: 'Variable windows expand/shrink to find the optimal contiguous subarray or substring.',
      difficulty: 'Medium',
    },
  ],
  'two-pointers': [
    {
      question: 'For the two-pointer technique to work on "find pair with target sum", the array must be:',
      type: 'mcq',
      options: ['Reversed', 'Sorted', 'Contain duplicates', 'Have even length'],
      correct_answer: 'Sorted',
      explanation: 'The opposite-end two-pointer approach relies on sorted order to decide which pointer to move.',
      difficulty: 'Easy',
    },
    {
      question: 'Which pointer pattern is used to detect cycles in a linked list?',
      type: 'mcq',
      options: ['Opposite ends', 'Fast and slow', 'Sliding window', 'Binary search'],
      correct_answer: 'Fast and slow',
      explanation: "Floyd's cycle detection uses a slow pointer (1 step) and fast pointer (2 steps) that meet inside a cycle.",
      difficulty: 'Easy',
    },
  ],
  'stack-basics': [
    {
      question: 'What principle does a stack follow?',
      type: 'mcq',
      options: ['FIFO', 'LIFO', 'LILO', 'Priority-based'],
      correct_answer: 'LIFO',
      explanation: 'Stack = Last In, First Out. The most recently pushed element is popped first.',
      difficulty: 'Easy',
    },
    {
      question: 'Which problem is classically solved using a stack?',
      type: 'mcq',
      options: ['Finding shortest path', 'Balanced parentheses', 'Sorting', 'Finding median'],
      correct_answer: 'Balanced parentheses',
      explanation: 'Push opening brackets, pop on closing brackets, and check they match. Stack is empty at end if balanced.',
      difficulty: 'Easy',
    },
    {
      question: 'A monotonic stack maintains elements in what order?',
      type: 'mcq',
      options: ['Random', 'Strictly increasing or decreasing', 'Alphabetical', 'Insertion order only'],
      correct_answer: 'Strictly increasing or decreasing',
      explanation: 'A monotonic stack pops elements that violate the increasing/decreasing invariant before pushing.',
      difficulty: 'Medium',
    },
  ],
  'binary-search': [
    {
      question: 'What is the time complexity of binary search?',
      type: 'mcq',
      options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'],
      correct_answer: 'O(log n)',
      explanation: 'Binary search halves the search space each iteration: n → n/2 → n/4 → ... → 1, which is log₂(n) steps.',
      difficulty: 'Easy',
    },
    {
      question: 'Binary search requires the input to be:',
      type: 'mcq',
      options: ['Unsorted', 'Sorted', 'A linked list', 'Contain unique elements only'],
      correct_answer: 'Sorted',
      explanation: 'Binary search relies on sorted order to eliminate half the search space each step.',
      difficulty: 'Easy',
    },
  ],
  'linked-list-basics': [
    {
      question: 'What is the time complexity of accessing the k-th element in a singly linked list?',
      type: 'mcq',
      options: ['O(1)', 'O(log n)', 'O(k)', 'O(n)'],
      correct_answer: 'O(k)',
      explanation: 'You must traverse from the head through k nodes. In worst case (k=n) it is O(n).',
      difficulty: 'Easy',
    },
    {
      question: 'What is the purpose of a dummy node in linked list problems?',
      type: 'mcq',
      options: [
        'To store extra data',
        'To simplify edge cases at the head',
        'To make the list circular',
        'To enable binary search',
      ],
      correct_answer: 'To simplify edge cases at the head',
      explanation: 'A dummy node before the head avoids special-casing insertions/deletions at position 0.',
      difficulty: 'Easy',
    },
  ],
  'trees-basics': [
    {
      question: 'Which traversal visits nodes in left-root-right order?',
      type: 'mcq',
      options: ['Preorder', 'Inorder', 'Postorder', 'Level order'],
      correct_answer: 'Inorder',
      explanation: 'Inorder = left subtree → root → right subtree. On a BST this yields sorted output.',
      difficulty: 'Easy',
    },
    {
      question: 'What data structure is used for BFS (level-order) traversal of a tree?',
      type: 'mcq',
      options: ['Stack', 'Queue', 'Heap', 'Hash Map'],
      correct_answer: 'Queue',
      explanation: 'BFS processes nodes level by level using a FIFO queue.',
      difficulty: 'Easy',
    },
  ],
  'bst': [
    {
      question: 'In a valid BST, all nodes in the left subtree are:',
      type: 'mcq',
      options: [
        'Greater than the root',
        'Less than the root',
        'Equal to the root',
        'Randomly ordered',
      ],
      correct_answer: 'Less than the root',
      explanation: 'BST property: every node in the left subtree has a value strictly less than the root.',
      difficulty: 'Easy',
    },
    {
      question: 'What is the average time complexity of search in a balanced BST?',
      type: 'mcq',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
      correct_answer: 'O(log n)',
      explanation: 'A balanced BST halves the search space at each level, giving O(log n) depth.',
      difficulty: 'Easy',
    },
  ],
  'heap-priority-queue': [
    {
      question: 'In a min-heap, the smallest element is always at:',
      type: 'mcq',
      options: ['A random position', 'The root', 'The last leaf', 'The deepest left node'],
      correct_answer: 'The root',
      explanation: 'The min-heap property ensures every parent ≤ its children, so the minimum is at the root.',
      difficulty: 'Easy',
    },
    {
      question: 'What is the time complexity of inserting into a binary heap?',
      type: 'mcq',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
      correct_answer: 'O(log n)',
      explanation: 'Insert at the end then bubble up. The tree height is log n, so at most log n swaps.',
      difficulty: 'Easy',
    },
  ],
  'graph-basics': [
    {
      question: 'Which algorithm finds the shortest path in an unweighted graph?',
      type: 'mcq',
      options: ['DFS', 'BFS', 'Binary Search', 'Merge Sort'],
      correct_answer: 'BFS',
      explanation: 'BFS explores nodes level by level, so the first time it reaches a node is via the shortest path.',
      difficulty: 'Easy',
    },
    {
      question: 'What is the time complexity of DFS on a graph with V vertices and E edges?',
      type: 'mcq',
      options: ['O(V)', 'O(E)', 'O(V + E)', 'O(V × E)'],
      correct_answer: 'O(V + E)',
      explanation: 'DFS visits each vertex once and traverses each edge once.',
      difficulty: 'Easy',
    },
  ],
  'dynamic-programming-1d': [
    {
      question: 'Which of these is NOT a requirement for Dynamic Programming?',
      type: 'mcq',
      options: ['Optimal substructure', 'Overlapping subproblems', 'Sorted input', 'Defined state'],
      correct_answer: 'Sorted input',
      explanation: 'DP requires optimal substructure and overlapping subproblems. Sorted input is not required.',
      difficulty: 'Medium',
    },
    {
      question: 'What is the difference between memoization and tabulation?',
      type: 'mcq',
      options: [
        'They are the same thing',
        'Memoization is top-down, tabulation is bottom-up',
        'Tabulation is top-down, memoization is bottom-up',
        'Memoization only works on graphs',
      ],
      correct_answer: 'Memoization is top-down, tabulation is bottom-up',
      explanation: 'Memoization uses recursion + cache (top-down). Tabulation fills a table iteratively (bottom-up).',
      difficulty: 'Medium',
    },
  ],
  'dynamic-programming-2d': [
    {
      question: 'Which classic problem uses a 2D DP table with two strings as axes?',
      type: 'mcq',
      options: ['Fibonacci', 'Longest Common Subsequence', 'Two Sum', 'Binary Search'],
      correct_answer: 'Longest Common Subsequence',
      explanation: 'LCS builds a table where dp[i][j] = LCS length of first i chars of s1 and first j chars of s2.',
      difficulty: 'Medium',
    },
    {
      question: 'In a grid DP problem, each cell typically depends on:',
      type: 'mcq',
      options: ['All other cells', 'Only the cell above and to the left', 'Random cells', 'Only diagonal cells'],
      correct_answer: 'Only the cell above and to the left',
      explanation: 'Grid DP usually transitions from dp[i-1][j] and dp[i][j-1] (up and left neighbors).',
      difficulty: 'Medium',
    },
  ],
  'backtracking': [
    {
      question: 'What is the key pattern in backtracking algorithms?',
      type: 'mcq',
      options: [
        'Sort then search',
        'Choose, explore, unchoose',
        'Divide and conquer',
        'Greedy selection',
      ],
      correct_answer: 'Choose, explore, unchoose',
      explanation: 'Backtracking makes a choice, recurses to explore, then undoes the choice to try alternatives.',
      difficulty: 'Medium',
    },
    {
      question: 'Pruning in backtracking helps by:',
      type: 'mcq',
      options: [
        'Sorting the input',
        'Skipping branches that cannot lead to valid solutions',
        'Increasing recursion depth',
        'Using more memory',
      ],
      correct_answer: 'Skipping branches that cannot lead to valid solutions',
      explanation: 'Pruning eliminates entire subtrees early, drastically reducing the search space.',
      difficulty: 'Medium',
    },
  ],
  'tries': [
    {
      question: 'What is the time complexity of searching for a word of length L in a trie?',
      type: 'mcq',
      options: ['O(1)', 'O(L)', 'O(n)', 'O(n × L)'],
      correct_answer: 'O(L)',
      explanation: 'Trie traverses one node per character in the word, so search is O(word length).',
      difficulty: 'Easy',
    },
    {
      question: 'Tries are most commonly used for:',
      type: 'mcq',
      options: ['Sorting numbers', 'Prefix-based string operations', 'Graph traversal', 'Matrix multiplication'],
      correct_answer: 'Prefix-based string operations',
      explanation: 'Tries store strings character by character, making them ideal for prefix search and autocomplete.',
      difficulty: 'Easy',
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function seedTestQuestionsForTopic(
  stmt: any,
  topicId: string,
  topicName: string,
  _keyConcepts: string[],
): void {
  const questions: SeedQuestion[] = [...(TOPIC_QUESTIONS[topicId] ?? [])];

  // Add one true/false question per topic
  questions.push({
    question: `True or False: ${topicName} can generally achieve O(1) time for all operations.`,
    type: 'true_false',
    options: ['True', 'False'],
    correct_answer: 'False',
    explanation: `Most operations in ${topicName} have varying complexities. Only specific operations like hash map lookups or array access are O(1).`,
    difficulty: 'Easy',
  });

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    // Deterministic ID: topicId + index ensures INSERT OR REPLACE
    // actually replaces on re-seed instead of creating duplicates.
    stmt.run({
      id: `${topicId}-q${i}`,
      topic_id: topicId,
      question: q.question,
      type: q.type,
      options: JSON.stringify(q.options),
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
    });
  }
}

if (require.main === module) {
  seedRoadmap();
}
