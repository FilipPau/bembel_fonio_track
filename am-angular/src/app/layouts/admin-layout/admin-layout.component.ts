import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminHeaderComponent } from '@components/admin-header/admin-header.component';
import { AdminSidebarComponent } from '@components/admin-sidebar/admin-sidebar.component';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, AdminHeaderComponent, AdminSidebarComponent],
  templateUrl: './admin-layout.component.html'
})
export class AdminLayoutComponent {
  // Mobile menu state
  showMobileMenu = signal(false);

  // Toggle mobile menu
  toggleMobileMenu(): void {
    this.showMobileMenu.update(show => !show);
  }
}
