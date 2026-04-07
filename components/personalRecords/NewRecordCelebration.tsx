/**
 * New Record Celebration Component
 * Animated overlay with confetti effect for new PRs
 */

'use client';

import { useEffect, useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NewRecordCelebrationProps {
  distanceLabel?: string;
  formattedTime?: string;
  onClose?: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export function NewRecordCelebration({
  distanceLabel,
  formattedTime,
  onClose,
  autoClose = true,
  autoCloseDelay = 5000,
}: NewRecordCelebrationProps) {
  const [visible, setVisible] = useState(true);
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      x: number;
      color: string;
      delay: number;
    }>
  >([]);

  useEffect(() => {
    // Generate confetti particles
    const colors = ['#fbbf24', '#f59e0b', '#fcd34d', '#fbbf24', '#fff'];
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)] ?? '#fbbf24',
      delay: Math.random() * 0.5,
    }));
    setParticles(newParticles);

    // Auto close
    if (autoClose) {
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDelay, onClose]);

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  if (!visible) return null;

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center duration-300">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="animate-confetti absolute"
            style={{
              left: `${particle.x}%`,
              top: '-10px',
              backgroundColor: particle.color,
              width: '8px',
              height: '8px',
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Main Card */}
      <div className="animate-in zoom-in-50 relative mx-4 max-w-md rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 px-8 py-8 text-zinc-900 shadow-2xl duration-300">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 hover:bg-yellow-600/20"
          onClick={handleClose}
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="text-center">
          {/* Trophy Icon */}
          <div className="mb-4 flex justify-center">
            <div className="animate-bounce rounded-full bg-yellow-300 p-4 shadow-lg">
              <Trophy className="h-12 w-12 text-yellow-800" />
            </div>
          </div>

          {/* Title */}
          <p className="mb-2 text-3xl font-bold">¡Nuevo Récord! 🎉</p>

          {/* Subtitle */}
          <p className="mb-4 text-lg opacity-90">Has batido tu mejor tiempo</p>

          {distanceLabel && formattedTime && (
            <div className="mb-4 rounded-xl bg-yellow-300/50 p-4">
              <p className="text-sm font-semibold uppercase tracking-wide opacity-80">
                {distanceLabel.replace('_', ' ')}
              </p>
              <p className="text-4xl font-bold">{formattedTime}</p>
            </div>
          )}

          <p className="text-sm opacity-75">¡Sigue así, crack! 💪</p>
        </div>

        {/* Pulse effect */}
        <div className="absolute inset-0 animate-pulse rounded-2xl bg-yellow-400/10" />
      </div>

      {/* CSS for confetti animation */}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default NewRecordCelebration;
