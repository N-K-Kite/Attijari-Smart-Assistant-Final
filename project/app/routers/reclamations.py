"""
reclamations.py — Router réclamations sur données réelles Attijari bank
PFE Sujet 21
"""
import os
import uuid
import re
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from threading import Thread
from typing import List, Optional

import pandas as pd

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.audit import log_action
from app.core.logging_config import logger
from app.core.config import settings
from app.routers.auth import verifier_token, responsable_requis

router = APIRouter()

# ── Paths ─────────────────────────────────────────────────────
# Use a more robust absolute path based on workspace root if possible
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CUSTOM_TICKETS_FILE = os.path.join(BASE_DIR, "data", "tickets_custom.json")
CUSTOM_TICKETS_FILE = os.path.normpath(CUSTOM_TICKETS_FILE)

# ── Charger les données réelles ───────────────────────────────
DF_RECLAMATIONS = None


def _load_custom_tickets() -> list:
    """Load custom tickets from JSON file on disk."""
    if os.path.exists(CUSTOM_TICKETS_FILE):
        try:
            with open(CUSTOM_TICKETS_FILE, "r", encoding="utf-8") as f:
                tickets = json.load(f)
                logger.info("✅ Loaded {} custom tickets from {}", len(tickets), CUSTOM_TICKETS_FILE)
                return tickets
        except Exception as e:
            logger.error("❌ Error loading custom tickets: {}", e)
    return []


def _save_custom_tickets(tickets: list) -> None:
    """Save custom tickets to JSON file on disk."""
    try:
        os.makedirs(os.path.dirname(CUSTOM_TICKETS_FILE), exist_ok=True)
        with open(CUSTOM_TICKETS_FILE, "w", encoding="utf-8") as f:
            json.dump(tickets, f, ensure_ascii=False, indent=2)
        logger.info("✅ Saved {} custom tickets to {}", len(tickets), CUSTOM_TICKETS_FILE)
    except Exception as e:
        logger.error("❌ Error saving custom tickets: {}", e)


def _append_custom_ticket(ticket: dict) -> None:
    """Append a single ticket to the custom tickets file."""
    tickets = _load_custom_tickets()
    tickets.append(ticket)
    _save_custom_tickets(tickets)


def charger_donnees() -> None:
    global DF_RECLAMATIONS
    
    # Try multiple paths including absolute
    paths = [
        "data/processed/dataset_nlp_enrichi.csv",
        "../data/processed/dataset_nlp_enrichi.csv",
    ]
    
    for path in paths:
        if os.path.exists(path):
            try:
                DF_RECLAMATIONS = pd.read_csv(path, on_bad_lines="skip")
                logger.info("✅ SUCCESS: {} tickets loaded from {}", len(DF_RECLAMATIONS), path)
                print(f"DEBUG: First 2 rows:\n{DF_RECLAMATIONS.head(2)}")
                break
            except Exception as e:
                logger.error("❌ ERROR reading {}: {}", path, e)
    
    if DF_RECLAMATIONS is None:
        logger.error("🚫 ALL PATHS FAILED. CWD is {}", os.getcwd())
        # Temporary mock data to ensure dashboard isn't empty while debugging
        DF_RECLAMATIONS = pd.DataFrame([
            {"id": "DEBUG-001", "date": "2026-05-03", "type_operation": "DEBUG", "categorie": "System", "objet": "Backend Data Path Issue", "severite": 1, "statut": "Ouvert", "priorite_orig": "Haute", "type_demande": "Réclamation", "en_retard": False, "duree_resolution_min": 0, "score_anomalie": 0.99, "score_risque": 0.99}
        ])

    # ── Merge custom tickets from disk ────────────────────────────
    custom = _load_custom_tickets()
    if custom:
        custom_df = pd.DataFrame(custom)
        DF_RECLAMATIONS = pd.concat([DF_RECLAMATIONS, custom_df], ignore_index=True)
        logger.info("✅ Merged {} custom tickets → total: {}", len(custom), len(DF_RECLAMATIONS))


try:
    charger_donnees()
except Exception as exc:
    logger.error("Erreur chargement données : {}", exc)


