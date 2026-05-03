import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, tap, catchError, map, switchMap } from 'rxjs';
import { Router } from '@angular/router';

export interface User {
  id: string;
  nom: string;
  email: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8000';
  private tokenKey = 'attijari_token';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  /**
   * Login via FastAPI: POST /auth/login with form-data (username + password)
   * Returns JWT token
   */
  login(credentials: { cin: string; password: string }): Observable<any> {
    const body = new URLSearchParams();
    body.set('username', credentials.cin);
    body.set('password', credentials.password);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    return this.http.post<any>(`${this.apiUrl}/auth/login`, body.toString(), { headers }).pipe(
      switchMap(res => {
        if (res && res.access_token) {
          localStorage.setItem(this.tokenKey, res.access_token);
          // Wait for fetchMe to complete before emitting the final login result
          return this.fetchMe().pipe(
            map(user => ({
              success: !!user,
              role: user?.role,
              nom: user?.nom
            }))
          );
        }
        return of({ success: false, error: 'Token non reçu' });
      }),
      catchError(err => {
        const detail = err?.error?.detail || 'Identifiants incorrects';
        return of({ success: false, error: detail });
      })
    );
  }

  register(userData: { nom: string; email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/register`, userData).pipe(
      catchError(err => {
        const detail = err?.error?.detail || "Erreur lors de l'inscription";
        return of({ success: false, error: detail });
      }),
      map(res => {
        if (res && res.id) return { success: true };
        return res;
      })
    );
  }

  logout(): void {
    this.logoutNoRedirect();
    this.router.navigate(['/login']);
  }

  logoutNoRedirect(): void {
    const token = this.getToken();
    if (token) {
      this.http.post(`${this.apiUrl}/auth/logout`, {}, {
        headers: this.getAuthHeaders()
      }).subscribe({ error: () => {} });
    }
    localStorage.removeItem(this.tokenKey);
    this.currentUserSubject.next(null);
  }

  private fetchMe(): Observable<User | null> {
    return this.http.get<User>(`${this.apiUrl}/auth/me`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(user => this.currentUserSubject.next(user)),
      catchError(() => {
        localStorage.removeItem(this.tokenKey);
        this.currentUserSubject.next(null);
        return of(null);
      })
    );
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.currentUserValue;
  }
}
