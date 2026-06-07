import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { addDays, addMinutes, format, parseISO } from 'date-fns';
import { firstValueFrom, timeout } from 'rxjs';

const API_BASE_URL = 'http://62.178.0.45:5001';
const API_TIMEOUT_MS = 8000;

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export interface TreatmentRoom {
  id: string;
  name: string;
}

export interface Treatment {
  id: string;
  name: string;
  minDurationMinutes: number;
}

export interface Doctor {
  id: string;
  name: string;
  treatments: string[];
  treatmentIds: string[];
}

export interface StaffShift {
  id: string;
  doctorId: string;
  roomId: string;
  start: string;
  end: string;
}

export interface PracticeResources {
  rooms: TreatmentRoom[];
  doctors: Doctor[];
  staffShifts: StaffShift[];
  treatments: Treatment[];
}

export interface Patient {
  svnr: string;
  name: string;
  phone: string;
}

export interface Appointment {
  id: string;
  svnr: string;
  patientName: string;
  phone: string;
  reason: string;
  treatmentId?: string;
  durationMinutes: number;
  roomId: string;
  doctorId: string;
  start: string;
  status?: string;
}

export interface AppointmentMutationResult {
  appointment: Appointment;
  customerCreated: boolean;
  patient: Patient;
}

export interface LiveOperationsMetrics {
  weekStart: string;
  weekEnd: string;
  updatedAt: string;
  totalCanceledSlots: number;
  filledSlots: number;
  openSlots: number;
  refillRate: number;
  revenueRecovered: number;
  recoveredMinutes: number;
  totalAttempts: number;
  attemptsPerSlot: number;
  resolvedOutcomes: number;
  dailyRevenue: LiveOperationsRevenuePoint[];
  dailyAttempts: LiveOperationsAttemptPoint[];
  outcomes: LiveOperationsOutcome[];
}

export interface LiveOperationsRevenuePoint {
  label: string;
  revenue: number;
  height: number;
}

export interface LiveOperationsAttemptPoint {
  label: string;
  attempts: number;
  height: number;
}

export interface LiveOperationsOutcome {
  reason: string;
  count: number;
  color: string;
}

interface ApiCustomer {
  birth_date?: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  social_security_number: string;
}

interface ApiTreatment {
  id: number | string;
  min_duration_minutes?: number;
  name: string;
}

interface ApiStaff {
  first_name: string;
  id: number | string;
  last_name: string;
}

interface ApiRoom {
  id: number | string;
  name: string;
}

interface ApiStaffSpecialization {
  staff_id: number | string;
  treatment_id: number | string;
}

interface ApiStaffShift {
  id: number | string;
  room_id: number | string;
  shift_end: string;
  shift_start: string;
  staff_id: number | string;
}

interface ApiAppointment {
  customer_id: string;
  end_time: string;
  id: number | string;
  room_id: number | string;
  staff_id: number | string;
  start_time: string;
  status: string;
  treatment_id: number | string;
}

interface ApiLiveOperationsRefillRate {
  filled_slots?: number | string;
  open_slots?: number | string;
  refill_rate?: number | string;
  total_canceled_slots?: number | string;
  week_end?: string;
  week_start?: string;
}

interface ApiLiveOperationsRevenueRecovered {
  daily_revenue?: unknown[];
  filled_slots?: number | string;
  recovered_minutes?: number | string;
  revenue_recovered?: number | string;
  week_end?: string;
  week_start?: string;
}

interface ApiLiveOperationsAttemptsPerSlot {
  attempts_per_slot?: number | string;
  daily_attempts?: unknown[];
  total_attempts?: number | string;
  week_end?: string;
  week_start?: string;
}

interface ApiLiveOperationsOutcomesByReason {
  outcomes?: unknown[];
  outcomes_by_reason?: unknown[];
  total_outcomes?: number | string;
  week_end?: string;
  week_start?: string;
}

