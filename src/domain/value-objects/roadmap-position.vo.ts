export interface RoadmapPosition {
  weekNumber: number;
  dayNumber: number;
  orderIndex: number;
}

export interface TopicNode<T> {
  topic: T;
  position: RoadmapPosition;
  isFirst: boolean;
  isLast: boolean;
}

export interface CurriculumProgress {
  userId: string;
  currentPosition: RoadmapPosition;
  completedTopics: number;
  totalTopics: number;
  isComplete: boolean;
  percentageComplete: number;
}

export interface AdvanceResult {
  newDay: number;
  newWeek: number;
  isComplete: boolean;
}
