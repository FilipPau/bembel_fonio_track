import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalendarEvent, CalendarModule, CalendarView } from 'angular-calendar';
import { addDays, addMinutes, addWeeks, format, parseISO, startOfWeek } from 'date-fns';
import {
  Appointment,
  DataStoreService,
  Patient,
  PracticeResources,
  StaffShift,
} from '../../../core/data/data-store.service';

type CalendarMode = 'rooms' | 'doctors';
type NoticeKind = 'success' | 'error' | 'info';

interface Notice {
  kind: NoticeKind;
  message: string;
}

interface AppointmentForm {
  svnr: string;
  patientName: string;
  phone: string;
  reason: string;
  durationMinutes: number | null;
  roomId: string;
  doctorId: string;
  date: string;
  time: string;
}

interface FinderForm {
  durationMinutes: number | null;
  reason: string;
  roomId: string;
  doctorId: string;
}

@Component({
  selector: 'app-book-appointment',
  imports: [CommonModule, FormsModule, CalendarModule],
  templateUrl: './book-appointment.component.html',
})
export class BookAppointmentComponent implements OnInit {
  private dataStore = inject(DataStoreService);

  CalendarView = CalendarView;
  viewDate = signal(startOfWeek(new Date('2026-06-08T09:00:00'), { weekStartsOn: 1 }));
  mode = signal<CalendarMode>('rooms');
  selectedRoomId = signal('all');
  selectedDoctorId = signal('all');
  selectedAppointmentId = signal<string | null>(null);
  dialogOpen = signal(false);
  editingAppointment = signal(false);
  finderExpanded = signal(true);
  addAppointmentExpanded = signal(true);
  finderMessage = signal('');
  notice = signal<Notice | null>(null);
  loading = signal(true);
  saving = signal(false);
  readonly segmentMinutes = 30;

  resources = signal<PracticeResources>({ rooms: [], doctors: [], staffShifts: [], treatments: [] });
  patients = signal<Patient[]>([]);
  appointments = signal<Appointment[]>([]);

  reasons = computed(() => this.resources().treatments.map((treatment) => treatment.name));

  form = signal<AppointmentForm>(this.emptyForm());
  editForm = signal<AppointmentForm>(this.emptyForm());
  finderForm = signal<FinderForm>({
    durationMinutes: null,
    reason: 'Routine check',
    roomId: 'all',
    doctorId: 'all',
  });

  weekEnd = computed(() => addDays(this.viewDate(), 6));

  selectedAppointment = computed(() => {
    const selectedId = this.selectedAppointmentId();
    return this.appointments().find((appointment) => appointment.id === selectedId) ?? null;
  });

  visibleRooms = computed(() => {
    const selected = this.selectedRoomId();
    return selected === 'all'
      ? this.resources().rooms
      : this.resources().rooms.filter((room) => room.id === selected);
  });

  visibleDoctors = computed(() => {
    const selected = this.selectedDoctorId();
    return selected === 'all'
      ? this.resources().doctors
      : this.resources().doctors.filter((doctor) => doctor.id === selected);
  });

  upcomingAppointments = computed(() =>
    [...this.appointments()].sort((left, right) => left.start.localeCompare(right.start)).slice(0, 8),
  );

  async ngOnInit(): Promise<void> {
    try {
      const [resources, patients, appointments] = await Promise.all([
        this.dataStore.loadResources(),
        this.dataStore.loadPatients(),
        this.dataStore.loadAppointments(),
      ]);

      this.resources.set(resources);
      this.patients.set(patients);
      this.appointments.set(appointments);
      const defaultReason = resources.treatments[0]?.name ?? '';
      this.form.update((form) => ({
        ...form,
        roomId: resources.rooms[0]?.id ?? '',
        doctorId: resources.doctors[0]?.id ?? '',
        reason: defaultReason || form.reason,
      }));
      this.finderForm.update((form) => ({
        ...form,
        reason: defaultReason || form.reason,
      }));
    } catch (error) {
      this.showError(error, 'Could not load appointments from the API.');
    } finally {
      this.loading.set(false);
    }
  }

  updateForm(field: keyof AppointmentForm, value: string | number | null): void {
    this.form.update((form) => ({ ...form, [field]: value }));
    if (field === 'svnr' && typeof value === 'string') this.fillPatientBySvnr(value, false);
  }

