import smtplib
import os
from dotenv import load_dotenv

load_dotenv("project/.env")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASSWORD")

print(f"Testing connection to {SMTP_HOST}:{SMTP_PORT}...")
print(f"User: {SMTP_USER}")

try:
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
        server.starttls()
        print("Connected and TLS started.")
        if SMTP_USER and SMTP_PASS:
            server.login(SMTP_USER, SMTP_PASS)
            print("Login successful!")
        else:
            print("No credentials provided.")
except Exception as e:
    print(f"Error: {e}")
