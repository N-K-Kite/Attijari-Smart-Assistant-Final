import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy {

  user: any = null;
  activeTab: string = 'overview';
  lastUpdateStr: string = '';
  apiStatus: string = 'checking...';

  // ── Overview KPIs (from /reclamations/stats) ──────────────────
  stats: any = null;
  alertesStats: any = null;

  // ── Réclamations tab ──────────────────────────────────────────
  reclamations: any[] = [];
  recTotal = 0;
  recLoading = false;
  recSearch = '';

  // ── Alertes tab ───────────────────────────────────────────────
  alertes: any[] = [];
  alertesLoading = false;
  alerteSeuil = 0.75;

  // ── Live feed ─────────────────────────────────────────────────
  liveEvents: any[] = [];

  private clockInterval: any;
  private feedInterval: any;

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(u => {
      if (!u) {
        // Only redirect if there's genuinely no token — 
        // if a token exists, fetchMe() is still loading
        if (!this.authService.getToken()) {
          this.router.navigate(['/login']);
        }
        return;
      }
      this.user = u;
    });

    this.startClock();
    this.checkApiHealth();
    this.loadOverview();
    this.loadReclamations(); // Load data pool for live feed
    this.startLiveFeed();
  }

  ngOnDestroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.feedInterval) clearInterval(this.feedInterval);
  }

  // ── Navigation ────────────────────────────────────────────────

  setTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'reclamations' && this.reclamations.length === 0) this.loadReclamations();
    if (tab === 'alertes' && this.alertes.length === 0) this.loadAlertes();
    this.cdr.detectChanges();
  }

  logout(): void {
    this.authService.logout();
  }

  // ── Data loading ──────────────────────────────────────────────

  private checkApiHealth(): void {
    this.apiService.getHealth().subscribe(h => {
      this.apiStatus = h?.status === 'healthy' ? '🟢 Connecté' :
                       h?.status === 'degraded' ? '🟡 Dégradé' : '🔴 Hors-ligne';
      this.cdr.detectChanges();
    });
  }

  loadOverview(): void {
    this.apiService.getReclamationStats().subscribe(s => { this.stats = s; this.cdr.detectChanges(); });
    this.apiService.getAlertesStats().subscribe(s => { this.alertesStats = s; this.cdr.detectChanges(); });
  }

  loadReclamations(): void {
    this.recLoading = true;
    this.cdr.detectChanges();
    this.apiService.getReclamations(2000, 0).subscribe(res => {
      this.reclamations = res?.data || [];
      this.recTotal = res?.total || 0;
      this.recLoading = false;
      this.cdr.detectChanges();
    });
  }

  loadAlertes(): void {
    this.alertesLoading = true;
    this.cdr.detectChanges();
    this.apiService.getAlertes(this.alerteSeuil).subscribe(a => {
      this.alertes = a;
      this.alertesLoading = false;
      this.cdr.detectChanges();
    });
  }

  // ── Helpers ───────────────────────────────────────────────────

  get filteredReclamations() {
    if (!this.recSearch.trim()) return this.reclamations;
    const q = this.recSearch.toLowerCase();
    return this.reclamations.filter((r: any) =>
      (r.objet || '').toLowerCase().includes(q) ||
      (r.type_operation || '').toLowerCase().includes(q) ||
      (r.statut || '').toLowerCase().includes(q)
    );
  }

  niveauClass(score: number): string {
    if (score >= 0.75) return 'niveau-critique';
    if (score >= 0.50) return 'niveau-surveillance';
    return 'niveau-normal';
  }

  niveauLabel(score: number): string {
    if (score >= 0.75) return 'CRITIQUE';
    if (score >= 0.50) return 'SURVEILLANCE';
    return 'NORMAL';
  }

  getGroupeKeys(): string[] {
    return this.stats?.groupes ? Object.keys(this.stats.groupes).slice(0, 6) : [];
  }

  getGroupeCount(key: string): number {
    return this.stats?.groupes?.[key] || 0;
  }

  getMaxGroupeCount(): number {
    if (!this.stats?.groupes) return 1;
    return Math.max(...Object.values(this.stats.groupes) as number[]) || 1;
  }

  // ── Clock + live feed ─────────────────────────────────────────

  private startClock(): void {
    const update = () => {
      this.lastUpdateStr = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      this.cdr.detectChanges();
    };
    update();
    this.clockInterval = setInterval(update, 1000);
  }

  private startLiveFeed(): void {
    const update = () => {
      if (this.reclamations.length === 0) return;
      
      // Select 10 random recent-ish tickets to pool from
      const pool = this.reclamations.slice(0, 50);
      if (pool.length === 0) return;
      
      const ticket = pool[Math.floor(Math.random() * pool.length)];
      if (!ticket) return;
      
      const type = ticket.score_anomalie >= 0.75 ? 'critical' : 
                   (ticket.type_demande === 'Réclamation' ? 'ai' : 'rpa');
      
      const html = `<strong>Ticket ${ticket.id.substring(0, 8)}</strong> — ${ticket.objet}`;
      
      this.liveEvents.unshift({
        html,
        type,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      });
      
      if (this.liveEvents.length > 8) this.liveEvents.pop();
      this.cdr.detectChanges();
    };

    // Run immediately and then every 7 seconds
    setTimeout(update, 1000);
    this.feedInterval = setInterval(update, 7000);
  }

}