  updateFinderForm(field: keyof FinderForm, value: string | number | null): void {
    this.finderForm.update((form) => ({ ...form, [field]: value }));
  }

  updateEditForm(field: keyof AppointmentForm, value: string | number | null): void {
    this.editForm.update((form) => ({ ...form, [field]: value }));
    if (field === 'svnr' && typeof value === 'string') {
      const patient = this.patients().find((item) => item.svnr === value.trim());
      if (patient) {
        this.editForm.update((form) => ({ ...form, patientName: patient.name, phone: patient.phone }));
      }
    }
  }

  fillPatientBySvnr(svnr = this.form().svnr, announce = true): void {
    const trimmedSvnr = svnr.trim();
    if (!trimmedSvnr) {
      if (announce) this.showNotice('info', 'Enter an SVNR before searching.');
      return;
    }

    const patient = this.patients().find((item) => item.svnr === trimmedSvnr);
    if (!patient) {
      if (announce) {
        this.showNotice('info', 'No existing customer was found. Fill in name and phone, then the customer will be created before booking.');
      }
      return;
    }

    this.form.update((form) => ({ ...form, svnr: patient.svnr, patientName: patient.name, phone: patient.phone }));
    if (announce) this.showNotice('success', 'Patient details loaded from the customer table.');
  }

  async addAppointment(): Promise<void> {
    const form = this.form();
    const validationError = this.validateAppointmentForm(form);
    if (validationError) {
      this.showNotice('error', validationError);
      return;
    }

    this.saving.set(true);
    try {
      const result = await this.dataStore.createAppointment(this.formToAppointment(form, `draft-${Date.now()}`));
      const appointment = result.appointment;
      this.upsertPatient(result.patient);
      this.appointments.update((appointments) => [...appointments, appointment]);
      this.openAppointment(appointment.id);
      this.viewDate.set(startOfWeek(parseISO(appointment.start), { weekStartsOn: 1 }));
      this.showNotice(
        'success',
        result.customerCreated
          ? 'Customer was created and the appointment was booked.'
          : 'Appointment was booked successfully.',
      );
    } catch (error) {
      this.showError(error, 'Could not book the appointment.');
    } finally {
      this.saving.set(false);
    }
  }

  async removeAppointment(appointmentId: string): Promise<void> {
    this.saving.set(true);
    try {
      await this.dataStore.deleteAppointment(appointmentId);
      this.appointments.update((appointments) => appointments.filter((appointment) => appointment.id !== appointmentId));
      this.closeDialog();
      this.showNotice('success', 'Appointment was deleted successfully.');
    } catch (error) {
      this.showError(error, 'Could not delete the appointment.');
    } finally {
      this.saving.set(false);
    }
  }

  async saveEditedAppointment(): Promise<void> {
    const selected = this.selectedAppointment();
    const form = this.editForm();
    const validationError = this.validateAppointmentForm(form, selected?.id);
    if (!selected || validationError) {
      this.showNotice('error', validationError ?? 'No appointment is selected for editing.');
      return;
    }

    this.saving.set(true);
    try {
      const result = await this.dataStore.updateAppointment(this.formToAppointment(form, selected.id));
      const updated = result.appointment;
      this.upsertPatient(result.patient);
      this.appointments.update((appointments) => appointments.map((appointment) => appointment.id === selected.id ? updated : appointment));
      this.selectedAppointmentId.set(updated.id);
      this.editingAppointment.set(false);
      this.showNotice(
        'success',
        result.customerCreated
          ? 'Customer was created and the appointment was updated.'
          : 'Appointment was updated successfully.',
      );
    } catch (error) {
      this.showError(error, 'Could not update the appointment.');
    } finally {
      this.saving.set(false);
    }
  }

