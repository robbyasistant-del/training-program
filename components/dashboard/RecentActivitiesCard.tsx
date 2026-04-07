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
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity as ActivityType } from '@/types/activity';

interface RecentActivitiesCardProps {
  activities: ActivityType[];
  isLoading?: boolean;
}

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
};

const activityColors: Record<string, string> = {
  Run: 'text-orange-500',
  Ride: 'text-blue-500',
  Swim: 'text-cyan-500',
  Hike: 'text-green-500',
  Walk: 'text-yellow-500',
  AlpineSki: 'text-purple-500',
  BackcountrySki: 'text-purple-500',
  NordicSki: 'text-purple-500',
  RollerSki: 'text-purple-500',
  Snowboard: 'text-purple-500',
  WeightTraining: 'text-red-500',
  Workout: 'text-red-500',
};

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
};

export function RecentActivitiesCard({ activities, isLoading = false }: RecentActivitiesCardProps) {
  if (isLoading) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="border-dashed border-zinc-800 bg-zinc-900">
        <CardContent className="p-8 text-center">
          <p className="text-zinc-400">No hay actividades recientes</p>
          <p className="mt-1 text-sm text-zinc-500">
            Sincroniza con Strava para ver tus actividades
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-white">
          <span>Actividades Recientes</span>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
            {activities.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.map((activity, index) => (
          <ActivityItem key={activity.id} activity={activity} index={index} />
        ))}
      </CardContent>
    </Card>
  );
}

function ActivityItem({ activity, index }: { activity: ActivityType; index: number }) {
  const Icon = activityIcons[activity.type] || Activity;
  const colorClass = activityColors[activity.type] || 'text-zinc-400';
  const label = activityLabels[activity.type] || activity.type;

  // Formatear fecha
  const date = new Date(activity.startDate);
  const formattedDate = format(date, 'd MMM, HH:mm', { locale: es });

  // Formatear duración
  const hours = Math.floor(activity.duration / 3600);
  const minutes = Math.floor((activity.duration % 3600) / 60);
  const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  // Formatear distancia
  const distanceKm = (activity.distance / 1000).toFixed(1);

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-4 flex items-center gap-4 rounded-lg bg-zinc-800/50 p-3 transition-colors duration-500 hover:bg-zinc-800"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Icono */}
      <div className={`rounded-lg bg-zinc-900 p-2 ${colorClass}`}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{activity.name}</p>
        <p className="text-sm text-zinc-400">
          {formattedDate} · {label}
        </p>
      </div>

      {/* Stats */}
      <div className="text-right">
        <p className="font-medium text-white">{distanceKm} km</p>
        <p className="text-sm text-zinc-400">{durationStr}</p>
      </div>
    </div>
  );
}
