/**
 * Personal Records Page
 * Vista completa de récords personales con historial
 */

import { Metadata } from 'next';
import { PersonalRecordsDashboard } from '@/components/personalRecords/PersonalRecordsDashboard';
import { PRHistoryChart } from '@/components/personalRecords/PRHistoryChart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, History } from 'lucide-react';
import { StandardDistanceLabel } from '@/types/personalRecord';

export const metadata: Metadata = {
  title: 'Récords Personales | Training Program',
  description: 'Tus mejores tiempos en distancias estándar',
};

// Lista de distancias disponibles para el historial (valores de Prisma enum)
const DISTANCES: { label: StandardDistanceLabel; name: string }[] = [
  { label: 'FIVE_K', name: '5K' },
  { label: 'TEN_K', name: '10K' },
  { label: 'FIFTEEN_K', name: '15K' },
  { label: 'HALF_MARATHON', name: 'Media Maratón' },
  { label: 'MARATHON', name: 'Maratón' },
];

interface PageProps {
  searchParams: { athleteId?: string };
}

export default function PersonalRecordsPage({ searchParams }: PageProps) {
  // En producción, esto vendría de la sesión/autenticación
  const athleteId = searchParams.athleteId ?? null;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">Récords Personales</h1>
              <p className="text-zinc-400">Tus mejores tiempos y progresión</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="current" className="space-y-6">
          <TabsList className="bg-zinc-800 border-zinc-700">
            <TabsTrigger value="current" className="data-[state=active]:bg-zinc-700">
              <Trophy className="h-4 w-4 mr-2" />
              Récords Actuales
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-zinc-700">
              <History className="h-4 w-4 mr-2" />
              Historial
            </TabsTrigger>
          </TabsList>

          {/* Current Records Tab */}
          <TabsContent value="current" className="space-y-6">
            <PersonalRecordsDashboard athleteId={athleteId} />

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-zinc-400">Distancias Cubiertas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">5</p>
                  <p className="text-xs text-zinc-500 mt-1">De 5K a Maratón</p>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-zinc-400">Total Récords</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">—</p>
                  <p className="text-xs text-zinc-500 mt-1">Histórico acumulado</p>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-zinc-400">Último Récord</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-white">—</p>
                  <p className="text-xs text-zinc-500 mt-1">Fecha del último PR</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  Evolución por Distancia
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Visualiza cómo has mejorado tus tiempos a lo largo del tiempo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="5K" className="space-y-4">
                  <TabsList className="bg-zinc-800 border-zinc-700 flex-wrap">
                    {DISTANCES.map((distance) => (
                      <TabsTrigger
                        key={distance.label}
                        value={distance.label}
                        className="data-[state=active]:bg-zinc-700"
                      >
                        {distance.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {DISTANCES.map((distance) => (
                    <TabsContent key={distance.label} value={distance.label}>
                      <PRHistoryChart
                        athleteId={athleteId}
                        distanceLabel={distance.label}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Info Card */}
        <Card className="bg-zinc-900/50 border-zinc-800 mt-8">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">¿Cómo se detectan los récords?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-zinc-500 space-y-2">
              <li>• Las actividades se comparan con distancias estándar (5K, 10K, 15K, Media Maratón, Maratón)</li>
              <li>• Se permite una tolerancia de ±2% para account de variaciones GPS</li>
              <li>• Se considera PR si el tiempo es mejor que el récord anterior para esa distancia</li>
              <li>• Los récords se detectan automáticamente al sincronizar actividades de Strava</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
