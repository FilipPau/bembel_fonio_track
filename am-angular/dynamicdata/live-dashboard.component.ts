import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { addDays, format } from 'date-fns';
import { LiveOperationsMetrics } from '../src/app/core/data/data-store.service';

const HOURLY_RATE_USD = 300;
const DEFAULT_WEEK_START = '2026-06-01';

interface WeeklyMetric {
  label: string;
  value: string;
  delta: string;
  tone: 'blue' | 'green' | 'amber' | 'purple';
}

@Component({
  selector: 'app-live-dashboard',
  imports: [CommonModule],
  templateUrl: './live-dashboard.component.html',
})
export class LiveDashboardComponent {
  weekStart = signal(DEFAULT_WEEK_START);
  metrics = signal<LiveOperationsMetrics>(createMockWeek(DEFAULT_WEEK_START));
  loading = signal(false);
  loadFailed = signal(false);
  hasLoaded = signal(true);
  errorMessage = signal('');

  refillRatePercent = computed(() => {
    const metrics = this.metrics();
    const rate = metrics.refillRate || (metrics.totalCanceledSlots ? metrics.filledSlots / metrics.totalCanceledSlots : 0);
    return Math.round(rate * 100);
  });

  weeklyMetrics = computed<WeeklyMetric[]>(() => {
    const metrics = this.metrics();
    const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

    return [
      {
        label: 'Refill rate',
        value: `${this.refillRatePercent()}%`,
        delta: `${metrics.filledSlots} of ${metrics.totalCanceledSlots} cancellation slots filled`,
        tone: 'green',
      },
      {
        label: 'Revenue recovered',
        value: currency.format(metrics.revenueRecovered),
        delta: `${Math.round(metrics.recoveredMinutes)} recovered minutes`,
        tone: 'blue',
      },
      {
        label: 'Attempts per slot',
        value: metrics.attemptsPerSlot.toFixed(1),
        delta: `${metrics.totalAttempts} patient calls across ${metrics.totalCanceledSlots} slots`,
        tone: 'amber',
      },
      {
        label: 'Outcomes by reason',
        value: String(this.totalOutcomes()),
        delta: `${metrics.outcomes.length} recorded outcome reasons`,
        tone: 'purple',
      },
    ];
  });

  weekLabel = computed(() => {
    const metrics = this.metrics();
    const start = new Date(`${metrics.weekStart}T00:00:00`);
    const end = new Date(`${metrics.weekEnd}T00:00:00`);
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  });

  connectionLabel = computed(() => 'Mockup data');

  totalOutcomes = computed(() =>
    this.metrics().outcomes.reduce((total, outcome) => total + outcome.count, 0),
  );

  bestOutcome = computed(() =>
    this.metrics().outcomes.reduce(
      (best, outcome) => outcome.count > best.count ? outcome : best,
      { reason: 'No outcomes recorded', count: 0, color: 'bg-gray-400' },
    ),
  );

  refillRingStyle = computed(() =>
    `conic-gradient(#10b981 ${this.refillRatePercent()}%, #e5e7eb ${this.refillRatePercent()}% 100%)`,
  );

  hasNoWeeklyData = computed(() => false);

  moveWeek(days: number): void {
    const nextStart = addDays(new Date(`${this.weekStart()}T00:00:00`), days);
    this.weekStart.set(format(nextStart, 'yyyy-MM-dd'));
    this.metrics.set(createMockWeek(this.weekStart()));
  }

  currentWeek(): void {
    this.weekStart.set(DEFAULT_WEEK_START);
    this.metrics.set(createMockWeek(DEFAULT_WEEK_START));
  }

