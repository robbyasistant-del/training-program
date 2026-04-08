import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';

import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';
import { DashboardLayout } from '@/components/navigation/DashboardLayout';
import { cn } from '@/lib/utils';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Training Program - Track Your Progress',
  description:
    'A web application for tracking and following structured training programs with progression tracking.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn('font-sans', inter.variable)}>
      <body className={cn('min-h-screen bg-background antialiased', inter.className)}>
        <ReactQueryProvider>
          <DashboardLayout>
            {children}
          </DashboardLayout>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
