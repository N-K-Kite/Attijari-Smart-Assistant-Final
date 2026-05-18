import os
import psycopg2
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "attijari_pfe")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASSWORD", "postgres")

def ajouter_meriam():
    try:
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed_password = pwd_context.hash("Stage@2026!")

        conn = psycopg2.connect(
            host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
            user=DB_USER, password=DB_PASS
        )
        cur = conn.cursor()

        query = """
            INSERT INTO utilisateurs (id, nom, email, mot_de_passe, role)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (email) DO NOTHING;
        """
        
        cur.execute(query, ("user-003", "Meriam", "meriam@attijaribank.tn", hashed_password, "utilisateur"))
        conn.commit()

        cur.execute("SELECT COUNT(*) FROM utilisateurs WHERE email = 'meriam@attijaribank.tn';")
        count = cur.fetchone()[0]
        
        if count > 0:
            print("Compte Meriam ajouté avec succès dans PostgreSQL !")
        else:
            print("Le compte existait déjà.")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Erreur : {e}")

if __name__ == "__main__":
    ajouter_meriam()