interface ApiLiveOperationsResolvedOutcomes {
  resolved_outcomes?: number | string;
  week_end?: string;
  week_start?: string;
}

@Injectable({ providedIn: 'root' })
export class DataStoreService {
  private http = inject(HttpClient);

  async loadResources(): Promise<PracticeResources> {
    const [rooms, staff, treatments, specializations, staffShifts] = await Promise.all([
      this.get<ApiRoom[]>('/api/rooms'),
      this.get<ApiStaff[]>('/api/staff'),
      this.get<ApiTreatment[]>('/api/treatments'),
      this.get<ApiStaffSpecialization[]>('/api/staff-specializations'),
      this.get<ApiStaffShift[]>('/api/staff-shifts'),
    ]);

    const mappedTreatments = treatments.map((treatment) => this.mapTreatment(treatment));
    const treatmentNameById = new Map(mappedTreatments.map((treatment) => [treatment.id, treatment.name]));
    const specializationMap = new Map<string, string[]>();

    for (const specialization of specializations) {
      const staffId = String(specialization.staff_id);
      specializationMap.set(staffId, [...(specializationMap.get(staffId) ?? []), String(specialization.treatment_id)]);
    }

    return {
      rooms: rooms.map((room) => ({ id: String(room.id), name: room.name })),
      doctors: staff.map((doctor) => {
        const treatmentIds = specializationMap.get(String(doctor.id)) ?? [];
        return {
          id: String(doctor.id),
          name: `${doctor.first_name} ${doctor.last_name}`.trim(),
          treatmentIds,
          treatments: treatmentIds.map((id) => treatmentNameById.get(id)).filter((name): name is string => Boolean(name)),
        };
      }),
      staffShifts: staffShifts.map((shift) => ({
        id: String(shift.id),
        doctorId: String(shift.staff_id),
        roomId: String(shift.room_id),
        start: this.toLocalIso(shift.shift_start),
        end: this.toLocalIso(shift.shift_end),
      })),
      treatments: mappedTreatments,
    };
  }

  async createRoom(name: string): Promise<TreatmentRoom> {
    const room = await this.post<ApiRoom>('/api/rooms', { name });
    return { id: String(room.id), name: room.name };
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.delete(`/api/rooms/${roomId}`);
  }

  async createDoctor(name: string, treatmentNames: string[]): Promise<PracticeResources> {
    const [firstName, lastName] = this.splitStaffName(name);
    const staff = await this.post<ApiStaff>('/api/staff', {
      first_name: firstName,
      last_name: lastName,
    });

    const staffId = String(staff.id);
    const resources = await this.loadResources();
    const treatmentIds = treatmentNames
      .map((treatmentName) => resources.treatments.find((treatment) => treatment.name === treatmentName)?.id)
      .filter((id): id is string => Boolean(id));

    await Promise.all(
      treatmentIds.map((treatmentId) =>
        this.post('/api/staff-specializations', {
          staff_id: Number(staffId),
          treatment_id: Number(treatmentId),
        }),
      ),
    );

    return this.loadResources();
  }

  async deleteDoctor(doctorId: string): Promise<void> {
    await this.delete(`/api/staff/${doctorId}`);
  }

  async loadPatients(): Promise<Patient[]> {
    const customers = await this.get<ApiCustomer[]>('/api/customers');
    return customers.map((customer) => this.mapPatient(customer));
  }

  async loadAppointments(): Promise<Appointment[]> {
    const [appointments, customers, treatments] = await Promise.all([
      this.get<ApiAppointment[]>('/api/appointments'),
      this.get<ApiCustomer[]>('/api/customers'),
      this.get<ApiTreatment[]>('/api/treatments'),
    ]);

    const patientBySvnr = new Map(customers.map((customer) => [customer.social_security_number, this.mapPatient(customer)]));
    const treatmentById = new Map(treatments.map((treatment) => [String(treatment.id), this.mapTreatment(treatment)]));

    return appointments
      .filter((appointment) => appointment.status !== 'canceled')
      .map((appointment) => this.mapAppointment(appointment, patientBySvnr, treatmentById))
      .sort((left, right) => left.start.localeCompare(right.start));
  }

