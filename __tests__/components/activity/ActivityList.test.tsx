import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityList, ActivityListCompact } from '@/components/activity/ActivityList';
import { Activity } from '@/types/activity';

// Mock de actividades para testing
const mockActivities: Activity[] = [
  {
    id: '1',
    name: 'Morning Run',
    type: 'Run',
    startDate: new Date().toISOString(),
    duration: 3600,
    distance: 8500,
    elevationGain: 45,
    averageSpeed: 2.36,
  },
  {
    id: '2',
    name: 'Evening Ride',
    type: 'Ride',
    startDate: new Date(Date.now() - 86400000).toISOString(),
    duration: 7200,
    distance: 42000,
    elevationGain: 120,
    averageSpeed: 5.83,
  },
  {
    id: '3',
    name: 'Swim Session',
    type: 'Swim',
    startDate: new Date(Date.now() - 172800000).toISOString(),
    duration: 1800,
    distance: 1500,
    elevationGain: 0,
    averageSpeed: 0.83,
  },
];

describe('ActivityList', () => {
  it('renders list of activities', () => {
    render(<ActivityList activities={mockActivities} isLoading={false} />);
    
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('Evening Ride')).toBeInTheDocument();
    expect(screen.getByText('Swim Session')).toBeInTheDocument();
  });

  it('renders loading state correctly', () => {
    render(<ActivityList activities={[]} isLoading={true} />);
    
    // Should show skeleton loaders
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when no activities', () => {
    render(<ActivityList activities={[]} isLoading={false} />);
    
    expect(screen.getByText('No hay actividades recientes')).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const handleRetry = jest.fn();
    render(
      <ActivityList 
        activities={[]} 
        isLoading={false} 
        error="Failed to load"
        onRetry={handleRetry}
      />
    );
    
    expect(screen.getByText('Error al cargar actividades')).toBeInTheDocument();
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    expect(screen.getByText('Reintentar')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const handleRetry = jest.fn();
    render(
      <ActivityList 
        activities={[]} 
        isLoading={false} 
        error="Failed to load"
        onRetry={handleRetry}
      />
    );
    
    fireEvent.click(screen.getByText('Reintentar'));
    expect(handleRetry).toHaveBeenCalled();
  });

  it('displays activity count badge', () => {
    render(<ActivityList activities={mockActivities} isLoading={false} />);
    
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls onActivityClick when activity is clicked', () => {
    const handleClick = jest.fn();
    render(
      <ActivityList 
        activities={mockActivities} 
        isLoading={false}
        onActivityClick={handleClick}
      />
    );
    
    fireEvent.click(screen.getByText('Morning Run'));
    expect(handleClick).toHaveBeenCalledWith(mockActivities[0]);
  });

  it('respects initialLimit prop', () => {
    const manyActivities = Array.from({ length: 20 }, (_, i) => ({
      ...mockActivities[0],
      id: String(i + 1),
      name: `Activity ${i + 1}`,
    }));
    
    render(
      <ActivityList 
        activities={manyActivities} 
        isLoading={false}
        initialLimit={10}
      />
    );
    
    // Should show "Ver más" button
    expect(screen.getByText('Ver más actividades')).toBeInTheDocument();
  });

  it('loads more activities when "Ver más" is clicked', () => {
    const manyActivities = Array.from({ length: 20 }, (_, i) => ({
      ...mockActivities[0],
      id: String(i + 1),
      name: `Activity ${i + 1}`,
    }));
    
    render(
      <ActivityList 
        activities={manyActivities} 
        isLoading={false}
        initialLimit={10}
        loadMoreIncrement={5}
      />
    );
    
    fireEvent.click(screen.getByText('Ver más actividades'));
    
    // After clicking, should show Activity 15 (initial 10 + 5 more)
    expect(screen.getByText('Activity 15')).toBeInTheDocument();
  });

  it('shows end message when all activities are loaded', () => {
    render(
      <ActivityList 
        activities={mockActivities} 
        isLoading={false}
        initialLimit={2}
      />
    );
    
    fireEvent.click(screen.getByText('Ver más actividades'));
    
    expect(screen.getByText('Has visto todas las actividades')).toBeInTheDocument();
  });
});

describe('ActivityListCompact', () => {
  it('renders compact list of activities', () => {
    render(<ActivityListCompact activities={mockActivities} />);
    
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
  });

  it('respects limit prop', () => {
    render(<ActivityListCompact activities={mockActivities} limit={2} />);
    
    // Should show "+1 más" for the remaining activity
    expect(screen.getByText('+1 más')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<ActivityListCompact activities={[]} isLoading={true} />);
    
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders error state with retry', () => {
    const handleRetry = jest.fn();
    render(
      <ActivityListCompact 
        activities={[]} 
        error="Error loading"
        onRetry={handleRetry}
      />
    );
    
    fireEvent.click(screen.getByText('Reintentar'));
    expect(handleRetry).toHaveBeenCalled();
  });

  it('renders empty state', () => {
    render(<ActivityListCompact activities={[]} />);
    
    expect(screen.getByText('No hay actividades')).toBeInTheDocument();
  });
});
