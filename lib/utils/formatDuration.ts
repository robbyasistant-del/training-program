export function formatDurationMinutes(minutes: number | string | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes === '' || minutes === 0) {
    return '--';
  }
  
  const numMinutes = typeof minutes === 'string' ? parseFloat(minutes) : minutes;
  
  if (isNaN(numMinutes) || numMinutes <= 0) {
    return '--';
  }
  
  const hours = Math.floor(numMinutes / 60);
  const mins = Math.round(numMinutes % 60);
  
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}