  findEarliestAppointment(): void {
    const form = this.finderForm();
    const duration = Number(form.durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) {
      this.finderMessage.set('Enter a duration in minutes before searching.');
      return;
    }

    const candidate = this.findEarliestSlot({
      durationMinutes: duration,
      reason: form.reason,
      roomId: form.roomId || 'all',
      doctorId: form.doctorId || 'all',
    });

    if (!candidate) {
      this.finderMessage.set('No matching free slot was found in the stored staff shifts.');
      return;
    }

    this.form.update((current) => ({
      ...current,
      roomId: candidate.roomId,
      doctorId: candidate.doctorId,
      date: format(candidate.start, 'yyyy-MM-dd'),
      time: format(candidate.start, 'HH:mm'),
      reason: form.reason,
      durationMinutes: duration,
    }));
    this.viewDate.set(startOfWeek(candidate.start, { weekStartsOn: 1 }));
    this.selectedRoomId.set(candidate.roomId);
    this.selectedDoctorId.set(candidate.doctorId);
    this.finderMessage.set(`Earliest slot: ${format(candidate.start, 'EEE, dd MMM HH:mm')} in ${this.roomName(candidate.roomId)} with ${this.doctorName(candidate.doctorId)}.`);
  }

  previousWeek(): void {
    this.viewDate.set(addWeeks(this.viewDate(), -1));
  }

  nextWeek(): void {
    this.viewDate.set(addWeeks(this.viewDate(), 1));
  }

  eventsForRoom(roomId: string): CalendarEvent[] {
    return this.appointments()
      .filter((appointment) => appointment.roomId === roomId)
      .map((appointment) => this.toCalendarEvent(appointment, this.doctorName(appointment.doctorId)));
  }

  eventsForDoctor(doctorId: string): CalendarEvent[] {
    return this.appointments()
      .filter((appointment) => appointment.doctorId === doctorId)
      .map((appointment) => this.toCalendarEvent(appointment, this.roomName(appointment.roomId)));
  }

  selectEvent(event: CalendarEvent): void {
    this.openAppointment(String(event.id));
  }

  openAppointment(appointmentId: string): void {
    const appointment = this.appointments().find((item) => item.id === appointmentId);
    if (!appointment) return;
    this.selectedAppointmentId.set(appointmentId);
    this.editForm.set(this.appointmentToForm(appointment));
    this.editingAppointment.set(false);
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.editingAppointment.set(false);
    this.selectedAppointmentId.set(null);
  }

  roomName(roomId: string): string {
    return this.resources().rooms.find((room) => room.id === roomId)?.name ?? 'Unknown room';
  }

  doctorName(doctorId: string): string {
    return this.resources().doctors.find((doctor) => doctor.id === doctorId)?.name ?? 'Unknown doctor';
  }

  formatAppointmentTime(appointment: Appointment): string {
    return format(parseISO(appointment.start), 'EEE, dd MMM HH:mm');
  }

  appointmentTooltip(appointment: Appointment): string {
    const start = parseISO(appointment.start);
    const end = addMinutes(start, appointment.durationMinutes);
    return `${appointment.patientName}\n${this.roomName(appointment.roomId)}\n${this.doctorName(appointment.doctorId)}\n${appointment.reason}\n${format(start, 'EEE, dd MMM HH:mm')} - ${format(end, 'HH:mm')}`;
  }

  calendarTooltip(appointment: Appointment): string {
    const start = parseISO(appointment.start);
    const end = addMinutes(start, appointment.durationMinutes);
    return [
      appointment.patientName,
      this.roomName(appointment.roomId),
      this.doctorName(appointment.doctorId),
      appointment.reason,
      `${format(start, 'EEE, dd MMM HH:mm')} - ${format(end, 'HH:mm')}`,
    ].join('\n');
  }

  isRoomSegmentStaffed(date: Date, roomId: string): boolean {
    return Boolean(this.roomSegmentShift(date, roomId));
  }

  isDoctorSegmentStaffed(date: Date, doctorId: string): boolean {
    return Boolean(this.doctorSegmentShift(date, doctorId));
  }

  roomSegmentShiftLabel(date: Date, roomId: string): string {
    const shift = this.roomSegmentShift(date, roomId);
    if (!shift || !this.shouldShowShiftLabel(date, shift)) return '';
    return this.shiftLabel(date, shift, this.doctorName(shift.doctorId));
  }

  doctorSegmentShiftLabel(date: Date, doctorId: string): string {
    const shift = this.doctorSegmentShift(date, doctorId);
    if (!shift || !this.shouldShowShiftLabel(date, shift)) return '';
    return this.shiftLabel(date, shift, this.roomName(shift.roomId));
  }