# ── Email Helper ──────────────────────────────────────────────
def _send_ticket_email(ticket: dict, user_email: str, user_name: str) -> None:
    """Send email notification for a new ticket (runs in background thread)."""
    def _do_send():
        try:
            import socket
            smtp_host = settings.SMTP_HOST
            smtp_port = settings.SMTP_PORT
            smtp_user = settings.SMTP_USER
            smtp_pass = settings.SMTP_PASSWORD
            dest_email = settings.TICKET_NOTIFY_EMAIL

            # --- DEBUG DNS ---
            try:
                ip = socket.gethostbyname(smtp_host)
                logger.info("📡 DNS Check: {} resolves to {}", smtp_host, ip)
            except Exception as dns_err:
                logger.error("❌ DNS Check FAILED for {}: {}", smtp_host, dns_err)
                # Fallback to hardcoded IP if needed, but better to fix DNS
            # -----------------

            if not smtp_user or not smtp_pass:
                logger.warning("⚠️ SMTP credentials not configured (user: {}, pass: {}) — email not sent", smtp_user, "***" if smtp_pass else "EMPTY")
                return

            msg = MIMEMultipart("alternative")
            msg["From"] = smtp_user
            msg["To"] = dest_email
            msg["Subject"] = f"🚨 Nouveau Ticket IT — {ticket['id']} | Attijari Bank"

            severity_label = "🔴 Critique" if ticket.get("severite") == 1 else "🟠 Haute" if ticket.get("severite") == 2 else "🟢 Normale"
            score_pct = round((ticket.get("score_anomalie", 0)) * 100, 1)

            html = f"""
            <html>
            <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px;">
              <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 25px 30px;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 20px;">🏦 Attijari Bank — Nouveau Ticket IT</h1>
                </div>
                <div style="padding: 30px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 12px 0; font-weight: 700; color: #666; width: 140px;">ID Ticket</td>
                      <td style="padding: 12px 0; font-weight: 800; color: #2A7DE1; font-family: monospace;">{ticket['id']}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 12px 0; font-weight: 700; color: #666;">Date</td>
                      <td style="padding: 12px 0;">{ticket['date']}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 12px 0; font-weight: 700; color: #666;">Utilisateur</td>
                      <td style="padding: 12px 0; font-weight: 700;">{user_name} ({user_email})</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 12px 0; font-weight: 700; color: #666;">Groupe IT</td>
                      <td style="padding: 12px 0;">{ticket['type_operation']}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 12px 0; font-weight: 700; color: #666;">Catégorie</td>
                      <td style="padding: 12px 0;">{ticket.get('categorie', 'N/A')}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 12px 0; font-weight: 700; color: #666;">Description</td>
                      <td style="padding: 12px 0;">{ticket['objet']}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 12px 0; font-weight: 700; color: #666;">Sévérité</td>
                      <td style="padding: 12px 0;">{severity_label}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 12px 0; font-weight: 700; color: #666;">Score IA</td>
                      <td style="padding: 12px 0; font-weight: 800; color: {'#E05252' if score_pct >= 75 else '#F5A623' if score_pct >= 50 else '#28C78A'};">{score_pct}%</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; font-weight: 700; color: #666;">Statut</td>
                      <td style="padding: 12px 0;"><span style="background: #FFEBEB; color: #E05252; padding: 4px 12px; border-radius: 4px; font-weight: 800; font-size: 12px;">OUVERT</span></td>
                    </tr>
                  </table>
                  <div style="margin-top: 25px; padding: 15px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #2A7DE1;">
                    <p style="margin: 0; font-size: 13px; color: #666;">Connectez-vous au <a href="http://localhost:4200/dashboard" style="color: #2A7DE1; font-weight: 700;">Dashboard</a> pour gérer ce ticket.</p>
                  </div>
                </div>
                <div style="background: #f8fafc; padding: 15px 30px; text-align: center;">
                  <p style="margin: 0; font-size: 11px; color: #999;">Système IA Attijari Bank — Notification automatique</p>
                </div>
              </div>
            </body>
            </html>
            """

            msg.attach(MIMEText(html, "html", "utf-8"))

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, dest_email, msg.as_string())

            logger.info("✅ Email notification sent to {} for ticket {}", dest_email, ticket['id'])

        except Exception as e:
            logger.error("❌ Email notification failed: {}", e)

    # Run in background thread so we don't block the API response
    Thread(target=_do_send, daemon=True).start()


# ── Schémas ────────────────────────────────────────────────────
class ReclamationOut(BaseModel):
    id: str
    date: str
    type_operation: str
    categorie: str
    objet: str
    action_effectuee: Optional[str]
    severite: int
    statut: str
    priorite_orig: str
    type_demande: str
    en_retard: bool
    duree_resolution_min: float
    score_anomalie: Optional[float]
    score_risque: Optional[float]


