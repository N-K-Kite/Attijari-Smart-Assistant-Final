import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

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
  apiStatus: string = 'Vérification...';
  apiStatusClass: string = 'status-degraded';

  // ── Stats (Real Data Pool) ───────────────────────────────────
  stats: any = null;
  alertesStats: any = null;
  auditStats: any = null;

  // ── Data lists ───────────────────────────────────────────────
  reclamations: any[] = [];
  recTotal = 0;
  recLoading = false;
  recSearch = '';

  alertes: any[] = [];
  alertesLoading = false;

  auditLogs: any[] = [];
  auditLoading = false;

  predictions: any[] = [];
  predLoading = false;

  recommandations: any[] = [];
  recoLoading = false;

  // ── Analyse ──────────────────────────────────────────────────
  analyseText = '';
  analyseResult: any = null;
  analyseLoading = false;

  // ── Trend ────────────────────────────────────────────────────
  trendData: number[] = [0, 0, 0, 0, 0, 0, 0];
  trendDays: string[] = [];

  // ── Feed ─────────────────────────────────────────────────────
  liveEvents: any[] = [];
  selectedTicket: any = null;
  replyText: string = '';
  replyLoading: boolean = false;

  private clockInterval: any;
  private feedInterval: any;
  private pollInterval: any;

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(u => {
      if (!u) {
        if (!this.authService.getToken()) this.router.navigate(['/login']);
        return;
      }
      this.user = u;
    });

    this.startClock();
    this.checkApiHealth();
    this.loadOverview();
    this.startLiveFeed();
    
    // Auto-refresh stats and trends every 30s
    this.pollInterval = setInterval(() => {
      this.checkApiHealth();
      this.loadOverview();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.feedInterval) clearInterval(this.feedInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    
    // Reset data for the specific tab
    if (tab === 'alertes') this.loadAlertes();
    if (tab === 'audit') this.loadAudit();
    if (tab === 'lstm') this.loadPredictions();
    if (tab === 'knn') this.loadRecommandations();
    if (tab === 'reclamations') this.loadReclamations();
    
    this.loadOverview();
    this.cdr.detectChanges();
  }

  // ── Data Loaders (Real Backend Integration) ──────────────────

  loadOverview(): void {
    this.apiService.getReclamationStats().subscribe({
      next: s => { 
        if (s) this.stats = s; 
        this.cdr.detectChanges(); 
      },
      error: () => { 
        if (!this.stats) this.stats = { total_tickets: 0, tickets_risque_eleve: 0, groupes: {} }; 
      }
    });
    this.apiService.getAlertesStats().subscribe(s => { if (s) this.alertesStats = s; });
    this.apiService.getAuditStats().subscribe(s => { if (s) this.auditStats = s; });
    this.loadReclamations();
  }

  loadReclamations(): void {
    if (this.recLoading) return;
    this.recLoading = true;
    this.apiService.getReclamations(200, 0)
      .pipe(finalize(() => { this.recLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: res => {
          let data = res?.data || [];
          // SORT DESCENDING BY DATE (Newest first)
          data.sort((a: any, b: any) => {
            const dateA = new Date(a.date).getTime() || 0;
            const dateB = new Date(b.date).getTime() || 0;
            return dateB - dateA; // Newest first
          });
          this.reclamations = data;
          this.recTotal = res?.total || 0;
          this.computeTrend();
        },
        error: () => {
          this.reclamations = [];
          this.recTotal = 0;
          this.computeTrend();
        }
      });
  }

  loadAlertes(): void {
    this.alertesLoading = true;
    this.apiService.getAlertes(0.50) // Lowered threshold from 0.75
      .pipe(finalize(() => { this.alertesLoading = false; this.cdr.detectChanges(); }))
      .subscribe(a => {
        this.alertes = a || [];
        console.log('Real Alertes loaded:', this.alertes.length);
      });
  }

  loadAudit(): void {
    this.auditLoading = true;
    this.apiService.getAuditLogs(100)
      .pipe(finalize(() => { this.auditLoading = false; this.cdr.detectChanges(); }))
      .subscribe(logs => this.auditLogs = logs || []);
  }

  loadPredictions(): void {
    this.predLoading = true;
    this.apiService.getPredictions()
      .pipe(finalize(() => { this.predLoading = false; this.cdr.detectChanges(); }))
      .subscribe(p => this.predictions = p || []);
  }

  loadRecommandations(): void {
    this.recoLoading = true;
    this.apiService.getRecommandations()
      .pipe(finalize(() => { this.recoLoading = false; this.cdr.detectChanges(); }))
      .subscribe(r => this.recommandations = r || []);
  }

  runAnalyse(): void {
    if (!this.analyseText.trim()) return;
    this.analyseLoading = true;
    this.apiService.analyserRecommandation(this.analyseText)
      .pipe(finalize(() => { this.analyseLoading = false; this.cdr.detectChanges(); }))
      .subscribe(res => this.analyseResult = res);
  }

  // ── Trend Graph Logic ────────────────────────────────────────

  computeTrend(): void {
    const days = [];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() - (6 - i));
      days.push(`${d.getDate()}/${d.getMonth()+1}`);
      
      const dayStr = String(d.getDate()).padStart(2, '0');
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const yearStr = d.getFullYear();
      
      const count = this.reclamations.filter(r => 
        r.date === `${dayStr}/${monthStr}/${yearStr}` || 
        r.date === `${yearStr}-${monthStr}-${dayStr}`
      ).length;
      counts[i] = count;
    }
    this.trendData = counts;
    this.trendDays = days;
  }

  getTrendSmoothPath(): string {
    const max = Math.max(...this.trendData, 5);
    const height = 120;
    const width = 400;
    const points = this.trendData.map((val, i) => ({
      x: (i / 6) * width,
      y: height - (val / max * 70) - 30
    }));

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i+1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      path += ` C ${cp1x},${p0.y} ${cp1x},${p1.y} ${p1.x},${p1.y}`;
    }
    return path;
  }

  getTrendFillPath(offset: number = 1.0): string {
    const max = Math.max(...this.trendData, 5);
    const height = 120;
    const width = 400;
    const points = this.trendData.map((val, i) => ({
      x: (i / 6) * width,
      y: height - (val / max * 70 * offset) - 30
    }));

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i+1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      path += ` C ${cp1x},${p0.y} ${cp1x},${p1.y} ${p1.x},${p1.y}`;
    }
    return path + ` L ${width},${height} L 0,${height} Z`;
  }

  getTrendPoints() {
    const max = Math.max(...this.trendData, 5);
    const height = 120;
    const width = 400;
    return this.trendData.map((val, i) => ({
      x: (i / 6) * width,
      y: height - (val / max * 70) - 30,
      isToday: i === 6,
      value: val
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────

  get filteredReclamations() {
    if (!this.recSearch.trim()) return this.reclamations;
    const q = this.recSearch.toLowerCase();
    return this.reclamations.filter((r: any) =>
      (r.objet || '').toLowerCase().includes(q) || 
      (r.type_operation || '').toLowerCase().includes(q) ||
      (r.id || '').toLowerCase().includes(q)
    );
  }

  selectTicket(t: any): void {
    this.selectedTicket = t;
    this.cdr.detectChanges();
  }

  toggleStatus(t: any): void {
    const newStatut = t.statut === 'Ouvert' ? 'Résolu' : 'Ouvert';
    this.apiService.updateReclamationStatut(t.id, newStatut).subscribe(res => {
      if (res) {
        t.statut = newStatut;
        // Also update in the list if it's not the same object reference
        const found = this.reclamations.find(r => r.id === t.id);
        if (found) found.statut = newStatut;
        
        // Add to live feed
        this.liveEvents.unshift({
          html: `<strong>${t.id?.substring(0,8)}</strong>: Statut changé en ${newStatut}`,
          type: newStatut === 'Résolu' ? 'ai' : 'critical',
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        });
        
        this.loadOverview(); // Refresh stats
        this.cdr.detectChanges();
      }
    });
  }

  sendReply(): void {
    if (!this.selectedTicket || !this.replyText.trim() || this.replyLoading) return;
    
    this.replyLoading = true;
    this.apiService.repondreReclamation(this.selectedTicket.id, this.replyText)
      .pipe(finalize(() => { 
        this.replyLoading = false; 
        this.cdr.detectChanges(); 
      }))
      .subscribe(res => {
        if (res) {
          // Update selected ticket local state
          if (!this.selectedTicket.reponses) this.selectedTicket.reponses = [];
          this.selectedTicket.reponses.push({
            auteur: this.user?.nom || 'Admin',
            message: this.replyText,
            date: new Date().toISOString()
          });
          
          this.replyText = '';
          
          // Add to live feed
          this.liveEvents.unshift({
            html: `<strong>${this.selectedTicket.id?.substring(0,8)}</strong>: Nouvelle réponse envoyée`,
            type: 'ai',
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          });
          
          this.cdr.detectChanges();
        }
      });
  }

  getGroupeKeys(): string[] { return this.stats?.groupes ? Object.keys(this.stats.groupes).slice(0, 8) : []; }
  getGroupeCount(key: string): number { return this.stats?.groupes?.[key] || 0; }
  getGroupeColor(index: number): string {
    const colors = ['#E05252', '#F5A623', '#2A7DE1', '#28C78A', '#00C2E0', '#7C3AED', '#FF6B6B', '#4DABF7'];
    return colors[index % colors.length];
  }
  getMaxGroupeCount(): number {
    if (!this.stats?.groupes) return 1;
    return Math.max(...Object.values(this.stats.groupes) as number[]) || 1;
  }
  niveauClass(score: number): string {
    if (score >= 0.75) return 'niveau-critique';
    if (score >= 0.50) return 'niveau-surveillance';
    return 'niveau-normal';
  }

  private checkApiHealth(): void {
    this.apiService.getHealth().subscribe({
      next: h => {
        this.apiStatus = h?.status === 'healthy' ? '🟢 En Ligne' : '🟡 Dégradé';
        this.apiStatusClass = h?.status === 'healthy' ? 'status-online' : 'status-degraded';
        this.cdr.detectChanges();
      },
      error: () => {
        this.apiStatus = '🔴 Hors-ligne';
        this.apiStatusClass = 'status-offline';
        this.cdr.detectChanges();
      }
    });
  }

  private startClock(): void {
    const update = () => {
      this.lastUpdateStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      this.cdr.detectChanges();
    };
    update();
    this.clockInterval = setInterval(update, 1000);
  }

  private startLiveFeed(): void {
    const update = () => {
      if (this.reclamations.length === 0) return;
      const t = this.reclamations[Math.floor(Math.random() * Math.min(20, this.reclamations.length))];
      if (!t) return;
      this.liveEvents.unshift({
        html: `<strong>${t.id?.substring(0,8) || 'TK'}</strong>: ${t.objet || 'Signalement'}`,
        type: t.score_anomalie >= 0.75 ? 'critical' : 'ai',
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      });
      if (this.liveEvents.length > 6) this.liveEvents.pop();
      this.cdr.detectChanges();
    };
    this.feedInterval = setInterval(update, 15000);
  }
}