  metricClass(tone: WeeklyMetric['tone']): string {
    switch (tone) {
      case 'green':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  }

  outcomeWidth(count: number): string {
    const total = this.totalOutcomes();
    return total ? `${Math.max(6, Math.round((count / total) * 100))}%` : '0%';
  }

  outcomeShare(count: number): number {
    const total = this.totalOutcomes();
    return total ? Math.round((count / total) * 100) : 0;
  }
}

function createMockWeek(weekStartValue: string): LiveOperationsMetrics {
  const preset = mockWeekPresets[weekStartValue] ?? createFallbackPreset(weekStartValue);
  const weekStartDate = new Date(`${weekStartValue}T00:00:00`);
  const openSlots = preset.totalCanceledSlots - preset.filledSlots;
  const refillRate = preset.totalCanceledSlots ? preset.filledSlots / preset.totalCanceledSlots : 0;
  const revenueRecovered = Math.round((preset.recoveredMinutes / 60) * HOURLY_RATE_USD);
  const attemptsPerSlot = preset.totalCanceledSlots ? preset.totalAttempts / preset.totalCanceledSlots : 0;
  const maxRevenue = Math.max(...preset.dailyRevenue, 1);
  const maxAttempts = Math.max(...preset.dailyAttempts, 1);

  return {
    weekStart: weekStartValue,
    weekEnd: format(addDays(weekStartDate, 6), 'yyyy-MM-dd'),
    updatedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
    totalCanceledSlots: preset.totalCanceledSlots,
    filledSlots: preset.filledSlots,
    openSlots,
    refillRate,
    revenueRecovered,
    recoveredMinutes: preset.recoveredMinutes,
    totalAttempts: preset.totalAttempts,
    attemptsPerSlot,
    resolvedOutcomes: preset.filledSlots,
    dailyRevenue: preset.dailyRevenue.map((revenue, index) => ({
      label: format(addDays(weekStartDate, index), 'EEE'),
      revenue,
      height: revenue ? Math.max(14, Math.round((revenue / maxRevenue) * 100)) : 8,
    })),
    dailyAttempts: preset.dailyAttempts.map((attempts, index) => ({
      label: format(addDays(weekStartDate, index), 'EEE'),
      attempts,
      height: attempts ? Math.max(16, Math.round((attempts / maxAttempts) * 100)) : 8,
    })),
    outcomes: preset.outcomes,
  };
}

function createFallbackPreset(weekStartValue: string): MockPreset {
  const seed = weekStartValue.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  const totalCanceledSlots = 9 + (seed % 5);
  const filledSlots = Math.min(totalCanceledSlots, 6 + (seed % 3));
  const openSlots = totalCanceledSlots - filledSlots;
  const recoveredMinutes = filledSlots * 35 + (seed % 4) * 10;
  const totalAttempts = filledSlots + Math.max(5, openSlots * 2 + 4);
  const revenue = Math.round((recoveredMinutes / 60) * HOURLY_RATE_USD);

  return {
    totalCanceledSlots,
    filledSlots,
    recoveredMinutes,
    totalAttempts,
    dailyRevenue: distribute(revenue, [0.24, 0.18, 0.2, 0.22, 0.16, 0, 0]),
    dailyAttempts: distribute(totalAttempts, [0.23, 0.18, 0.2, 0.19, 0.2, 0, 0]),
    outcomes: [
      { reason: 'Termin vorverschoben', count: filledSlots, color: 'bg-emerald-500' },
      { reason: 'Abgelehnt, zu kurzfristig', count: Math.max(2, Math.round(openSlots * 1.5)), color: 'bg-amber-500' },
      { reason: 'Nicht erreicht', count: Math.max(2, openSlots), color: 'bg-blue-500' },
      { reason: 'Nicht geantwortet', count: Math.max(1, Math.round(openSlots * 0.8)), color: 'bg-rose-500' },
    ],
  };
}

function distribute(total: number, weights: number[]): number[] {
  const exactValues = weights.map((weight) => total * weight);
  const values = exactValues.map(Math.floor);
  let remaining = total - values.reduce((sum, value) => sum + value, 0);

  exactValues
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction)
    .forEach(({ index }) => {
      if (remaining <= 0) return;
      values[index] += 1;
      remaining -= 1;
    });

  return values;
}

interface MockPreset {
  totalCanceledSlots: number;
  filledSlots: number;
  recoveredMinutes: number;
  totalAttempts: number;
  dailyRevenue: number[];
  dailyAttempts: number[];
  outcomes: LiveOperationsMetrics['outcomes'];
}

const mockWeekPresets: Record<string, MockPreset> = {
  '2026-06-01': {
    totalCanceledSlots: 16,
    filledSlots: 12,
    recoveredMinutes: 370,
    totalAttempts: 39,
    dailyRevenue: [575, 250, 450, 325, 250, 0, 0],
    dailyAttempts: [11, 7, 7, 7, 7, 0, 0],
    outcomes: [
      { reason: 'Termin vorverschoben', count: 12, color: 'bg-emerald-500' },
      { reason: 'Abgelehnt, zu kurzfristig', count: 12, color: 'bg-amber-500' },
      { reason: 'Nicht erreicht', count: 8, color: 'bg-blue-500' },
      { reason: 'Nicht geantwortet', count: 7, color: 'bg-rose-500' },
    ],
  },
  '2026-06-08': {
    totalCanceledSlots: 6,
    filledSlots: 4,
    recoveredMinutes: 110,
    totalAttempts: 14,
    dailyRevenue: [300, 100, 0, 150, 0, 0, 0],
    dailyAttempts: [4, 3, 2, 2, 3, 0, 0],
    outcomes: [
      { reason: 'Termin vorverschoben', count: 4, color: 'bg-emerald-500' },
      { reason: 'Abgelehnt, zu kurzfristig', count: 4, color: 'bg-amber-500' },
      { reason: 'Nicht erreicht', count: 3, color: 'bg-blue-500' },
      { reason: 'Nicht geantwortet', count: 3, color: 'bg-rose-500' },
    ],
  },
};
