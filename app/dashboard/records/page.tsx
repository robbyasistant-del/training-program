/**
 * Personal Records Dashboard Page
 * Shows metric-based PRs and history
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MetricPRDashboard } from '@/components/records/MetricPRDashboard';

export default function RecordsPage() {
  const router = useRouter();
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get athleteId from cookie
  useEffect(() => {
    const cookie = document.cookie.split('; ').find((row) => row.startsWith('athlete_id='));
    if (cookie) {
      const id = cookie.split('=')[1];
      if (id) {
        setAthleteId(id);
      } else {
        router.push('/login');
      }
    } else {
      router.push('/login');
    }
    setIsLoading(false);
  }, [router]);

  if (isLoading || !athleteId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-[#FC4C02]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Récords Personales</h1>
        <p className="mt-2 text-zinc-400">Visualiza tus mejores marcas y celebra tus logros</p>
      </div>

      <MetricPRDashboard athleteId={athleteId} />
    </div>
  );
}