class AnalyseNLPIn(BaseModel):
    description: str
    type_operation: str
    categorie: Optional[str] = ""
    severite: int = 2


class StatutUpdateIn(BaseModel):
    statut: str


class ReponseIn(BaseModel):
    message: str


# ── GET /reclamations ─────────────────────────────────────────
@router.get("/", summary="Liste des réclamations réelles Attijari bank")
async def get_reclamations(
    statut:         Optional[str]  = Query(default=None, description="Filtrer par statut"),
    type_operation: Optional[str]  = Query(default=None, description="Filtrer par groupe"),
    type_demande:   Optional[str]  = Query(default=None, description="Réclamation ou Demande de Service"),
    en_retard:      Optional[bool] = Query(default=None, description="Tickets en retard SLA"),
    severite_min:   Optional[int]  = Query(default=None, ge=1, le=4, description="Sévérité minimum 1–4"),
    limit:          int            = Query(default=50,  ge=1, le=5000, description="Nombre max de résultats"),
    offset:         int            = Query(default=0,   ge=0, description="Pagination"),
    payload: dict = Depends(verifier_token),
):
    """
    Retourne les tickets réels Attijari bank (Fév–Mars 2026).
    1507 tickets uniques après dédoublonnage.
    """
    logger.info("GET /reclamations | limit={} | offset={} | statut={} | type_op={} | ret={}", limit, offset, statut, type_operation, en_retard)
    
    if DF_RECLAMATIONS is None:
        logger.error("DF_RECLAMATIONS is NONE")
        return {"total": 0, "data": [], "message": "Données non chargées"}

    df = DF_RECLAMATIONS.copy()

    # Ensure empty strings don't trigger filters
    if statut and statut.strip():
        df = df[df["statut"] == statut]
    if type_operation and type_operation.strip():
        df = df[df["type_operation"].str.contains(type_operation, case=False, na=False)]
    if type_demande and type_demande.strip():
        df = df[df["type_demande"] == type_demande]
        
    if en_retard is not None:
        df = df[df["en_retard"] == en_retard]
    if severite_min is not None:
        df = df[df["severite"] <= severite_min]

    # SORT BY DATE DESCENDING (Newest first)
    if "date" in df.columns:
        df = df.sort_values(by="date", ascending=False)

    total = len(df)
    logger.info("Filtered total: {}", total)
    df = df.iloc[offset : offset + limit]

    cols = [
        "id", "date", "type_operation", "categorie", "objet",
        "action_effectuee", "severite", "statut", "priorite_orig",
        "type_demande", "en_retard", "duree_resolution_min",
        "score_anomalie", "score_risque",
    ]
    nullable = {"score_anomalie", "score_risque", "action_effectuee"}

    # Extra columns for the message inbox
    extra_cols = ["created_by_email", "created_by_name", "full_description", "reponses"]

    result = []
    for _, row in df.iterrows():
        rec = {}
        for col in cols:
            val = row.get(col, "")
            if pd.isna(val):
                val = None if col in nullable else ""
            rec[col] = val
        # Include extra columns if present
        for col in extra_cols:
            val = row.get(col, None)
            if val is not None and not (isinstance(val, float) and pd.isna(val)):
                rec[col] = val
        result.append(rec)

    logger.debug(
        "GET /reclamations → {} / {} tickets ({} filtres)",
        len(result), total, sum(1 for x in [statut, type_operation, type_demande, en_retard, severite_min] if x is not None)
    )
    return {"total": total, "offset": offset, "limit": limit, "data": result}


