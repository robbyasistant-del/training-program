'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WeekSelectorProps {
  weekLabel: string;
  weekOffset: number;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
}

export function WeekSelector({
  weekLabel,
  weekOffset,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
}: WeekSelectorProps) {
  const isCurrentWeek = weekOffset === 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onPreviousWeek}
          className="h-9 w-9 border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800"
        >
          <ChevronLeft className="h-4 w-4 text-zinc-400" />
        </Button>

        <div className="flex min-w-[140px] flex-col items-center">
          <span className="text-sm font-medium text-white">{weekLabel}</span>
          {!isCurrentWeek && (
            <button
              onClick={onCurrentWeek}
              className="text-xs text-orange-500 transition-colors hover:text-orange-400"
            >
              Volver a actual
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onNextWeek}
          className="h-9 w-9 border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800"
        >
          <ChevronRight className="h-4 w-4 text-zinc-400" />
        </Button>
      </div>

      {isCurrentWeek && <span className="text-xs font-medium text-green-500">● Semana actual</span>}
    </div>
  );
}
