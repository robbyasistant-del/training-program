'use client';

import { useState, useEffect } from 'react';
import { User, Weight, Calendar, MapPin, Flag, Activity, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  birthdate: string | null;
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

export default function ProfilePage() {
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Editable fields
  const [weight, setWeight] = useState<string>('');
  const [birthdate, setBirthdate] = useState<string>('');

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/auth/strava/status');
      const data = await response.json();

      if (data.isConnected) {
        const profileResponse = await fetch('/api/athlete/sync-profile', {
          method: 'POST',
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setProfile(profileData.athlete);
          setWeight(profileData.athlete.weight?.toString() || '');
          setBirthdate(profileData.athlete.birthdate ? profileData.athlete.birthdate.split('T')[0] : '');
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

  const handleSaveProfile = async () => {
    if (!profile) return;
    setIsSaving(true);
    
    try {
      const response = await fetch('/api/athlete/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight: weight ? parseFloat(weight) : null,
          birthdate: birthdate || null,
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setProfile(updated);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncComplete = () => {
    fetchProfile();
    fetchStats();
  };

  const calculateAge = (birthdateStr: string | null): number | null => {
    if (!birthdateStr) return null;
    const birth = new Date(birthdateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-[#FC4C02]"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-xl">
          <h1 className="mb-2 text-2xl font-bold text-white">Conectar Strava</h1>
          <p className="mb-6 text-zinc-400">
            Conecta tu cuenta de Strava para importar tu perfil y actividades.
          </p>
          <a
            href="/api/strava/connect"
            className="inline-flex items-center rounded-xl bg-[#FC4C02] px-6 py-3 font-medium text-white transition-colors hover:bg-[#e04402]"
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
    <div className="min-h-screen bg-zinc-950 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header Card */}
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
              {profile.profileImage ? (
                <img
                  src={profile.profileImage}
                  alt={`${profile.firstname} ${profile.lastname}`}
                  className="h-24 w-24 rounded-full object-cover ring-2 ring-zinc-700"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800 ring-2 ring-zinc-700">
                  <User className="h-12 w-12 text-zinc-500" />
                </div>
              )}

              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl font-bold text-white">
                  {profile.firstname} {profile.lastname}
                </h1>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-zinc-400 md:justify-start">
                  {profile.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {profile.city}
                    </span>
                  )}
                  {profile.city && profile.country && <span>•</span>}
                  {profile.country && (
                    <span className="flex items-center gap-1">
                      <Flag className="h-4 w-4" />
                      {profile.country}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                  {profile.syncStatus === 'completed' ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400 border border-emerald-500/20">
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
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-400 border border-amber-500/20">
                      <div className="mr-1 h-3 w-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent"></div>
                      Sincronizando...
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-zinc-800 px-3 py-1 text-sm font-medium text-zinc-400 border border-zinc-700">
                      No sincronizado
                    </span>
                  )}

                  {profile.lastSyncAt && (
                    <span className="text-sm text-zinc-500">
                      Última sync: {new Date(profile.lastSyncAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setIsSyncModalOpen(true)}
                className="rounded-xl bg-[#FC4C02] px-4 py-2 font-medium text-white transition-colors hover:bg-[#e04402]"
              >
                Sincronizar Actividades
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Profile Data Card */}
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <User className="h-5 w-5 text-[#FC4C02]" />
              Datos del Perfil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Weight Field */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-400">
                  <Weight className="h-4 w-4" />
                  Peso (kg)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="Ej: 70.5"
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-white placeholder-zinc-600 focus:border-[#FC4C02] focus:outline-none"
                  />
                </div>
              </div>

              {/* Birthdate Field */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-400">
                  <Calendar className="h-4 w-4" />
                  Fecha de Nacimiento
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-white focus:border-[#FC4C02] focus:outline-none"
                  />
                </div>
                {birthdate && (
                  <p className="text-sm text-[#FC4C02]">
                    Edad: {calculateAge(birthdate)} años
                  </p>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-xl bg-[#FC4C02] px-6 py-2 font-medium text-white transition-colors hover:bg-[#e04402] disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        {stats && (
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Activity className="h-5 w-5 text-[#FC4C02]" />
                Estadísticas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-zinc-950 p-6 text-center border border-zinc-800">
                  <p className="text-sm text-zinc-500">Total Actividades</p>
                  <p className="text-3xl font-bold text-white">{stats.totalActivities}</p>
                </div>

                <div className="rounded-xl bg-zinc-950 p-6 text-center border border-zinc-800">
                  <p className="text-sm text-zinc-500">Distancia Total</p>
                  <p className="text-3xl font-bold text-white">
                    {(stats.totalDistance / 1000).toFixed(1)} km
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-950 p-6 text-center border border-zinc-800">
                  <p className="text-sm text-zinc-500">Tiempo Total</p>
                  <p className="text-3xl font-bold text-white">
                    {Math.floor(stats.totalMovingTime / 3600)}h{' '}
                    {Math.floor((stats.totalMovingTime % 3600) / 60)}m
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
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