# ── GET /reclamations/me ──────────────────────────────────────
@router.get("/me", summary="Mes réclamations personnelles")
async def get_my_reclamations(payload: dict = Depends(verifier_token)):
    """
    Retourne les tickets créés par l'utilisateur connecté.
    """
    utilisateur = payload.get("sub", "anonyme")
    logger.info("GET /reclamations/me | user={}", utilisateur)
    
    if DF_RECLAMATIONS is None:
        return {"total": 0, "data": []}

    # Filter by created_by_email
    df = DF_RECLAMATIONS.copy()
    if "created_by_email" in df.columns:
        df = df[df["created_by_email"] == utilisateur]
    else:
        # If the column doesn't exist, we can't find them in the CSV data
        # But we might find them in custom tickets
        return {"total": 0, "data": []}

    # Sort by exact timestamp first, then date
    sort_cols = []
    if "created_at" in df.columns:
        sort_cols.append("created_at")
    if "date" in df.columns:
        sort_cols.append("date")
        
    if sort_cols:
        df = df.sort_values(by=sort_cols, ascending=False)

    total = len(df)
    
    cols = [
        "id", "date", "type_operation", "categorie", "objet",
        "action_effectuee", "severite", "statut", "priorite_orig",
        "type_demande", "en_retard", "duree_resolution_min",
        "score_anomalie", "score_risque", "created_at"
    ]
    extra_cols = ["reponses", "full_description"]

    result = []
    for _, row in df.iterrows():
        rec = {}
        for col in cols:
            val = row.get(col, None)
            if pd.isna(val): val = None
            rec[col] = val
        for col in extra_cols:
            val = row.get(col, None)
            if val is not None and not (isinstance(val, float) and pd.isna(val)):
                rec[col] = val
        result.append(rec)

    return {"total": total, "data": result}


# ── GET /reclamations/stats ───────────────────────────────────
@router.get("/stats", summary="Statistiques pour le dashboard")
async def get_stats(payload: dict = Depends(verifier_token)):
    """Statistiques globales pour les graphiques Chart.js du binôme."""
    if DF_RECLAMATIONS is None:
        return {"erreur": "Données non chargées"}

    df = DF_RECLAMATIONS

    groupes   = df["type_operation"].value_counts().head(8).to_dict()
    priorites = df["priorite_orig"].value_counts().to_dict()
    statuts   = df["statut"].value_counts().to_dict()

    total_retard = int(df["en_retard"].sum())
    pct_retard   = round(float(df["en_retard"].mean()) * 100, 1)
    score_col    = "score_anomalie" if "score_anomalie" in df.columns else None
    score_moy    = round(float(df[score_col].mean()), 3) if score_col else 0
    nb_risque    = int((df[score_col] >= 0.60).sum()) if score_col else 0
    nb_surveill  = int(((df[score_col] >= 0.40) & (df[score_col] < 0.60)).sum()) if score_col else 0

    return {
        "total_tickets":        len(df),
        "reclamations":         int((df["type_demande"] == "Réclamation").sum()),
        "demandes_service":     int((df["type_demande"] == "Demande de Service").sum()),
        "en_retard_sla":        total_retard,
        "pct_retard_sla":       pct_retard,
        "duree_moy_resolution": round(float(df["duree_resolution_min"].mean()), 0),
        "score_anomalie_moyen": score_moy,
        "tickets_risque_eleve": nb_risque,
        "tickets_surveillance": nb_surveill,
        "groupes":              groupes,
        "priorites":            priorites,
        "statuts":              statuts,
        "source":               "Données réelles Attijari bank — Fév–Mars 2026",
    }


# ── GET /reclamations/{id} ────────────────────────────────────
@router.get("/{reclamation_id}", summary="Détail d'un ticket")
async def get_reclamation(reclamation_id: str, payload: dict = Depends(verifier_token)):
    if DF_RECLAMATIONS is None:
        raise HTTPException(status_code=503, detail="Données non chargées")

    row = DF_RECLAMATIONS[DF_RECLAMATIONS["id"] == reclamation_id]
    if row.empty:
        raise HTTPException(status_code=404, detail=f"Ticket {reclamation_id} non trouvé")

    r = row.iloc[0]
    return {col: (None if pd.isna(r[col]) else r[col]) for col in DF_RECLAMATIONS.columns}