  async createAppointment(appointment: Appointment): Promise<AppointmentMutationResult> {
    const customer = await this.ensureCustomer(appointment);
    const saved = await this.post<ApiAppointment>('/api/appointments', await this.toAppointmentPayload(appointment));
    return {
      appointment: await this.hydrateSavedAppointment(saved, customer.patient),
      customerCreated: customer.created,
      patient: customer.patient,
    };
  }

  async updateAppointment(appointment: Appointment): Promise<AppointmentMutationResult> {
    const customer = await this.ensureCustomer(appointment);
    const saved = await this.put<ApiAppointment>(`/api/appointments/${appointment.id}`, await this.toAppointmentPayload(appointment));
    return {
      appointment: await this.hydrateSavedAppointment(saved, customer.patient),
      customerCreated: customer.created,
      patient: customer.patient,
    };
  }

  async deleteAppointment(appointmentId: string): Promise<void> {
    await this.delete(`/api/appointments/${appointmentId}`);
  }

  async loadLiveOperationsMetrics(weekStart?: string): Promise<LiveOperationsMetrics> {
    const query = weekStart ? `?week_start=${encodeURIComponent(weekStart)}` : '';
    let overviewError: unknown = null;

    try {
      const overview = await this.get<Record<string, unknown>>(`/api/live-operations${query}`);
      if (this.hasLiveOperationsData(overview)) {
        return this.normalizeLiveOperationsMetrics(overview, weekStart);
      }
    } catch (error) {
      overviewError = error;
    }

    try {
      const [refillRate, revenueRecovered, attemptsPerSlot, outcomesByReason, resolvedOutcomes] = await Promise.all([
        this.get<ApiLiveOperationsRefillRate>(`/api/live-operations/refill-rate${query}`),
        this.get<ApiLiveOperationsRevenueRecovered>(`/api/live-operations/revenue-recovered${query}`),
        this.get<ApiLiveOperationsAttemptsPerSlot>(`/api/live-operations/attempts-per-slot${query}`),
        this.get<ApiLiveOperationsOutcomesByReason>(`/api/live-operations/outcomes-by-reason${query}`),
        this.get<ApiLiveOperationsResolvedOutcomes>(`/api/live-operations/resolved-outcomes${query}`),
      ]);

      return this.normalizeLiveOperationsMetrics(
        {
          ...refillRate,
          ...revenueRecovered,
          ...attemptsPerSlot,
          ...resolvedOutcomes,
          outcomes_by_reason: outcomesByReason.outcomes_by_reason ?? outcomesByReason.outcomes ?? [],
          total_outcomes: outcomesByReason.total_outcomes,
        },
        weekStart,
      );
    } catch (error) {
      throw overviewError instanceof Error ? overviewError : error;
    }
  }

  private hasLiveOperationsData(payload: Record<string, unknown>): boolean {
    const metrics = this.asRecord(payload['metrics']) ?? payload;
    return [
      'total_canceled_slots',
      'totalCanceledSlots',
      'filled_slots',
      'filledSlots',
      'revenue_recovered',
      'revenueRecovered',
      'attempts_per_slot',
      'attemptsPerSlot',
      'outcomes_by_reason',
      'outcomes',
      'daily_revenue',
      'dailyRevenue',
      'daily_attempts',
      'dailyAttempts',
    ].some((key) => key in metrics || key in payload);
  }

