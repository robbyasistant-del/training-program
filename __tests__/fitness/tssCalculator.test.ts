import {
  calculateCyclingTSS,
  calculateRunningTSS,
  calculateSwimmingTSS,
  calculateHeartRateTSS,
  estimateTSS,
  calculateNormalizedPower,
  calculateIntensityFactor,
  calculateTSS,
} from '@/lib/fitness/tssCalculator';

describe('TSS Calculator', () => {
  describe('calculateCyclingTSS', () => {
    it('calculates TSS correctly for cycling with power data', () => {
      const result = calculateCyclingTSS({
        durationSeconds: 3600, // 1 hour
        normalizedPower: 200,
        ftp: 250,
      });

      // IF = 200/250 = 0.8
      // TSS = (3600 * 200 * 0.8) / (250 * 3600) * 100 = 64
      expect(result.tss).toBeCloseTo(64, 0);
      expect(result.method).toBe('power');
      expect(result.intensityFactor).toBe(0.8);
    });

    it('estimates TSS when power data is missing', () => {
      const result = calculateCyclingTSS({
        durationSeconds: 3600,
        normalizedPower: undefined,
        ftp: undefined,
      });

      expect(result.method).toBe('estimated');
      expect(result.tss).toBeGreaterThan(0);
    });

    it('handles zero FTP gracefully', () => {
      const result = calculateCyclingTSS({
        durationSeconds: 3600,
        normalizedPower: 200,
        ftp: 0,
      });

      expect(result.method).toBe('estimated');
    });
  });

  describe('calculateRunningTSS', () => {
    it('calculates TSS correctly for running with pace data', () => {
      const result = calculateRunningTSS({
        durationSeconds: 3600, // 1 hour
        thresholdPace: 5, // 5 min/km
        averageSpeed: 3.33, // ~3:00 min/km, faster than threshold
      });

      expect(result.method).toBe('pace');
      expect(result.intensityFactor).toBeGreaterThanOrEqual(1);
      expect(result.tss).toBeGreaterThan(0);
    });

    it('estimates TSS when pace data is missing', () => {
      const result = calculateRunningTSS({
        durationSeconds: 3600,
        thresholdPace: undefined,
        averageSpeed: undefined,
      });

      expect(result.method).toBe('estimated');
      expect(result.tss).toBeCloseTo(95, 0); // ~95 TSS/hour for running
    });
  });

  describe('calculateSwimmingTSS', () => {
    it('calculates TSS correctly for swimming with distance', () => {
      const result = calculateSwimmingTSS({
        durationSeconds: 3600, // 1 hour
        distance: 3000, // 3km
      });

      expect(result.method).toBe('pace');
      expect(result.tss).toBeGreaterThan(0);
    });
  });

  describe('calculateHeartRateTSS', () => {
    it('calculates TSS correctly with heart rate data', () => {
      const result = calculateHeartRateTSS({
        durationSeconds: 3600, // 1 hour
        heartRate: 150,
        maxHeartRate: 190,
        restingHeartRate: 60,
      });

      expect(result.method).toBe('heart_rate');
      expect(result.tss).toBeGreaterThan(0);
    });

    it('estimates TSS when heart rate data is missing', () => {
      const result = calculateHeartRateTSS({
        durationSeconds: 3600,
        heartRate: undefined,
        maxHeartRate: undefined,
        restingHeartRate: undefined,
      });

      expect(result.method).toBe('estimated');
    });
  });

  describe('estimateTSS', () => {
    it('returns correct estimate for cycling', () => {
      const result = estimateTSS(3600, 'RIDE');
      expect(result.tss).toBeCloseTo(75, 0);
      expect(result.method).toBe('estimated');
    });

    it('returns correct estimate for running', () => {
      const result = estimateTSS(3600, 'RUN');
      expect(result.tss).toBeCloseTo(95, 0);
    });

    it('returns correct estimate for swimming', () => {
      const result = estimateTSS(3600, 'SWIM');
      expect(result.tss).toBeCloseTo(85, 0);
    });

    it('uses default factor for unknown activity type', () => {
      const result = estimateTSS(3600, 'UNKNOWN');
      expect(result.tss).toBeCloseTo(60, 0);
    });
  });

  describe('calculateNormalizedPower', () => {
    it('calculates NP correctly from power data', () => {
      const powerData = [150, 200, 250, 200, 150];
      const np = calculateNormalizedPower(powerData);
      expect(np).toBeGreaterThan(0);
    });

    it('returns null for empty power data', () => {
      const np = calculateNormalizedPower([]);
      expect(np).toBeNull();
    });
  });

  describe('calculateIntensityFactor', () => {
    it('calculates IF correctly', () => {
      const if_ = calculateIntensityFactor(200, 250);
      expect(if_).toBe(0.8);
    });

    it('returns 0 for zero FTP', () => {
      const if_ = calculateIntensityFactor(200, 0);
      expect(if_).toBe(0);
    });
  });

  describe('calculateTSS', () => {
    it('uses correct calculator for RIDE activities', () => {
      const result = calculateTSS('RIDE', {
        durationSeconds: 3600,
        normalizedPower: 200,
        ftp: 250,
      });

      expect(result.method).toBe('power');
    });

    it('uses correct calculator for RUN activities', () => {
      const result = calculateTSS('RUN', {
        durationSeconds: 3600,
        thresholdPace: 5,
        averageSpeed: 3.33,
      });

      expect(result.method).toBe('pace');
    });

    it('uses correct calculator for SWIM activities', () => {
      const result = calculateTSS('SWIM', {
        durationSeconds: 3600,
        distance: 3000,
      });

      expect(result.method).toBe('pace');
    });

    it('falls back to heart rate for unknown activities with HR data', () => {
      const result = calculateTSS('UNKNOWN' as any, {
        durationSeconds: 3600,
        heartRate: 150,
        maxHeartRate: 190,
        restingHeartRate: 60,
      });

      expect(result.method).toBe('heart_rate');
    });

    it('falls back to estimation for unknown activities without HR data', () => {
      const result = calculateTSS('UNKNOWN' as any, {
        durationSeconds: 3600,
      });

      expect(result.method).toBe('estimated');
    });
  });
});
