import { Repository, Topic, User } from '../../db/repository';
import {
  AdvanceResult,
  CurriculumProgress,
  RoadmapPosition,
  TopicNode,
} from './types';

/**
 * CurriculumEngine — the "brain" of the DSA learning system.
 *
 * Responsibilities:
 *  - Enforcing strict NeetCode roadmap ordering (no random topic selection)
 *  - Determining a user's current and next topic deterministically
 *  - Advancing the user through the roadmap after each rated session
 *  - Exposing curriculum progress and completion state
 *  - Validating roadmap integrity (no gaps, no duplicates)
 *
 * This module is completely decoupled from delivery channels and AI generation.
 * It receives a Repository for DB access and a roadmapId to support future
 * multi-roadmap scenarios.
 */
export class CurriculumEngine {
  private readonly roadmapId: string;

  constructor(
    private readonly repo: Repository,
    roadmapId = 'neetcode',
  ) {
    this.roadmapId = roadmapId;
  }

  // ── Topic Resolution ────────────────────────────────────────────────────────

  /**
   * Returns the topic the user is currently assigned to, or null if the
   * roadmap is complete.
   *
   * Never returns a random topic — always resolves by (week, day) stored on
   * the user record.
   */
  getCurrentTopic(user: User): Topic | null {
    return (
      this.repo.getTopicByDayWeek(
        user.current_day,
        user.current_week,
        this.roadmapId,
      ) ?? null
    );
  }

  /**
   * Returns the topic at a specific roadmap position, or null if none exists.
   */
  getTopicAt(week: number, day: number): Topic | null {
    return (
      this.repo.getTopicByDayWeek(day, week, this.roadmapId) ?? null
    );
  }

  /**
   * Returns a TopicNode that includes first/last metadata alongside the topic,
   * giving callers full sequence context without knowing DB internals.
   */
  getTopicNode(user: User): TopicNode | null {
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

  // ── Progression ─────────────────────────────────────────────────────────────

  /**
   * Computes the next (week, day) pair after the user's current position
   * without mutating any state.
   *
   * Returns null when the user is at the last topic (roadmap complete).
   */
  computeNextPosition(user: User): RoadmapPosition | null {
    const totalWeeks = this.repo.getTotalWeeks(this.roadmapId);
    const daysInCurrentWeek = this.repo.getDaysInWeek(
      user.current_week,
      this.roadmapId,
    );

    if (user.current_day < daysInCurrentWeek) {
      // Move to next day in the same week
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
      // Move to day 1 of the next week
      const nextTopic = this.getTopicAt(user.current_week + 1, 1);
      if (!nextTopic) return null;
      return {
        weekNumber: user.current_week + 1,
        dayNumber: 1,
        orderIndex: nextTopic.order_index,
      };
    }

    // User is at the final topic
    return null;
  }

  /**
   * Advances the user to the next topic in the roadmap and persists the new
   * position in the database.
   *
   * Call this after the user has rated a completed session. The curriculum
   * engine itself does NOT score or weight the advancement — that remains the
   * responsibility of the ProgressService / SpacedRepetition module.
   */
  advanceUser(user: User): AdvanceResult {
    const next = this.computeNextPosition(user);

    if (!next) {
      // Already at the end — do not advance beyond last topic
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

  // ── Completion State ────────────────────────────────────────────────────────

  /**
   * Returns true when the user has no further topics — i.e. they are past
   * the last available (week, day) slot in the roadmap.
   */
  isComplete(user: User): boolean {
    return this.getCurrentTopic(user) === null;
  }

  // ── Progress Summary ────────────────────────────────────────────────────────

  /**
   * Builds a CurriculumProgress snapshot for a user.
   * Counts all topics in the roadmap and how many the user has completed.
   */
  getProgress(user: User): CurriculumProgress {
    const allTopics = this.repo.getAllTopics(this.roadmapId);
    const totalTopics = allTopics.length;

    // A topic is "completed" when the user's position has moved past it
    const currentOrder = this.getCurrentTopic(user)?.order_index ?? Infinity;
    const completedTopics = allTopics.filter(
      (t) => t.order_index < currentOrder,
    ).length;

    const percentageComplete =
      totalTopics > 0
        ? Math.round((completedTopics / totalTopics) * 100)
        : 0;

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

  // ── Category & Filtering ────────────────────────────────────────────────────

  /**
   * Returns all topics belonging to a specific category (e.g. "Arrays & Hashing"),
   * ordered by their roadmap sequence.
   *
   * Used by the ProblemFetcherService to match problems to the correct topic tag.
   */
  getTopicsByCategory(category: string): Topic[] {
    return this.repo
      .getAllTopics(this.roadmapId)
      .filter((t) => t.category === category)
      .sort((a, b) => a.order_index - b.order_index);
  }

  /**
   * Returns all topics for a given week, ordered by day.
   */
  getTopicsForWeek(week: number): Topic[] {
    return this.repo.getTopicsForWeek(week, this.roadmapId);
  }

  // ── Roadmap Integrity ───────────────────────────────────────────────────────

  /**
   * Validates that the seeded roadmap has no gaps or duplicate positions.
   * Intended for startup checks and seeder tests — not called in hot paths.
   *
   * Returns true when the roadmap is valid.
   */
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
          `[CurriculumEngine] Duplicate position detected: week=${topic.week_number} day=${topic.day_number}`,
        );
        return false;
      }
      seen.add(key);
    }

    // Ensure order_index values are contiguous (1-based)
    for (let i = 0; i < topics.length; i++) {
      if (topics[i].order_index !== i + 1) {
        console.error(
          `[CurriculumEngine] Non-contiguous order_index at position ${i}: ` +
            `expected ${i + 1}, got ${topics[i].order_index}`,
        );
        return false;
      }
    }

    return true;
  }
}
