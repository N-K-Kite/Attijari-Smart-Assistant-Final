import os
import json
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "attijari_pfe")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASSWORD", "postgres")

JSON_PATH = "data/tickets_custom.json"

def importer_json():
    if not os.path.exists(JSON_PATH):
        print("Aucun fichier tickets_custom.json trouvé.")
        return

    with open(JSON_PATH, "r", encoding="utf-8") as f:
        tickets = json.load(f)

    rows = []
    for t in tickets:
        # Gérer la date correctement
        dt_str = t.get("date")
        if not dt_str:
            dt_str = t.get("created_at")
        try:
            date_val = datetime.strptime(dt_str[:10], "%Y-%m-%d")
        except:
            date_val = datetime.now()

        created_at = t.get("created_at")
        if created_at:
            try:
                created_at_val = datetime.strptime(created_at[:19], "%Y-%m-%dT%H:%M:%S")
            except:
                created_at_val = datetime.now()
        else:
            created_at_val = datetime.now()

        rows.append((
            str(t.get("id")),
            date_val,
            str(t.get("type_operation") or "Helpdesk")[:100],
            str(t.get("full_description") or t.get("objet") or "Sans description")[:500],
            str(t.get("action_effectuee") or "")[:500] if t.get("action_effectuee") else None,
            int(t.get("severite", 2)),
            str(t.get("statut", "Ouvert"))[:50],
            float(t.get("score_anomalie", 0.3)),
            float(t.get("score_risque", 0.28)),
            created_at_val
        ))

    if not rows:
        print("Aucun ticket à importer.")
        return

    print(f"Importation de {len(rows)} tickets custom...")

    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS
    )
    cur = conn.cursor()

    query = """
        INSERT INTO reclamations
            (id, date, type_operation, description, action_effectuee,
             severite, statut, score_anomalie, score_risque, created_at)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
    """
    
    execute_values(cur, query, rows)
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM reclamations;")
    total = cur.fetchone()[0]
    print(f"Importation terminée ! Nombre total de tickets en BDD : {total}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    importer_json()