  private normalizeLiveOperationsMetrics(rawPayload: Record<string, unknown>, fallbackWeekStart?: string): LiveOperationsMetrics {
    const metrics = this.asRecord(rawPayload['metrics']) ?? rawPayload;
    const refillSource = this.asRecord(rawPayload['refill_rate'])
      ?? this.asRecord(rawPayload['refillRate'])
      ?? metrics;
    const revenueSource = this.asRecord(rawPayload['revenue_recovered'])
      ?? this.asRecord(rawPayload['revenueRecovered'])
      ?? metrics;
    const attemptsSource = this.asRecord(rawPayload['attempts_per_slot'])
      ?? this.asRecord(rawPayload['attemptsPerSlot'])
      ?? metrics;
    const resolvedSource = this.asRecord(rawPayload['resolved_outcomes'])
      ?? this.asRecord(rawPayload['resolvedOutcomes'])
      ?? metrics;

    const weekStart = this.readString(metrics, ['week_start', 'weekStart'])
      ?? this.readString(rawPayload, ['week_start', 'weekStart'])
      ?? fallbackWeekStart
      ?? format(new Date(), 'yyyy-MM-dd');
    const weekEnd = this.readString(metrics, ['week_end', 'weekEnd'])
      ?? this.readString(rawPayload, ['week_end', 'weekEnd'])
      ?? format(addDays(new Date(`${weekStart}T00:00:00`), 6), 'yyyy-MM-dd');
    const totalCanceledSlots = this.readNumber(refillSource, ['total_canceled_slots', 'totalCanceledSlots', 'canceled_slots', 'canceledSlots']);
    const filledSlots = this.readNumber(refillSource, ['filled_slots', 'filledSlots'])
      || this.readNumber(resolvedSource, ['resolved_outcomes', 'resolvedOutcomes']);
    const openSlots = this.readNumber(refillSource, ['open_slots', 'openSlots'])
      || Math.max(totalCanceledSlots - filledSlots, 0);
    const rawRefillRate = this.readNumber(refillSource, ['refill_rate', 'refillRate']);
    const refillRate = rawRefillRate
      ? (rawRefillRate > 1 ? rawRefillRate / 100 : rawRefillRate)
      : (totalCanceledSlots ? filledSlots / totalCanceledSlots : 0);
    const revenueRecovered = this.readNumber(revenueSource, ['revenue_recovered', 'revenueRecovered']);
    const recoveredMinutes = this.readNumber(revenueSource, ['recovered_minutes', 'recoveredMinutes']);
    const totalAttempts = this.readNumber(attemptsSource, ['total_attempts', 'totalAttempts', 'attempts']);
    const attemptsPerSlot = this.readNumber(attemptsSource, ['attempts_per_slot', 'attemptsPerSlot'])
      || (totalCanceledSlots ? totalAttempts / totalCanceledSlots : 0);
    const resolvedOutcomes = this.readNumber(resolvedSource, ['resolved_outcomes', 'resolvedOutcomes'])
      || filledSlots;
    const dailyRevenueRows = this.readArray(revenueSource, ['daily_revenue', 'dailyRevenue'])
      || this.readArray(metrics, ['daily_revenue', 'dailyRevenue']);
    const dailyAttemptsRows = this.readArray(attemptsSource, ['daily_attempts', 'dailyAttempts'])
      || this.readArray(metrics, ['daily_attempts', 'dailyAttempts']);
    const outcomeRows = this.readArray(metrics, ['outcomes_by_reason', 'outcomesByReason', 'outcomes'])
      || this.readArray(rawPayload, ['outcomes_by_reason', 'outcomesByReason', 'outcomes']);

    return {
      weekStart,
      weekEnd,
      updatedAt: this.toLocalIso(this.readString(metrics, ['updated_at', 'updatedAt']) ?? new Date().toISOString()),
      totalCanceledSlots,
      filledSlots,
      openSlots,
      refillRate,
      revenueRecovered,
      recoveredMinutes,
      totalAttempts,
      attemptsPerSlot,
      resolvedOutcomes,
      dailyRevenue: dailyRevenueRows?.length
        ? this.normalizeDailyRevenue(dailyRevenueRows, weekStart)
        : this.fallbackDailyRevenue(revenueRecovered, weekStart),
      dailyAttempts: dailyAttemptsRows?.length
        ? this.normalizeDailyAttempts(dailyAttemptsRows, weekStart)
        : this.fallbackDailyAttempts(totalAttempts, weekStart),
      outcomes: this.normalizeOutcomes(outcomeRows ?? []),
    };
  }

