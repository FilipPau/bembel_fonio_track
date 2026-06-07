import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/admin/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../../dynamicdata/live-dashboard.component').then(
            (m) => m.LiveDashboardComponent,
          ),
      },
      {
        path: 'book-appointment',
        loadComponent: () =>
          import('./pages/admin/book-appointment/book-appointment.component').then(
            (m) => m.BookAppointmentComponent,
          ),
      },
      {
        path: 'resources',
        loadComponent: () =>
          import('./pages/admin/resources/resources.component').then(
            (m) => m.ResourcesComponent,
          ),
      },
      {
        path: 'credits',
        loadComponent: () =>
          import('./pages/admin/credits/credits.component').then(
            (m) => m.CreditsComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
];
