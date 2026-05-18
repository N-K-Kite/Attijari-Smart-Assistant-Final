import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(
    host="localhost", 
    port=5432, 
    dbname="attijari_pfe", 
    user="postgres", 
    password=os.getenv("DB_PASSWORD", "root")
)
cur = conn.cursor()
cur.execute("DELETE FROM reclamations WHERE id LIKE 'TK-%';")
print(f"Deleted {cur.rowcount} custom tickets.")
conn.commit()
cur.close()
conn.close()