  isRoomShiftStartSegment(date: Date, roomId: string): boolean {
    const shift = this.roomSegmentShift(date, roomId);
    return Boolean(shift && this.isShiftStartSegment(date, shift));
  }

  isDoctorShiftStartSegment(date: Date, doctorId: string): boolean {
    const shift = this.doctorSegmentShift(date, doctorId);
    return Boolean(shift && this.isShiftStartSegment(date, shift));
  }

  isRoomShiftEndSegment(date: Date, roomId: string): boolean {
    const shift = this.roomSegmentShift(date, roomId);
    return Boolean(shift && this.isShiftEndSegment(date, shift));
  }

  isDoctorShiftEndSegment(date: Date, doctorId: string): boolean {
    const shift = this.doctorSegmentShift(date, doctorId);
    return Boolean(shift && this.isShiftEndSegment(date, shift));
  }

  private toCalendarEvent(appointment: Appointment, context: string): CalendarEvent {
    const start = parseISO(appointment.start);
    const end = addMinutes(start, appointment.durationMinutes);
    return {
      id: appointment.id,
      start,
      end,
      title: this.calendarTooltip(appointment),
      color: { primary: '#2563eb', secondary: '#dbeafe' },
      cssClass: appointment.durationMinutes <= 30 ? 'appointment-event compact-appointment-event' : 'appointment-event',
      meta: { type: 'appointment', appointment, context },
    };
  }

  private findEarliestSlot(criteria: { durationMinutes: number; reason: string; roomId: string; doctorId: string }): { start: Date; roomId: string; doctorId: string } | null {
    const shifts = [...this.resources().staffShifts]
      .filter((shift) => criteria.roomId === 'all' || shift.roomId === criteria.roomId)
      .filter((shift) => criteria.doctorId === 'all' || shift.doctorId === criteria.doctorId)
      .filter((shift) => this.doctorCanTreat(shift.doctorId, criteria.reason))
      .sort((left, right) => left.start.localeCompare(right.start));

    for (const shift of shifts) {
      let cursor = parseISO(shift.start);
      const shiftEnd = parseISO(shift.end);
      while (addMinutes(cursor, criteria.durationMinutes) <= shiftEnd) {
        if (this.isSlotFree(cursor, criteria.durationMinutes, shift.roomId, shift.doctorId)) {
          return { start: cursor, roomId: shift.roomId, doctorId: shift.doctorId };
        }
        cursor = addMinutes(cursor, 15);
      }
    }

    return null;
  }

  private isSlotFree(start: Date, durationMinutes: number, roomId: string, doctorId: string, ignoredAppointmentId?: string): boolean {
    const end = addMinutes(start, durationMinutes);
    return !this.appointments().some((appointment) => {
      if (appointment.id === ignoredAppointmentId) return false;
      if (appointment.roomId !== roomId && appointment.doctorId !== doctorId) return false;
      const appointmentStart = parseISO(appointment.start);
      const appointmentEnd = addMinutes(appointmentStart, appointment.durationMinutes);
      return start < appointmentEnd && end > appointmentStart;
    });
  }

  private doctorCanTreat(doctorId: string, reason: string): boolean {
    return this.resources().doctors.find((doctor) => doctor.id === doctorId)?.treatments.includes(reason) ?? false;
  }

  private roomSegmentShift(date: Date, roomId: string): StaffShift | null {
    return this.resources().staffShifts.find((shift) =>
      shift.roomId === roomId && this.isSegmentInsideShift(date, shift),
    ) ?? null;
  }

  private doctorSegmentShift(date: Date, doctorId: string): StaffShift | null {
    return this.resources().staffShifts.find((shift) =>
      shift.doctorId === doctorId && this.isSegmentInsideShift(date, shift),
    ) ?? null;
  }

  private isSegmentInsideShift(date: Date, shift: StaffShift): boolean {
    return date >= parseISO(shift.start) && date < parseISO(shift.end);
  }

  private shouldShowShiftLabel(date: Date, shift: StaffShift): boolean {
    return this.isShiftStartSegment(date, shift) || date.getMinutes() === 0;
  }

  private shiftLabel(date: Date, shift: StaffShift, resourceName: string): string {
    if (this.isShiftStartSegment(date, shift)) {
      return `${resourceName} ${format(parseISO(shift.start), 'HH:mm')}-${format(parseISO(shift.end), 'HH:mm')}`;
    }
    return resourceName;
  }

