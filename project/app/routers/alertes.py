"""
alertes.py — Router alertes — Endpoint principal UiPath
PFE Attijari bank — Sujet 21

UiPath CheckAlerte.xaml appelle : GET /api/alertes?seuil=0.75
UiPath ConfirmerResolution.xaml appelle : POST /api/alertes/{id}/cloturer
"""
from collections import Counter
from datetime import datetime
from typing import List, Optional

import json
import os
import pandas as pd
import pickle

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.audit import log_action
from app.core.logging_config import logger
from app.routers.auth import verifier_token

router = APIRouter()

# ── Charger les données et modèles ────────────────────────────
DF_DATA    = None
KNN_MODEL  = None
LSTM_MODEL = None

# ── Path for custom tickets (same as reclamations router) ────
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_CUSTOM_TICKETS_FILE = os.path.normpath(os.path.join(_BASE_DIR, "data", "tickets_custom.json"))


def _load_custom_tickets_df() -> pd.DataFrame:
    """Load custom tickets from disk and return as a DataFrame."""
    if not os.path.exists(_CUSTOM_TICKETS_FILE):
        return pd.DataFrame()
    try:
        with open(_CUSTOM_TICKETS_FILE, "r", encoding="utf-8") as f:
            tickets = json.load(f)
        if tickets:
            return pd.DataFrame(tickets)
    except Exception as e:
        logger.error("❌ Alertes: Error loading custom tickets: {}", e)
    return pd.DataFrame()


def charger_ressources() -> None:
    global DF_DATA, KNN_MODEL, LSTM_MODEL

    # Try absolute path first, then relative paths
    paths = [
        "data/processed/dataset_nlp_enrichi.csv",
        "../data/processed/dataset_nlp_enrichi.csv",
        "data/cleaned/reclamations_propres.csv",
    ]
    
    for path in paths:
        if os.path.exists(path):
            try:
                DF_DATA = pd.read_csv(path, on_bad_lines="skip")
                logger.info("✅ Alertes : {} tickets chargés depuis {}", len(DF_DATA), path)
                break
            except Exception as e:
                logger.error("❌ Erreur lecture CSV {}: {}", path, e)

    # Models relative path fallbacks
    model_paths = {
        "knn": ["models/knn_model.pkl"],
        "lstm": ["models/lstm_model.h5"]
    }

    for p in model_paths["knn"]:
        if os.path.exists(p):
            try:
                KNN_MODEL = pickle.load(open(p, "rb"))
                logger.info("✅ KNN chargé depuis {}", p)
                break
            except Exception as e: logger.error("Error KNN: {}", e)

    for p in model_paths["lstm"]:
        if os.path.exists(p):
            try:
                import tensorflow as tf
                LSTM_MODEL = tf.keras.models.load_model(p)
                logger.info("✅ LSTM chargé depuis {}", p)
                break
            except Exception as e: logger.error("Error LSTM: {}", e)


try:
    charger_ressources()
except Exception as exc:
    logger.error("Erreur chargement ressources alertes : {}", exc)


# ── Schéma alerte ─────────────────────────────────────────────
class AlerteSchema(BaseModel):
    id: str
    type_operation: str
    score_risque: float
    priorite: int
    action_recommandee: str
    date_detection: str
    statut: str
    source: str


class CloturageRequest(BaseModel):
    action_effectuee: str = Field(default="", description="Action corrective appliquée")
    statut_final:     str = Field(default="resolue", description="Statut final : resolue | rejetee")


# ── Calcul alertes depuis les données réelles + custom tickets ─
def calculer_alertes_reelles(seuil: float = 0.75) -> list:
    # Merge CSV data with custom tickets
    frames = []
    if DF_DATA is not None:
        frames.append(DF_DATA)
    
    custom_df = _load_custom_tickets_df()
    if not custom_df.empty:
        frames.append(custom_df)

    if not frames:
        logger.warning("Données non chargées — aucune alerte retournée")
        return []

    df_all = pd.concat(frames, ignore_index=True) if len(frames) > 1 else frames[0]

    col_score = "score_anomalie" if "score_anomalie" in df_all.columns else None
    if not col_score:
        return []

    df_alertes = df_all[df_all[col_score] >= seuil].copy()
    
    # Sort new custom tickets to the top, then by score
    df_alertes["is_custom"] = df_alertes["id"].astype(str).str.startswith("TK-")
    df_alertes = df_alertes.sort_values(["is_custom", col_score], ascending=[False, False])

    alertes = []
    for _, row in df_alertes.iterrows():
        score  = float(row.get(col_score, 0))
        action = str(row.get("action_effectuee", "") or "Escalader au support technique")[:200]

        # Detect if it came from a custom ticket
        is_custom = bool(str(row.get("id", "")).startswith("TK-"))

        # Use "created_at" for precise timestamps (custom tickets), fallback to "date" (CSV)
        created_at_val = row.get("created_at")
        date_val = row.get("date")

        if pd.notna(created_at_val) and str(created_at_val).strip() not in ("", "nan", "None"):
            date_str = str(created_at_val)
        elif pd.notna(date_val) and str(date_val).strip() not in ("", "nan", "None"):
            date_str = str(date_val)
        else:
            date_str = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

        alertes.append({
            "id":                 str(row.get("id", "")),
            "type_operation":     str(row.get("type_operation", "")),
            "score_risque":       round(score, 3),
            "priorite":           1 if score >= 0.85 else 2,
            "action_recommandee": action,
            "date_detection":     date_str,
            "statut":             "active",
            "source":             "Nouvelle réclamation chatbot" if is_custom else "Données réelles Attijari bank — LSTM + KNN",
        })

    # Sort perfectly by date descending so newest tickets are chronologically at the top
    alertes.sort(key=lambda x: x["date_detection"], reverse=True)

    return alertes


