/**
 * PR Notification Toast Component
 * Celebration notification for new PRs
 */

'use client';

import { useEffect, useState } from 'react';
import { Trophy, X, TrendingUp, Route, Gauge, Clock, Mountain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MetricType, FormattedMetricPR } from '@/types/metricPR';

interface PRNotificationToastProps {
  notification: {
    id: string;
    metricType: MetricType;
    record: FormattedMetricPR;
  };
  onDismiss: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

const metricIcons: Record<MetricType, React.ReactNode> = {
  [MetricType.DISTANCE]: <Route className="h-6 w-6" />,
  [MetricType.PACE]: <Gauge className="h-6 w-6" />,
  [MetricType.DURATION]: <Clock className="h-6 w-6" />,
  [MetricType.ELEVATION_GAIN]: <Mountain className="h-6 w-6" />,
};

const metricLabels: Record<MetricType, string> = {
  [MetricType.DISTANCE]: 'Distancia',
  [MetricType.PACE]: 'Ritmo',
  [MetricType.DURATION]: 'Duración',
  [MetricType.ELEVATION_GAIN]: 'Desnivel',
};

export function PRNotificationToast({
  notification,
  onDismiss,
  autoClose = true,
  autoCloseDelay = 8000,
}: PRNotificationToastProps) {
  const [visible, setVisible] = useState(false);
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      x: number;
      y: number;
      color: string;
      delay: number;
      duration: number;
    }>
  >([]);

  const { metricType, record } = notification;
  const hasImprovement = record.improvementPercent !== undefined;

  useEffect(() => {
    // Animate in
    const showTimer = setTimeout(() => setVisible(true), 100);

    // Generate confetti particles
    const colors = ['#fbbf24', '#f59e0b', '#fcd34d', '#22c55e', '#3b82f6'];
    const newParticles = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: 20 + Math.random() * 60, // Spread across the toast
      y: -10 - Math.random() * 20,
      color: colors[Math.floor(Math.random() * colors.length)] ?? '#fbbf24',
      delay: Math.random() * 0.5,
      duration: 1 + Math.random() * 1.5,
    }));
    setParticles(newParticles);

    // Auto close
    if (autoClose) {
      const closeTimer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, autoCloseDelay);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(closeTimer);
      };
    }

    return () => clearTimeout(showTimer);
  }, [autoClose, autoCloseDelay, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`fixed right-4 top-4 z-50 transition-all duration-300 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      {/* Confetti particles */}
      <div className="pointer-events-none absolute inset-0 overflow-visible">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="animate-confetti-toast absolute"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}px`,
              backgroundColor: particle.color,
              width: '6px',
              height: '6px',
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Main Toast */}
      <div className="min-w-[320px] max-w-[400px] rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 px-6 py-4 text-zinc-900 shadow-2xl">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="animate-bounce-subtle rounded-full bg-yellow-300 p-2 shadow-md">
            <Trophy className="h-6 w-6 text-yellow-800" />
          </div>

          {/* Content */}
          <div className="flex-1">
            <p className="text-lg font-bold">¡Nuevo Récord! 🎉</p>

            <div className="mt-1 flex items-center gap-2">
              {metricIcons[metricType]}
              <p className="font-medium">{metricLabels[metricType]}</p>
            </div>

            <div className="mt-2 rounded-lg bg-yellow-300/50 p-2">
              <p className="text-2xl font-bold">{record.formattedValue}</p>

              {hasImprovement && (
                <div className="mt-1 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-700" />
                  <p className="text-sm font-medium text-green-800">
                    Mejora: {record.formattedImprovement}
                  </p>
                </div>
              )}
            </div>

            <p className="mt-2 truncate text-sm opacity-75">{record.activityName}</p>
          </div>

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-1 h-8 w-8 hover:bg-yellow-600/20"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress bar */}
        {autoClose && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-yellow-800/20">
            <div
              className="animate-progress h-full bg-yellow-800/40"
              style={{ animationDuration: `${autoCloseDelay}ms` }}
            />
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes confetti-toast {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(150px) rotate(720deg) scale(0);
            opacity: 0;
          }
        }
        .animate-confetti-toast {
          animation: confetti-toast ease-out forwards;
        }
        @keyframes bounce-subtle {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 0.6s ease-in-out 3;
        }
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-progress {
          animation: progress linear forwards;
        }
      `}</style>
    </div>
  );
}
