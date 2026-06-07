import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink, TitleCasePipe],
  templateUrl: './signup.component.html'
})
export class SignupComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  form: FormGroup;
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  private fb = inject(FormBuilder);

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    this.authService.signUp(this.form.getRawValue()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/admin']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'An error occurred during sign-up');
      }
    });
  }

  getPasswordStrength(): string {
    const password = this.form.get('password')?.value;
    if (!password) return 'weak';
    
    let score = 0;
    
    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
  }

  getPasswordStrengthPercentage(): number {
    const password = this.form.get('password')?.value;
    if (!password) return 0;
    
    let score = 0;
    
    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    // Convert score to percentage (max score is 6)
    return Math.min((score / 6) * 100, 100);
  }
}

