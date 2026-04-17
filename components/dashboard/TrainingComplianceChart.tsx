'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, TrendingUp, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface TrainingComplianceData {
  date: string;
  dayLabel: string;
  displayDate: string;
  uniqueKey: string;
  plannedTSS: number;
  actualTSS: number;
  compliance: number;
}

interface TrainingComplianceChartProps {
  athleteId: string | null;
  days?: number;
}

export function TrainingComplianceChart({ athleteId, days = 30 }: TrainingComplianceChartProps) {
  const [data, setData] = useState<TrainingComplianceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!athleteId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const response = await fetch(
          `/api/dashboard/training-compliance?athleteId=${athleteId}&days=${days}`
        );
        
        if (!response.ok) {
          throw new Error('Error al cargar datos de cumplimiento');
        }
        
        const result = await response.json();
        
        // Transformar datos para recharts - añadir key única invisible para tooltip
        const formattedData = result.data.map((day: any) => ({
          date: day.date,
          dayLabel: day.dayLabel,
          displayDate: day.displayDate,
          uniqueKey: `${day.dayLabel}-${day.displayDate}`, // Ej: "Lun-17-04"
          plannedTSS: day.plannedTSS || 0,
          actualTSS: day.actualTSS || 0,
          compliance: day.compliance || 0,
        }));
        
        setData(formattedData);
      } catch (err) {
        console.error('[TrainingComplianceChart] Error:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [athleteId, days]);

  if (loading) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="p-4">
          <Skeleton className="h-72 w-full" />
          <div className="grid grid-cols-4 gap-4 mt-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="h-5 w-5 text-[#FC4C02]" />
            Cumplimiento de Entrenamiento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <p className="text-red-400">{error}</p>
          <p className="text-sm text-zinc-500 mt-2">
            No se pudieron cargar los datos de entrenamiento
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calcular estadísticas
  const totalPlanned = data.reduce((sum, d) => sum + d.plannedTSS, 0);
  const totalActual = data.reduce((sum, d) => sum + d.actualTSS, 0);
  const activeDays = data.filter(d => d.actualTSS > 0).length;
  const plannedDays = data.filter(d => d.plannedTSS > 0).length;
  
  const avgCompliance = plannedDays > 0
    ? data.filter(d => d.plannedTSS > 0).reduce((sum, d) => sum + d.compliance, 0) / plannedDays
    : 0;

  // Determinar el máximo para el eje Y
  const maxTSS = Math.max(
    ...data.map(d => Math.max(d.plannedTSS, d.actualTSS)),
    100 // Mínimo 100 para que se vea bien
  );
  const yAxisMax = Math.ceil(maxTSS / 50) * 50; // Redondear al siguiente 50

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Target className="h-5 w-5 text-[#FC4C02]" />
              Cumplimiento de Entrenamiento
            </CardTitle>
            <p className="text-sm text-zinc-500 mt-1">
              Últimos {days} días • TSS planificado vs realizado
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-[#FC4C02]" />
              <span className="text-zinc-400">Planificado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-emerald-500" />
              <span className="text-zinc-400">Realizado</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* Gráfica */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              barGap={2}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#27272a" 
                vertical={false} 
              />
              <XAxis
                dataKey="uniqueKey"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#71717a', fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={20}
                tickFormatter={(value) => {
                  // Extraer solo el día (primera parte antes del guión)
                  return value.split('-')[0];
                }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#71717a', fontSize: 11 }}
                domain={[0, yAxisMax]}
                label={{ 
                  value: 'TSS', 
                  angle: -90, 
                  position: 'insideLeft',
                  fill: '#71717a',
                  fontSize: 11
                }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                content={({ active, label }) => {
                  if (active && label) {
                    // Buscar el día exacto por uniqueKey
                    const dayData = data.find(d => d.uniqueKey === label);
                    if (!dayData) return null;
                    
                    const planned = dayData.plannedTSS;
                    const actual = dayData.actualTSS;
                    const compliance = planned > 0 ? Math.round((actual / planned) * 100) : 0;
                    
                    // Formatear la fecha correctamente DD-MM-YYYY
                    const [year, month, day] = dayData.date.split('-');
                    const formattedDate = `${day}-${month}-${year}`;
                    
                    return (
                      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-lg min-w-[180px]">
                        <p className="font-medium text-white mb-1">
                          {formattedDate} ({dayData.dayLabel})
                        </p>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-[#FC4C02]" />
                              <span className="text-zinc-400">Planificado</span>
                            </span>
                            <span className="text-white font-medium">{planned} TSS</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              <span className="text-zinc-400">Realizado</span>
                            </span>
                            <span className="text-white font-medium">{actual} TSS</span>
                          </div>
                          {planned > 0 && (
                            <div className="border-t border-zinc-700 pt-1.5 mt-1.5">
                              <span className={`text-sm font-medium ${
                                compliance >= 100 
                                  ? 'text-emerald-400' 
                                  : compliance >= 80 
                                    ? 'text-amber-400' 
                                    : 'text-red-400'
                              }`}>
                                {compliance}% cumplimiento
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Barra de TSS planificado */}
              <Bar
                dataKey="plannedTSS"
                name="Planificado"
                fill="#FC4C02"
                radius={[2, 2, 0, 0]}
                maxBarSize={20}
                opacity={0.8}
              />
              {/* Barra de TSS realizado */}
              <Bar
                dataKey="actualTSS"
                name="Realizado"
                fill="#10b981"
                radius={[2, 2, 0, 0]}
                maxBarSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Leyenda del eje X */}
        <div className="flex justify-center mt-2">
          <p className="text-xs text-zinc-500">Días (últimos {days} días)</p>
        </div>

        {/* Estadísticas resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-zinc-800">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-xs text-zinc-500">Cumplimiento</p>
            </div>
            <p className={`text-lg font-bold ${
              avgCompliance >= 100 
                ? 'text-emerald-400' 
                : avgCompliance >= 80 
                  ? 'text-amber-400' 
                  : 'text-red-400'
            }`}>
              {avgCompliance.toFixed(0)}%
            </p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Target className="h-3.5 w-3.5 text-[#FC4C02]" />
              <p className="text-xs text-zinc-500">Planificado</p>
            </div>
            <p className="text-lg font-bold text-[#FC4C02]">
              {totalPlanned.toFixed(0)}
            </p>
            <p className="text-xs text-zinc-600">TSS total</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Calendar className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-xs text-zinc-500">Realizado</p>
            </div>
            <p className="text-lg font-bold text-emerald-400">
              {totalActual.toFixed(0)}
            </p>
            <p className="text-xs text-zinc-600">TSS total</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
              <p className="text-xs text-zinc-500">Días activos</p>
            </div>
            <p className="text-lg font-bold text-white">
              {activeDays}
            </p>
            <p className="text-xs text-zinc-600">de {data.length} días</p>
          </div>
        </div>

        {/* Mensaje si no hay datos */}
        {data.length === 0 || (totalPlanned === 0 && totalActual === 0) ? (
          <div className="mt-4 p-4 bg-zinc-800/50 rounded-lg text-center">
            <p className="text-sm text-zinc-400">
              No hay datos de entrenamiento para el período seleccionado
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Sincroniza con Strava o añade actividades manualmente para ver el cumplimiento
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
