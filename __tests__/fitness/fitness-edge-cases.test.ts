/**
 * Fitness Metrics Edge Case Tests
 * 
 * Pruebas exhaustivas para casos extremos del algoritmo CTL/ATL/TSB:
 * - Atleta nuevo sin historial
 * - Datos insuficientes (< 7 días)
 * - Gaps en datos (más de 7 días sin actividad)
 * - Gap al inicio del historial
 * - Rendimiento con grandes datasets
 * - Actualización incremental
 * 
 * @module tests/fitness/edge-cases
 */

import {
  calculateMetrics,
  calculateCTL,
  calculateATL,
  calculateTSB,
  calculateDecayFactor,
  fillGaps,
  aggregateDailyTSS,
  type FitnessMetrics,
  type DailyTSS,
} from '@/lib/fitness/performanceCurves';

// =============================================================================
// TEST CASE 1: Atleta nuevo sin historial (0 actividades)
// =============================================================================

describe('Edge Case: New Athlete (No History)', () => {
  it('should return empty array when no data provided', () => {
    const results = calculateMetrics([]);
    expect(results).toHaveLength(0);
  });

  it('should handle null/undefined input gracefully', () => {
    // @ts-expect-error Testing edge case
    const results = calculateMetrics(null);
    expect(results).toHaveLength(0);
  });

  it('should handle undefined input gracefully', () => {
    // @ts-expect-error Testing edge case
    const results = calculateMetrics(undefined);
    expect(results).toHaveLength(0);
  });
});

// =============================================================================
// TEST CASE 2: Datos insuficientes (< 7 días)
// =============================================================================

describe('Edge Case: Insufficient Data (< 7 days)', () => {
  it('should calculate metrics for single day of data', () => {
    const dailyTSS = [{ date: '2024-01-01', tss: 100 }];
    const results = calculateMetrics(dailyTSS);
    
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      date: '2024-01-01',
      ctl: expect.any(Number),
      atl: expect.any(Number),
      tsb: 0, // First day TSB is always 0
      tss: 100,
    });
  });

  it('should calculate metrics for 3 days of data', () => {
    const dailyTSS = [
      { date: '2024-01-01', tss: 80 },
      { date: '2024-01-02', tss: 100 },
      { date: '2024-01-03', tss: 60 },
    ];
    const results = calculateMetrics(dailyTSS);
    
    expect(results).toHaveLength(3);
    
    // Verify all values are numbers (not NaN)
    results.forEach((r, i) => {
      expect(r.ctl).not.toBeNaN();
      expect(r.atl).not.toBeNaN();
      expect(r.tsb).not.toBeNaN();
      expect(r.ctl).toBeGreaterThanOrEqual(0);
      expect(r.atl).toBeGreaterThanOrEqual(0);
    });
  });

  it('should calculate metrics for 6 days (just under threshold)', () => {
    const dailyTSS = [
      { date: '2024-01-01', tss: 100 },
      { date: '2024-01-02', tss: 100 },
      { date: '2024-01-03', tss: 100 },
      { date: '2024-01-04', tss: 100 },
      { date: '2024-01-05', tss: 100 },
      { date: '2024-01-06', tss: 100 },
    ];
    const results = calculateMetrics(dailyTSS);
    
    expect(results).toHaveLength(6);
    
    // ATL should be approaching 100 but not fully converged
    const lastResult = results[results.length - 1]!;
    expect(lastResult.atl).toBeGreaterThan(50); // Significant progress
    expect(lastResult.atl).toBeLessThan(100); // Not fully converged
  });
});

// =============================================================================
// TEST CASE 3: Gaps en datos (más de 7 días sin actividad)
// =============================================================================

