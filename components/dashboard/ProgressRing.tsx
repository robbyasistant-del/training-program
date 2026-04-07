'use client';

import { useEffect, useState } from 'react';

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  value?: string;
  subvalue?: string;
}

export function ProgressRing({
  percentage,
  size = 120,
  strokeWidth = 8,
  color = '#fc5200',
  label,
  value,
  subvalue,
}: ProgressRingProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

  useEffect(() => {
    // Animar el progreso al cargar
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);

    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Círculo de fondo */}
        <svg className="-rotate-90 transform" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#27272a"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
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
          {value && <span className="text-2xl font-bold text-white">{value}</span>}
          {subvalue && <span className="text-xs text-zinc-500">{subvalue}</span>}
        </div>
      </div>

      {/* Etiqueta */}
      {label && <p className="mt-2 text-sm font-medium text-zinc-400">{label}</p>}

      {/* Porcentaje */}
      <p className="text-xs text-zinc-500">{Math.round(percentage)}% completado</p>
    </div>
  );
}
