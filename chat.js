/* ============================================================
   CHAT.JS – Chatbot logic with mock AI + intent detection
   Ready to swap mock responses for real API calls
   ============================================================ */

// ============================================================
// CONFIG – swap API_URL when your teammate's model is ready
// ============================================================
const API_CONFIG = {
  USE_MOCK: true,                    // false → call real API
  API_URL: 'http://localhost:8000/chat',  // FastAPI endpoint
  API_KEY: '',                       // set when ready
};

// ============================================================
// NLP INTENT KNOWLEDGE BASE  (mock until real model integrates)
// ============================================================
const INTENTS = {
  SOLDE: {
    patterns: ['solde', 'compte', 'argent', 'combien', 'balance', 'avoir'],
    label: 'Consultation Solde',
    sentiment: '😊 Neutre',
  },
  BLOCAGE: {
    patterns: ['bloquer', 'bloc', 'carte', 'perdu', 'volé', 'annuler', 'désactiver'],
    label: 'Blocage Carte',
    sentiment: '😟 Urgent',
  },
  TRANSACTION: {
    patterns: ['transaction', 'virement', 'paiement', 'historique', 'opération', 'dernière', 'mouvement'],
    label: 'Historique / Virement',
    sentiment: '😊 Neutre',
  },
  RECLAMATION: {
    patterns: ['réclamation', 'problème', 'erreur', 'faux', 'incorrect', 'contester', 'plainte'],
    label: 'Réclamation',
    sentiment: '😡 Négatif',
  },
  AGENCE: {
    patterns: ['agence', 'horaire', 'adresse', 'bureau', 'guichet', 'succursale', 'ouverture'],
    label: 'Infos Agences',
    sentiment: '😊 Neutre',
  },
  AGENT: {
    patterns: ['agent', 'humain', 'personne', 'conseiller', 'parler', 'transfert', 'appel'],
    label: 'Transfert Agent',
    sentiment: '😐 Neutre',
  },
  CREDIT: {
    patterns: ['crédit', 'prêt', 'emprunt', 'financement', 'remboursement', 'mensualité'],
    label: 'Crédit / Prêt',
    sentiment: '😊 Neutre',
  },
  SALUTATION: {
    patterns: ['bonjour', 'salut', 'bonsoir', 'allô', 'hello', 'hi', 'bonne journée'],
    label: 'Salutation',
    sentiment: '😊 Positif',
  },
};

