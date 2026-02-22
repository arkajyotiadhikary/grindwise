import { getDatabase } from './init';
import { NEETCODE_ROADMAP, NEETCODE_PROBLEMS } from '../data/neetcode-roadmap';
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
    // Seed topics
    for (const topic of NEETCODE_ROADMAP) {
      insertTopic.run({
        ...topic,
        key_concepts: JSON.stringify(topic.key_concepts),
      });

      // Seed problems for topic
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
          url: `https://leetcode.com/problems/${problem.leetcode_slug}/`
        });
      }

      // Seed test questions per topic
      seedTestQuestionsForTopic(insertTestQuestion, topic.id, topic.name, topic.key_concepts);
    }
  });

  seedAll();
  console.log(`✅ Seeded ${NEETCODE_ROADMAP.length} topics`);
  db.close();
}

function seedTestQuestionsForTopic(
  stmt: any,
  topicId: string,
  topicName: string,
  keyConcepts: string[]
): void {
  const questions: Array<{
    question: string;
    type: string;
    options: string[];
    correct_answer: string;
    explanation: string;
    difficulty: string;
  }> = [];

  // Generic MCQ based on topic
  if (topicId === 'arrays-basics') {
    questions.push({
      question: 'What is the time complexity of accessing an element in an array by index?',
      type: 'mcq',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
      correct_answer: 'O(1)',
      explanation: 'Arrays store elements in contiguous memory. Index calculation (base + i × size) is constant time.',
      difficulty: 'Easy'
    }, {
      question: 'Which technique uses two indices moving toward each other to solve array problems?',
      type: 'mcq',
      options: ['Sliding Window', 'Two Pointer', 'Divide and Conquer', 'Greedy'],
      correct_answer: 'Two Pointer',
      explanation: 'Two Pointer places pointers at opposite ends of the array and moves them toward each other.',
      difficulty: 'Easy'
    });
  } else if (topicId === 'binary-search') {
    questions.push({
      question: 'What is the time complexity of binary search?',
      type: 'mcq',
      options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'],
      correct_answer: 'O(log n)',
      explanation: 'Binary search halves the search space each iteration: n → n/2 → n/4 → ... → 1, which is log₂(n) steps.',
      difficulty: 'Easy'
    }, {
      question: 'Binary search requires the array to be ___.',
      type: 'fill_blank',
      options: [],
      correct_answer: 'sorted',
      explanation: 'Binary search relies on the sorted order to eliminate half the search space each step.',
      difficulty: 'Easy'
    });
  } else if (topicId === 'dynamic-programming-1d') {
    questions.push({
      question: 'Which of these is NOT a requirement for a problem to be solvable with Dynamic Programming?',
      type: 'mcq',
      options: ['Optimal substructure', 'Overlapping subproblems', 'Sorted input', 'Defined state'],
      correct_answer: 'Sorted input',
      explanation: 'DP requires optimal substructure and overlapping subproblems. Input being sorted is not a requirement.',
      difficulty: 'Medium'
    });
  }

  // Add a true/false about time complexity
  questions.push({
    question: `True or False: ${topicName} can generally achieve O(1) time for all operations.`,
    type: 'true_false',
    options: ['True', 'False'],
    correct_answer: 'False',
    explanation: `Most operations in ${topicName} have varying complexities. Only specific operations like hash map lookups or array access are O(1).`,
    difficulty: 'Easy'
  });

  for (const q of questions) {
    stmt.run({
      id: uuidv4(),
      topic_id: topicId,
      question: q.question,
      type: q.type,
      options: JSON.stringify(q.options),
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty
    });
  }
}

if (require.main === module) {
  seedRoadmap();
}