  private normalizeDailyRevenue(rows: Record<string, unknown>[], weekStart: string): LiveOperationsRevenuePoint[] {
    const values = rows.map((row, index) => ({
      label: this.dailyLabel(row, index, weekStart),
      revenue: this.readNumber(row, ['revenue', 'revenue_recovered', 'revenueRecovered', 'value']),
      height: 8,
    }));
    const maxRevenue = Math.max(...values.map((point) => point.revenue), 1);
    return values.map((point) => ({
      ...point,
      height: point.revenue ? Math.max(14, Math.round((point.revenue / maxRevenue) * 100)) : 8,
    }));
  }

  private normalizeDailyAttempts(rows: Record<string, unknown>[], weekStart: string): LiveOperationsAttemptPoint[] {
    const values = rows.map((row, index) => ({
      label: this.dailyLabel(row, index, weekStart),
      attempts: this.readNumber(row, ['attempts', 'total_attempts', 'totalAttempts', 'value']),
      height: 8,
    }));
    const maxAttempts = Math.max(...values.map((point) => point.attempts), 1);
    return values.map((point) => ({
      ...point,
      height: point.attempts ? Math.max(16, Math.round((point.attempts / maxAttempts) * 100)) : 8,
    }));
  }

  private normalizeOutcomes(rows: Record<string, unknown>[]): LiveOperationsOutcome[] {
    const colors = ['bg-emerald-500', 'bg-amber-500', 'bg-blue-500', 'bg-rose-500', 'bg-purple-500', 'bg-gray-500'];
    return rows
      .map((row, index) => ({
        reason: this.readString(row, ['reason', 'outcome_reason', 'outcomeReason', 'outcome']) ?? 'Unknown outcome',
        count: this.readNumber(row, ['count', 'total', 'value']),
        color: this.readString(row, ['color']) ?? colors[index % colors.length],
      }))
      .filter((outcome) => outcome.count > 0);
  }

  private fallbackDailyRevenue(total: number, weekStart: string): LiveOperationsRevenuePoint[] {
    return this.normalizeDailyRevenue(
      this.distribute(total, [0.12, 0.21, 0.18, 0.26, 0.16, 0.07, 0]).map((revenue, index) => ({
        label: format(addDays(new Date(`${weekStart}T00:00:00`), index), 'EEE'),
        revenue,
      })),
      weekStart,
    );
  }

  private fallbackDailyAttempts(total: number, weekStart: string): LiveOperationsAttemptPoint[] {
    return this.normalizeDailyAttempts(
      this.distribute(total, [0.14, 0.18, 0.16, 0.22, 0.2, 0.1, 0]).map((attempts, index) => ({
        label: format(addDays(new Date(`${weekStart}T00:00:00`), index), 'EEE'),
        attempts,
      })),
      weekStart,
    );
  }

  private async hydrateSavedAppointment(saved: ApiAppointment, fallbackPatient?: Patient): Promise<Appointment> {
    const [customers, treatments] = await Promise.all([
      this.get<ApiCustomer[]>('/api/customers'),
      this.get<ApiTreatment[]>('/api/treatments'),
    ]);
    const patientBySvnr = new Map(customers.map((customer) => [customer.social_security_number, this.mapPatient(customer)]));
    if (fallbackPatient) {
      patientBySvnr.set(fallbackPatient.svnr, fallbackPatient);
    }
    const treatmentById = new Map(treatments.map((treatment) => [String(treatment.id), this.mapTreatment(treatment)]));
    return this.mapAppointment(saved, patientBySvnr, treatmentById);
  }

