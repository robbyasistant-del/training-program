import {
  formatDuration,
  formatDistance,
  calculatePace,
  calculateTSS,
  getHeartRateZone,
  formatRelativeDate,
  isGoalAchieved,
} from '@/lib/helpers/training';

describe('formatDuration', () => {
  it('should format seconds to MM:SS', () => {
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3600)).toBe('01:00:00');
    expect(formatDuration(3661)).toBe('01:01:01');
  });

  it('should handle zero seconds', () => {
    expect(formatDuration(0)).toBe('00:00');
  });

  it('should handle negative values', () => {
    expect(formatDuration(-10)).toBe('00:00');
  });

  it('should format large durations', () => {
    expect(formatDuration(7200)).toBe('02:00:00');
  });
});

describe('formatDistance', () => {
  it('should format meters to km', () => {
    expect(formatDistance(1000)).toBe('1.00 km');
    expect(formatDistance(5500)).toBe('5.50 km');
    expect(formatDistance(12345)).toBe('12.35 km');
  });

  it('should handle zero distance', () => {
    expect(formatDistance(0)).toBe('0.00 km');
  });

  it('should handle negative values', () => {
    expect(formatDistance(-1000)).toBe('0.00 km');
  });
});

describe('calculatePace', () => {
  it('should calculate pace correctly', () => {
    // 5km in 25 minutes = 5:00 /km
    expect(calculatePace(5000, 1500)).toBe('5:00 /km');
    // 10km in 50 minutes = 5:00 /km
    expect(calculatePace(10000, 3000)).toBe('5:00 /km');
  });

  it('should handle zero or negative inputs', () => {
    expect(calculatePace(0, 1000)).toBe('--:-- /km');
    expect(calculatePace(1000, 0)).toBe('--:-- /km');
    expect(calculatePace(-1000, 1000)).toBe('--:-- /km');
  });

  it('should format pace with leading zeros', () => {
    // 5km in 20 minutes 30 seconds = 4:06 /km
    expect(calculatePace(5000, 1230)).toBe('4:06 /km');
  });
});

describe('calculateTSS', () => {
  it('should calculate TSS correctly', () => {
    // IF = 200/200 = 1, TSS = 1 * 1 * 100 * 1 = 100
    expect(calculateTSS(200, 200, 1)).toBe(100);
    // IF = 150/200 = 0.75, TSS = 0.75^2 * 100 * 2 = 112.5 ≈ 113
    expect(calculateTSS(150, 200, 2)).toBe(113);
  });

  it('should handle zero or negative inputs', () => {
    expect(calculateTSS(200, 0, 1)).toBe(0);
    expect(calculateTSS(200, 200, 0)).toBe(0);
    expect(calculateTSS(200, -100, 1)).toBe(0);
  });
});

describe('getHeartRateZone', () => {
  it('should return correct zones', () => {
    const maxHR = 200;
    expect(getHeartRateZone(100, maxHR)).toBe(1); // 50% - Recovery
    expect(getHeartRateZone(130, maxHR)).toBe(2); // 65% - Aerobic
    expect(getHeartRateZone(160, maxHR)).toBe(3); // 80% - Tempo
    expect(getHeartRateZone(185, maxHR)).toBe(4); // 92.5% - Threshold
    expect(getHeartRateZone(195, maxHR)).toBe(5); // 97.5% - VO2 Max
  });

  it('should handle edge cases', () => {
    expect(getHeartRateZone(0, 200)).toBe(0);
    expect(getHeartRateZone(100, 0)).toBe(0);
    expect(getHeartRateZone(120, 200)).toBe(2); // Exactly 60%
  });
});

describe('formatRelativeDate', () => {
  it('should format today correctly', () => {
    const today = new Date();
    expect(formatRelativeDate(today)).toBe('Today');
  });

  it('should format yesterday correctly', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatRelativeDate(yesterday)).toBe('Yesterday');
  });

  it('should format within last week', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    expect(formatRelativeDate(threeDaysAgo)).toBe('3 days ago');
  });

  it('should format older dates', () => {
    const oldDate = new Date('2024-01-15');
    const result = formatRelativeDate(oldDate);
    // Should return formatted date like "Jan 15"
    expect(result).toContain('15');
  });
});

describe('isGoalAchieved', () => {
  it('should return true when goal is achieved (greater is better)', () => {
    expect(isGoalAchieved(100, 100, true)).toBe(true);
    expect(isGoalAchieved(150, 100, true)).toBe(true);
  });

  it('should return false when goal is not achieved (greater is better)', () => {
    expect(isGoalAchieved(50, 100, true)).toBe(false);
  });

  it('should return true when goal is achieved (lesser is better)', () => {
    expect(isGoalAchieved(80, 100, false)).toBe(true);
    expect(isGoalAchieved(100, 100, false)).toBe(true);
  });

  it('should return false when goal is not achieved (lesser is better)', () => {
    expect(isGoalAchieved(120, 100, false)).toBe(false);
  });
});
