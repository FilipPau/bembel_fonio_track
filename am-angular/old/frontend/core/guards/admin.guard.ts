import { CanMatchFn, Router } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { map } from 'rxjs';
import { AuthService } from '@core/services/auth.service';

export const adminGuard: CanMatchFn = (route, segments) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (isPlatformBrowser(platformId)) {
    const returnUrl = '/' + segments.map(s => s.path).join('/');
    if (authService.isSignedIn()) {
      return true;
    }
    return authService.getSession().pipe(
      map(user => user ? true : router.createUrlTree(['/auth/signin'], { queryParams: { returnUrl } }))
    );
  }
};