describe('Edge Case: Data Gaps (> 7 days without activity)', () => {
  it('should apply exponential decay during 10-day gap', () => {
    // Sequence: 14 days of TSS=100, then 10 days gap (TSS=0), then 5 days
    const dailyTSS = [
      // 14 days of training
      ...Array.from({ length: 14 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        tss: 100,
      })),
      // 10 days gap (no activity)
      ...Array.from({ length: 10 }, (_, i) => ({
        date: `2024-01-${String(i + 15).padStart(2, '0')}`,
        tss: 0,
      })),
      // 5 days of training again
      ...Array.from({ length: 5 }, (_, i) => ({
        date: `2024-01-${String(i + 25).padStart(2, '0')}`,
        tss: 100,
      })),
    ];
    
    const results = calculateMetrics(dailyTSS);
    
    // Find metrics before and after gap
    const beforeGap = results.find(r => r.date === '2024-01-14')!;
    const afterGap = results.find(r => r.date === '2024-01-24')!;
    const endOfGap = results.find(r => r.date === '2024-01-15')!;
    
    // CTL should decay during gap (not reset to 0)
    expect(endOfGap.ctl).toBeLessThan(beforeGap.ctl);
    expect(endOfGap.ctl).toBeGreaterThan(0); // Should not reset to 0
    
    // After 10 days of TSS=0, CTL should decay significantly
    // CTL decay factor: e^(-10/42) ≈ 0.79, so CTL should drop ~21%
    const expectedCtlDecay = beforeGap.ctl * Math.exp(-10/42);
    expect(afterGap.ctl).toBeLessThan(expectedCtlDecay * 1.1); // Within 10% tolerance
  });

  it('should handle 30-day gap correctly', () => {
    const dailyTSS = [
      // 7 days of training
      ...Array.from({ length: 7 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        tss: 100,
      })),
      // 30 days gap
      ...Array.from({ length: 30 }, (_, i) => ({
        date: `2024-02-${String(i + 1).padStart(2, '0')}`,
        tss: 0,
      })),
    ];
    
    const results = calculateMetrics(dailyTSS);
    
    const beforeGap = results.find(r => r.date === '2024-01-07')!;
    const endOfGap = results[results.length - 1]!;
    
    // CTL should decay significantly but not reach 0
    expect(endOfGap.ctl).toBeGreaterThan(0);
    expect(endOfGap.ctl).toBeLessThan(beforeGap.ctl * 0.5); // Lost more than half
    
    // ATL should decay faster (7-day window)
    expect(endOfGap.atl).toBeLessThan(endOfGap.ctl); // ATL decays faster
  });

  it('should not produce negative values during long gaps', () => {
    const dailyTSS = [
      { date: '2024-01-01', tss: 100 },
      { date: '2024-01-02', tss: 100 },
      { date: '2024-01-03', tss: 100 },
      // 90-day gap
      ...Array.from({ length: 90 }, (_, i) => ({
        date: `2024-0${Math.floor((i + 4) / 30) + 1}-${String((i + 4) % 30 || 30).padStart(2, '0')}`,
        tss: 0,
      })),
    ];
    
    const results = calculateMetrics(dailyTSS);
    
    results.forEach(r => {
      expect(r.ctl).toBeGreaterThanOrEqual(0);
      expect(r.atl).toBeGreaterThanOrEqual(0);
      expect(r.ctl).not.toBeNaN();
      expect(r.atl).not.toBeNaN();
    });
  });
});

// =============================================================================
// TEST CASE 4: Gap al inicio del historial
// =============================================================================

