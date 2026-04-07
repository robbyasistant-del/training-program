'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  LucideIcon,
  Activity,
  Bike,
  Dumbbell,
  Mountain,
  PersonStanding,
  Waves,
  Zap,
  Heart,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity as ActivityType } from '@/types/activity';

/**
 * Props para el componente ActivityCard
 */
interface ActivityCardProps {
  /** Actividad a mostrar */
  activity: ActivityType;
  /** Índice para animación escalonada (opcional) */
  index?: number;
  /** Variante de visualización */
  variant?: 'default' | 'compact' | 'detailed';
  /** Callback al hacer click en la tarjeta */
  onClick?: ((activity: ActivityType) => void) | undefined;
  /** Clase CSS adicional */
  className?: string;
}

/**
 * Mapa de iconos por tipo de actividad
 */
const activityIcons: Record<string, LucideIcon> = {
  Run: Activity,
  Ride: Bike,
  Swim: Waves,
  Hike: Mountain,
  Walk: PersonStanding,
  AlpineSki: Mountain,
  BackcountrySki: Mountain,
  NordicSki: Mountain,
  RollerSki: Mountain,
  Snowboard: Mountain,
  WeightTraining: Dumbbell,
  Workout: Dumbbell,
  Crossfit: Zap,
};

/**
 * Mapa de colores por tipo de actividad (estilo Strava)
 */
const activityColors: Record<string, { bg: string; text: string; border: string; badge: string }> =
  {
    Run: {
      bg: 'bg-orange-500/10',
      text: 'text-orange-500',
      border: 'border-orange-500/20',
      badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    },
    Ride: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-500',
      border: 'border-blue-500/20',
      badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    },
    Swim: {
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-500',
      border: 'border-cyan-500/20',
      badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    },
    Hike: {
      bg: 'bg-green-500/10',
      text: 'text-green-500',
      border: 'border-green-500/20',
      badge: 'bg-green-500/20 text-green-400 border-green-500/30',
    },
    Walk: {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-500',
      border: 'border-yellow-500/20',
      badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    },
    AlpineSki: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-500',
      border: 'border-purple-500/20',
      badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    },
    BackcountrySki: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-500',
      border: 'border-purple-500/20',
      badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    },
    NordicSki: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-500',
      border: 'border-purple-500/20',
      badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    },
    RollerSki: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-500',
      border: 'border-purple-500/20',
      badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    },
    Snowboard: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-500',
      border: 'border-purple-500/20',
      badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    },
    WeightTraining: {
      bg: 'bg-red-500/10',
      text: 'text-red-500',
      border: 'border-red-500/20',
      badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    },
    Workout: {
      bg: 'bg-red-500/10',
      text: 'text-red-500',
      border: 'border-red-500/20',
      badge: 'bg-red-500/20 text-red-400 border-red-500/30',
    },
    Crossfit: {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-500',
      border: 'border-yellow-500/20',
      badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    },
  };

/**
 * Labels en español para tipos de actividad
 */
const activityLabels: Record<string, string> = {
  Run: 'Correr',
  Ride: 'Ciclismo',
  Swim: 'Natación',
  Hike: 'Senderismo',
  Walk: 'Caminar',
  AlpineSki: 'Esquí Alpino',
  BackcountrySki: 'Esquí Backcountry',
  NordicSki: 'Esquí Nórdico',
  RollerSki: 'Esquí Roller',
  Snowboard: 'Snowboard',
  WeightTraining: 'Entrenamiento',
  Workout: 'Entrenamiento',
  Crossfit: 'CrossFit',
};

/**
 * Componente ActivityCard
 *
 * Muestra una tarjeta con información de una actividad deportiva.
 * Diseño inspirado en Strava con badges de color según el tipo.
 *
 * @example
 * ```tsx
 * <ActivityCard activity={activity} index={0} variant="detailed" />
 * ```
 */
