import { render, screen } from '@testing-library/react';
import { ActivityCard, ActivityCardSkeleton, ActivityCardEmpty } from '@/components/activity/ActivityCard';
import { Activity } from '@/types/activity';

// Mock de actividad para testing
const mockActivity: Activity = {
  id: '1',
  name: 'Morning Run',
  type: 'Run',
  startDate: new Date().toISOString(),
  duration: 3600,
  distance: 8500,
  elevationGain: 45,
  averageSpeed: 2.36,
  averageHeartrate: 155,
};

describe('ActivityCard', () => {
  it('renders default variant correctly', () => {
    render(<ActivityCard activity={mockActivity} />);
    
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
    // "Correr" aparece como parte del string de fecha + tipo
    expect(screen.getByText(/Correr/)).toBeInTheDocument();
    expect(screen.getByText('8.50 km')).toBeInTheDocument();
  });

  it('renders compact variant correctly', () => {
    render(<ActivityCard activity={mockActivity} variant="compact" />);
    
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
  });

  it('renders detailed variant correctly', () => {
    render(<ActivityCard activity={mockActivity} variant="detailed" />);
    
    expect(screen.getByText('Morning Run')).toBeInTheDocument();
    expect(screen.getByText('Distancia')).toBeInTheDocument();
    expect(screen.getByText('Tiempo')).toBeInTheDocument();
    expect(screen.getByText('Ritmo')).toBeInTheDocument();
  });

  it('formats pace correctly for running activities', () => {
    render(<ActivityCard activity={mockActivity} variant="detailed" />);
    
    // Ritmo ~7:03 /km para 8.5km en 60min
    expect(screen.getByText(/\/km$/)).toBeInTheDocument();
  });

  it('formats speed correctly for cycling activities', () => {
    const cyclingActivity: Activity = {
      ...mockActivity,
      type: 'Ride',
      distance: 42000,
      duration: 7200,
      averageSpeed: 5.83,
    };
    
    render(<ActivityCard activity={cyclingActivity} variant="detailed" />);
    
    expect(screen.getByText(/km\/h$/)).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<ActivityCard activity={mockActivity} onClick={handleClick} />);
    
    const card = screen.getByText('Morning Run').closest('[role="button"]');
    card?.click();
    
    expect(handleClick).toHaveBeenCalledWith(mockActivity);
  });
});

describe('ActivityCardSkeleton', () => {
  it('renders skeleton for default variant', () => {
    const { container } = render(<ActivityCardSkeleton />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders skeleton for compact variant', () => {
    const { container } = render(<ActivityCardSkeleton variant="compact" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders skeleton for detailed variant', () => {
    const { container } = render(<ActivityCardSkeleton variant="detailed" />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});

describe('ActivityCardEmpty', () => {
  it('renders empty state with default message', () => {
    render(<ActivityCardEmpty />);
    
    expect(screen.getByText('No hay actividades recientes')).toBeInTheDocument();
    expect(screen.getByText('Sincroniza con Strava para ver tus actividades')).toBeInTheDocument();
  });

  it('renders empty state with custom message', () => {
    render(<ActivityCardEmpty message="Custom empty message" />);
    
    expect(screen.getByText('Custom empty message')).toBeInTheDocument();
  });
});
