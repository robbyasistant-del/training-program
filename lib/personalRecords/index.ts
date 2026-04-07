/**
 * Personal Records Module - Index
 */

// Standard Distance PRs
export {
  STANDARD_DISTANCES,
  PR_EVENTS,
  type StandardDistanceLabel,
  type PersonalRecord,
  type PRDetectionResult,
  type PRActivityData,
  type FormattedPersonalRecord,
  type PRHistoryEntry,
  type PREventType,
  type PREventPayload,
} from '@/types/personalRecord';

export {
  detectStandardDistance,
  calculatePacePerKm,
  formatTime,
  formatPace,
  formatPersonalRecord,
  detectPersonalRecord,
  getCurrentPersonalRecords,
  getPersonalRecordHistory,
  processBatchForPRs,
  previewPersonalRecord,
} from './prService';

export {
  onPREvent,
  emitPREvent,
  clearPREventListeners,
  getPREventListenerCount,
} from './prEventEmitter';

// Metric-based PRs
export {
  MetricType,
  ActivityType,
  METRIC_CONFIGS,
  METRIC_PR_EVENTS,
  type MetricPR,
  type MetricPRWithActivity,
  type MetricPRActivityData,
  type MetricPRDetectionResult,
  type FormattedMetricPR,
  type MetricConfig,
  type MetricPREventType,
  type MetricPREventPayload,
  type PRNotification,
  type PRNotificationWithRecord,
} from '@/types/metricPR';

export {
  calculatePace,
  isBetterValue,
  calculateImprovementPercent,
  extractMetricValue,
  isMetricPR,
  detectMetricPRs,
  getCurrentMetricPRs,
  getMetricPRHistory,
  formatMetricPR,
  processBatchForMetricPRs,
  createPRNotification,
  getUnreadPRNotifications,
  markNotificationsAsSeen,
  onMetricPREvent,
} from './metricPRService';
