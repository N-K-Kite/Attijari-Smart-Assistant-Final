# 📖 Guide d'installation et de déploiement — Encadrant (Attijari Bank)

Ce guide est destiné à l'encadrant du projet pour installer, configurer et exécuter localement l'application **Système IA de détection et de recommandation - Attijari bank**.

---

## 🛠️ Prérequis
Avant de commencer, assurez-vous d'avoir installé sur votre machine :
1. **Python 3.11** (recommandé pour la compatibilité avec TensorFlow et spaCy).
2. **Node.js (LTS)** (avec npm pour installer le frontend Angular).
3. **Docker Desktop** (pour lancer les bases de données et les moteurs IA de recherche et tracking facilement).

---

## 🚀 Étape 1 : Démarrage des Services d'Infrastructure (Docker)
L'application s'appuie sur une infrastructure complète (Base de données, Moteur de recherche NLP, Cache, MLflow).
1. Ouvrez un terminal dans le répertoire principal :
   ```bash
   cd project
   ```
2. Lancez l'infrastructure en arrière-plan avec Docker Compose :
   ```bash
   docker-compose up -d
   ```
   *Cela va initialiser :*
   * 🐘 **PostgreSQL** (Port 5433 ou 5432 - Stockage principal)
   * 🏃 **Redis** (Port 6379 - Caching & background tasks)
   * 🔍 **Elasticsearch** (Port 9200 - Indexation NLP des tickets)
   * 📊 **MLflow** (Port 5000 - Suivi de l'entraînement des modèles)

---

## 🐍 Étape 2 : Configuration & Lancement du Backend (FastAPI)

1. Ouvrez un terminal dans le dossier **`project`**.
2. Créez un environnement virtuel Python et activez-le :
   ```powershell
   # Sur Windows (PowerShell) :
   python -m venv venv
   .\venv\Scripts\activate
   ```
3. Installez toutes les dépendances requises (TensorFlow, MLflow, spaCy, FastAPI, etc.) :
   ```bash
   pip install -r requirements.txt
   ```
4. Configurez le fichier d'environnement :
   * Copiez le fichier `.env.example` et renommez-le en `.env`.
   * **Note importante sur le port Postgres :** Si Docker a exposé PostgreSQL sur le port `5433` (car le port `5432` était déjà occupé sur votre PC par une installation locale), modifiez les lignes suivantes dans votre fichier `.env` :
     ```env
     DB_PORT=5433
     DATABASE_URL=postgresql://postgres:root@localhost:5433/attijari_pfe
     ```
5. Initialisez la base de données et chargez les 1507 tickets IT de test :
   ```bash
   python scripts/init_db.py
   python scripts/import_csv.py
   ```
6. Démarrez le serveur Backend FastAPI :
   ```bash
   uvicorn app.main:app --reload
   ```
   Le backend sera disponible sur : **`http://localhost:8000`**
   * Vous pouvez accéder à la documentation interactive des APIs sur : **`http://localhost:8000/docs`**

---

## 🅰️ Étape 3 : Configuration & Lancement du Frontend (Angular)

1. Ouvrez un **nouveau** terminal dans le dossier **`frontend`**.
2. Installez les packages Node.js :
   ```bash
   npm install
   ```
3. Démarrez l'application Angular :
   ```bash
   npm start
   ```
   L'application sera accessible depuis votre navigateur à l'adresse suivante : **`http://localhost:4200`**

---

## 🔑 Comptes de Test Disponibles
Pour vous connecter et tester les différents profils et fonctionnalités du dashboard, utilisez les comptes suivants :

| Rôle | Email | Mot de passe | Description |
| :--- | :--- | :--- | :--- |
| **Administrateur** | `admin@attijaribank.tn` | `Admin@2026!` | Accès complet, gestion des utilisateurs, journal d'audit. |
| **Responsable IT** | `responsable.it@attijaribank.tn` | `Resp@2026!` | Vue sur les alertes critiques IA et gestion de la boîte de réclamations. |
| **Stagiaire** | `meriam@attijaribank.tn` | `Stage@2026!` | Consultation générale et tests de prédiction de tickets. |

---

## 🎯 Fonctionnalités Clés à Évaluer
1. **Dashboard IA** : Visualisation en temps réel des statistiques de pannes, des prédictions du modèle LSTM et des taux de résolution.
2. **Moteur de Recommandation KNN** : Dans l'onglet réclamations, le système propose automatiquement des solutions basées sur la similarité sémantique avec d'anciens tickets résolus.
3. **Boîte de Réclamation Persistante** : Permet aux responsables d'interagir, de modifier le statut des tickets, de valider des résolutions et de déclencher des alertes par e-mail.
4. **Journal d'Audit Trail** : Suivi rigoureux de toutes les actions sensibles effectuées par les utilisateurs (connexions, modifications, validations IA) pour la conformité de sécurité d'Attijari bank.