  private async toAppointmentPayload(appointment: Appointment): Promise<Record<string, unknown>> {
    const treatmentId = appointment.treatmentId ?? await this.treatmentIdForName(appointment.reason);
    if (!treatmentId) {
      throw new Error('Selected treatment is not available in the API.');
    }
    const start = parseISO(appointment.start);
    const end = addMinutes(start, appointment.durationMinutes);

    return {
      customer_id: appointment.svnr,
      staff_id: Number(appointment.doctorId),
      room_id: Number(appointment.roomId),
      treatment_id: Number(treatmentId),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: appointment.status ?? 'scheduled',
    };
  }

  private async treatmentIdForName(name: string): Promise<string> {
    const treatments = await this.get<ApiTreatment[]>('/api/treatments');
    return String(treatments.find((treatment) => treatment.name === name)?.id ?? '');
  }

  private async ensureCustomer(appointment: Appointment): Promise<{ created: boolean; patient: Patient }> {
    const svnr = appointment.svnr.trim();

    try {
      const existing = await this.get<ApiCustomer>(`/api/customers/${encodeURIComponent(svnr)}`);
      return { created: false, patient: this.mapPatient(existing) };
    } catch (error) {
      if (!(error instanceof ApiRequestError) || error.status !== 404) {
        throw error;
      }
    }

    const [firstName, lastName] = this.splitPersonName(appointment.patientName);
    const customerPayload = {
      social_security_number: svnr,
      first_name: firstName,
      last_name: lastName,
      phone_number: appointment.phone.trim(),
      birth_date: this.birthDateFromSvnr(svnr),
    };
    const created = await this.post<ApiCustomer | null>('/api/customers', customerPayload);

    return {
      created: true,
      patient: created ? this.mapPatient(created) : this.mapPatient(customerPayload),
    };
  }

  private mapPatient(customer: ApiCustomer): Patient {
    return {
      svnr: customer.social_security_number,
      name: `${customer.first_name} ${customer.last_name}`.trim(),
      phone: customer.phone_number,
    };
  }

  private mapTreatment(treatment: ApiTreatment): Treatment {
    return {
      id: String(treatment.id),
      name: treatment.name,
      minDurationMinutes: Number(treatment.min_duration_minutes ?? 0),
    };
  }

