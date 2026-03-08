/**
 * SM-2 spaced repetition algorithm as a pure value object.
 * quality: 0–5 (0 = blackout, 5 = perfect recall)
 */

export interface SpacedRepetitionState {
  intervalDays: number;
  easeFactor: number;
  repetitionCount: number;
}

export interface NextInterval {
  intervalDays: number;
  easeFactor: number;
  repetitionCount: number;
  nextReviewDate: string;
}

export const SpacedRepetitionVO = {
  computeNextInterval(
    quality: number,
    state?: SpacedRepetitionState,
  ): NextInterval {
    let interval: number;
    let easeFactor: number;
    let repetitionCount: number;

    if (!state) {
      interval = 1;
      easeFactor = 2.5;
      repetitionCount = 1;
    } else {
      easeFactor = Math.max(
        1.3,
        state.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
      );
      repetitionCount = state.repetitionCount + 1;

      if (quality < 3) {
        interval = 1;
      } else if (repetitionCount === 1) {
        interval = 1;
      } else if (repetitionCount === 2) {
        interval = 6;
      } else {
        interval = Math.round(state.intervalDays * easeFactor);
      }
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);
    const nextReviewDate = nextReview.toISOString().split('T')[0] as string;

    return {
      intervalDays: interval,
      easeFactor,
      repetitionCount,
      nextReviewDate,
    };
  },
};
