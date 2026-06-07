import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
    },
    {
        path: 'todos',
        loadComponent: () => import('./todos/todos.component').then(m => m.TodosComponent)
    },
    {
        path: 'settings',
        loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent)
    },
    {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
    }
];