import { Component, EventEmitter, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-admin-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.component.html'
})
export class AdminSidebarComponent {
  @Output() mobileMenuClose = new EventEmitter<void>();

  // Close mobile menu
  closeMobileMenu(): void {
    this.mobileMenuClose.emit();
  }
}
