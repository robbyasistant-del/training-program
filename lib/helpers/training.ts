// Helper functions for training calculations and formatting

/**
 * Format seconds into HH:MM:SS or MM:SS display
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format distance in meters to km with 2 decimal places
 */
export function formatDistance(meters: number): string {
  if (meters < 0) return '0.00 km';
  const km = meters / 1000;
  return `${km.toFixed(2)} km`;
}

/**
 * Calculate pace (min/km) from distance and time
 */
export function calculatePace(meters: number, seconds: number): string {
  if (meters <= 0 || seconds <= 0) return '--:-- /km';

  const km = meters / 1000;
  const paceSeconds = seconds / km;
  const minutes = Math.floor(paceSeconds / 60);
  const secs = Math.floor(paceSeconds % 60);

  return `${minutes}:${secs.toString().padStart(2, '0')} /km`;
}

/**
 * Calculate training stress score based on heart rate
 * Simplified TSS approximation
 */
export function calculateTSS(
  normalizedPowerOrPace: number,
  thresholdPowerOrPace: number,
  durationHours: number
): number {
  if (thresholdPowerOrPace <= 0 || durationHours <= 0) return 0;

  const intensityFactor = normalizedPowerOrPace / thresholdPowerOrPace;
  const tss = intensityFactor * intensityFactor * 100 * durationHours;

  return Math.round(tss);
}

/**
 * Get training zone based on heart rate percentage of max
 */
export function getHeartRateZone(heartRate: number, maxHeartRate: number): number {
  if (maxHeartRate <= 0 || heartRate <= 0) return 0;

  const percentage = (heartRate / maxHeartRate) * 100;

  if (percentage < 60) return 1; // Recovery
  if (percentage < 75) return 2; // Aerobic
  if (percentage < 85) return 3; // Tempo
  if (percentage < 95) return 4; // Threshold
  return 5; // VO2 Max / Anaerobic
}

/**
 * Format date to relative time (today, yesterday, or date)
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Validate if a training goal is achieved
 */
export function isGoalAchieved(
  currentValue: number,
  targetValue: number,
  isGreaterBetter = true
): boolean {
  if (isGreaterBetter) {
    return currentValue >= targetValue;
  }
  return currentValue <= targetValue;
}
