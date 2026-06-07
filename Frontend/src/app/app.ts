import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'app-root',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    MatSidenavModule,
    MatTableModule,
    MatToolbarModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly navItems = [
    { icon: 'dashboard', label: 'Dashboard', active: true },
    { icon: 'inventory_2', label: 'Bestand' },
    { icon: 'local_shipping', label: 'Lieferungen' },
    { icon: 'analytics', label: 'Reports' },
    { icon: 'settings', label: 'Einstellungen' }
  ];

  readonly stats = [
    { label: 'Umsatz', value: '48.920 EUR', delta: '+12,4%', icon: 'payments', tone: 'success' },
    { label: 'Bestellungen', value: '1.284', delta: '+8,1%', icon: 'receipt_long', tone: 'info' },
    { label: 'Offene Tickets', value: '27', delta: '-3', icon: 'support_agent', tone: 'warning' },
    { label: 'Auslastung', value: '86%', delta: '+4%', icon: 'speed', tone: 'success' }
  ];

  readonly tasks = [
    { name: 'Fulfillment', progress: 78, status: 'Stabil' },
    { name: 'Lagerabgleich', progress: 64, status: 'Pruefen' },
    { name: 'Retouren', progress: 42, status: 'Offen' }
  ];

  readonly recentOrders = [
    { id: '#BF-1048', customer: 'Apfelwein Markt', amount: '1.240 EUR', status: 'Bezahlt', tone: 'success' },
    { id: '#BF-1047', customer: 'Mainufer GmbH', amount: '820 EUR', status: 'Versand', tone: 'info' },
    { id: '#BF-1046', customer: 'Kiosk Nordend', amount: '315 EUR', status: 'Offen', tone: 'warning' },
    { id: '#BF-1045', customer: 'Eventservice Hain', amount: '2.180 EUR', status: 'Bezahlt', tone: 'success' }
  ];

  readonly displayedColumns = ['id', 'customer', 'amount', 'status'];
}