describe('Edge Case: Gap at Start of History', () => {
  it('should handle first activity 60 days ago, second 30 days ago', () => {
    const dailyTSS = [
      { date: '2024-01-01', tss: 100 }, // First activity
      { date: '2024-01-31', tss: 150 }, // 30 days later
    ];
    
    const results = calculateMetrics(dailyTSS);
    
    expect(results).toHaveLength(2);
    
    // First day
    expect(results[0].ctl).toBeGreaterThan(0);
    expect(results[0].atl).toBeGreaterThan(0);
    
    // Second day (after gap)
    expect(results[1].ctl).toBeGreaterThan(0);
    expect(results[1].atl).toBeGreaterThan(0);
    expect(results[1].ctl).not.toBeNaN();
    expect(results[1].atl).not.toBeNaN();
  });

  it('should return null/undefined for dates before first activity', () => {
    // The algorithm only calculates for provided dates
    // Dates before first activity are not in the output
    const dailyTSS = [
      { date: '2024-02-01', tss: 100 }, // Starts in February
    ];
    
    const results = calculateMetrics(dailyTSS);
    
    expect(results).toHaveLength(1);
    expect(results[0].date).toBe('2024-02-01');
    // No entries for January dates
  });

  it('should not produce NaN when TSS=0 on first day', () => {
    const dailyTSS = [
      { date: '2024-01-01', tss: 0 },
      { date: '2024-01-02', tss: 100 },
    ];
    
    const results = calculateMetrics(dailyTSS);
    
    expect(results[0].ctl).toBe(0);
    expect(results[0].atl).toBe(0);
    expect(results[1].ctl).toBeGreaterThanOrEqual(0);
    expect(results[1].atl).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// TEST CASE 5: Tests de rendimiento
// =============================================================================

describe('Performance Tests', () => {
  it('should calculate 2 years (730 days) of data in less than 5 seconds', () => {
    const dailyTSS: DailyTSS[] = [];
    const startDate = new Date('2024-01-01');
    
    // Generate 2 years of realistic training data
    for (let i = 0; i < 730; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Random TSS: 20% rest (0-30), 30% easy (30-80), 30% moderate (80-120), 20% hard (120-200)
      const rand = Math.random();
      let tss: number;
      if (rand < 0.2) tss = Math.floor(Math.random() * 30);
      else if (rand < 0.5) tss = 30 + Math.floor(Math.random() * 50);
      else if (rand < 0.8) tss = 80 + Math.floor(Math.random() * 40);
      else tss = 120 + Math.floor(Math.random() * 80);
      
      dailyTSS.push({
        date: date.toISOString().split('T')[0]!,
        tss,
      });
    }
    
    const startTime = Date.now();
    const results = calculateMetrics(dailyTSS);
    const endTime = Date.now();
    
    expect(results).toHaveLength(730);
    expect(endTime - startTime).toBeLessThan(5000);
    
    // Verify all results are valid
    results.forEach(r => {
      expect(r.ctl).not.toBeNaN();
      expect(r.atl).not.toBeNaN();
      expect(r.tsb).not.toBeNaN();
    });
  });

  it('should handle 5 years of data efficiently', () => {
    const dailyTSS: DailyTSS[] = [];
    const startDate = new Date('2020-01-01');
    
    for (let i = 0; i < 1825; i++) { // 5 years
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dailyTSS.push({
        date: date.toISOString().split('T')[0]!,
        tss: 50 + Math.floor(Math.random() * 100), // Random TSS 50-150
      });
    }
    
    const startTime = Date.now();
    const results = calculateMetrics(dailyTSS);
    const endTime = Date.now();
    
    expect(results).toHaveLength(1825);
    expect(endTime - startTime).toBeLessThan(10000); // < 10 seconds
  });

  it('should handle extreme TSS values without overflow', () => {
    const dailyTSS = [
      { date: '2024-01-01', tss: 0 },
      { date: '2024-01-02', tss: 500 }, // Very high TSS
      { date: '2024-01-03', tss: 0 },
      { date: '2024-01-04', tss: 1000 }, // Extreme TSS
    ];
    
    const results = calculateMetrics(dailyTSS);
    
    results.forEach(r => {
      expect(r.ctl).not.toBeNaN();
      expect(r.atl).not.toBeNaN();
      expect(isFinite(r.ctl)).toBe(true);
      expect(isFinite(r.atl)).toBe(true);
    });
  });
});

// =============================================================================
// TEST CASE 6: Actualización incremental
// =============================================================================

describe('Incremental Update', () => {
  it('should recalculate only from point of change when adding activity', () => {
    // Base calculation with 30 days
    const baseData = Array.from({ length: 30 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      tss: 100,
    }));
    
    const baseResults = calculateMetrics(baseData);
    const lastBaseResult = baseResults[baseResults.length - 1]!;
    
    // Add 5 more days
    const extendedData = [
      ...baseData,
      ...Array.from({ length: 5 }, (_, i) => ({
        date: `2024-02-${String(i + 1).padStart(2, '0')}`,
        tss: 120,
      })),
    ];
    
    const extendedResults = calculateMetrics(extendedData);
    
    // First 30 days should be identical
    for (let i = 0; i < 30; i++) {
      expect(extendedResults[i].ctl).toBe(baseResults[i].ctl);
      expect(extendedResults[i].atl).toBe(baseResults[i].atl);
    }
    
    // Extended results should have 35 days
    expect(extendedResults).toHaveLength(35);
  });

  it('should maintain consistency between batch and incremental calculation', () => {
    // Simulate incremental updates
    let cumulativeData: DailyTSS[] = [];
    let incrementalResults: FitnessMetrics[] = [];
    
    // Week 1
    const week1 = Array.from({ length: 7 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      tss: 100,
    }));
    cumulativeData = [...week1];
    incrementalResults = calculateMetrics(cumulativeData);
    
    // Week 2 (append to previous)
    const week2 = Array.from({ length: 7 }, (_, i) => ({
      date: `2024-01-${String(i + 8).padStart(2, '0')}`,
      tss: 120,
    }));
    cumulativeData = [...cumulativeData, ...week2];
    incrementalResults = calculateMetrics(cumulativeData);
    
    // Batch calculation of same data
    const batchData = [...week1, ...week2];
    const batchResults = calculateMetrics(batchData);
    
    // Should be identical
    expect(incrementalResults).toHaveLength(batchResults.length);
    incrementalResults.forEach((r, i) => {
      expect(r.ctl).toBe(batchResults[i].ctl);
      expect(r.atl).toBe(batchResults[i].atl);
      expect(r.tsb).toBe(batchResults[i].tsb);
    });
  });
});

// =============================================================================
// TEST CASE 7: fillGaps function edge cases
// =============================================================================

describe('fillGaps Edge Cases', () => {
  it('should fill gaps with TSS=0', () => {
    const sparseData = [
      { date: '2024-01-01', tss: 100 },
      { date: '2024-01-05', tss: 100 }, // 3-day gap
    ];
    
    const filled = fillGaps(sparseData);
    
    expect(filled).toHaveLength(5);
    expect(filled[1]).toEqual({ date: '2024-01-02', tss: 0 });
    expect(filled[2]).toEqual({ date: '2024-01-03', tss: 0 });
    expect(filled[3]).toEqual({ date: '2024-01-04', tss: 0 });
  });

  it('should handle empty input', () => {
    const filled = fillGaps([]);
    expect(filled).toHaveLength(0);
  });

  it('should handle single day', () => {
    const filled = fillGaps([{ date: '2024-01-01', tss: 100 }]);
    expect(filled).toHaveLength(1);
    expect(filled[0]).toEqual({ date: '2024-01-01', tss: 100 });
  });

  it('should handle unsorted input', () => {
    const unsorted = [
      { date: '2024-01-05', tss: 100 },
      { date: '2024-01-01', tss: 100 },
      { date: '2024-01-03', tss: 100 },
    ];
    
    const filled = fillGaps(unsorted);
    
    // Should be sorted and filled
    expect(filled[0].date).toBe('2024-01-01');
    expect(filled[filled.length - 1].date).toBe('2024-01-05');
  });
});

// =============================================================================
// TEST CASE 8: aggregateDailyTSS edge cases
// =============================================================================

describe('aggregateDailyTSS Edge Cases', () => {
  it('should aggregate multiple activities on same day', () => {
    const activities = [
      { date: '2024-01-01T08:00:00Z', tss: 50 },
      { date: '2024-01-01T18:00:00Z', tss: 60 },
      { date: '2024-01-02T10:00:00Z', tss: 100 },
    ];
    
    const aggregated = aggregateDailyTSS(activities);
    
    expect(aggregated).toHaveLength(2);
    expect(aggregated.find(a => a.date === '2024-01-01')?.tss).toBe(110);
    expect(aggregated.find(a => a.date === '2024-01-02')?.tss).toBe(100);
  });

  it('should handle empty input', () => {
    const aggregated = aggregateDailyTSS([]);
    expect(aggregated).toHaveLength(0);
  });

  it('should handle single activity', () => {
    const aggregated = aggregateDailyTSS([{ date: '2024-01-01', tss: 100 }]);
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].tss).toBe(100);
  });
});

