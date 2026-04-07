'use client';

import { ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import { useState, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity } from '@/types/activity';

import { ActivityCard, ActivityCardSkeleton, ActivityCardEmpty } from './ActivityCard';

/**
 * Props para el componente ActivityList
 */
interface ActivityListProps {
  /** Array de actividades a mostrar */
  activities: Activity[];
  /** Estado de carga */
  isLoading?: boolean;
  /** Error (null si no hay error) */
  error?: string | null;
  /** Número de items a mostrar inicialmente */
  initialLimit?: number;
  /** Incremento al cargar más */
  loadMoreIncrement?: number;
  /** Variante de las tarjetas */
  cardVariant?: 'default' | 'compact' | 'detailed';
  /** Callback para recargar datos */
  onRetry?: () => void;
  /** Callback al hacer click en una actividad */
  onActivityClick?: (activity: Activity) => void;
  /** Título del componente */
  title?: string;
  /** Mostrar badge con conteo */
  showCount?: boolean;
  /** Clase CSS adicional */
  className?: string;
  /** Mensaje personalizado cuando está vacío */
  emptyMessage?: string;
  /** Habilitar infinite scroll (alternativa a botón "Ver más") */
  infiniteScroll?: boolean;
  /** Callback cuando se necesitan más datos (para infinite scroll o paginación server-side) */
  onLoadMore?: () => Promise<void>;
  /** Indica si hay más páginas disponibles */
  hasMore?: boolean;
  /** Indica si está cargando más (paginación) */
  isLoadingMore?: boolean;
}

/**
 * Componente ActivityList
 *
 * Contenedor que recibe un array de actividades y renderiza un stack vertical
 * de ActivityCard. Incluye estado vacío, soporte para "Ver más", y manejo de errores.
 *
 * @example
 * ```tsx
 * <ActivityList
 *   activities={activities}
 *   isLoading={isLoading}
 *   error={error}
 *   initialLimit={10}
 *   onRetry={refetch}
 *   cardVariant="detailed"
 * />
 * ```
 */
export function ActivityList({
  activities,
  isLoading = false,
  error = null,
  initialLimit = 10,
  loadMoreIncrement = 10,
  cardVariant = 'default',
  onRetry,
  onActivityClick,
  title = 'Actividades Recientes',
  showCount = true,
  className = '',
  emptyMessage = 'No hay actividades recientes',
  infiniteScroll = false,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: ActivityListProps) {
  const [displayLimit, setDisplayLimit] = useState(initialLimit);

  // Determinar actividades a mostrar
  const displayedActivities = activities.slice(0, displayLimit);
  const hasMoreActivities = activities.length > displayLimit || hasMore;

  // Manejar "Ver más"
  const handleLoadMore = useCallback(async () => {
    if (onLoadMore) {
      await onLoadMore();
    } else {
      setDisplayLimit((prev) => prev + loadMoreIncrement);
    }
  }, [onLoadMore, loadMoreIncrement]);

  // Estado de carga
  if (isLoading) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-10" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: Math.min(initialLimit, 5) }).map((_, i) => (
            <ActivityCardSkeleton key={i} variant={cardVariant} />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Estado de error
  if (error) {
    return (
      <Card className="border-red-800/50 bg-red-900/10">
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center">
            <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
            <h3 className="mb-1 text-lg font-medium text-red-400">Error al cargar actividades</h3>
            <p className="mb-4 text-sm text-red-300/70">{error}</p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="border-red-700/50 text-red-400 hover:bg-red-900/30 hover:text-red-300"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado vacío
  if (activities.length === 0) {
    return (
      <Card className="border-dashed border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-white">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityCardEmpty message={emptyMessage} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-zinc-800 bg-zinc-900 ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-3 text-white">
          <span>{title}</span>
          {showCount && (
            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
              {activities.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Lista de actividades */}
        <div className="space-y-3">
          {displayedActivities.map((activity, index) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              index={index}
              variant={cardVariant}
              onClick={onActivityClick}
            />
          ))}
        </div>

        {/* Indicador de carga adicional */}
        {isLoadingMore && (
          <div className="space-y-3 pt-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <ActivityCardSkeleton key={`loading-more-${i}`} variant={cardVariant} />
            ))}
          </div>
        )}

        {/* Botón "Ver más" */}
        {hasMoreActivities && !infiniteScroll && (
          <div className="pt-4">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              {isLoadingMore ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Cargando...
                </>
              ) : (
                <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Ver más actividades
                </>
              )}
            </Button>
          </div>
        )}

        {/* Mensaje de fin de lista */}
        {!hasMoreActivities && activities.length > initialLimit && (
          <p className="pt-4 text-center text-sm text-zinc-500">Has visto todas las actividades</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Props para ActivityListCompact
 * Versión simplificada sin Card wrapper
 */
interface ActivityListCompactProps {
  activities: Activity[];
  isLoading?: boolean;
  error?: string | null;
  limit?: number;
  onRetry?: () => void;
  onActivityClick?: (activity: Activity) => void;
  className?: string;
}

/**
 * Versión compacta de ActivityList sin Card wrapper
 * Útil para integrar en otros componentes
 */
export function ActivityListCompact({
  activities,
  isLoading = false,
  error = null,
  limit = 5,
  onRetry,
  onActivityClick,
  className = '',
}: ActivityListCompactProps) {
  const displayActivities = activities.slice(0, limit);

  if (isLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: limit }).map((_, i) => (
          <ActivityCardSkeleton key={i} variant="compact" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-red-800/50 bg-red-900/10 p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="flex-1">
            <p className="text-sm text-red-400">{error}</p>
          </div>
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="text-red-400 hover:bg-red-900/30 hover:text-red-300"
            >
              Reintentar
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div
        className={`rounded-lg border border-dashed border-zinc-700 bg-zinc-800/30 p-4 ${className}`}
      >
        <p className="text-center text-sm text-zinc-400">No hay actividades</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {displayActivities.map((activity, index) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          index={index}
          variant="compact"
          onClick={onActivityClick}
        />
      ))}
      {activities.length > limit && (
        <p className="pt-2 text-center text-xs text-zinc-500">+{activities.length - limit} más</p>
      )}
    </div>
  );
}
