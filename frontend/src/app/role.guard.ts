import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from './services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return false;
    }

    const allowedRoles = route.data['roles'] as string[];
    const userRole = this.authService.currentUserValue?.role;

    if (allowedRoles && userRole && allowedRoles.includes(userRole)) {
      return true;
    }

    // Not authorized for this page — redirect to chat instead
    this.router.navigate(['/chat']);
    return false;
  }
}
