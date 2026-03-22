import { MessageFormatter } from '@grindwise/shared/message-formatter';
import { createMockTopic, createMockProblem, createMockUser } from '../mocks';

describe('MessageFormatter', () => {
  describe('dailyTopic', () => {
    it('includes topic name, day, week, description, key concepts, complexities', () => {
      const topic = createMockTopic();
      const msg = MessageFormatter.dailyTopic(topic, 1, 1);
      expect(msg).toContain('Day 1, Week 1');
      expect(msg).toContain(topic.name);
      expect(msg).toContain(topic.description);
      expect(msg).toContain('indexing');
      expect(msg).toContain(topic.time_complexity);
      expect(msg).toContain(topic.space_complexity);
    });

    it('truncates content to 1800 chars', () => {
      const longContent = 'A'.repeat(3000);
      const topic = createMockTopic({ content: longContent });
      const msg = MessageFormatter.dailyTopic(topic, 1, 1);
      expect(msg).not.toContain('A'.repeat(3000));
      expect(msg).toContain('A'.repeat(1800));
    });
  });

  describe('dailyProblem', () => {
    it('includes problem title, difficulty, hints, and URL', () => {
      const problem = createMockProblem();
      const topic = createMockTopic();
      const msg = MessageFormatter.dailyProblem(problem, topic);
      expect(msg).toContain('Two Sum');
      expect(msg).toContain('Easy');
      expect(msg).toContain('leetcode.com');
      expect(msg).toContain('Think about what complement means');
    });

    it('handles missing description', () => {
      const problem = createMockProblem({ description: undefined });
      const topic = createMockTopic();
      const msg = MessageFormatter.dailyProblem(problem, topic);
      expect(msg).toContain('Visit LeetCode');
    });
  });

  describe('solution', () => {
    it('includes solution code and explanation', () => {
      const problem = createMockProblem();
      const msg = MessageFormatter.solution(problem);
      expect(msg).toContain('```typescript');
      expect(msg).toContain('twoSum');
      expect(msg).toContain('hash map');
    });

    it('shows fallback when no solution code', () => {
      const problem = createMockProblem({ solution_code: undefined });
      const msg = MessageFormatter.solution(problem);
      expect(msg).toContain('Solution not available yet');
    });
  });

  describe('reviewReminder', () => {
    it('includes topic name and days ago', () => {
      const topic = createMockTopic();
      const msg = MessageFormatter.reviewReminder(topic, 7);
      expect(msg).toContain(topic.name);
      expect(msg).toContain('7 days ago');
      expect(msg).toContain('RECALL');
      expect(msg).toContain('FUZZY');
      expect(msg).toContain('BLANK');
    });
  });

  describe('testResults', () => {
    it('shows trophy for >= 80%', () => {
      const msg = MessageFormatter.testResults(8, 10, 80);
      expect(msg).toContain('🏆');
      expect(msg).toContain('8/10');
    });

    it('shows checkmark for >= 60%', () => {
      const msg = MessageFormatter.testResults(7, 10, 70);
      expect(msg).toContain('✅');
    });

    it('shows book for < 60%', () => {
      const msg = MessageFormatter.testResults(3, 10, 30);
      expect(msg).toContain('📖');
    });
  });

  describe('welcome', () => {
    it('includes user name and roadmap info', () => {
      const msg = MessageFormatter.welcome('Arka');
      expect(msg).toContain('Arka');
      expect(msg).toContain('NeetCode DSA Roadmap');
      expect(msg).toContain('Commands');
    });
  });

  describe('progressReport', () => {
    it('includes all stats', () => {
      const user = createMockUser();
      const msg = MessageFormatter.progressReport(user, {
        understood: 3,
        sent: 5,
        completedTopics: 3,
        totalTopics: 20,
        percentageComplete: 15,
      });
      expect(msg).toContain('Test User');
      expect(msg).toContain('Week 1, Day 1');
      expect(msg).toContain('Streak: 5');
      expect(msg).toContain('3/20');
      expect(msg).toContain('15%');
    });
  });

  describe('phaseSubmissionConfirm', () => {
    it('includes phase name and YES/NO prompt', () => {
      const msg = MessageFormatter.phaseSubmissionConfirm('explanation');
      expect(msg).toContain('EXPLANATION');
      expect(msg).toContain('YES');
      expect(msg).toContain('NO');
    });
  });

  describe('phaseEvaluationResult', () => {
    it('includes score stars and feedback', () => {
      const msg = MessageFormatter.phaseEvaluationResult('code', 4, 'Well done');
      expect(msg).toContain('CODE');
      expect(msg).toContain('4/5');
      expect(msg).toContain('Well done');
    });
  });

  describe('practiceComplete', () => {
    it('includes all scores and combined quality', () => {
      const msg = MessageFormatter.practiceComplete(
        { explanation: 4, pseudo: 3, code: 5 },
        4,
      );
      expect(msg).toContain('Explanation: 4/5');
      expect(msg).toContain('Pseudocode:  3/5');
      expect(msg).toContain('Code:        5/5');
      expect(msg).toContain('Combined Quality: 4/5');
      expect(msg).toContain('Excellent');
    });

    it('shows practice message for low combined quality', () => {
      const msg = MessageFormatter.practiceComplete(
        { explanation: 2, pseudo: 2, code: 3 },
        2,
      );
      expect(msg).toContain('Good attempt');
    });
  });

  describe('retryPhasePrompt', () => {
    it('includes phase name in command', () => {
      const msg = MessageFormatter.retryPhasePrompt('pseudo');
      expect(msg).toContain('/pseudo');
    });
  });

  describe('help', () => {
    it('lists all commands', () => {
      const msg = MessageFormatter.help();
      expect(msg).toContain('/topic');
      expect(msg).toContain('/problem');
      expect(msg).toContain('/solution');
      expect(msg).toContain('/progress');
      expect(msg).toContain('/review');
      expect(msg).toContain('/easy');
      expect(msg).toContain('/medium');
      expect(msg).toContain('/hard');
      expect(msg).toContain('/explanation');
      expect(msg).toContain('/pseudo');
      expect(msg).toContain('/code');
      expect(msg).toContain('/test');
      expect(msg).toContain('/ask');
    });
  });
});
