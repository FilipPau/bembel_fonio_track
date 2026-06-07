import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-credits',
  imports: [CommonModule],
  templateUrl: './credits.component.html',
})
export class CreditsComponent {
  mainTechnologies = [
    { name: 'Angular', mark: 'A', description: 'Application framework', accent: 'bg-red-100 text-red-700' },
    { name: 'Flask', mark: 'FL', description: 'Backend API framework', accent: 'bg-slate-100 text-slate-700' },
    { name: 'PostgreSQL', mark: 'PG', description: 'Original database technology', accent: 'bg-indigo-100 text-indigo-700' },
    { name: 'Fonio', mark: 'FO', description: 'Project platform and backend tooling', accent: 'bg-amber-100 text-amber-700' },
  ];

  libraries = [
    { name: 'Tailwind CSS', mark: 'TW', description: 'Utility-first interface styling', accent: 'bg-sky-100 text-sky-700' },
    { name: 'angular-calendar', mark: 'CAL', description: 'Week calendar and appointment views', accent: 'bg-blue-100 text-blue-700' },
    { name: 'date-fns', mark: 'DF', description: 'Date formatting and week navigation', accent: 'bg-emerald-100 text-emerald-700' },
  ];

  developers = ['Filip Paunovic', 'Simrith Singh', 'Markus Antonius Johannes Wanke', 'Shane Matejka'];
}
