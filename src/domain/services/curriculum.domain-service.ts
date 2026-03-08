import { User } from '../entities/user.entity';
import { Topic } from '../entities/topic.entity';
import { IRepositoryPort } from '../ports/repository.port';
import {
  AdvanceResult,
  CurriculumProgress,
  RoadmapPosition,
  TopicNode,
} from '../value-objects/roadmap-position.vo';

export class CurriculumDomainService {
  private readonly roadmapId: string;

  constructor(
    private readonly repo: IRepositoryPort,
    roadmapId = 'neetcode',
  ) {
    this.roadmapId = roadmapId;
  }

  getCurrentTopic(user: User): Topic | null {
    return (
      this.repo.getTopicByDayWeek(
        user.current_day,
        user.current_week,
        this.roadmapId,
      ) ?? null
    );
  }

  getTopicAt(week: number, day: number): Topic | null {
    return this.repo.getTopicByDayWeek(day, week, this.roadmapId) ?? null;
  }

  getTopicNode(user: User): TopicNode<Topic> | null {
    const topic = this.getCurrentTopic(user);
    if (!topic) return null;

    const totalWeeks = this.repo.getTotalWeeks(this.roadmapId);
    const daysInCurrentWeek = this.repo.getDaysInWeek(
      user.current_week,
      this.roadmapId,
    );

    const isFirst = user.current_week === 1 && user.current_day === 1;
    const isLast =
      user.current_week === totalWeeks &&
      user.current_day === daysInCurrentWeek;

    const position: RoadmapPosition = {
      weekNumber: user.current_week,
      dayNumber: user.current_day,
      orderIndex: topic.order_index,
    };

    return { topic, position, isFirst, isLast };
  }

  computeNextPosition(user: User): RoadmapPosition | null {
    const totalWeeks = this.repo.getTotalWeeks(this.roadmapId);
    const daysInCurrentWeek = this.repo.getDaysInWeek(
      user.current_week,
      this.roadmapId,
    );

    if (user.current_day < daysInCurrentWeek) {
      const nextTopic = this.getTopicAt(
        user.current_week,
        user.current_day + 1,
      );
      if (!nextTopic) return null;
      return {
        weekNumber: user.current_week,
        dayNumber: user.current_day + 1,
        orderIndex: nextTopic.order_index,
      };
    }

    if (user.current_week < totalWeeks) {
      const nextTopic = this.getTopicAt(user.current_week + 1, 1);
      if (!nextTopic) return null;
      return {
        weekNumber: user.current_week + 1,
        dayNumber: 1,
        orderIndex: nextTopic.order_index,
      };
    }

    return null;
  }

  advanceUser(user: User): AdvanceResult {
    const next = this.computeNextPosition(user);

    if (!next) {
      return {
        newDay: user.current_day,
        newWeek: user.current_week,
        isComplete: true,
      };
    }

    this.repo.updateUserProgress(user.id, next.dayNumber, next.weekNumber);

    return {
      newDay: next.dayNumber,
      newWeek: next.weekNumber,
      isComplete: false,
    };
  }

  isComplete(user: User): boolean {
    return this.getCurrentTopic(user) === null;
  }

  getProgress(user: User): CurriculumProgress {
    const allTopics = this.repo.getAllTopics(this.roadmapId);
    const totalTopics = allTopics.length;

    const currentOrder = this.getCurrentTopic(user)?.order_index ?? Infinity;
    const completedTopics = allTopics.filter(
      (t) => t.order_index < currentOrder,
    ).length;

    const percentageComplete =
      totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    return {
      userId: user.id,
      currentPosition: {
        weekNumber: user.current_week,
        dayNumber: user.current_day,
        orderIndex: currentOrder === Infinity ? totalTopics + 1 : currentOrder,
      },
      completedTopics,
      totalTopics,
      isComplete: this.isComplete(user),
      percentageComplete,
    };
  }

  getTopicsByCategory(category: string): Topic[] {
    return this.repo
      .getAllTopics(this.roadmapId)
      .filter((t) => t.category === category)
      .sort((a, b) => a.order_index - b.order_index);
  }

  getTopicsForWeek(week: number): Topic[] {
    return this.repo.getTopicsForWeek(week, this.roadmapId);
  }

  validateRoadmapIntegrity(): boolean {
    const topics = this.repo
      .getAllTopics(this.roadmapId)
      .sort((a, b) => a.order_index - b.order_index);

    if (topics.length === 0) return false;

    const seen = new Set<string>();
    for (const topic of topics) {
      const key = `${topic.week_number}:${topic.day_number}`;
      if (seen.has(key)) {
        console.error(
          `[CurriculumDomainService] Duplicate position: week=${topic.week_number} day=${topic.day_number}`,
        );
        return false;
      }
      seen.add(key);
    }

    for (let i = 0; i < topics.length; i++) {
      if (topics[i]!.order_index !== i + 1) {
        console.error(
          `[CurriculumDomainService] Non-contiguous order_index at position ${i}: expected ${i + 1}, got ${topics[i]!.order_index}`,
        );
        return false;
      }
    }

    return true;
  }
}