export function ActivityCard({
  activity,
  index = 0,
  variant = 'default',
  onClick,
  className = '',
}: ActivityCardProps) {
  const Icon = activityIcons[activity.type] || Activity;
  const colors = activityColors[activity.type] || {
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    border: 'border-zinc-500/20',
    badge: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  };
  const label = activityLabels[activity.type] || activity.type;

  // Formatear fecha relativa (Hoy, Ayer, Lun 15 Ene)
  const formatRelativeDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (activityDate.getTime() === today.getTime()) {
      return `Hoy, ${format(date, 'HH:mm', { locale: es })}`;
    }
    if (activityDate.getTime() === yesterday.getTime()) {
      return `Ayer, ${format(date, 'HH:mm', { locale: es })}`;
    }
    return format(date, 'EEE d MMM, HH:mm', { locale: es });
  };

  const formattedDate = formatRelativeDate(activity.startDate);

  // Formatear duración
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Formatear distancia
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  // Calcular ritmo (min/km para correr, km/h para ciclismo)
  const formatPace = (): string => {
    if (activity.distance === 0 || activity.duration === 0) return '-';

    if (activity.type === 'Run' || activity.type === 'Walk' || activity.type === 'Hike') {
      // Ritmo: min/km
      const paceMinPerKm = activity.duration / 60 / (activity.distance / 1000);
      const paceMin = Math.floor(paceMinPerKm);
      const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
      return `${paceMin}:${paceSec.toString().padStart(2, '0')} /km`;
    } else {
      // Velocidad: km/h
      const speedKmh = (activity.averageSpeed * 3.6).toFixed(1);
      return `${speedKmh} km/h`;
    }
  };

  // Variante compacta
  if (variant === 'compact') {
    return (
      <div
        className={`animate-in fade-in slide-in-from-bottom-2 flex cursor-pointer items-center gap-3 rounded-lg bg-zinc-800/50 p-3 transition-all duration-300 hover:bg-zinc-800 ${className} `}
        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
        onClick={() => onClick?.(activity)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.(activity)}
      >
        <div className={`rounded-lg ${colors.bg} p-2 ${colors.text}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{activity.name}</p>
          <p className="text-xs text-zinc-400">{formattedDate}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-white">{formatDistance(activity.distance)}</p>
        </div>
      </div>
    );
  }

  // Variante detallada
  if (variant === 'detailed') {
    return (
      <div
        className={`rounded-xl border ${colors.border} animate-in fade-in slide-in-from-bottom-4 cursor-pointer bg-zinc-800/30 p-4 transition-all duration-300 hover:bg-zinc-800/60 hover:shadow-lg ${className} `}
        style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
        onClick={() => onClick?.(activity)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick?.(activity)}
      >
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl ${colors.bg} p-3 ${colors.text}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{activity.name}</h3>
              <p className="text-sm text-zinc-400">{formattedDate}</p>
            </div>
          </div>
          <Badge variant="outline" className={colors.badge}>
            {label}
          </Badge>
        </div>

        {/* Métricas principales */}
        <div className="mb-3 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{formatDistance(activity.distance)}</p>
            <p className="text-xs text-zinc-500">Distancia</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{formatDuration(activity.duration)}</p>
            <p className="text-xs text-zinc-500">Tiempo</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{formatPace()}</p>
            <p className="text-xs text-zinc-500">Ritmo</p>
          </div>
        </div>

        {/* Métricas adicionales */}
        {(activity.elevationGain > 0 || activity.averageHeartrate) && (
          <div className="flex flex-wrap gap-3 border-t border-zinc-700/50 pt-3">
            {activity.elevationGain > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                <TrendingUp className="h-4 w-4" />
                <span>{Math.round(activity.elevationGain)} m elevación</span>
              </div>
            )}
            {activity.averageHeartrate && (
              <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                <Heart className="h-4 w-4 text-red-400" />
                <span>{Math.round(activity.averageHeartrate)} bpm medio</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Variante default (estilo Strava estándar)
  return (
    <div
      className={`animate-in fade-in slide-in-from-bottom-4 flex cursor-pointer items-center gap-4 rounded-lg bg-zinc-800/50 p-3 transition-all duration-300 hover:bg-zinc-800 ${className} `}
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
      onClick={() => onClick?.(activity)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(activity)}
    >
      {/* Icono */}
      <div className={`rounded-lg bg-zinc-900 p-2 ${colors.text}`}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Info principal */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{activity.name}</p>
        <p className="text-sm text-zinc-400">
          {formattedDate} · {label}
        </p>
      </div>

      {/* Stats */}
      <div className="text-right">
        <p className="font-medium text-white">{formatDistance(activity.distance)}</p>
        <p className="text-sm text-zinc-400">{formatDuration(activity.duration)}</p>
      </div>
    </div>
  );
}

/**
 * Skeleton loader para ActivityCard
 */
export function ActivityCardSkeleton({
  variant = 'default',
}: {
  variant?: 'default' | 'compact' | 'detailed';
}) {
  if (variant === 'compact') {
    return <Skeleton className="h-14 w-full rounded-lg" />;
  }

  if (variant === 'detailed') {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  return <Skeleton className="h-16 w-full rounded-lg" />;
}

/**
 * Estado vacío para cuando no hay actividades
 */
export function ActivityCardEmpty({
  message = 'No hay actividades recientes',
}: {
  message?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-800/30 p-8 text-center">
      <Activity className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
      <p className="text-zinc-400">{message}</p>
      <p className="mt-1 text-sm text-zinc-500">Sincroniza con Strava para ver tus actividades</p>
    </div>
  );
}
