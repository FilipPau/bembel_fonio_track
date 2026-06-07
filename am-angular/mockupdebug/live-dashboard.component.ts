import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { addDays, format, startOfWeek } from 'date-fns';

const HOURLY_RATE_USD = 300;

interface OutcomeReason {
  reason: string;
  count: number;
  color: string;
}

interface RevenuePoint {
  label: string;
  revenue: number;
  height: number;
}

interface AttemptPoint {
  label: string;
  attempts: number;
  height: number;
}

interface LiveOperationsMock {
  weekStart: string;
  weekEnd: string;
  updatedAt: string;
  totalCanceledSlots: number;
  filledSlots: number;
  openSlots: number;
  recoveredMinutes: number;
  revenueRecovered: number;
  totalAttempts: number;
  attemptsPerSlot: number;
  dailyRevenue: RevenuePoint[];
  dailyAttempts: AttemptPoint[];
  outcomes: OutcomeReason[];
}

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
  weekStart = signal(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  metrics = signal<LiveOperationsMock>(createMockWeek(this.weekStart()));

  refillRatePercent = computed(() =>
    this.metrics().totalCanceledSlots
      ? Math.round((this.metrics().filledSlots / this.metrics().totalCanceledSlots) * 100)
      : 0,
  );

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
        delta: `${metrics.recoveredMinutes} recovered minutes`,
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

  connectionLabel = computed(() => 'Preview data');

  totalOutcomes = computed(() =>
    this.metrics().outcomes.reduce((total, outcome) => total + outcome.count, 0),
  );

  bestOutcome = computed(() =>
    this.metrics().outcomes.reduce((best, outcome) => outcome.count > best.count ? outcome : best),
  );

  refillRingStyle = computed(() =>
    `conic-gradient(#10b981 ${this.refillRatePercent()}%, #e5e7eb ${this.refillRatePercent()}% 100%)`,
  );

  moveWeek(days: number): void {
    const nextStart = addDays(new Date(`${this.weekStart()}T00:00:00`), days);
    this.weekStart.set(format(nextStart, 'yyyy-MM-dd'));
    this.metrics.set(createMockWeek(this.weekStart()));
  }

  currentWeek(): void {
    this.weekStart.set(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    this.metrics.set(createMockWeek(this.weekStart()));
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

function createMockWeek(weekStartValue: string): LiveOperationsMock {
  const weekStartDate = new Date(`${weekStartValue}T00:00:00`);
  const seed = deterministicSeed(weekStartValue);
  const totalCanceledSlots = 18 + (seed % 8);
  const filledSlots = Math.min(totalCanceledSlots, 11 + (seed % 6));
  const openSlots = totalCanceledSlots - filledSlots;
  const recoveredMinutes = filledSlots * 36 + (seed % 5) * 15;
  const revenueRecovered = Math.round((recoveredMinutes / 60) * HOURLY_RATE_USD);
  const totalAttempts = filledSlots * 2 + openSlots * 3 + (seed % 7);
  const attemptsPerSlot = totalAttempts / totalCanceledSlots;
  const dailyRevenueRaw = distribute(revenueRecovered, [0.12, 0.21, 0.18, 0.26, 0.16, 0.07, 0]);
  const dailyAttemptsRaw = distribute(totalAttempts, [0.14, 0.18, 0.16, 0.22, 0.2, 0.1, 0]);
  const maxRevenue = Math.max(...dailyRevenueRaw, 1);
  const maxAttempts = Math.max(...dailyAttemptsRaw, 1);

  return {
    weekStart: weekStartValue,
    weekEnd: format(addDays(weekStartDate, 6), 'yyyy-MM-dd'),
    updatedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
    totalCanceledSlots,
    filledSlots,
    openSlots,
    recoveredMinutes,
    revenueRecovered,
    totalAttempts,
    attemptsPerSlot,
    dailyRevenue: dailyRevenueRaw.map((revenue, index) => ({
      label: format(addDays(weekStartDate, index), 'EEE'),
      revenue,
      height: revenue ? Math.max(14, Math.round((revenue / maxRevenue) * 100)) : 8,
    })),
    dailyAttempts: dailyAttemptsRaw.map((attempts, index) => ({
      label: format(addDays(weekStartDate, index), 'EEE'),
      attempts,
      height: attempts ? Math.max(16, Math.round((attempts / maxAttempts) * 100)) : 8,
    })),
    outcomes: [
      { reason: 'Accepted earlier slot', count: filledSlots, color: 'bg-emerald-500' },
      { reason: 'Declined time', count: Math.max(2, Math.round(openSlots * 1.2)), color: 'bg-amber-500' },
      { reason: 'No answer', count: Math.max(2, openSlots + (seed % 3)), color: 'bg-blue-500' },
      { reason: 'Too short notice', count: Math.max(1, Math.round(openSlots * 0.7)), color: 'bg-rose-500' },
    ],
  };
}

function deterministicSeed(value: string): number {
  return value.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
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
