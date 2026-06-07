import { inject, PLATFORM_ID } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { map } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

/**
 * Prevents access to /auth routes if the user is already signed in.
 */
export const guestGuard: CanMatchFn = (route, segments) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (isPlatformBrowser(platformId)) {
    // If the user is already signed in, redirect to dashboard
    if (authService.isSignedIn()) {
      return router.createUrlTree(['/admin']);
    }
    // If not signed in, allow access to auth routes
    return authService.getSession().pipe(
      map(user => !user ? true : router.createUrlTree(['/admin']))
    );
  }
};
