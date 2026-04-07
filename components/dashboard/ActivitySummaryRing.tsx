'use client';

import { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from '@/types/activity';

interface ActivitySummaryRingProps {
  activities: Activity[];
  isLoading?: boolean;
}

export function ActivitySummaryRing({ activities, isLoading = false }: ActivitySummaryRingProps) {
  const [animatedStreak, setAnimatedStreak] = useState(0);

  // Calcular streak de semanas consecutivas con actividades
  const streak = calculateWeeklyStreak(activities);

  useEffect(() => {
    // Animar el streak al cargar
    if (!isLoading && streak > 0) {
      const timer = setTimeout(() => {
        setAnimatedStreak(streak);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, streak]);

  if (isLoading) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="flex justify-center">
          <Skeleton className="h-32 w-32 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  // Configuración del anillo
  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  // Máximo streak considerado (para el anillo completo)
  const maxStreak = 12;
  const progress = Math.min(animatedStreak / maxStreak, 1);
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <CardTitle className="text-center text-white">Racha Semanal</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg className="-rotate-90 transform" width={size} height={size}>
            {/* Fondo del anillo */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#27272a"
              strokeWidth={strokeWidth}
            />
            {/* Progreso del anillo */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#fc5200"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: 'stroke-dashoffset 1s ease-out',
              }}
            />
          </svg>

          {/* Contenido central */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-white">{animatedStreak}</span>
            <span className="text-xs text-zinc-500">
              {animatedStreak === 1 ? 'semana' : 'semanas'}
            </span>
          </div>
        </div>

        {/* Mensaje motivacional */}
        <p className="mt-4 text-center text-sm text-zinc-400">{getMotivationalMessage(streak)}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Calcula el streak de semanas consecutivas con actividades
 */
function calculateWeeklyStreak(activities: Activity[]): number {
  if (activities.length === 0) return 0;

  // Agrupar actividades por semana
  const weeksWithActivity = new Set<string>();

  activities.forEach((activity) => {
    const date = new Date(activity.startDate);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    weeksWithActivity.add(`${year}-${week}`);
  });

  // Ordenar semanas
  const sortedWeeks = Array.from(weeksWithActivity).sort();

  if (sortedWeeks.length === 0) return 0;

  // Contar streak desde la semana más reciente
  let streak = 0;
  const currentWeek = getWeekNumber(new Date());
  const currentYear = new Date().getFullYear();

  // Verificar si hay actividad esta semana
  const hasCurrentWeekActivity = sortedWeeks.includes(`${currentYear}-${currentWeek}`);

  if (hasCurrentWeekActivity) {
    streak = 1;

    // Contar semanas anteriores consecutivas
    let checkWeek = currentWeek - 1;
    let checkYear = currentYear;

    while (true) {
      // Ajustar año si es necesario
      if (checkWeek <= 0) {
        checkYear--;
        checkWeek = 52; // Aproximación simple
      }

      if (sortedWeeks.includes(`${checkYear}-${checkWeek}`)) {
        streak++;
        checkWeek--;
      } else {
        break;
      }
    }
  }

  return streak;
}

/**
 * Obtiene el número de semana del año
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Mensaje motivacional basado en el streak
 */
function getMotivationalMessage(streak: number): string {
  if (streak === 0) return '¡Comienza tu racha esta semana!';
  if (streak === 1) return '¡Primera semana! Sigue así.';
  if (streak < 4) return '¡Buen trabajo! Mantén el ritmo.';
  if (streak < 8) return '¡Increíble consistencia!';
  if (streak < 12) return '¡Eres una máquina!';
  return '¡Leyenda del entrenamiento!';
}
