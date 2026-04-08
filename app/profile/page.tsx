'use client';

import { useState, useEffect } from 'react';

import { SyncProgressModal } from '@/components/strava/SyncProgressModal';

interface AthleteProfile {
  id: string;
  firstname: string;
  lastname: string;
  profileImage: string | null;
  city: string | null;
  country: string | null;
  sex: string | null;
  weight: number | null;
  syncStatus: string;
  lastSyncAt: string | null;
  _count?: {
    activities: number;
  };
}

interface ActivityStats {
  totalDistance: number;
  totalMovingTime: number;
  totalActivities: number;
}

/**
 * Página de perfil del atleta
 * Muestra datos del perfil y estadísticas de actividades
 */
export default function ProfilePage() {
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/auth/strava/status');
      const data = await response.json();

      if (data.isConnected) {
        // Fetch detailed profile
        const profileResponse = await fetch('/api/athlete/sync-profile', {
          method: 'POST',
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setProfile(profileData.athlete);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/athlete/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, []);

  const handleSyncComplete = () => {
    fetchProfile();
    fetchStats();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#FC4C02]"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-md">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Conectar Strava</h1>
          <p className="mb-6 text-gray-600">
            Conecta tu cuenta de Strava para importar tu perfil y actividades.
          </p>
          <a
            href="/api/strava/connect"
            className="inline-flex items-center rounded-lg bg-[#FC4C02] px-6 py-3 font-medium text-white transition-colors hover:bg-[#e04402]"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L8.423 0 2.5 12.343h4.172" />
            </svg>
            Conectar con Strava
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8 pt-20 lg:pt-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
            {profile.profileImage ? (
              <img
                src={profile.profileImage}
                alt={`${profile.firstname} ${profile.lastname}`}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-200">
                <span className="text-2xl text-gray-500">
                  {profile.firstname[0]}
                  {profile.lastname[0]}
                </span>
              </div>
            )}

            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold text-gray-900">
                {profile.firstname} {profile.lastname}
              </h1>
              <p className="text-gray-600">
                {profile.city}
                {profile.city && profile.country && ', '}
                {profile.country}
              </p>
              {profile.weight && (
                <p className="mt-1 text-sm text-gray-500">Peso: {profile.weight} kg</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {profile.syncStatus === 'completed' ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                    <svg className="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Sincronizado
                  </span>
                ) : profile.syncStatus === 'running' ? (
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
                    <div className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-yellow-600 border-t-transparent"></div>
                    Sincronizando...
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
                    No sincronizado
                  </span>
                )}

                {profile.lastSyncAt && (
                  <span className="text-sm text-gray-500">
                    Última sync: {new Date(profile.lastSyncAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsSyncModalOpen(true)}
              className="rounded-lg bg-[#FC4C02] px-4 py-2 font-medium text-white transition-colors hover:bg-[#e04402]"
            >
              Sincronizar Actividades
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-600">Total Actividades</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalActivities}</p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-600">Distancia Total</p>
              <p className="text-3xl font-bold text-gray-900">
                {(stats.totalDistance / 1000).toFixed(1)} km
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-600">Tiempo Total</p>
              <p className="text-3xl font-bold text-gray-900">
                {Math.floor(stats.totalMovingTime / 3600)}h{' '}
                {Math.floor((stats.totalMovingTime % 3600) / 60)}m
              </p>
            </div>
          </div>
        )}
      </div>

      <SyncProgressModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onComplete={handleSyncComplete}
      />
    </div>
  );
}
