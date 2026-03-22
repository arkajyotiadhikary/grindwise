import { CurriculumDomainService } from '@grindwise/domain/services/curriculum.domain-service';
import { createMockRepo, createMockUser, createMockTopic } from '../mocks';

describe('CurriculumDomainService', () => {
  const repo = createMockRepo();
  const service = new CurriculumDomainService(repo, 'neetcode');

  beforeEach(() => jest.clearAllMocks());

  describe('getCurrentTopic', () => {
    it('returns topic for user position', () => {
      const topic = createMockTopic();
      repo.getTopicByDayWeek.mockReturnValue(topic);
      const user = createMockUser();
      expect(service.getCurrentTopic(user)).toBe(topic);
      expect(repo.getTopicByDayWeek).toHaveBeenCalledWith(1, 1, 'neetcode');
    });

    it('returns null when no topic at position', () => {
      repo.getTopicByDayWeek.mockReturnValue(undefined);
      expect(service.getCurrentTopic(createMockUser())).toBeNull();
    });
  });

  describe('computeNextPosition', () => {
    it('advances to next day in same week', () => {
      const user = createMockUser({ current_day: 1, current_week: 1 });
      repo.getDaysInWeek.mockReturnValue(3);
      repo.getTotalWeeks.mockReturnValue(10);
      const nextTopic = createMockTopic({ order_index: 2, day_number: 2 });
      repo.getTopicByDayWeek.mockReturnValue(nextTopic);

      const pos = service.computeNextPosition(user);
      expect(pos).toEqual({ weekNumber: 1, dayNumber: 2, orderIndex: 2 });
    });

    it('advances to next week when at last day', () => {
      const user = createMockUser({ current_day: 3, current_week: 1 });
      repo.getDaysInWeek.mockReturnValue(3);
      repo.getTotalWeeks.mockReturnValue(10);
      const nextTopic = createMockTopic({ order_index: 4, day_number: 1, week_number: 2 });
      repo.getTopicByDayWeek.mockReturnValue(nextTopic);

      const pos = service.computeNextPosition(user);
      expect(pos).toEqual({ weekNumber: 2, dayNumber: 1, orderIndex: 4 });
    });

    it('returns null at end of roadmap', () => {
      const user = createMockUser({ current_day: 3, current_week: 10 });
      repo.getDaysInWeek.mockReturnValue(3);
      repo.getTotalWeeks.mockReturnValue(10);

      expect(service.computeNextPosition(user)).toBeNull();
    });
  });

  describe('advanceUser', () => {
    it('advances user and updates repo', () => {
      const user = createMockUser({ current_day: 1, current_week: 1 });
      repo.getDaysInWeek.mockReturnValue(3);
      repo.getTotalWeeks.mockReturnValue(10);
      const nextTopic = createMockTopic({ order_index: 2 });
      repo.getTopicByDayWeek.mockReturnValue(nextTopic);

      const result = service.advanceUser(user);
      expect(result.isComplete).toBe(false);
      expect(repo.updateUserProgress).toHaveBeenCalledWith(user.id, result.newDay, result.newWeek);
    });

    it('marks complete at end of roadmap', () => {
      const user = createMockUser({ current_day: 3, current_week: 10 });
      repo.getDaysInWeek.mockReturnValue(3);
      repo.getTotalWeeks.mockReturnValue(10);

      const result = service.advanceUser(user);
      expect(result.isComplete).toBe(true);
      expect(repo.updateUserProgress).not.toHaveBeenCalled();
    });
  });

  describe('getProgress', () => {
    it('computes correct progress stats', () => {
      const user = createMockUser({ current_day: 1, current_week: 2 });
      const topics = [
        createMockTopic({ order_index: 1 }),
        createMockTopic({ order_index: 2 }),
        createMockTopic({ order_index: 3 }),
        createMockTopic({ order_index: 4 }),
      ];
      repo.getAllTopics.mockReturnValue(topics);
      // current topic at order_index 3
      repo.getTopicByDayWeek.mockReturnValue(topics[2]!);

      const progress = service.getProgress(user);
      expect(progress.completedTopics).toBe(2); // topics with order_index < 3
      expect(progress.totalTopics).toBe(4);
      expect(progress.percentageComplete).toBe(50);
    });
  });

  describe('validateRoadmapIntegrity', () => {
    it('returns true for valid roadmap', () => {
      repo.getAllTopics.mockReturnValue([
        createMockTopic({ order_index: 1, week_number: 1, day_number: 1 }),
        createMockTopic({ order_index: 2, week_number: 1, day_number: 2 }),
        createMockTopic({ order_index: 3, week_number: 2, day_number: 1 }),
      ]);
      expect(service.validateRoadmapIntegrity()).toBe(true);
    });

    it('returns false for empty roadmap', () => {
      repo.getAllTopics.mockReturnValue([]);
      expect(service.validateRoadmapIntegrity()).toBe(false);
    });

    it('returns false for duplicate positions', () => {
      repo.getAllTopics.mockReturnValue([
        createMockTopic({ order_index: 1, week_number: 1, day_number: 1 }),
        createMockTopic({ order_index: 2, week_number: 1, day_number: 1 }),
      ]);
      expect(service.validateRoadmapIntegrity()).toBe(false);
    });

    it('returns false for non-contiguous order indexes', () => {
      repo.getAllTopics.mockReturnValue([
        createMockTopic({ order_index: 1, week_number: 1, day_number: 1 }),
        createMockTopic({ order_index: 3, week_number: 1, day_number: 2 }),
      ]);
      expect(service.validateRoadmapIntegrity()).toBe(false);
    });
  });
});
