import { Sidebar } from '@/components/navigation/Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Sidebar />
      <main className="min-h-screen transition-all duration-300 lg:ml-72">
        {children}
      </main>
    </div>
  );
}