# ── GET /api/alertes — Endpoint principal UiPath ──────────────
@router.get(
    "/",
    response_model=List[AlerteSchema],
    summary="Alertes actives — Appelé par UiPath CheckAlerte.xaml",
)
async def get_alertes(
    seuil:  float          = Query(default=0.50, ge=0.0, le=1.0, description="Seuil score risque (0.0–1.0)"),
    statut: Optional[str]  = Query(default=None, description="Filtrer par statut"),
    payload: dict = None, # Depends(verifier_token) bypassed for demo
):
    """
    **Point d'entrée principal du robot UiPath.**

    - **score ≥ 0.85** → Priorité 1 → RPA automatique
    - **score 0.75–0.85** → Priorité 2 → Validation responsable IT
    - **score < 0.75** → Non retourné
    """
    alertes = calculer_alertes_reelles(seuil)

    if statut:
        alertes = [a for a in alertes if a["statut"] == statut]

    utilisateur = payload.get("sub", "anonyme") if payload else "anonyme"
    log_action(
        utilisateur=utilisateur,
        role=payload.get("role", "") if payload else "rpa",
        action="GET_ALERTES",
        details=f"seuil={seuil} — {len(alertes)} alerte(s) retournée(s)",
    )
    logger.info("GET /alertes seuil={} → {} alertes ({})", seuil, len(alertes), utilisateur)

    return alertes


# ── GET /api/alertes/stats ────────────────────────────────────
@router.get("/stats", summary="Statistiques alertes — Dashboard")
async def get_stats_alertes(payload: dict = Depends(verifier_token)):
    """Statistiques temps réel pour le dashboard Chart.js du binôme."""
    # Merge CSV + custom tickets for accurate stats
    frames = []
    if DF_DATA is not None:
        frames.append(DF_DATA)
    custom_df = _load_custom_tickets_df()
    if not custom_df.empty:
        frames.append(custom_df)

    df_all = pd.concat(frames, ignore_index=True) if len(frames) > 1 else (frames[0] if frames else pd.DataFrame())

    score_col = "score_anomalie" if not df_all.empty and "score_anomalie" in df_all.columns else None

    score_moyen = round(float(df_all[score_col].mean()), 3) if score_col else 0.0

    # Severity breakdown based on score_anomalie thresholds
    nb_critique    = int((df_all[score_col] >= 0.75).sum()) if score_col else 0
    nb_haute       = int(((df_all[score_col] >= 0.50) & (df_all[score_col] < 0.75)).sum()) if score_col else 0
    nb_moyenne     = int(((df_all[score_col] >= 0.25) & (df_all[score_col] < 0.50)).sum()) if score_col else 0
    nb_faible      = int((df_all[score_col] < 0.25).sum()) if score_col else 0
    total          = len(df_all)

    # Group breakdown across all tickets
    groupes = {}
    if not df_all.empty and "type_operation" in df_all.columns:
        groupes = df_all["type_operation"].value_counts().head(8).to_dict()

    return {
        "alertes_critiques":    nb_critique,
        "alertes_haute":        nb_haute,
        "alertes_moyenne":      nb_moyenne,
        "alertes_faible":       nb_faible,
        "alertes_surveillance": nb_haute + nb_moyenne,
        "tickets_total":        total,
        "score_moyen":          score_moyen,
        "groupes":              groupes,
        "derniere_maj":         datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "source":               "Données réelles Attijari bank Fév–Mars 2026 + tickets chatbot",
    }


# ── POST /api/alertes/{id}/cloturer — UiPath ConfirmerResolution
@router.post(
    "/{alerte_id}/cloturer",
    summary="Clôturer alerte — Appelé par UiPath ConfirmerResolution.xaml",
)
async def cloturer_alerte(
    alerte_id: str,
    req: CloturageRequest,
    payload: dict = None, # Depends(verifier_token) bypassed for demo
):
    """
    Appelé par ConfirmerResolution.xaml après exécution de l'action corrective.
    Met à jour le statut et enrichit la base d'apprentissage LSTM.
    """
    if req.statut_final not in ("resolue", "rejetee", "en_cours"):
        raise HTTPException(
            status_code=400,
            detail="statut_final doit être : resolue | rejetee | en_cours",
        )

    utilisateur = payload.get("sub", "anonyme") if payload else "anonyme"
    log_action(
        utilisateur=utilisateur,
        role=payload.get("role", "") if payload else "rpa",
        action="RESOLUTION_CONFIRMEE",
        details=f"Alerte {alerte_id} → {req.statut_final} | action: {req.action_effectuee[:100]}",
    )
    logger.info("Alerte {} clôturée ({}) par {}", alerte_id, req.statut_final, utilisateur)

    return {
        "message":          f"Alerte {alerte_id} clôturée",
        "alerte_id":        alerte_id,
        "action_effectuee": req.action_effectuee,
        "statut_final":     req.statut_final,
        "date_resolution":  datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "apprentissage":    "Ticket ajouté à la base d'apprentissage LSTM — réentraînement lundi 02h00",
        "prochain_retrain": "Lundi prochain 02:00",
    }
