import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  email = '';
  password = '';
  isLoading = false;
  errorMsg = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // Force logout on login page to ensure strict login requirement
    this.authService.logoutNoRedirect();
  }

  onSubmit(): void {
    if (!this.email.trim() || !this.password.trim()) {
      this.errorMsg = 'Veuillez remplir tous les champs.';
      return;
    }

    this.isLoading = true;
    this.errorMsg = '';

    this.authService.login({ cin: this.email, password: this.password }).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMsg = res.error || 'Identifiants incorrects';
        }
        this.isLoading = false;
      },
      error: () => {
        this.errorMsg = 'Erreur serveur. Le backend FastAPI est-il démarré ?';
        this.isLoading = false;
      }
    });
  }

  fillDemo(role: string) {
    if (role === 'admin') {
      this.email = 'admin@attijaribank.tn';
      this.password = 'Admin@2026!';
    } else if (role === 'responsable') {
      this.email = 'responsable.it@attijaribank.tn';
      this.password = 'Resp@2026!';
    } else {
      this.email = 'meriam@attijaribank.tn';
      this.password = 'Stage@2026!';
    }
  }
}
