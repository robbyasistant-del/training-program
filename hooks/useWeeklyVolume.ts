import { useState, useEffect } from 'react';

interface WeeklyVolumeData {
  weekLabel: string;
  volume: number;
  isCurrentWeek: boolean;
  weekStartDate: string;
}

interface UseWeeklyVolumeReturn {
  data: WeeklyVolumeData[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook para obtener el volumen semanal de entrenamiento
 * @param athleteId - ID del atleta
 * @param unit - Unidad de medida ('km' | 'hours' | 'sessions')
 */
export function useWeeklyVolume(
  athleteId: string | null,
  unit: 'km' | 'hours' | 'sessions' = 'km'
): UseWeeklyVolumeReturn {
  const [data, setData] = useState<WeeklyVolumeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!athleteId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/dashboard/weekly-volume?athleteId=${athleteId}&unit=${unit}`
      );

      if (!response.ok) {
        throw new Error('Error al cargar volumen semanal');
      }

      const result = await response.json();
      setData(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [athleteId, unit]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
