/**
 * Personal Records Dashboard Page
 * Shows metric-based PRs and history
 */

import { Metadata } from 'next';
import { MetricPRDashboard } from '@/components/records/MetricPRDashboard';

export const metadata: Metadata = {
  title: 'Récords Personales | Training Program',
  description: 'Visualiza tus récords personales y tu progreso',
};

export default function RecordsPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="container mx-auto px-4 py-8 pt-20 lg:pt-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Récords Personales</h1>
          <p className="text-zinc-400 mt-2">
            Visualiza tus mejores marcas y celebra tus logros
          </p>
        </div>

        <MetricPRDashboard />
      </div>
    </div>
  );
}
