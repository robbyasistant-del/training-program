/**
 * Tests for Personal Record Service
 */

import {
  detectStandardDistance,
  calculatePacePerKm,
  formatTime,
  formatPace,
} from '@/lib/personalRecords/prService';

describe('Personal Record Service', () => {
  describe('detectStandardDistance', () => {
    it('should detect 5K within tolerance', () => {
      // Exact 5K
      expect(detectStandardDistance(5000)).toEqual({
        label: '5K',
        targetMeters: 5000,
      });

      // Within 2% tolerance (4900-5100)
      expect(detectStandardDistance(4900)).toEqual({
        label: '5K',
        targetMeters: 5000,
      });
      expect(detectStandardDistance(5100)).toEqual({
        label: '5K',
        targetMeters: 5000,
      });

      // 5.05K should be detected as 5K (from test case)
      expect(detectStandardDistance(5050)).toEqual({
        label: '5K',
        targetMeters: 5000,
      });
    });

    it('should detect 10K within tolerance', () => {
      expect(detectStandardDistance(10000)).toEqual({
        label: '10K',
        targetMeters: 10000,
      });
      expect(detectStandardDistance(9800)).toEqual({
        label: '10K',
        targetMeters: 10000,
      });
      expect(detectStandardDistance(10200)).toEqual({
        label: '10K',
        targetMeters: 10000,
      });
    });

    it('should detect half marathon (21.097K)', () => {
      expect(detectStandardDistance(21097.5)).toEqual({
        label: 'HALF_MARATHON',
        targetMeters: 21097.5,
      });
      // 2% tolerance: min = 20675.55, max = 21519.45
      expect(detectStandardDistance(20676)).toEqual({
        label: 'HALF_MARATHON',
        targetMeters: 21097.5,
      });
      expect(detectStandardDistance(21519)).toEqual({
        label: 'HALF_MARATHON',
        targetMeters: 21097.5,
      });
    });

    it('should detect marathon (42.195K)', () => {
      expect(detectStandardDistance(42195)).toEqual({
        label: 'MARATHON',
        targetMeters: 42195,
      });
      // 2% tolerance: min = 41351.1, max = 43038.9
      expect(detectStandardDistance(41352)).toEqual({
        label: 'MARATHON',
        targetMeters: 42195,
      });
      expect(detectStandardDistance(43038)).toEqual({
        label: 'MARATHON',
        targetMeters: 42195,
      });
    });

    it('should return null for distances outside tolerance', () => {
      // 4.8K is outside 5K tolerance (4900 minimum)
      expect(detectStandardDistance(4800)).toBeNull();

      // 8K doesn't match any standard distance
      expect(detectStandardDistance(8000)).toBeNull();

      // Random distance
      expect(detectStandardDistance(12345)).toBeNull();
    });

    it('should handle edge cases', () => {
      expect(detectStandardDistance(0)).toBeNull();
      expect(detectStandardDistance(-100)).toBeNull();
      expect(detectStandardDistance(999999)).toBeNull();
    });
  });

  describe('calculatePacePerKm', () => {
    it('should calculate correct pace for 5K in 25:00', () => {
      // 25 minutes = 1500 seconds
      const pace = calculatePacePerKm(1500, 5000);
      expect(pace).toBe(300); // 5:00 per km
    });

    it('should calculate correct pace for 10K in 50:00', () => {
      // 50 minutes = 3000 seconds
      const pace = calculatePacePerKm(3000, 10000);
      expect(pace).toBe(300); // 5:00 per km
    });

    it('should handle sub-4:00 pace', () => {
      // 5K in 20:00 = 4:00/km
      const pace = calculatePacePerKm(1200, 5000);
      expect(pace).toBe(240); // 4:00 per km
    });

    it('should return 0 for invalid distance', () => {
      expect(calculatePacePerKm(1200, 0)).toBe(0);
      expect(calculatePacePerKm(1200, -100)).toBe(0);
    });
  });

  describe('formatTime', () => {
    it('should format time under 1 hour as MM:SS', () => {
      expect(formatTime(1500)).toBe('25:00');
      expect(formatTime(59)).toBe('0:59');
      expect(formatTime(3661)).toBe('1:01:01');
    });

    it('should format time over 1 hour as H:MM:SS', () => {
      expect(formatTime(3600)).toBe('1:00:00');
      expect(formatTime(3661)).toBe('1:01:01');
      expect(formatTime(7384)).toBe('2:03:04');
    });

    it('should handle edge cases', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(59)).toBe('0:59');
      expect(formatTime(60)).toBe('1:00');
    });
  });

  describe('formatPace', () => {
    it('should format pace as MM:SS', () => {
      expect(formatPace(300)).toBe('5:00');
      expect(formatPace(240)).toBe('4:00');
      expect(formatPace(345)).toBe('5:45');
    });

    it('should handle sub-4:00 paces', () => {
      expect(formatPace(180)).toBe('3:00');
      expect(formatPace(210)).toBe('3:30');
    });
  });
});

describe('PR Detection Integration', () => {
  it('should detect a 5K activity that matches PR criteria', () => {
    const activity = {
      id: 'activity-123',
      distance: 5050, // 5.05K - within 2% tolerance of 5K
      movingTime: 1350, // 22:30
      startDate: new Date('2024-01-15'),
    };

    const distance = detectStandardDistance(activity.distance);
    expect(distance).not.toBeNull();
    expect(distance?.label).toBe('5K');
  });

  it('should reject activity outside tolerance', () => {
    const activity = {
      id: 'activity-456',
      distance: 4800, // 4.8K - outside 2% tolerance of 5K
      movingTime: 1200,
      startDate: new Date('2024-01-15'),
    };

    const distance = detectStandardDistance(activity.distance);
    expect(distance).toBeNull();
  });
});
