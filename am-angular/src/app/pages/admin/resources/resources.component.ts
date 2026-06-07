import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { format, parseISO } from 'date-fns';
import { PracticeResources, DataStoreService, StaffShift } from '../../../core/data/data-store.service';

interface StaffShiftDay {
  dateKey: string;
  label: string;
  shifts: StaffShift[];
}

type NoticeKind = 'success' | 'error' | 'info';

interface Notice {
  kind: NoticeKind;
  message: string;
}

@Component({
  selector: 'app-resources',
  imports: [CommonModule, FormsModule],
  templateUrl: './resources.component.html',
})
export class ResourcesComponent implements OnInit {
  private dataStore = inject(DataStoreService);

  resources = signal<PracticeResources>({ rooms: [], doctors: [], staffShifts: [], treatments: [] });
  roomForm = signal({ name: '' });
  doctorForm = signal({ name: '', treatments: [] as string[] });
  treatmentSearch = signal('');
  loading = signal(true);
  loadFailed = signal(false);
  notice = signal<Notice | null>(null);
  saving = signal(false);

  treatmentOptions = computed(() => this.resources().treatments.map((treatment) => treatment.name));

  filteredTreatmentOptions = computed(() => {
    const search = this.treatmentSearch().trim().toLowerCase();
    const selected = new Set(this.doctorForm().treatments);
    return this.treatmentOptions()
      .filter((treatment) => !selected.has(treatment))
      .filter((treatment) => !search || treatment.toLowerCase().includes(search))
      .slice(0, 6);
  });

  staffShiftDays = computed<StaffShiftDay[]>(() => {
    const groups = new Map<string, StaffShift[]>();
    const shifts = [...this.resources().staffShifts].sort((left, right) => left.start.localeCompare(right.start));

    for (const shift of shifts) {
      const dateKey = format(parseISO(shift.start), 'yyyy-MM-dd');
      groups.set(dateKey, [...(groups.get(dateKey) ?? []), shift]);
    }

    return [...groups.entries()].map(([dateKey, shiftsForDay]) => ({
      dateKey,
      label: format(parseISO(`${dateKey}T00:00:00`), 'EEEE, dd MMM yyyy'),
      shifts: shiftsForDay,
    }));
  });

  async ngOnInit(): Promise<void> {
    try {
      this.resources.set(await this.dataStore.loadResources());
      this.loadFailed.set(false);
    } catch (error) {
      this.loadFailed.set(true);
      this.showError(error, 'Could not load practice resources from the API.');
    } finally {
      this.loading.set(false);
    }
  }

  updateRoomName(value: string): void {
    this.roomForm.update((form) => ({ ...form, name: value }));
  }

  updateDoctorName(value: string): void {
    this.doctorForm.update((form) => ({ ...form, name: value }));
  }

  updateTreatmentSearch(value: string): void {
    this.treatmentSearch.set(value);
  }

  addTreatment(treatment: string): void {
    if (this.doctorForm().treatments.includes(treatment)) return;
    this.doctorForm.update((form) => ({
      ...form,
      treatments: [...form.treatments, treatment],
    }));
    this.treatmentSearch.set('');
  }

  removeTreatment(treatment: string): void {
    this.doctorForm.update((form) => ({
      ...form,
      treatments: form.treatments.filter((item) => item !== treatment),
    }));
  }

  async addRoom(): Promise<void> {
    const form = this.roomForm();
    const name = form.name.trim();
    if (!name) {
      this.showNotice('error', 'Enter a room name before saving.');
      return;
    }

    this.saving.set(true);
    try {
      const room = await this.dataStore.createRoom(name);
      this.resources.update((resources) => ({
        ...resources,
        rooms: [...resources.rooms, room],
      }));
      this.roomForm.set({ name: '' });
      this.showNotice('success', 'Treatment room was created successfully.');
    } catch (error) {
      this.showError(error, 'Could not create the treatment room.');
    } finally {
      this.saving.set(false);
    }
  }

  async removeRoom(roomId: string): Promise<void> {
    this.saving.set(true);
    try {
      await this.dataStore.deleteRoom(roomId);
      this.resources.update((resources) => ({
        ...resources,
        rooms: resources.rooms.filter((room) => room.id !== roomId),
        staffShifts: resources.staffShifts.filter((shift) => shift.roomId !== roomId),
      }));
      this.showNotice('success', 'Treatment room was removed successfully.');
    } catch (error) {
      this.showError(error, 'Could not remove the treatment room.');
    } finally {
      this.saving.set(false);
    }
  }

  async addDoctor(): Promise<void> {
    const form = this.doctorForm();
    const name = form.name.trim();
    if (!name) {
      this.showNotice('error', 'Enter a doctor name before saving.');
      return;
    }

    const treatments = form.treatments.length ? form.treatments : this.treatmentOptions().slice(0, 1);
    if (!treatments.length) {
      this.showNotice('error', 'At least one treatment must be available before a doctor can be created.');
      return;
    }

    this.saving.set(true);
    try {
      this.resources.set(await this.dataStore.createDoctor(name, treatments));
      this.doctorForm.set({ name: '', treatments: [] });
      this.treatmentSearch.set('');
      this.showNotice('success', 'Practicing doctor was created successfully.');
    } catch (error) {
      this.showError(error, 'Could not create the practicing doctor.');
    } finally {
      this.saving.set(false);
    }
  }

  async removeDoctor(doctorId: string): Promise<void> {
    this.saving.set(true);
    try {
      await this.dataStore.deleteDoctor(doctorId);
      this.resources.set(await this.dataStore.loadResources());
      this.showNotice('success', 'Practicing doctor was removed successfully.');
    } catch (error) {
      this.showError(error, 'Could not remove the practicing doctor.');
    } finally {
      this.saving.set(false);
    }
  }

  doctorName(doctorId: string): string {
    return this.resources().doctors.find((doctor) => doctor.id === doctorId)?.name ?? 'Unknown doctor';
  }

  roomName(roomId: string): string {
    return this.resources().rooms.find((room) => room.id === roomId)?.name ?? 'Unknown room';
  }

  formatShiftTime(shift: StaffShift): string {
    return `${format(parseISO(shift.start), 'HH:mm')} - ${format(parseISO(shift.end), 'HH:mm')}`;
  }

  shiftDuration(shift: StaffShift): string {
    const minutes = Math.round((parseISO(shift.end).getTime() - parseISO(shift.start).getTime()) / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (!remainingMinutes) return `${hours}h`;
    return `${hours}h ${remainingMinutes}min`;
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