// ============================================================
// MOCK RESPONSES DATABASE
// ============================================================
const MOCK_RESPONSES = {
  SOLDE: [
    {
      text: `Voici le résumé de vos comptes :\n\n💰 **Compte Courant** : {{CC}}\n💳 **Compte Épargne** : {{EP}}\n\nDernière mise à jour : ${formatTime(new Date())}`,
    },
  ],
  BLOCAGE: [
    {
      text: `Je comprends l'urgence. Pour procéder au blocage de votre carte :\n\n1️⃣ Votre carte **{{CARD_TYPE}}** (**{{CARD}}**) sera bloquée immédiatement.\n2️⃣ Vous recevrez un SMS de confirmation.\n3️⃣ Une nouvelle carte vous sera envoyée sous **3-5 jours ouvrés**.\n\n⚠️ Voulez-vous confirmer le blocage ?`,
      followUp: 'Votre carte **{{CARD}}** a été bloquée avec succès. Ticket n° ATJ-2024-1892 créé. ✅',
    },
  ],
  TRANSACTION: [
    {
      text: `Voici vos **5 dernières transactions** :\n\n{{TRANSACTIONS}}\n\nPuis-je vous aider pour une autre opération ?`,
    },
  ],
  RECLAMATION: [
    {
      text: `Je suis désolé d'apprendre ce problème. Votre réclamation est importante pour nous.\n\n📋 **Référence ticket** : ATJ-REC-20240329-448\n⏱️ **Délai de traitement** : 48h ouvrées\n📧 Vous recevrez un email de suivi\n\nSouhaitez-vous être transféré à un agent spécialisé pour accélérer le traitement ?`,
    },
  ],
  AGENCE: [
    {
      text: `🏦 **Agences Attijari Bank proches de vous** :\n\n📍 **Centre Urbain Nord – Tunis**\n   24, Rue Hédi Karray – 08:30 à 16:00 (L-V)\n\n📍 **Centre Urbain Nord – Tunis**\n   LOTS B15, IMMEUBLE TAMATOUZ – 08:30 à 15:30 (L-V)\n\n📍 **Menzah 5 – Ariana**\n   18, avenue de la liberté – 09:00 à 16:00 (L-V)\n\nPuis-je vous aider avec autre chose ?`,
    },
  ],
  AGENT: [
    {
      text: null, // triggers escalation card
      escalate: true,
    },
  ],
  CREDIT: [
    {
      text: `Je peux vous informer sur nos offres de crédit :\n\n🏠 **Crédit Immobilier** – jusqu'à 80% du bien, 25 ans\n🚗 **Crédit Auto** – taux à partir de 5,5%, 60 mois\n📊 **Crédit Consommation** – jusqu'à 150 000 DT\n💼 **Crédit Professionnel** – solutions sur mesure\n\nSouhaitez-vous un rendez-vous avec un conseiller ?`,
    },
  ],
  SALUTATION: [
    { text: 'Bonjour et bienvenue chez Attijari Bank ! 👋\nComment puis-je vous aider aujourd\'hui ?' },
    { text: 'Bonjour ! Je suis heureux de vous accueillir. En quoi puis-je vous être utile ?' },
  ],
  DEFAULT: [
    {
      text: `Je suis là pour vous aider avec vos besoins bancaires. Voici ce que je peux faire :\n\n- 💰 Consulter votre solde\n- 🔒 Bloquer/débloquer votre carte\n- 💸 Effectuer un virement\n- 📋 Soumettre une réclamation\n- 🏦 Trouver une agence\n- 👤 Contacter un agent\n\nQuelle est votre demande ?`,
    },
  ],
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function formatTime(date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function detectIntent(text) {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let bestIntent = 'DEFAULT';
  let bestScore = 0;

  for (const [intent, data] of Object.entries(INTENTS)) {
    const score = data.patterns.filter(p => lower.includes(p)).length;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  const confidence = bestScore > 0 ? Math.min(0.65 + bestScore * 0.12, 0.98) : 0.4;
  return { intent: bestIntent, confidence };
}

function renderMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

// ============================================================
// MAIN CHAT CLASS
// ============================================================
class AttijariChat {
  constructor() {
    this.messagesInner = document.getElementById('messagesInner');
    this.sessionsList  = document.getElementById('sessionsList');
    this.chatInput     = document.getElementById('chatInput');
    this.sendBtn       = document.getElementById('sendBtn');
    this.clearBtn      = document.getElementById('clearChatBtn');
    this.transferBtn   = document.getElementById('transferBtn');
    this.newChatBtn    = document.getElementById('newChatBtn');
    this.confidenceBar = document.getElementById('confidenceBar');
    this.confidenceVal = document.getElementById('confidence-value');
    this.intentEl      = document.getElementById('detected-intent');
    this.sentimentEl   = document.getElementById('sentiment-value');
    
    // Session State
    this.sessions = [];
    this.currentSessionId = null;
    this.pendingFollowUp = null;

    this.init();
    
    // Wait for the user to be authenticated before loading sessions
    window.addEventListener('userAuthenticated', (e) => {
      this.loadUserSessions(e.detail.user_id);
    });

    // Fallback if user is already authenticated
    if (window.currentUser && window.currentUser.user_id) {
      this.loadUserSessions(window.currentUser.user_id);
    }
  }

  init() {
    // New chat button
    this.newChatBtn?.addEventListener('click', () => this.createNewSession());

    // Send on button click
    this.sendBtn?.addEventListener('click', () => this.handleSend());

    // Send on Enter
    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Auto-resize textarea
    this.chatInput?.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 140) + 'px';
    });

    // Clear (Delete) current session
    this.clearBtn?.addEventListener('click', () => this.deleteCurrentSession());

    // Transfer to agent
    this.transferBtn?.addEventListener('click', () => this.escalateToAgent());

    // Quick action buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const msg = btn.dataset.msg;
        if (msg) this.processUserMessage(msg);
      });
    });

    // Context action buttons
    document.getElementById('ctx-escalate')?.addEventListener('click', () => {
      this.addSystemMessage('Ticket d\'escalade créé – Réf. ATJ-ESC-' + Date.now().toString().slice(-6));
    });
    document.getElementById('ctx-transfer')?.addEventListener('click', () => this.escalateToAgent());

    // Sidebar toggles are now handled by inline script in chat.html for maximum reliability

    // Update timestamp
    this.updateLastSeen();
  }

  // ============================================================
  // SESSION LOGIC
  // ============================================================
  getStorageKey() {
    const uid = window.currentUser?.user_id || 'guest';
    return `attijari_sessions_${uid}`;
  }

  loadUserSessions(userId) {
    console.log('[Chat] Loading sessions for user:', userId);
    this.sessions = this.loadSessions();
    this.loadLastSession();
  }

  loadSessions() {
    const saved = localStorage.getItem(this.getStorageKey());
    return saved ? JSON.parse(saved) : [];
  }

  saveSessions() {
    localStorage.setItem(this.getStorageKey(), JSON.stringify(this.sessions));
    this.renderSessionsList();
  }

  loadLastSession() {
    if (this.sessions.length > 0) {
      this.switchSession(this.sessions[0].id);
    } else {
      this.createNewSession();
    }
  }

  createNewSession() {
    const id = 'sess_' + Date.now();
    const newSession = {
      id: id,
      title: 'Nouvelle discussion',
      timestamp: new Date().toISOString(),
      messages: [] // Array of { role, text, time }
    };
    this.sessions.unshift(newSession);
    this.saveSessions();
    this.switchSession(id);
  }

  switchSession(id) {
    this.currentSessionId = id;
    const session = this.sessions.find(s => s.id === id);
    if (!session) return;

    this.renderChatArea(session.messages);
    this.renderSessionsList();
    this.scrollToBottom();
    this.pendingFollowUp = null;
  }

  deleteCurrentSession() {
    if (!this.currentSessionId) return;
    if (!confirm('Supprimer cette conversation définitivement ?')) return;

    this.sessions = this.sessions.filter(s => s.id !== this.currentSessionId);
    this.saveSessions();
    
    if (this.sessions.length > 0) {
      this.switchSession(this.sessions[0].id);
    } else {
      this.createNewSession();
    }
  }

  renderSessionsList() {
    if (!this.sessionsList) return;
    this.sessionsList.innerHTML = '';
    
    this.sessions.forEach(session => {
      const isActive = session.id === this.currentSessionId;
      const date = new Date(session.timestamp);
      const timeStr = date.toLocaleDateString() === new Date().toLocaleDateString() 
        ? formatTime(date) 
        : date.toLocaleDateString();

      const item = document.createElement('div');
      item.className = `session-item ${isActive ? 'active' : ''}`;
      item.innerHTML = `
        <div class="session-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div class="session-info">
          <p class="session-title">${this.escapeHtml(session.title)}</p>
          <p class="session-time">${timeStr}</p>
        </div>
      `;
      item.addEventListener('click', () => this.switchSession(session.id));
      this.sessionsList.appendChild(item);
    });
  }

  renderChatArea(messages) {
    // Clear and restore welcome message
    const welcome = document.getElementById('welcome-msg');
    this.messagesInner.innerHTML = '';
    if (welcome) {
        this.messagesInner.appendChild(welcome.cloneNode(true));
    }

    messages.forEach(msg => {
      this.renderMessageToDOM(msg.role, msg.text, msg.time);
    });
  }

  saveMessageToCurrentSession(role, text) {
    const session = this.sessions.find(s => s.id === this.currentSessionId);
    if (!session) return;

    const time = formatTime(new Date());
    session.messages.push({ role, text, time });
    session.timestamp = new Date().toISOString();

    // Auto-update title if it's the first user message
    if (role === 'user' && (session.title === 'Nouvelle discussion' || session.messages.length <= 2)) {
      session.title = text.length > 25 ? text.substring(0, 22) + '...' : text;
    }

    this.saveSessions();
  }

  handleSend() {
    const text = this.chatInput.value.trim();
    if (!text) return;
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';
    this.processUserMessage(text);
  }

  processUserMessage(text) {
    this.appendUserMessage(text);

    if (API_CONFIG.USE_MOCK) {
      const { intent, confidence } = detectIntent(text);
      this.updateContextPanel(intent, confidence);
      setTimeout(() => {
        this.showTyping().then(() => {
          this.appendBotResponse(intent, confidence);
        });
      }, 300);
    } else {
      this.callRealAPI(text);
    }
  }

  // ============================================================
  // REAL API INTEGRATION STUB
  // ============================================================
  async callRealAPI(text) {
    this.showTyping();
    try {
      const response = await fetch(API_CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(API_CONFIG.API_KEY ? { 'Authorization': `Bearer ${API_CONFIG.API_KEY}` } : {}),
        },
        body: JSON.stringify({ message: text, session_id: this.currentSessionId }),
      });

      if (!response.ok) throw new Error('API Error ' + response.status);

      const data = await response.json();
      this.removeTyping();
      this.appendBotResponseFromData(data.reply, data.intent, data.confidence);
    } catch (err) {
      this.removeTyping();
      this.appendMessage('bot', '⚠️ Connexion au modèle en cours… Veuillez réessayer. (' + err.message + ')');
    }
  }

  // ============================================================
  // MESSAGE RENDERING
  // ============================================================
  appendUserMessage(text) {
    this.renderMessageToDOM('user', text, formatTime(new Date()));
    this.saveMessageToCurrentSession('user', text);
    this.scrollToBottom();
  }

  appendBotResponse(intent, confidence) {
    this.removeTyping();
    const responses = MOCK_RESPONSES[intent] || MOCK_RESPONSES.DEFAULT;
    const resp = responses[Math.floor(Math.random() * responses.length)];

    if (resp.escalate) {
      this.appendEscalationCard();
      return;
    }

    let text = resp.text;
    if (text) {
      // Balance placeholders
      if (text.includes('{{CC}}') || text.includes('{{EP}}')) {
        let ccVal = window.currentUser?.compte_courant;
        let epVal = window.currentUser?.compte_epargne;
        
        const ccStr = (ccVal !== undefined && ccVal !== null)
          ? this.formatCurrency(ccVal) 
          : document.getElementById('ctx-cc-val')?.textContent || 'récupération...';
          
        const epStr = (epVal !== undefined && epVal !== null)
          ? this.formatCurrency(epVal) 
          : document.getElementById('ctx-ep-val')?.textContent || 'récupération...';
        
        text = text.replace('{{CC}}', ccStr).replace('{{EP}}', epStr);
      }
      // Card placeholders
      if (text.includes('{{CARD}}') || text.includes('{{CARD_TYPE}}')) {
        const cardNum = window.currentUser?.card_number_masked || '**** **** **** 0000';
        const cardType = window.currentUser?.card_type || 'Carte Bancaire';
        text = text.replace(/{{CARD}}/g, cardNum).replace(/{{CARD_TYPE}}/g, cardType);
      }

      // Transactions placeholder
      if (text.includes('{{TRANSACTIONS}}')) {
        const txs = window.currentUser?.transactions || [];
        let txHtml = '';
        if (txs.length === 0) {
          txHtml = '_Aucune transaction récente._';
        } else {
          txs.forEach(t => {
            const symbol = t.type === 'CREDIT' ? '🟢' : '🔴';
            const amount = parseFloat(t.amount || 0).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
            txHtml += `${symbol} **${t.merchant}**\n   _${t.date}_ : **${amount} DT**\n\n`;
          });
        }
        text = text.replace('{{TRANSACTIONS}}', txHtml.trim());
      }
    }

    this.appendMessage('bot', text);

    // Handle follow-up (e.g. blocage confirmation)
    if (resp.followUp) {
      this.pendingFollowUp = resp.followUp;
      const confirmEl = document.createElement('div');
      confirmEl.style.marginTop = '10px';
      confirmEl.innerHTML = `
        <div style="display:flex;gap:8px;margin-top:10px">
          <button onclick="window.attijariChat.confirmAction()" style="
            padding:8px 18px;border-radius:8px;background:#F7941D;color:white;
            font-size:13px;font-weight:600;border:none;cursor:pointer;transition:0.2s
          " onmouseover="this.style.background='#D97B0E'" onmouseout="this.style.background='#F7941D'">
            ✅ Confirmer
          </button>
          <button onclick="window.attijariChat.cancelAction(this)" style="
            padding:8px 18px;border-radius:8px;background:rgba(255,255,255,0.07);color:#9898A8;
            font-size:13px;font-weight:600;border:1px solid rgba(255,255,255,0.1);cursor:pointer
          ">
            ❌ Annuler
          </button>
        </div>
      `;
      const lastMsg = this.messagesInner.lastElementChild;
      const bubble = lastMsg?.querySelector('.msg-bubble');
      if (bubble) bubble.appendChild(confirmEl);
    }
  }

  appendBotResponseFromData(text, intent, confidence) {
    this.appendMessage('bot', text);
    if (intent) {
      this.updateContextPanel(intent, confidence || 0.8);
    }
  }

  appendMessage(role, text) {
    const time = formatTime(new Date());
    this.renderMessageToDOM(role, text, time);
    this.saveMessageToCurrentSession(role, text);
    this.scrollToBottom();
  }

  renderMessageToDOM(role, text, time) {
    const isBot = role === 'bot' || role === 'system';
    const el = document.createElement('div');
    el.className = `message-group ${role}`;
    
    if (role === 'system') {
      el.className = 'system-msg';
      el.textContent = '⚙️ ' + text;
    } else if (isBot) {
      el.innerHTML = `
        <div class="msg-avatar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="14" rx="2"/>
            <circle cx="9" cy="11" r="2"/><circle cx="15" cy="11" r="2"/>
            <line x1="9" y1="16" x2="15" y2="16"/>
          </svg>
        </div>
        <div class="msg-content">
          <div class="msg-bubble">${renderMarkdown(text)}</div>
          <span class="msg-time">${time}</span>
        </div>
      `;
    } else {
      el.innerHTML = `
        <div class="msg-content">
          <div class="msg-bubble">${this.escapeHtml(text)}</div>
          <span class="msg-time">${time}</span>
        </div>
      `;
    }
    
    this.messagesInner.appendChild(el);
  }

  appendEscalationCard() {
    const time = formatTime(new Date());
    const el = document.createElement('div');
    el.className = 'message-group bot';
    el.innerHTML = `
      <div class="msg-avatar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="14" rx="2"/>
          <circle cx="9" cy="11" r="2"/><circle cx="15" cy="11" r="2"/>
          <line x1="9" y1="16" x2="15" y2="16"/>
        </svg>
      </div>
      <div class="msg-content">
        <div class="escalate-card">
          <div class="ec-icon">👤</div>
          <div>
            <h4>Transfert vers agent humain</h4>
            <p>Un conseiller Attijari sera disponible dans <strong>2-3 minutes</strong>.<br/>
            File d'attente : 3 personnes · Résumé de la conversation joint.</p>
          </div>
        </div>
        <span class="msg-time">${time}</span>
      </div>
    `;
    this.messagesInner.appendChild(el);
    this.saveMessageToCurrentSession('bot', '[ESC_CARD] Transfert agent');
    this.scrollToBottom();
    this.addSystemMessage('Session transférée à l\'équipe agents humains');
  }

  confirmAction() {
    if (this.pendingFollowUp) {
      setTimeout(() => this.appendMessage('bot', this.pendingFollowUp), 400);
      this.pendingFollowUp = null;
    }
  }

  cancelAction(btn) {
    const wrapper = btn.parentElement;
    if (wrapper) wrapper.remove();
    this.appendMessage('bot', 'D\'accord, l\'opération a été annulée. Y a-t-il autre chose que je peux faire pour vous ?');
    this.pendingFollowUp = null;
  }

  escalateToAgent() {
    this.appendEscalationCard();
  }

  addSystemMessage(text) {
    this.renderMessageToDOM('system', text, formatTime(new Date()));
    this.saveMessageToCurrentSession('system', text);
    this.scrollToBottom();
  }

  // ============================================================
  // TYPING INDICATOR
  // ============================================================
  showTyping() {
    return new Promise(resolve => {
      const delay = 900 + Math.random() * 700;
      const el = document.createElement('div');
      el.className = 'typing-indicator';
      el.id = 'typingIndicator';
      el.innerHTML = `
        <div class="msg-avatar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="14" rx="2"/>
            <circle cx="9" cy="11" r="2"/><circle cx="15" cy="11" r="2"/>
            <line x1="9" y1="16" x2="15" y2="16"/>
          </svg>
        </div>
        <div class="typing-bubble">
          <span></span><span></span><span></span>
        </div>
      `;
      this.messagesInner.appendChild(el);
      this.scrollToBottom();
      setTimeout(() => resolve(), delay);
    });
  }

  removeTyping() {
    document.getElementById('typingIndicator')?.remove();
  }

  // ============================================================
  // CONTEXT PANEL
  // ============================================================
  updateContextPanel(intent, confidence) {
    const intentData = INTENTS[intent];
    const pct = Math.round(confidence * 100);

    if (this.intentEl) this.intentEl.textContent = intentData?.label || '—';
    if (this.sentimentEl) this.sentimentEl.textContent = intentData?.sentiment || '😊 Neutre';
    if (this.confidenceBar) this.confidenceBar.style.width = pct + '%';
    if (this.confidenceVal) this.confidenceVal.textContent = pct + '%';

    // Color confidence bar
    if (this.confidenceBar) {
      this.confidenceBar.style.background =
        pct > 80 ? 'var(--green)' :
          pct > 55 ? 'var(--orange)' : 'var(--red)';
    }
  }

  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================
  clearChat() {
    if (!confirm('Effacer la conversation ?')) return;
    const welcome = document.getElementById('welcome-msg');
    this.messagesInner.innerHTML = '';
    if (welcome) this.messagesInner.appendChild(welcome);
    this.pendingFollowUp = null;
  }

  newSession() {
    this.clearChat();
    this.addSystemMessage('Nouvelle session démarrée');
    this.sessionCount++;
  }

  // ============================================================
  // UTILS
  // ============================================================
  scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) container.scrollTop = container.scrollHeight;
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br/>');
  }

  updateLastSeen() {
    const updateEl = document.getElementById('lastUpdate');
    const tick = () => {
      if (updateEl) updateEl.textContent = 'Mis à jour: ' + formatTime(new Date());
    };
    tick();
    setInterval(tick, 30000);
  }

  formatCurrency(val) {
    return parseFloat(val).toLocaleString('fr-TN', { minimumFractionDigits: 3 }) + ' DT';
  }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  window.attijariChat = new AttijariChat();
});
