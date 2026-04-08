'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Activity,
  Trophy,
  User,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Zap,
  CalendarDays,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    description: 'Vista general',
  },
  {
    label: 'Rendimiento',
    href: '/dashboard/performance',
    icon: <Activity className="h-5 w-5" />,
    description: 'Curvas de fitness',
  },
  {
    label: 'Récords',
    href: '/dashboard/records',
    icon: <Trophy className="h-5 w-5" />,
    description: 'Tus mejores marcas',
  },
  {
    label: 'Entrenamiento',
    href: '/dashboard/training',
    icon: <CalendarDays className="h-5 w-5" />,
    description: 'Coach, objetivos y semana',
  },
  {
    label: 'Perfil',
    href: '/profile',
    icon: <User className="h-5 w-5" />,
    description: 'Tu perfil Strava',
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/dashboard/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FC4C02] to-[#e04402]">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white">Training</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-20' : 'w-72',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo Section */}
        <div className="flex h-20 items-center justify-between border-b border-zinc-800 px-4">
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center gap-3 transition-all duration-300',
              isCollapsed && 'lg:justify-center'
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FC4C02] to-[#e04402]">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span
              className={cn(
                'whitespace-nowrap text-lg font-bold text-white transition-all duration-300',
                isCollapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'
              )}
            >
              Training
            </span>
          </Link>

          {/* Collapse Toggle (Desktop only) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              'hidden h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white lg:flex',
              isCollapsed && 'rotate-180'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-6">
          <div className={cn('mb-4 px-3', isCollapsed && 'lg:hidden')}>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Menú Principal
            </p>
          </div>

          <ul className="space-y-2">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200',
                      active
                        ? 'bg-gradient-to-r from-[#FC4C02]/20 to-[#FC4C02]/5 text-white'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-white',
                      isCollapsed && 'lg:justify-center'
                    )}
                  >
                    <span
                      className={cn(
                        'flex shrink-0 items-center justify-center transition-colors',
                        active ? 'text-[#FC4C02]' : 'text-zinc-500 group-hover:text-white'
                      )}
                    >
                      {item.icon}
                    </span>

                    <div
                      className={cn(
                        'flex flex-col transition-all duration-300',
                        isCollapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'
                      )}
                    >
                      <span className="whitespace-nowrap font-medium">{item.label}</span>
                      {!isCollapsed && item.description && (
                        <span className="whitespace-nowrap text-xs text-zinc-500">
                          {item.description}
                        </span>
                      )}
                    </div>

                    {/* Active Indicator */}
                    {active && !isCollapsed && (
                      <div className="ml-auto h-2 w-2 rounded-full bg-[#FC4C02]" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-zinc-800 p-4">
          <div
            className={cn(
              'flex items-center gap-3 rounded-xl bg-zinc-900/50 px-3 py-3',
              isCollapsed && 'lg:justify-center'
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800">
              <svg className="h-4 w-4 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L8.423 0 2.5 12.343h4.172" />
              </svg>
            </div>
            <div
              className={cn(
                'flex flex-col transition-all duration-300',
                isCollapsed ? 'lg:w-0 lg:opacity-0' : 'w-auto opacity-100'
              )}
            >
              <span className="whitespace-nowrap text-sm font-medium text-white">
                Strava
              </span>
              <span className="whitespace-nowrap text-xs text-zinc-500">
                Conectado
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Spacer */}
      <div
        className={cn(
          'hidden lg:block transition-all duration-300',
          isCollapsed ? 'w-20' : 'w-72'
        )}
      />

      {/* Mobile Content Spacer */}
      <div className="h-16 lg:hidden" />
    </>
  );
}
