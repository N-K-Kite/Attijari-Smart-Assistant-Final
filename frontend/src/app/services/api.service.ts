import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private base = 'http://localhost:8000';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private get headers() {
    return { headers: this.auth.getAuthHeaders() };
  }

  // ── Health ────────────────────────────────────────────────────
  getHealth(): Observable<any> {
    return this.http.get<any>(`${this.base}/health`).pipe(catchError(() => of(null)));
  }

  // ── Reclamations ──────────────────────────────────────────────
  getReclamations(limit = 50, offset = 0): Observable<any> {
    return this.http.get<any>(
      `${this.base}/reclamations/?limit=${limit}&offset=${offset}`,
      this.headers
    ).pipe(catchError(() => of({ data: [], total: 0 })));
  }

  getMyReclamations(): Observable<any> {
    return this.http.get<any>(`${this.base}/reclamations/me`, this.headers)
      .pipe(catchError(() => of({ data: [], total: 0 })));
  }

  getReclamationStats(): Observable<any> {
    return this.http.get<any>(`${this.base}/reclamations/stats`, this.headers)
      .pipe(catchError(() => of(null)));
  }

  analyserReclamation(data: { description: string; type_operation: string; severite: number }): Observable<any> {
    return this.http.post<any>(`${this.base}/reclamations/analyser`, data, this.headers)
      .pipe(catchError(() => of(null)));
  }

  // ── Alertes (UiPath) ──────────────────────────────────────────
  getAlertes(seuil = 0.75): Observable<any> {
    return this.http.get<any>(`${this.base}/api/alertes/?seuil=${seuil}`, this.headers)
      .pipe(catchError(() => of([])));
  }

  getAlertesStats(): Observable<any> {
    return this.http.get<any>(`${this.base}/api/alertes/stats`, this.headers)
      .pipe(catchError(() => of(null)));
  }

  // ── Predictions LSTM ──────────────────────────────────────────
  getPredictions(): Observable<any> {
    return this.http.get<any>(`${this.base}/api/predictions/`, this.headers)
      .pipe(catchError(() => of([])));
  }

  getPredictionsDashboard(): Observable<any> {
    return this.http.get<any>(`${this.base}/api/predictions/dashboard`, this.headers)
      .pipe(catchError(() => of(null)));
  }

  // ── Recommandations KNN ───────────────────────────────────────
  getRecommandations(): Observable<any> {
    return this.http.get<any>(`${this.base}/api/recommandations/`, this.headers)
      .pipe(catchError(() => of([])));
  }

  analyserRecommandation(texte: string, groupe: string = '', categorie: string = ''): Observable<any> {
    return this.http.post<any>(
      `${this.base}/api/recommandations/analyser`,
      { texte, groupe, categorie },
      this.headers
    ).pipe(catchError(err => {
      console.error('KNN error:', err);
      return of(null);
    }));
  }

  // ── Predictions LSTM ───────────────────────────────────────────
  predireRisque(data: { type_operation: string; severite: number }): Observable<any> {
    return this.http.post<any>(`${this.base}/api/predictions/predire`, data, this.headers)
      .pipe(catchError(() => of(null)));
  }

  // ── Audit Trail ────────────────────────────────────────────────
  getAuditLogs(limit = 100): Observable<any> {
    return this.http.get<any>(`${this.base}/api/audit/?limit=${limit}`, this.headers)
      .pipe(catchError(() => of([])));
  }

  getAuditStats(): Observable<any> {
    return this.http.get<any>(`${this.base}/api/audit/stats`, this.headers)
      .pipe(catchError(() => of(null)));
  }

  // ── Update Ticket Status ────────────────────────────────────────
  updateReclamationStatut(id: string, statut: string): Observable<any> {
    return this.http.put<any>(
      `${this.base}/reclamations/${id}/statut`,
      { statut },
      this.headers
    ).pipe(catchError(err => {
      console.error('Update status error:', err);
      return of(null);
    }));
  }

  repondreReclamation(id: string, message: string): Observable<any> {
    return this.http.post<any>(
      `${this.base}/reclamations/${id}/repondre`,
      { message },
      this.headers
    ).pipe(catchError(err => {
      console.error('Reply error:', err);
      return of(null);
    }));
  }
}
