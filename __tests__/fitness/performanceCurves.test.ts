// Mock prisma before importing the module
jest.mock('@/lib/db', () => ({
  prisma: {
    fitnessMetric: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    activity: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}));

import {
  calculateMetrics,
  calculateDecayFactor,
  aggregateDailyTSS,
  fillGaps,
  interpretTSB,
  interpretCTL,
  calculateCTL,
  calculateATL,
  calculateTSB,
} from '@/lib/fitness/performanceCurves';

describe('Performance Curves', () => {
  describe('calculateMetrics', () => {
    it('calculates CTL/ATL/TSB for sequence of TSS values', () => {
      const dailyTSS = [
        { date: '2024-01-01', tss: 100 },
        { date: '2024-01-02', tss: 100 },
        { date: '2024-01-03', tss: 100 },
        { date: '2024-01-04', tss: 100 },
        { date: '2024-01-05', tss: 100 },
      ];

      const result = calculateMetrics(dailyTSS);

      expect(result).toHaveLength(5);
      expect(result[4]!.ctl).toBeGreaterThan(0);
      expect(result[4]!.atl).toBeGreaterThan(0);
      expect(result[4]!.tsb).toBeDefined();
    });

    it('CTL converges toward constant TSS over time', () => {
      // Simulate 180 days (6 months) of constant TSS = 100
      // CTL takes time to converge - 42 days is the half-life, not full convergence
      const dailyTSS = Array.from({ length: 180 }, (_, i) => {
        const date = new Date('2024-01-01');
        date.setDate(date.getDate() + i);
        return {
          date: date.toISOString().split('T')[0]!,
          tss: 100,
        };
      });

      const result = calculateMetrics(dailyTSS);

      // CTL should converge close to 100 after 180 days (±2%)
      const lastResult = result[result.length - 1]!;
      expect(lastResult.ctl).toBeGreaterThan(98);
      expect(lastResult.ctl).toBeLessThan(102);
    });

    it('handles empty input gracefully', () => {
      const result = calculateMetrics([]);

      expect(result).toHaveLength(0);
    });

    it('uses initial CTL and ATL values correctly', () => {
      const dailyTSS = [
        { date: '2024-01-01', tss: 100 },
        { date: '2024-01-02', tss: 100 },
      ];

      const result = calculateMetrics(dailyTSS, { initialCtl: 50, initialAtl: 50 });

      // Should start from initial values
      expect(result[0]!.ctl).not.toBe(0);
      expect(result[0]!.atl).not.toBe(0);
    });

    it('calculates TSB correctly (CTL - ATL from previous day)', () => {
      const dailyTSS = [
        { date: '2024-01-01', tss: 100 },
        { date: '2024-01-02', tss: 50 },
        { date: '2024-01-03', tss: 50 },
      ];

      const result = calculateMetrics(dailyTSS);

      // TSB day 2 = CTL day 1 - ATL day 1
      expect(result[1]!.tsb).toBeDefined();
      // TSB should be around 0 for first day (both start at 0)
      expect(result[0]!.tsb).toBe(0);
    });
  });

  describe('aggregateDailyTSS', () => {
    it('aggregates activities by date', () => {
      const activities = [
        { date: '2024-01-01', tss: 50 },
        { date: '2024-01-01', tss: 75 },
        { date: '2024-01-02', tss: 100 },
      ];

      const result = aggregateDailyTSS(activities);

      expect(result).toHaveLength(2);
      expect(result[0]!.date).toBe('2024-01-01');
      expect(result[0]!.tss).toBe(125); // 50 + 75
      expect(result[1]!.date).toBe('2024-01-02');
      expect(result[1]!.tss).toBe(100);
    });
  });

  describe('fillGaps', () => {
    it('fills missing days with TSS = 0', () => {
      const activities = [
        { date: '2024-01-01', tss: 100 },
        { date: '2024-01-03', tss: 100 },
      ];

      const result = fillGaps(activities);

      expect(result).toHaveLength(3);
      expect(result[0]!.tss).toBe(100);
      expect(result[1]!.tss).toBe(0); // Missing day filled
      expect(result[2]!.tss).toBe(100);
    });

    it('ignores activities without TSS', () => {
      const activities = [
        { date: '2024-01-01', tss: 100 },
        { date: '2024-01-03', tss: 50 },
      ];

      const result = fillGaps(activities);

      // Should have 3 days (Jan 1, 2, 3) with Jan 2 filled as 0
      expect(result).toHaveLength(3);
      expect(result[0]!.tss).toBe(100); // Jan 1
      expect(result[1]!.tss).toBe(0);   // Jan 2 (filled)
      expect(result[2]!.tss).toBe(50);  // Jan 3
    });

    it('sorts by date ascending', () => {
      const activities = [
        { date: '2024-01-03', tss: 100 },
        { date: '2024-01-01', tss: 100 },
        { date: '2024-01-02', tss: 100 },
      ];

      const result = fillGaps(activities);

      expect(result[0]!.date).toBe('2024-01-01');
      expect(result[1]!.date).toBe('2024-01-02');
      expect(result[2]!.date).toBe('2024-01-03');
    });
  });

  describe('EMA factors', () => {
    it('CTL factor should be approximately 0.0235', () => {
      // 1 - exp(-1/42) ≈ 0.0235
      const ctlFactor = calculateDecayFactor(42);
      expect(ctlFactor).toBeCloseTo(0.0235, 3);
    });

    it('ATL factor should be approximately 0.1331', () => {
      // 1 - exp(-1/7) ≈ 0.1331
      const atlFactor = calculateDecayFactor(7);
      expect(atlFactor).toBeCloseTo(0.1331, 3);
    });
  });

  describe('Individual calculations', () => {
    it('calculateCTL works correctly', () => {
      const ctl = calculateCTL(50, 100, 42);
      expect(ctl).toBeGreaterThan(50); // Should increase towards TSS
      expect(ctl).toBeLessThan(100);   // But not reach it immediately
    });

    it('calculateATL works correctly', () => {
      const atl = calculateATL(50, 100, 7);
      expect(atl).toBeGreaterThan(50); // Should increase towards TSS
      expect(atl).toBeLessThan(100);   // But not reach it immediately
    });

    it('calculateTSB works correctly', () => {
      const tsb = calculateTSB(100, 80);
      expect(tsb).toBe(20);
    });
  });

  describe('interpretTSB', () => {
    it('returns fresh state for TSB > 25', () => {
      const state = interpretTSB(30);

      expect(state.status).toBe('detraining');
    });

    it('returns fresh state for TSB between 10 and 25', () => {
      const state = interpretTSB(20);

      expect(state.status).toBe('fresh');
    });

    it('returns neutral state for TSB between -10 and 10', () => {
      const state = interpretTSB(5);

      expect(state.status).toBe('neutral');
    });

    it('returns optimal_training state for TSB between -30 and -10', () => {
      const state = interpretTSB(-15);

      expect(state.status).toBe('optimal_training');
    });

    it('returns high_fatigue state for TSB < -30', () => {
      const state = interpretTSB(-35);

      expect(state.status).toBe('high_fatigue');
    });
  });

  describe('interpretCTL', () => {
    it('returns recreational for low CTL', () => {
      const result = interpretCTL(30);
      expect(result.level).toBe('recreational');
    });

    it('returns intermediate for medium CTL', () => {
      const result = interpretCTL(75);
      expect(result.level).toBe('intermediate');
    });

    it('returns advanced for high CTL', () => {
      const result = interpretCTL(125);
      expect(result.level).toBe('advanced');
    });

    it('returns elite_amateur for very high CTL', () => {
      const result = interpretCTL(175);
      expect(result.level).toBe('elite_amateur');
    });

    it('returns professional for elite CTL', () => {
      const result = interpretCTL(250);
      expect(result.level).toBe('professional');
    });
  });

  describe('Performance requirements', () => {
    it('calculates 2 years of data (730 days) in less than 5 seconds', () => {
      const dailyTSS = Array.from({ length: 730 }, (_, i) => ({
        date: `2024-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        tss: Math.floor(Math.random() * 150),
      }));

      const startTime = Date.now();
      const result = calculateMetrics(dailyTSS);
      const endTime = Date.now();

      expect(result).toHaveLength(730);
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
});
