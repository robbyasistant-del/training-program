'use client';

import { useEffect, useState } from 'react';

import { SyncProgressPanel } from '@/components/strava/SyncProgressPanel';

interface AthleteProfile {
  id: string;
  firstname: string;
  lastname: string;
  profileImage: string | null;
  city: string | null;
  country: string | null;
  weight: number | null;
  lastSyncAt: string | null;
  syncStatus: string;
  stats: {
    totalActivities: number;
    totalDistance: number;
    totalMovingTime: number;
  };
}

interface Activity {
  id: string;
  name: string;
  type: string;
  startDate: string;
  distance: number;
  movingTime: number;
}

/**
 * Dashboard de perfil del atleta
 * Muestra datos del perfil sincronizado, ultimas actividades y boton de sync
 */
export default function DashboardProfilePage() {
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncId, setSyncId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/athlete/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/athlete/activities?limit=10');
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchProfile(), fetchActivities()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  const handleSyncProfile = async () => {
    try {
      setIsSyncing(true);
      const response = await fetch('/api/strava/sync/profile', {
        method: 'POST',
      });

      if (response.ok) {
        await fetchProfile();
      }
    } catch (error) {
      console.error('Error syncing profile:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncActivities = async () => {
    try {
      const response = await fetch('/api/strava/sync/activities?limit=200', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setSyncId(data.syncId);
      }
    } catch (error) {
      console.error('Error syncing activities:', error);
    }
  };

  const handleSyncComplete = () => {
    setSyncId(null);
    fetchActivities();
    fetchProfile();
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
            Conectar con Strava
          </a>
        </div>
      </div>
    );
  }

  const shouldShowSyncButton =
    profile.stats.totalActivities < 50 ||
    (profile.lastSyncAt &&
      new Date().getTime() - new Date(profile.lastSyncAt).getTime() > 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
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

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {profile.syncStatus === 'completed' ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
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
                    Ultima sync: {new Date(profile.lastSyncAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleSyncProfile}
                disabled={isSyncing}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {isSyncing ? 'Sincronizando...' : 'Actualizar Perfil'}
              </button>

              {shouldShowSyncButton && (
                <button
                  onClick={handleSyncActivities}
                  className="rounded-lg bg-[#FC4C02] px-4 py-2 font-medium text-white transition-colors hover:bg-[#e04402]"
                >
                  Sincronizar Actividades
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sync Progress Panel */}
        {syncId && (
          <div className="mb-8">
            <SyncProgressPanel
              syncId={syncId}
              onComplete={handleSyncComplete}
              onError={() => setSyncId(null)}
            />
          </div>
        )}

        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-600">Total Actividades</p>
            <p className="text-3xl font-bold text-gray-900">{profile.stats.totalActivities}</p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-600">Distancia Total</p>
            <p className="text-3xl font-bold text-gray-900">
              {(profile.stats.totalDistance / 1000).toFixed(1)} km
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-600">Tiempo Total</p>
            <p className="text-3xl font-bold text-gray-900">
              {Math.floor(profile.stats.totalMovingTime / 3600)}h{' '}
              {Math.floor((profile.stats.totalMovingTime % 3600) / 60)}m
            </p>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Ultimas Actividades</h2>

          {activities.length === 0 ? (
            <p className="text-gray-600">No hay actividades sincronizadas aun.</p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-gray-900">{activity.name}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(activity.startDate).toLocaleDateString()} • {activity.type}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      {(activity.distance / 1000).toFixed(1)} km
                    </p>
                    <p className="text-sm text-gray-500">
                      {Math.floor(activity.movingTime / 60)} min
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