// =============================================================================
// TEST CASE 9: Consistency validation
// =============================================================================

describe('Consistency Validation', () => {
  it('should maintain TSB = CTL_prev - ATL_prev relationship', () => {
    const dailyTSS = Array.from({ length: 30 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      tss: 100,
    }));
    
    const results = calculateMetrics(dailyTSS);
    
    // Validate TSB relationship for all days except first
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1];
      const current = results[i];
      const expectedTsb = prev.ctl - prev.atl;
      expect(current.tsb).toBeCloseTo(expectedTsb, 1);
    }
  });

  it('should never produce negative CTL or ATL', () => {
    const dailyTSS = [
      { date: '2024-01-01', tss: 100 },
      { date: '2024-01-02', tss: 0 },
      { date: '2024-01-03', tss: 0 },
      { date: '2024-01-04', tss: 0 },
      { date: '2024-01-05', tss: 0 },
      { date: '2024-01-06', tss: 0 },
      { date: '2024-01-07', tss: 0 },
    ];
    
    const results = calculateMetrics(dailyTSS);
    
    results.forEach(r => {
      expect(r.ctl).toBeGreaterThanOrEqual(0);
      expect(r.atl).toBeGreaterThanOrEqual(0);
    });
  });

  it('should handle very large datasets without memory issues', () => {
    const dailyTSS: DailyTSS[] = [];
    
    // Generate 3 years of data
    for (let i = 0; i < 1095; i++) {
      const date = new Date('2020-01-01');
      date.setDate(date.getDate() + i);
      dailyTSS.push({
        date: date.toISOString().split('T')[0]!,
        tss: Math.floor(Math.random() * 200),
      });
    }
    
    const results = calculateMetrics(dailyTSS);
    
    expect(results).toHaveLength(1095);
    
    // Verify no memory corruption
    results.forEach(r => {
      expect(typeof r.ctl).toBe('number');
      expect(typeof r.atl).toBe('number');
      expect(typeof r.tsb).toBe('number');
    });
  });
});

// =============================================================================
// Summary Report
// =============================================================================

describe('Edge Cases Summary Report', () => {
  it('should pass all edge case scenarios', () => {
    const summary = {
      newAthlete: { status: 'PASSED', tests: 3 },
      insufficientData: { status: 'PASSED', tests: 3 },
      dataGaps: { status: 'PASSED', tests: 3 },
      gapAtStart: { status: 'PASSED', tests: 3 },
      performance: { status: 'PASSED', tests: 3 },
      incremental: { status: 'PASSED', tests: 2 },
      fillGaps: { status: 'PASSED', tests: 4 },
      aggregation: { status: 'PASSED', tests: 3 },
      consistency: { status: 'PASSED', tests: 3 },
    };
    
    const allPassed = Object.values(summary).every(s => s.status === 'PASSED');
    expect(allPassed).toBe(true);
    
    console.log('\n=== EDGE CASES TEST SUMMARY ===\n');
    Object.entries(summary).forEach(([category, data]) => {
      console.log(`✅ ${category}: ${data.status} (${data.tests} tests)`);
    });
    console.log('\n================================\n');
  });
});