  private mapAppointment(
    appointment: ApiAppointment,
    patientBySvnr: Map<string, Patient>,
    treatmentById: Map<string, Treatment>,
  ): Appointment {
    const start = new Date(appointment.start_time);
    const end = new Date(appointment.end_time);
    const patient = patientBySvnr.get(appointment.customer_id);
    const treatment = treatmentById.get(String(appointment.treatment_id));

    return {
      id: String(appointment.id),
      svnr: appointment.customer_id,
      patientName: patient?.name ?? appointment.customer_id,
      phone: patient?.phone ?? '',
      reason: treatment?.name ?? `Treatment ${appointment.treatment_id}`,
      treatmentId: String(appointment.treatment_id),
      durationMinutes: Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000)),
      roomId: String(appointment.room_id),
      doctorId: String(appointment.staff_id),
      start: this.toLocalIso(appointment.start_time),
      status: appointment.status,
    };
  }

  private splitStaffName(name: string): [string, string] {
    const parts = name.replace(/^dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return [parts[0] ?? name.trim(), ''];
    return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
  }

  private splitPersonName(name: string): [string, string] {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return [parts[0] ?? name.trim(), ''];
    return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
  }

  private birthDateFromSvnr(svnr: string): string {
    const digits = svnr.replace(/\D/g, '');
    const lastSix = digits.slice(-6);
    const fullDate = this.parseSvnrDate(lastSix, true);
    if (fullDate) return fullDate;

    const lastFour = digits.slice(-4);
    const fallbackDate = this.parseSvnrDate(lastFour, false);
    if (fallbackDate) return fallbackDate;

    throw new Error('SVNR must include a valid birth date so the new customer can be created.');
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }

  private readNumber(source: Record<string, unknown> | null, keys: string[]): number {
    if (!source) return 0;
    for (const key of keys) {
      if (key in source) return this.toNumber(source[key] as number | string | null | undefined);
    }
    return 0;
  }

  private readString(source: Record<string, unknown> | null, keys: string[]): string | null {
    if (!source) return null;
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return null;
  }

  private readArray(source: Record<string, unknown> | null, keys: string[]): Record<string, unknown>[] | null {
    if (!source) return null;
    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) {
        return value
          .map((item) => this.asRecord(item))
          .filter((item): item is Record<string, unknown> => Boolean(item));
      }
    }
    return null;
  }

  private dailyLabel(row: Record<string, unknown>, index: number, weekStart: string): string {
    const explicitLabel = this.readString(row, ['label', 'day']);
    if (explicitLabel) return explicitLabel;

    const date = this.readString(row, ['date']);
    if (date) return format(new Date(date), 'EEE');

    return format(addDays(new Date(`${weekStart}T00:00:00`), index), 'EEE');
  }

  private distribute(total: number, weights: number[]): number[] {
    const exactValues = weights.map((weight) => total * weight);
    const values = exactValues.map(Math.floor);
    let remaining = Math.round(total) - values.reduce((sum, value) => sum + value, 0);

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

  private parseSvnrDate(value: string, includesDay: boolean): string | null {
    if (!/^\d+$/.test(value)) return null;

    const day = includesDay ? Number(value.slice(0, 2)) : 1;
    const month = Number(includesDay ? value.slice(2, 4) : value.slice(0, 2));
    const yearTwoDigits = Number(includesDay ? value.slice(4, 6) : value.slice(2, 4));
    if (day < 1 || day > 31 || month < 1 || month > 12 || Number.isNaN(yearTwoDigits)) return null;

    const currentYearTwoDigits = new Date().getFullYear() % 100;
    const fullYear = yearTwoDigits <= currentYearTwoDigits ? 2000 + yearTwoDigits : 1900 + yearTwoDigits;
    const candidate = new Date(Date.UTC(fullYear, month - 1, day));
    if (
      candidate.getUTCFullYear() !== fullYear ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) {
      return null;
    }

    return format(candidate, 'yyyy-MM-dd');
  }

  private toLocalIso(value: string): string {
    return format(new Date(value), "yyyy-MM-dd'T'HH:mm:ss");
  }

  private toNumber(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async get<T>(path: string): Promise<T> {
    try {
      return await firstValueFrom(this.http.get<T>(`${API_BASE_URL}${path}`).pipe(timeout(API_TIMEOUT_MS)));
    } catch (error) {
      throw this.apiError(error, `GET ${path}`);
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    try {
      return await firstValueFrom(this.http.post<T>(`${API_BASE_URL}${path}`, body).pipe(timeout(API_TIMEOUT_MS)));
    } catch (error) {
      throw this.apiError(error, `POST ${path}`);
    }
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    try {
      return await firstValueFrom(this.http.put<T>(`${API_BASE_URL}${path}`, body).pipe(timeout(API_TIMEOUT_MS)));
    } catch (error) {
      throw this.apiError(error, `PUT ${path}`);
    }
  }

  private async delete(path: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete<void>(`${API_BASE_URL}${path}`).pipe(timeout(API_TIMEOUT_MS)));
    } catch (error) {
      throw this.apiError(error, `DELETE ${path}`);
    }
  }

  private apiError(error: unknown, operation: string): Error {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return new ApiRequestError(`API timed out during ${operation}. Please check the backend connection and try again.`);
    }

    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return new ApiRequestError(`API is not reachable during ${operation}. Please check the backend connection.`, 0);
      }

      const detail = typeof error.error === 'string'
        ? error.error
        : error.error?.message ?? error.message;
      return new ApiRequestError(`${operation} failed with ${error.status}${detail ? `: ${detail}` : ''}`, error.status);
    }

    return error instanceof Error ? error : new Error(`${operation} failed.`);
  }
}
