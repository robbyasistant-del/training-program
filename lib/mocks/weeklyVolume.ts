/**
 * Datos mock para el gráfico de volumen semanal
 *
 * Simulan 8 semanas de datos de entrenamiento para desarrollo y testing.
 */

import { WeeklyVolumeData } from '@/components/charts/WeeklyVolumeChart';

/**
 * Genera datos de volumen semanal mock
 *
 * @param unit - Unidad de medida ('km', 'hours', 'sessions')
 * @returns Array de WeeklyVolumeData con 8 semanas
 */
export function generateMockWeeklyVolume(
  unit: 'km' | 'hours' | 'sessions' = 'km'
): WeeklyVolumeData[] {
  const now = new Date();
  const currentWeek = getWeekNumber(now);
  const currentYear = now.getFullYear();

  // Datos base según unidad
  const baseValues: Record<typeof unit, number[]> = {
    km: [45.2, 52.8, 38.5, 61.3, 55.7, 42.1, 58.9, 35.4],
    hours: [4.5, 5.2, 3.8, 6.1, 5.5, 4.2, 5.8, 3.5],
    sessions: [4, 5, 3, 6, 5, 4, 6, 3],
  };

  const values = baseValues[unit];

  return Array.from({ length: 8 }, (_, i) => {
    const weekOffset = 7 - i; // De la semana más antigua a la actual
    const weekNum = currentWeek - weekOffset;
    const year = weekNum <= 0 ? currentYear - 1 : currentYear;
    const adjustedWeek = weekNum <= 0 ? 52 + weekNum : weekNum;

    // Calcular fechas de la semana
    const weekStart = getDateOfISOWeek(adjustedWeek, year);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const monthNames = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];

    return {
      weekLabel: i === 7 ? 'Actual' : `S${adjustedWeek}`,
      volume: values[i] ?? 0,
      isCurrentWeek: i === 7,
      weekStartDate: `${weekStart.getDate()} ${monthNames[weekStart.getMonth()]} - ${weekEnd.getDate()} ${monthNames[weekEnd.getMonth()]}`,
    };
  });
}

/**
 * Datos mock predefinidos para diferentes escenarios
 */
export const mockWeeklyVolumeKm: WeeklyVolumeData[] = [
  { weekLabel: 'S10', volume: 45.2, isCurrentWeek: false, weekStartDate: '3 Mar - 9 Mar' },
  { weekLabel: 'S11', volume: 52.8, isCurrentWeek: false, weekStartDate: '10 Mar - 16 Mar' },
  { weekLabel: 'S12', volume: 38.5, isCurrentWeek: false, weekStartDate: '17 Mar - 23 Mar' },
  { weekLabel: 'S13', volume: 61.3, isCurrentWeek: false, weekStartDate: '24 Mar - 30 Mar' },
  { weekLabel: 'S14', volume: 55.7, isCurrentWeek: false, weekStartDate: '31 Mar - 6 Abr' },
  { weekLabel: 'S15', volume: 42.1, isCurrentWeek: false, weekStartDate: '7 Abr - 13 Abr' },
  { weekLabel: 'S16', volume: 58.9, isCurrentWeek: false, weekStartDate: '14 Abr - 20 Abr' },
  { weekLabel: 'Actual', volume: 35.4, isCurrentWeek: true, weekStartDate: '21 Abr - 27 Abr' },
];

export const mockWeeklyVolumeHours: WeeklyVolumeData[] = [
  { weekLabel: 'S10', volume: 4.5, isCurrentWeek: false },
  { weekLabel: 'S11', volume: 5.2, isCurrentWeek: false },
  { weekLabel: 'S12', volume: 3.8, isCurrentWeek: false },
  { weekLabel: 'S13', volume: 6.1, isCurrentWeek: false },
  { weekLabel: 'S14', volume: 5.5, isCurrentWeek: false },
  { weekLabel: 'S15', volume: 4.2, isCurrentWeek: false },
  { weekLabel: 'S16', volume: 5.8, isCurrentWeek: false },
  { weekLabel: 'Actual', volume: 3.5, isCurrentWeek: true },
];

export const mockWeeklyVolumeSessions: WeeklyVolumeData[] = [
  { weekLabel: 'S10', volume: 4, isCurrentWeek: false },
  { weekLabel: 'S11', volume: 5, isCurrentWeek: false },
  { weekLabel: 'S12', volume: 3, isCurrentWeek: false },
  { weekLabel: 'S13', volume: 6, isCurrentWeek: false },
  { weekLabel: 'S14', volume: 5, isCurrentWeek: false },
  { weekLabel: 'S15', volume: 4, isCurrentWeek: false },
  { weekLabel: 'S16', volume: 6, isCurrentWeek: false },
  { weekLabel: 'Actual', volume: 3, isCurrentWeek: true },
];

/**
 * Datos vacíos para testing de empty state
 */
export const mockWeeklyVolumeEmpty: WeeklyVolumeData[] = [];

/**
 * Datos de carga (simulando fetch)
 */
export const mockWeeklyVolumeLoading = {
  data: [] as WeeklyVolumeData[],
  loading: true,
};

/**
 * Helper para obtener el número de semana del año (ISO week)
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Helper para obtener la fecha de inicio de una semana ISO
 */
function getDateOfISOWeek(week: number, year: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  return ISOweekStart;
}
