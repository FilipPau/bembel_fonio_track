import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  form: FormGroup;
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  success = signal<boolean>(false);
  emailSent = signal<string>('');

  constructor() {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  submit() {
    if (this.form.invalid) return;
    
    this.loading.set(true);
    this.error.set(null);
    
    const email = this.form.get('email')?.value;
    
    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        this.emailSent.set(email);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'An error occurred. Please try again.');
      }
    });
  }

  resetForm() {
    this.form.reset();
    this.success.set(false);
    this.error.set(null);
    this.emailSent.set('');
  }
}
