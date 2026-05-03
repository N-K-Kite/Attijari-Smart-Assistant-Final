import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'bot' | 'user' | 'system';
  time: Date;
}

export interface Conversation {
  id: string;
  title: string;
  time: string;
  messages: ChatMessage[];
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private conversationsSubject = new BehaviorSubject<Conversation[]>([]);
  public conversations$ = this.conversationsSubject.asObservable();

  private activeConversationIdSubject = new BehaviorSubject<string | null>(null);
  public activeConversationId$ = this.activeConversationIdSubject.asObservable();

  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  private storageKeyPrefix = 'attijari_chat_';

  constructor(
    private apiService: ApiService,
    private authService: AuthService
  ) {
    // Listen for user changes to load their specific chat history
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.loadConversations(user.email);
      } else {
        this.conversationsSubject.next([]);
        this.messagesSubject.next([]);
        this.activeConversationIdSubject.next(null);
      }
    });
  }

  private getStorageKey(email: string): string {
    return `${this.storageKeyPrefix}${email}`;
  }

  private loadConversations(email: string): void {
    const saved = localStorage.getItem(this.getStorageKey(email));
    if (saved) {
      try {
        const convs = JSON.parse(saved);
        convs.forEach((c: Conversation) => {
          c.messages.forEach(m => m.time = new Date(m.time));
        });
        this.conversationsSubject.next(convs);
        if (convs.length > 0) {
          this.setActiveConversation(convs[0].id);
        } else {
          this.createNewConversation();
        }
      } catch (e) {
        this.createNewConversation();
      }
    } else {
      this.createNewConversation();
    }
  }

  private saveConversations(): void {
    const user = this.authService.currentUserValue;
    if (user) {
      localStorage.setItem(
        this.getStorageKey(user.email),
        JSON.stringify(this.conversationsSubject.value)
      );
    }
  }

  setActiveConversation(id: string): void {
    const conv = this.conversationsSubject.value.find(c => c.id === id);
    if (conv) {
      this.activeConversationIdSubject.next(id);
      this.messagesSubject.next(conv.messages);
    }
  }

  createNewConversation(): void {
    const id = Date.now().toString();
    const newConv: Conversation = {
      id,
      title: 'Nouvelle discussion',
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      messages: [{
        id: 'welcome',
        text: "Bonjour ! Je suis l'Assistant IA d'Attijari Bank. Je peux analyser vos réclamations IT, détecter les anomalies et vous proposer des solutions. Décrivez votre problème 😊",
        sender: 'bot',
        time: new Date()
      }]
    };
    const current = this.conversationsSubject.value;
    this.conversationsSubject.next([newConv, ...current]);
    this.setActiveConversation(id);
    this.saveConversations();
  }

  addMessage(msg: ChatMessage) {
    const activeId = this.activeConversationIdSubject.value;
    if (!activeId) return;

    const convs = this.conversationsSubject.value;
    const convIndex = convs.findIndex(c => c.id === activeId);
    
    if (convIndex !== -1) {
      convs[convIndex].messages.push(msg);
      
      if (msg.sender === 'user' && convs[convIndex].title === 'Nouvelle discussion') {
        convs[convIndex].title = msg.text.substring(0, 30) + (msg.text.length > 30 ? '...' : '');
      }

      this.conversationsSubject.next([...convs]);
      this.messagesSubject.next([...convs[convIndex].messages]);
      this.saveConversations();
    }
  }

  /**
   * Sends user message to BOTH backend AI engines in parallel:
   * 1. POST /reclamations/analyser  → NLP analysis (rule-based anomaly scoring)
   * 2. POST /api/recommandations/analyser → KNN model (find similar past tickets + recommended action)
   * 
   * Then combines both results into a rich, contextual response.
   */
  sendMessage(text: string): Observable<string> {
    // Detect the IT group/category from user's text for better KNN matching
    const { groupe, categorie, severite } = this.detectContext(text);

    // Call BOTH AI endpoints in parallel using forkJoin
    return forkJoin({
      nlp: this.apiService.analyserReclamation({
        description: text,
        type_operation: groupe,
        severite: severite
      }).pipe(catchError(() => of(null))),

      knn: this.apiService.analyserRecommandation(text, groupe, categorie)
        .pipe(catchError(() => of(null)))
    }).pipe(
      map(({ nlp, knn }) => this.buildResponse(text, nlp, knn))
    );
  }

  /**
   * Detects IT context from the user's message to route to the right
   * AI analysis pipeline. Maps keywords to Attijari bank's real IT groups.
   */
  private detectContext(text: string): { groupe: string; categorie: string; severite: number } {
    const lower = text.toLowerCase();
    
    // Map keywords to actual Attijari bank IT groups (from the dataset)
    const groupeMap: { [key: string]: { groupe: string; categorie: string } } = {
      // Security
      'firewall':        { groupe: 'Sécurité Opérationnelle', categorie: 'Securite et Habilitation SI' },
      'compromission':   { groupe: 'Sécurité Opérationnelle', categorie: 'Securite et Habilitation SI' },
      'virus':           { groupe: 'Sécurité Opérationnelle', categorie: 'Securite et Habilitation SI' },
      'spam':            { groupe: 'Helpdesk', categorie: 'Securite et Habilitation SI' },
      'habilitation':    { groupe: 'Sécurité Opérationnelle', categorie: 'Securite et Habilitation SI' },
      'vpn':             { groupe: 'Sécurité Opérationnelle', categorie: 'Réseau' },
      // Banking systems
      'swift':           { groupe: 'SWIFT', categorie: 'Application métier' },
      'amplitude':       { groupe: 'Système', categorie: 'Amplitude' },
      'western union':   { groupe: 'SWIFT', categorie: 'Application métier' },
      // IT Support
      'mot de passe':    { groupe: 'Helpdesk', categorie: 'Accès et Authentification' },
      'password':        { groupe: 'Helpdesk', categorie: 'Accès et Authentification' },
      'accès':           { groupe: 'Helpdesk', categorie: 'Accès et Authentification' },
      'acces':           { groupe: 'Helpdesk', categorie: 'Accès et Authentification' },
      'connexion':       { groupe: 'Helpdesk', categorie: 'Accès et Authentification' },
      'login':           { groupe: 'Helpdesk', categorie: 'Accès et Authentification' },
      'connecter':       { groupe: 'Helpdesk', categorie: 'Accès et Authentification' },
      'outlook':         { groupe: 'Helpdesk', categorie: 'Messagerie' },
      'email':           { groupe: 'Helpdesk', categorie: 'Messagerie' },
      'mail':            { groupe: 'Helpdesk', categorie: 'Messagerie' },
      'imprimante':      { groupe: 'Helpdesk', categorie: 'Impression' },
      'impression':      { groupe: 'Helpdesk', categorie: 'Impression' },
      // Network & Systems
      'réseau':          { groupe: 'Réseau', categorie: 'Réseau' },
      'reseau':          { groupe: 'Réseau', categorie: 'Réseau' },
      'internet':        { groupe: 'Réseau', categorie: 'Réseau' },
      'serveur':         { groupe: 'Système', categorie: 'Serveur' },
      'timeout':         { groupe: 'Système', categorie: 'Performance' },
      'lent':            { groupe: 'Système', categorie: 'Performance' },
      'erreur':          { groupe: 'Helpdesk', categorie: 'Application métier' },
      'blocage':         { groupe: 'Helpdesk', categorie: 'Application métier' },
      'bloqué':          { groupe: 'Helpdesk', categorie: 'Application métier' },
      'bloque':          { groupe: 'Helpdesk', categorie: 'Application métier' },
      // Phone
      'téléphone':       { groupe: 'Téléphonie', categorie: 'Téléphonie' },
      'telephone':       { groupe: 'Téléphonie', categorie: 'Téléphonie' },
      'appel':           { groupe: 'Téléphonie', categorie: 'Téléphonie' },
    };

    let groupe = 'Helpdesk';
    let categorie = 'Support Général';
    
    for (const [keyword, context] of Object.entries(groupeMap)) {
      if (lower.includes(keyword)) {
        groupe = context.groupe;
        categorie = context.categorie;
        break;
      }
    }

    // Detect severity from urgency keywords
    let severite = 2;
    const urgentWords = ['urgent', 'critique', 'bloquant', 'bloqué', 'bloque', 'compromission', 'virus', 'down', 'panne'];
    if (urgentWords.some(w => lower.includes(w))) severite = 1;
    
    const lowWords = ['question', 'info', 'information', 'comment', 'demande'];
    if (lowWords.some(w => lower.includes(w))) severite = 3;

    return { groupe, categorie, severite };
  }

  /**
   * Builds a rich response combining NLP analysis + KNN recommendation.
   * This is what makes the chatbot "smart" — it uses real Attijari data.
   */
  private buildResponse(userText: string, nlp: any, knn: any): string {
    const parts: string[] = [];
    const lower = userText.toLowerCase();

    // Handle very short greetings locally (no need for AI)
    if (lower.length < 10) {
      if (['bonjour', 'salut', 'hello', 'hi', 'salam'].some(g => lower.includes(g))) {
        return "Bonjour ! 👋 Comment puis-je vous aider ? Décrivez votre problème informatique et je l'analyserai.";
      }
      if (['merci', 'thanks', 'شكرا'].some(g => lower.includes(g))) {
        return "Je vous en prie ! N'hésitez pas si vous avez d'autres questions. 😊";
      }
    }

    // 1. NLP Analysis Results (score d'anomalie, systèmes détectés)
    if (nlp) {
      const scorePercent = Math.round((nlp.score_anomalie || 0) * 100);
      
      if (nlp.niveau === 'CRITIQUE') {
        parts.push(`🚨 **Alerte Critique** — Score d'anomalie : ${scorePercent}%`);
        parts.push(`Un ticket prioritaire **${nlp.reclamation_id?.substring(0, 8) || ''}** a été ouvert automatiquement.`);
      } else if (nlp.niveau === 'SURVEILLANCE') {
        parts.push(`⚠️ **Surveillance** — Score d'anomalie : ${scorePercent}%`);
        parts.push(`Votre demande est sous surveillance active.`);
      } else {
        parts.push(`✅ **Analyse terminée** — Score : ${scorePercent}% (Normal)`);
      }

      // Show detected systems
      if (nlp.systemes_detectes?.length > 0) {
        parts.push(`\n🖥️ **Systèmes concernés** : ${nlp.systemes_detectes.join(', ')}`);
      }
      if (nlp.erreurs_detectees?.length > 0) {
        parts.push(`🔍 **Erreurs identifiées** : ${nlp.erreurs_detectees.join(', ')}`);
      }
    }

    // 2. KNN Recommendation (solution from similar past tickets)
    if (knn && knn.action_suggeree) {
      parts.push(`\n💡 **Solution recommandée** :\n${knn.action_suggeree}`);
      
      if (knn.taux_succes) {
        const confidence = Math.round(knn.taux_succes * 100);
        parts.push(`📊 Taux de succès : **${confidence}%** (basé sur ${knn.nb_cas_similaires || 0} cas similaires)`);
      }

      if (knn.cas_similaires?.length > 0) {
        parts.push(`\n📋 **Tickets similaires** : ${knn.cas_similaires.slice(0, 3).join(' | ')}`);
      }
    }

    // 3. Fallback if both AI engines returned nothing useful
    if (parts.length === 0) {
      return "J'ai bien reçu votre demande. Elle a été enregistrée et transmise à l'équipe technique pour analyse. Un ticket sera ouvert automatiquement.";
    }

    return parts.join('\n');
  }

  deleteConversation(id: string): void {
    const current = this.conversationsSubject.value.filter(c => c.id !== id);
    this.conversationsSubject.next(current);
    if (this.activeConversationIdSubject.value === id) {
      if (current.length > 0) this.setActiveConversation(current[0].id);
      else this.createNewConversation();
    }
    this.saveConversations();
  }
}
