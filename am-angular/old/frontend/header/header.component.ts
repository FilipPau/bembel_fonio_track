import { Component, HostListener, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ViewportScroller } from '@angular/common';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.component.html'
})
export class HeaderComponent {
  isMobileMenuOpen = signal(false);

  constructor(
    private router: Router,
    private viewportScroller: ViewportScroller
  ) {}

  toggleMobileMenu() {
    this.isMobileMenuOpen.update(current => !current);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }

  scrollToSection(sectionId: string) {
    // Close mobile menu if open
    this.closeMobileMenu();
    
    // Check if we're on the home page
    if (this.router.url === '/' || this.router.url === '') {
      // If on home page, scroll to section
      this.scrollToElement(sectionId);
    } else {
      // If not on home page, navigate to home with fragment
      this.router.navigate(['/'], { fragment: sectionId }).then(() => {
        // Wait for the page to load and then scroll
        this.waitForElementAndScroll(sectionId);
      });
    }
  }

  private scrollToElement(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      this.viewportScroller.scrollToAnchor(sectionId);
    }
  }

  private waitForElementAndScroll(sectionId: string, maxAttempts = 10) {
    let attempts = 0;
    const checkElement = () => {
      attempts++;
      const element = document.getElementById(sectionId);
      if (element) {
        this.viewportScroller.scrollToAnchor(sectionId);
      } else if (attempts < maxAttempts) {
        // Try again after a short delay
        setTimeout(checkElement, 100);
      }
    };
    checkElement();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    // Close mobile menu when clicking outside
    const target = event.target as HTMLElement;
    if (!target.closest('.mobile-menu') && !target.closest('.mobile-menu-button')) {
      this.closeMobileMenu();
    }
  }
}
