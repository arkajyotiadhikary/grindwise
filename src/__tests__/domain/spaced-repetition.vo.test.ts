import { SpacedRepetitionVO } from '@grindwise/domain/value-objects/spaced-repetition.vo';

describe('SpacedRepetitionVO', () => {
  describe('computeNextInterval — first review (no prior state)', () => {
    it('returns interval=1, easeFactor=2.5, repetitionCount=1', () => {
      const result = SpacedRepetitionVO.computeNextInterval(5);
      expect(result.intervalDays).toBe(1);
      expect(result.easeFactor).toBe(2.5);
      expect(result.repetitionCount).toBe(1);
      expect(result.nextReviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('ignores quality value on first review (always same initial state)', () => {
      const resultHigh = SpacedRepetitionVO.computeNextInterval(5);
      const resultLow = SpacedRepetitionVO.computeNextInterval(0);
      expect(resultHigh.intervalDays).toBe(resultLow.intervalDays);
      expect(resultHigh.easeFactor).toBe(resultLow.easeFactor);
    });
  });

  describe('computeNextInterval — with prior state', () => {
    const baseState = {
      intervalDays: 6,
      easeFactor: 2.5,
      repetitionCount: 2,
    };

    it('quality=5 (perfect) extends interval using ease factor', () => {
      const result = SpacedRepetitionVO.computeNextInterval(5, baseState);
      expect(result.intervalDays).toBe(Math.round(6 * result.easeFactor));
      expect(result.easeFactor).toBeGreaterThanOrEqual(2.5);
      expect(result.repetitionCount).toBe(3);
    });

    it('quality=0 (blackout) resets interval to 1', () => {
      const result = SpacedRepetitionVO.computeNextInterval(0, baseState);
      expect(result.intervalDays).toBe(1);
      expect(result.repetitionCount).toBe(3);
    });

    it('quality=2 (poor) resets interval to 1', () => {
      const result = SpacedRepetitionVO.computeNextInterval(2, baseState);
      expect(result.intervalDays).toBe(1);
    });

    it('quality=3 (okay) extends interval', () => {
      const result = SpacedRepetitionVO.computeNextInterval(3, baseState);
      expect(result.intervalDays).toBeGreaterThan(1);
    });

    it('ease factor never drops below 1.3', () => {
      let state = { intervalDays: 1, easeFactor: 1.4, repetitionCount: 1 };
      for (let i = 0; i < 10; i++) {
        const result = SpacedRepetitionVO.computeNextInterval(0, state);
        expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
        state = {
          intervalDays: result.intervalDays,
          easeFactor: result.easeFactor,
          repetitionCount: result.repetitionCount,
        };
      }
    });

    it('repetition=1 with state returns interval=1', () => {
      const state = { intervalDays: 1, easeFactor: 2.5, repetitionCount: 0 };
      const result = SpacedRepetitionVO.computeNextInterval(5, state);
      expect(result.repetitionCount).toBe(1);
      expect(result.intervalDays).toBe(1);
    });

    it('repetition=2 returns interval=6', () => {
      const state = { intervalDays: 1, easeFactor: 2.5, repetitionCount: 1 };
      const result = SpacedRepetitionVO.computeNextInterval(5, state);
      expect(result.repetitionCount).toBe(2);
      expect(result.intervalDays).toBe(6);
    });

    it('nextReviewDate is in the future', () => {
      const result = SpacedRepetitionVO.computeNextInterval(5, baseState);
      const reviewDate = new Date(result.nextReviewDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expect(reviewDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
    });
  });
});
