import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { addMinutes, isSameDay, parseISO } from 'date-fns';
import { Appointment, DataStoreService, PracticeResources } from '../../../core/data/data-store.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private dataStore = inject(DataStoreService);

  now = signal(new Date());
  appointments = signal<Appointment[]>([]);
  resources = signal<PracticeResources>({ rooms: [], doctors: [], staffShifts: [], treatments: [] });
  loading = signal(true);
  loadFailed = signal(false);

  activeAppointments = computed(() => {
    const now = this.now();
    return this.appointments().filter((appointment) => {
      const start = parseISO(appointment.start);
      const end = addMinutes(start, appointment.durationMinutes);
      return start <= now && end >= now;
    });
  });

  todaysAppointments = computed(() =>
    this.appointments().filter((appointment) => isSameDay(parseISO(appointment.start), this.now())),
  );

  nextAppointment = computed(() =>
    [...this.appointments()]
      .filter((appointment) => parseISO(appointment.start) >= this.now())
      .sort((left, right) => left.start.localeCompare(right.start))[0] ?? null,
  );

  staffedRoomsToday = computed(() => {
    const today = this.now();
    return this.resources().staffShifts.filter((shift) => isSameDay(parseISO(shift.start), today));
  });

  async ngOnInit(): Promise<void> {
    try {
      const [appointments, resources] = await Promise.all([
        this.dataStore.loadAppointments(),
        this.dataStore.loadResources(),
      ]);
      this.appointments.set(appointments);
      this.resources.set(resources);
      this.loadFailed.set(false);
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  roomName(roomId: string): string {
    return this.resources().rooms.find((room) => room.id === roomId)?.name ?? 'Unknown room';
  }

  doctorName(doctorId: string): string {
    return this.resources().doctors.find((doctor) => doctor.id === doctorId)?.name ?? 'Unknown doctor';
  }
}
