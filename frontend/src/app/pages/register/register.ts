import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  nom = '';
  email = '';
  password = '';
  confirmPassword = '';
  isLoading = false;
  errorMsg = '';
  successMsg = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    if (!this.nom || !this.email || !this.password) {
      this.errorMsg = 'Veuillez remplir tous les champs.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMsg = 'Les mots de passe ne correspondent pas.';
      return;
    }

    this.isLoading = true;
    this.errorMsg = '';
    this.successMsg = '';

    const userData = {
      nom: this.nom,
      email: this.email,
      password: this.password
    };

    this.authService.register(userData).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.successMsg = 'Compte créé avec succès ! Redirection vers la connexion...';
          setTimeout(() => this.router.navigate(['/login']), 2000);
        } else {
          this.errorMsg = res.error || "Erreur lors de l'inscription.";
        }
        this.isLoading = false;
      },
      error: () => {
        this.errorMsg = "Erreur serveur. Le backend est-il démarré ?";
        this.isLoading = false;
      }
    });
  }
}
