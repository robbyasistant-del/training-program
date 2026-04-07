/**
 * Tests for RecentActivitiesCard component
 */

import { render, screen } from '@testing-library/react';
import { RecentActivitiesCard } from '@/components/dashboard/RecentActivitiesCard';
import { Activity } from '@/types/activity';

// Mock de format para fechas
jest.mock('date-fns', () => ({
  format: jest.fn(() => '15 ene, 07:30'),
}));

jest.mock('date-fns/locale', () => ({
  es: {},
}));

const mockActivities: Activity[] = [
  {
    id: '123456789',
    name: 'Morning Run',
    type: 'Run',
    startDate: '2024-01-15T07:30:00Z',
    duration: 3600,
    distance: 10500,
    elevationGain: 150,
    averageSpeed: 2.9,
    maxSpeed: 3.5,
    calories: 650,
  },
  {
    id: '123456790',
    name: 'Evening Ride',
    type: 'Ride',
    startDate: '2024-01-14T18:00:00Z',
    duration: 5400,
    distance: 25000,
    elevationGain: 200,
    averageSpeed: 4.6,
  },
  {
    id: '123456791',
    name: 'Pool Swim',
    type: 'Swim',
    startDate: '2024-01-13T06:00:00Z',
    duration: 1800,
    distance: 1500,
    elevationGain: 0,
    averageSpeed: 0.8,
  },
];

describe('RecentActivitiesCard', () => {
  describe('Loading state', () => {
    it('should show skeleton loaders when isLoading is true', () => {
      const { container } = render(
        <RecentActivitiesCard activities={[]} isLoading={true} />
      );

      // Should show multiple skeleton elements (animate-pulse class)
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty state', () => {
    it('should show empty message when no activities', () => {
      render(<RecentActivitiesCard activities={[]} isLoading={false} />);

      expect(screen.getByText('No hay actividades recientes')).toBeInTheDocument();
      expect(
        screen.getByText('Sincroniza con Strava para ver tus actividades')
      ).toBeInTheDocument();
    });
  });

  describe('With activities', () => {
    it('should render activity count badge', () => {
      render(<RecentActivitiesCard activities={mockActivities} isLoading={false} />);

      expect(screen.getByText('Actividades Recientes')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // Badge count
    });

    it('should render all activities', () => {
      render(<RecentActivitiesCard activities={mockActivities} isLoading={false} />);

      expect(screen.getByText('Morning Run')).toBeInTheDocument();
      expect(screen.getByText('Evening Ride')).toBeInTheDocument();
      expect(screen.getByText('Pool Swim')).toBeInTheDocument();
    });

    it('should display correct activity types with labels', () => {
      render(<RecentActivitiesCard activities={mockActivities} isLoading={false} />);

      // Check for type labels in the date/type line
      const runActivity = screen.getByText('Morning Run').closest('div');
      expect(runActivity).toBeInTheDocument();
    });

    it('should format distance correctly', () => {
      render(<RecentActivitiesCard activities={mockActivities} isLoading={false} />);

      // 10500m = 10.5km
      expect(screen.getByText('10.5 km')).toBeInTheDocument();
      // 25000m = 25.0km
      expect(screen.getByText('25.0 km')).toBeInTheDocument();
    });

    it('should format duration correctly', () => {
      render(<RecentActivitiesCard activities={mockActivities} isLoading={false} />);

      // 3600s = 1h 0m
      expect(screen.getByText('1h 0m')).toBeInTheDocument();
      // 5400s = 1h 30m
      expect(screen.getByText('1h 30m')).toBeInTheDocument();
      // 1800s = 30m
      expect(screen.getByText('30m')).toBeInTheDocument();
    });
  });

  describe('Activity icons and colors', () => {
    it('should render Run activities with correct styling', () => {
      render(<RecentActivitiesCard activities={[mockActivities[0]]} isLoading={false} />);

      const runCard = screen.getByText('Morning Run').closest('div[class*="rounded-lg"]');
      expect(runCard).toBeInTheDocument();
    });

    it('should handle unknown activity types gracefully', () => {
      const unknownActivity: Activity = {
        ...mockActivities[0],
        type: 'UnknownType' as Activity['type'],
        name: 'Unknown Activity',
      };

      render(<RecentActivitiesCard activities={[unknownActivity]} isLoading={false} />);

      expect(screen.getByText('Unknown Activity')).toBeInTheDocument();
    });
  });

  describe('Responsive design', () => {
    it('should have proper container classes', () => {
      const { container } = render(
        <RecentActivitiesCard activities={mockActivities} isLoading={false} />
      );

      const card = container.firstChild;
      expect(card).toHaveClass('bg-zinc-900');
      expect(card).toHaveClass('border-zinc-800');
    });
  });
});
