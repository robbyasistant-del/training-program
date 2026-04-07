/**
 * Tests for ActivitySummaryRing component
 */

import { render, screen } from '@testing-library/react';
import { ActivitySummaryRing } from '@/components/dashboard/ActivitySummaryRing';
import { Activity } from '@/types/activity';

const mockActivities: Activity[] = [
  {
    id: '1',
    name: 'Run 1',
    type: 'Run',
    startDate: '2024-01-15T07:30:00Z',
    duration: 3600,
    distance: 10000,
    elevationGain: 100,
    averageSpeed: 3.0,
  },
  {
    id: '2',
    name: 'Run 2',
    type: 'Run',
    startDate: '2024-01-08T07:30:00Z',
    duration: 3600,
    distance: 10000,
    elevationGain: 100,
    averageSpeed: 3.0,
  },
  {
    id: '3',
    name: 'Run 3',
    type: 'Run',
    startDate: '2024-01-01T07:30:00Z',
    duration: 3600,
    distance: 10000,
    elevationGain: 100,
    averageSpeed: 3.0,
  },
];

describe('ActivitySummaryRing', () => {
  beforeEach(() => {
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate'],
      advanceTimers: true,
    } as any);
    jest.setSystemTime(new Date('2024-01-17').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Loading state', () => {
    it('should show skeleton when isLoading is true', () => {
      const { container } = render(
        <ActivitySummaryRing activities={[]} isLoading={true} />
      );

      // Should have animate-pulse class for skeleton
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty state', () => {
    it('should show zero streak with motivational message', () => {
      render(<ActivitySummaryRing activities={[]} isLoading={false} />);

      expect(screen.getByText('Racha Semanal')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('¡Comienza tu racha esta semana!')).toBeInTheDocument();
    });
  });

  describe('Streak calculation', () => {
    it('should display correct week count in ring', () => {
      render(<ActivitySummaryRing activities={mockActivities} isLoading={false} />);

      // Should show streak count
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should show motivational message for streak', () => {
      render(<ActivitySummaryRing activities={mockActivities} isLoading={false} />);

      expect(screen.getByText('¡Increíble consistencia!')).toBeInTheDocument();
    });

    it('should handle single week streak', () => {
      const singleActivity = [mockActivities[0]];
      render(<ActivitySummaryRing activities={singleActivity} isLoading={false} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('semana')).toBeInTheDocument();
    });
  });

  describe('SVG ring rendering', () => {
    it('should render SVG with correct dimensions', () => {
      const { container } = render(
        <ActivitySummaryRing activities={mockActivities} isLoading={false} />
      );

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '140');
      expect(svg).toHaveAttribute('height', '140');
    });

    it('should have background and progress circles', () => {
      const { container } = render(
        <ActivitySummaryRing activities={mockActivities} isLoading={false} />
      );

      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBe(2);
    });
  });

  describe('Responsive design', () => {
    it('should have proper card styling', () => {
      const { container } = render(
        <ActivitySummaryRing activities={mockActivities} isLoading={false} />
      );

      const card = container.firstChild;
      expect(card).toHaveClass('bg-zinc-900');
      expect(card).toHaveClass('border-zinc-800');
    });
  });

  describe('Motivational messages', () => {
    const testCases: [number, string][] = [
      [0, '¡Comienza tu racha esta semana!'],
      [1, '¡Primera semana! Sigue así.'],
      [3, '¡Buen trabajo! Mantén el ritmo.'],
      [6, '¡Increíble consistencia!'],
      [10, '¡Eres una máquina!'],
      [15, '¡Leyenda del entrenamiento!'],
    ];

    testCases.forEach(([streak, expectedMessage]) => {
      it(`should show correct message for streak ${streak}`, () => {
        // Create activities for specific streak
        const activities: Activity[] = [];
        const baseDate = new Date('2024-01-17');

        for (let i = 0; i < streak; i++) {
          const date = new Date(baseDate);
          date.setDate(date.getDate() - i * 7);
          activities.push({
            ...mockActivities[0],
            id: String(i),
            startDate: date.toISOString(),
          });
        }

        render(<ActivitySummaryRing activities={activities} isLoading={false} />);

        expect(screen.getByText(expectedMessage)).toBeInTheDocument();
      });
    });
  });
});
