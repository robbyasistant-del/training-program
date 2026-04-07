import { render, screen } from '@testing-library/react';
import {
  WeeklyVolumeChart,
  WeeklyVolumeChartCompact,
  type WeeklyVolumeData,
} from '@/components/charts/WeeklyVolumeChart';

// Mock de datos para testing
const mockData: WeeklyVolumeData[] = [
  { weekLabel: 'S1', volume: 45.2, isCurrentWeek: false },
  { weekLabel: 'S2', volume: 52.8, isCurrentWeek: false },
  { weekLabel: 'S3', volume: 38.5, isCurrentWeek: false },
  { weekLabel: 'S4', volume: 61.3, isCurrentWeek: false },
  { weekLabel: 'S5', volume: 55.7, isCurrentWeek: false },
  { weekLabel: 'S6', volume: 42.1, isCurrentWeek: false },
  { weekLabel: 'S7', volume: 58.9, isCurrentWeek: false },
  { weekLabel: 'Actual', volume: 35.4, isCurrentWeek: true },
];

describe('WeeklyVolumeChart', () => {
  it('renders the chart with title', () => {
    render(<WeeklyVolumeChart data={mockData} title="Volumen Semanal" />);
    
    expect(screen.getByText('Volumen Semanal')).toBeInTheDocument();
    expect(screen.getByText('Últimas 8 semanas')).toBeInTheDocument();
  });

  it('renders legend correctly', () => {
    render(<WeeklyVolumeChart data={mockData} />);
    
    expect(screen.getByText('Semanas anteriores')).toBeInTheDocument();
    expect(screen.getByText('Semana actual')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<WeeklyVolumeChart data={[]} loading={true} />);
    
    // Should show skeleton loaders
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<WeeklyVolumeChart data={[]} title="Volumen Semanal" />);
    
    expect(screen.getByText('Volumen Semanal')).toBeInTheDocument();
    expect(
      screen.getByText(/No hay actividades registradas estas semanas/)
    ).toBeInTheDocument();
    expect(screen.getByText('Conectar con Strava')).toBeInTheDocument();
  });

  it('renders with different units', () => {
    const { rerender } = render(
      <WeeklyVolumeChart data={mockData} unit="km" />
    );
    expect(screen.getByText('Volumen Semanal')).toBeInTheDocument();

    rerender(<WeeklyVolumeChart data={mockData} unit="hours" />);
    expect(screen.getByText('Volumen Semanal')).toBeInTheDocument();

    rerender(<WeeklyVolumeChart data={mockData} unit="sessions" />);
    expect(screen.getByText('Volumen Semanal')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <WeeklyVolumeChart data={mockData} className="custom-class" />
    );
    
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});

describe('WeeklyVolumeChartCompact', () => {
  it('renders compact chart', () => {
    const { container } = render(<WeeklyVolumeChartCompact data={mockData} />);
    
    // Compact version should not show loading or empty state
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin datos')).not.toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<WeeklyVolumeChartCompact data={[]} loading={true} />);
    
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<WeeklyVolumeChartCompact data={[]} />);
    
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });
});