# ── PUT /reclamations/{id}/statut — Toggle ticket status ──────
@router.put("/{reclamation_id}/statut", summary="Modifier le statut d'un ticket")
async def update_statut(
    reclamation_id: str,
    req: StatutUpdateIn,
    payload: dict = Depends(responsable_requis),
):
    """
    Met à jour le statut d'un ticket (Ouvert → Résolu ou vice-versa).
    Accessible uniquement aux rôles admin et responsable_it.
    """
    global DF_RECLAMATIONS
    
    if req.statut not in ("Ouvert", "Résolu", "En cours"):
        raise HTTPException(status_code=400, detail="Statut invalide. Valeurs: Ouvert, Résolu, En cours")
    
    if DF_RECLAMATIONS is None:
        raise HTTPException(status_code=503, detail="Données non chargées")
    
    mask = DF_RECLAMATIONS["id"] == reclamation_id
    if not mask.any():
        raise HTTPException(status_code=404, detail=f"Ticket {reclamation_id} non trouvé")
    
    # Update in DataFrame
    DF_RECLAMATIONS.loc[mask, "statut"] = req.statut
    
    # Also update in custom tickets JSON if it's a custom ticket
    custom_tickets = _load_custom_tickets()
    for ticket in custom_tickets:
        if ticket["id"] == reclamation_id:
            ticket["statut"] = req.statut
            if req.statut == "Résolu":
                ticket["date_resolution"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
            break
    _save_custom_tickets(custom_tickets)
    
    utilisateur = payload.get("sub", "anonyme")
    log_action(
        utilisateur=utilisateur,
        role=payload.get("role", ""),
        action="UPDATE_STATUT",
        details=f"Ticket {reclamation_id} → {req.statut}",
    )
    
    logger.info("Ticket {} statut updated to {} by {}", reclamation_id, req.statut, utilisateur)
    
    return {
        "message": f"Ticket {reclamation_id} mis à jour",
        "ticket_id": reclamation_id,
        "nouveau_statut": req.statut,
        "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
    }


# ── POST /reclamations/{id}/repondre — Reply to a ticket ──────
@router.post("/{reclamation_id}/repondre", summary="Répondre à une réclamation")
async def repondre_reclamation(
    reclamation_id: str,
    req: ReponseIn,
    payload: dict = Depends(responsable_requis),
):
    """
    Simule l'envoi d'une réponse à l'utilisateur.
    Enregistre la réponse dans le fichier custom si applicable.
    """
    global DF_RECLAMATIONS
    
    if DF_RECLAMATIONS is None:
        raise HTTPException(status_code=503, detail="Données non chargées")
    
    mask = DF_RECLAMATIONS["id"] == reclamation_id
    if not mask.any():
        raise HTTPException(status_code=404, detail=f"Ticket {reclamation_id} non trouvé")
    
    # Update in custom tickets JSON
    custom_tickets = _load_custom_tickets()
    found_custom = False
    for ticket in custom_tickets:
        if ticket["id"] == reclamation_id:
            if "reponses" not in ticket:
                ticket["reponses"] = []
            
            reponse = {
                "id": str(uuid.uuid4())[:8],
                "auteur": payload.get("nom", "Admin"),
                "email_auteur": payload.get("sub", ""),
                "message": req.message,
                "date": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
            }
            ticket["reponses"].append(reponse)
            found_custom = True
            break
    
    if found_custom:
        _save_custom_tickets(custom_tickets)
        
        # --- SYNC WITH MEMORY (DF_RECLAMATIONS) ---
        idx_list = DF_RECLAMATIONS.index[DF_RECLAMATIONS["id"] == reclamation_id].tolist()
        if idx_list:
            idx = idx_list[0]
            # Ensure the column exists
            if "reponses" not in DF_RECLAMATIONS.columns:
                DF_RECLAMATIONS["reponses"] = None
                DF_RECLAMATIONS["reponses"] = DF_RECLAMATIONS["reponses"].astype(object)
            
            # Get existing list or create new one
            existing = DF_RECLAMATIONS.at[idx, "reponses"]
            if not isinstance(existing, list):
                existing = []
            
            # Create the exact same response object as saved to disk
            reponse = {
                "id": str(uuid.uuid4())[:8],
                "auteur": payload.get("nom", "Admin"),
                "email_auteur": payload.get("sub", ""),
                "message": req.message,
                "date": datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
            }
            # Append and re-assign (to trigger any potential change detection in pandas if needed, though .at is direct)
            existing.append(reponse)
            DF_RECLAMATIONS.at[idx, "reponses"] = existing
            logger.info("✅ Sync'd reply for ticket {} into memory", reclamation_id)
        # ------------------------------------------
    
    utilisateur = payload.get("sub", "anonyme")
    log_action(
        utilisateur=utilisateur,
        role=payload.get("role", ""),
        action="REPLY_TICKET",
        details=f"Réponse au ticket {reclamation_id}",
    )
    
    logger.info("Reply sent for ticket {} by {}", reclamation_id, utilisateur)
    
    return {
        "message": "Réponse enregistrée et envoyée",
        "ticket_id": reclamation_id,
        "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
    }


# ── POST /reclamations/analyser ───────────────────────────────
@router.post("/analyser", summary="Analyser un ticket via NLP")
async def analyser_reclamation(req: AnalyseNLPIn, payload: dict = Depends(verifier_token)):
    """
    Analyse un ticket avec score d'anomalie basé sur les modèles d'IA réels
    (moyennes par groupe et KNN pour cas similaires).
    """
    
    # ── Étape 1 : Base score par groupe issue du modèle
    from app.routers.predictions import SCORES_REELS
    groupe = req.type_operation or "Helpdesk"
    # Les scores_reels sont déjà très fidèles aux données d'entraînement.
    score_base = SCORES_REELS.get(groupe, 0.40)
    score = score_base

    # ── Étape 2 : Blend avec la prédiction KNN (cas similaires réels)
    try:
        from app.routers.recommandations import recommander_knn
        rec_knn = recommander_knn(req.description, groupe, req.categorie or "")
        # Si KNN trouve des cas similaires, on fusionne les scores (70% KNN, 30% Base)
        if rec_knn.get("taux_succes", 0) > 0 and rec_knn.get("nb_cas_similaires", 0) > 0:
            score = (score_base * 0.3) + (rec_knn["taux_succes"] * 0.7)
    except Exception as e:
        logger.warning(f"Impossible d'utiliser KNN pour le score : {e}")

    # ── Étape 3 : Ajustements spécifiques
    if req.severite == 1:
        score += 0.15
    elif req.severite == 2:
        score += 0.05

    mots_critiques = {
        "compromission": 0.15, "firewall": 0.10, "spam": 0.10,
        "blocage": 0.10, "western union": 0.15, "swift": 0.15,
        "authentification": 0.05, "timeout": 0.05, "erreur": 0.02,
    }

    desc_lower = req.description.lower()
    for mot, boost in mots_critiques.items():
        if mot in desc_lower:
            score += boost

    if "sécurité" in req.type_operation.lower() or "securite" in req.type_operation.lower():
        score += 0.10

    # Normalisation finale
    score = round(min(score, 0.99), 3)

    systemes = [s for s in ["SWIFT", "Amplitude", "IDC", "Outlook", "VPN", "Firewall", "Redis", "NMR", "Tanit"]
                if s.lower() in desc_lower]
    erreurs  = [e for e in ["spam", "compromission", "blocage", "timeout", "authentification"]
                if e.lower() in desc_lower]

    utilisateur = payload.get("sub", "anonyme")
    user_name = payload.get("nom", "Utilisateur")
    new_id = f"TK-{str(uuid.uuid4())[:8].upper()}"
    
    # Create the new ticket record
    new_ticket = {
        "id": new_id,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "type_operation": req.type_operation or "Helpdesk",
        "categorie": req.categorie or "Support Général",
        "objet": req.description[:100] + ("..." if len(req.description) > 100 else ""),
        "full_description": req.description,
        "action_effectuee": None,
        "severite": req.severite,
        "statut": "Ouvert",
        "priorite_orig": "Haute" if req.severite == 1 else "Moyenne",
        "type_demande": "Réclamation",
        "en_retard": False,
        "duree_resolution_min": 0.0,
        "score_anomalie": score,
        "score_risque": round(score * 0.95, 3),
        "created_by_email": utilisateur,
        "created_by_name": user_name,
        "created_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
    }

    # Append to global DataFrame if it exists
    global DF_RECLAMATIONS
    if DF_RECLAMATIONS is not None:
        new_row = pd.DataFrame([new_ticket])
        DF_RECLAMATIONS = pd.concat([DF_RECLAMATIONS, new_row], ignore_index=True)
        logger.info("Ticket {} added to system", new_id)

    # ── Persist to disk ───────────────────────────────────────
    _append_custom_ticket(new_ticket)

    # ── Send email notification ───────────────────────────────
    _send_ticket_email(new_ticket, utilisateur, user_name)

    log_action(
        utilisateur=utilisateur,
        role=payload.get("role", ""),
        action="ANALYSE_NLP",
        details=f"Ticket créé — id={new_id} | score={score} | groupe={req.type_operation}",
    )

    return {
        "reclamation_id":    new_id,
        "texte_analyse":     req.description,
        "systemes_detectes": systemes,
        "erreurs_detectees": erreurs,
        "score_anomalie":    score,
        "score_risque":      round(score * 0.95, 3),
        "niveau":            "CRITIQUE" if score >= 0.75 else ("SURVEILLANCE" if score >= 0.50 else "NORMAL"),
        "alerte_declenchee": score >= 0.75,
        "methode":           "Règles métier sur données réelles Attijari bank",
        "timestamp":         datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
    }
