import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-signin',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signin.component.html',
})
export class SigninComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  form: FormGroup;
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  constructor() {
    this.form = this.fb.group({
      email: [
        'demo@appointment-manager.dev',
        [Validators.required, Validators.email],
      ],
      password: [
        'Password@123',
        [Validators.required, Validators.minLength(6)],
      ],
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.authService.signIn(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl =
          this.router.getCurrentNavigation()?.extras?.queryParams?.[
            'returnUrl'
          ] || '/admin';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.message || 'An error occurred during sign-in',
        );
      },
    });
  }
}