  private isShiftStartSegment(date: Date, shift: StaffShift): boolean {
    return date.getTime() === parseISO(shift.start).getTime();
  }

  private isShiftEndSegment(date: Date, shift: StaffShift): boolean {
    const shiftEnd = parseISO(shift.end);
    const segmentEnd = addMinutes(date, this.segmentMinutes);
    return date < shiftEnd && segmentEnd >= shiftEnd;
  }

  private appointmentToForm(appointment: Appointment): AppointmentForm {
    const start = parseISO(appointment.start);
    return {
      svnr: appointment.svnr,
      patientName: appointment.patientName,
      phone: appointment.phone,
      reason: appointment.reason,
      durationMinutes: appointment.durationMinutes,
      roomId: appointment.roomId,
      doctorId: appointment.doctorId,
      date: format(start, 'yyyy-MM-dd'),
      time: format(start, 'HH:mm'),
    };
  }

  private formToAppointment(form: AppointmentForm, id: string): Appointment {
    return {
      id,
      svnr: form.svnr.trim(),
      patientName: form.patientName.trim(),
      phone: form.phone.trim(),
      reason: form.reason,
      treatmentId: this.treatmentId(form.reason),
      durationMinutes: Number(form.durationMinutes),
      roomId: form.roomId,
      doctorId: form.doctorId,
      start: `${form.date}T${form.time}:00`,
    };
  }

  private isValidForm(form: AppointmentForm): boolean {
    return Boolean(
      form.svnr.trim() &&
      form.patientName.trim() &&
      form.phone.trim() &&
      form.reason &&
      form.roomId &&
      form.doctorId &&
      form.date &&
      form.time &&
      Number(form.durationMinutes) > 0,
    );
  }

  private emptyForm(): AppointmentForm {
    return {
      svnr: '',
      patientName: '',
      phone: '',
      reason: 'Routine check',
      durationMinutes: 30,
      roomId: '',
      doctorId: '',
      date: '2026-06-08',
      time: '09:00',
    };
  }

  private treatmentId(reason: string): string | undefined {
    return this.resources().treatments.find((treatment) => treatment.name === reason)?.id;
  }

  private validateAppointmentForm(form: AppointmentForm, ignoredAppointmentId?: string): string | null {
    if (!this.isValidForm(form)) {
      return 'Fill in SVNR, patient, phone, treatment, duration, room, doctor, date, and time before saving.';
    }

    const duration = Number(form.durationMinutes);
    const start = parseISO(`${form.date}T${form.time}:00`);
    if (!Number.isFinite(duration) || duration <= 0 || Number.isNaN(start.getTime())) {
      return 'Use a valid date, time, and duration in minutes.';
    }

    if (!this.treatmentId(form.reason)) {
      return 'Selected treatment is not available in the API.';
    }

    if (!this.doctorCanTreat(form.doctorId, form.reason)) {
      return `${this.doctorName(form.doctorId)} is not configured for ${form.reason}.`;
    }

    if (!this.hasStaffedCoverage(start, duration, form.roomId, form.doctorId)) {
      return 'The selected doctor is not staffed in this room for the full appointment time.';
    }

    if (!this.isSlotFree(start, duration, form.roomId, form.doctorId, ignoredAppointmentId)) {
      return 'This time overlaps an existing appointment for the selected room or doctor.';
    }

    return null;
  }

  private hasStaffedCoverage(start: Date, durationMinutes: number, roomId: string, doctorId: string): boolean {
    const end = addMinutes(start, durationMinutes);
    return this.resources().staffShifts.some((shift) =>
      shift.roomId === roomId &&
      shift.doctorId === doctorId &&
      start >= parseISO(shift.start) &&
      end <= parseISO(shift.end),
    );
  }

  private upsertPatient(patient: Patient): void {
    this.patients.update((patients) => {
      const existing = patients.some((item) => item.svnr === patient.svnr);
      return existing
        ? patients.map((item) => item.svnr === patient.svnr ? patient : item)
        : [...patients, patient];
    });
  }

  private showNotice(kind: NoticeKind, message: string): void {
    this.notice.set({ kind, message });
  }

  private showError(error: unknown, fallback: string): void {
    const message = error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback;
    this.showNotice('error', message || fallback);
  }
}
