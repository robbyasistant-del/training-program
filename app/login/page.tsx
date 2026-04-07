import { StravaConnectionButton } from '@/components/strava';

interface LoginPageProps {
  searchParams: { redirect?: string };
}

/**
 * Login Page
 * Página de autenticación con diseño limpio y minimalista
 * Inspirado en Strava/Apple Fitness
 */
export default function LoginPage({ searchParams }: LoginPageProps) {
  const redirectUrl = searchParams.redirect || '/dashboard';
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md">
        {/* Logo y título */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FC4C02] to-[#e04402] shadow-lg">
            <svg
              className="h-8 w-8 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L8.423 0 2.5 12.343h4.172" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Training Program
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Conecta tu cuenta de Strava para comenzar
          </p>
        </div>

        {/* Card de login */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          <div className="space-y-6">
            {/* Descripción */}
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bienvenido</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Accede a tu historial de actividades y recibe recomendaciones personalizadas
              </p>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  Inicia sesión con
                </span>
              </div>
            </div>

            {/* Botón de Strava */}
            <div className="flex justify-center">
              <StravaConnectionButton redirectUrl={redirectUrl} />
            </div>

            {/* Features */}
            <div className="space-y-3 pt-4">
              <Feature icon="📊" text="Análisis de rendimiento y curvas de progreso" />
              <Feature icon="🎯" text="Planificación de objetivos de temporada" />
              <Feature icon="📅" text="Estructura semanal de entrenamientos" />
            </div>

            {/* Nota de privacidad */}
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
              Solo accedemos a tus datos de actividad pública.{' '}
              <a
                href="https://www.strava.com/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-600 dark:hover:text-gray-300"
              >
                Más información
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Al conectar, aceptas nuestros{' '}
          <a href="#" className="text-[#FC4C02] hover:underline">
            Términos de Servicio
          </a>{' '}
          y{' '}
          <a href="#" className="text-[#FC4C02] hover:underline">
            Política de Privacidad
          </a>
        </p>
      </div>
    </div>
  );
}

/**
 * Feature item component
 */
function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}
