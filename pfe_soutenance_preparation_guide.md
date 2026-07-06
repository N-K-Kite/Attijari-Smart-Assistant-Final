# Guide de Préparation & Script de Soutenance de Mi-Parcours
### Sujet 21 : Système de Détection d'Anomalies IA & Automatisation RPA (DSI Attijari bank)
**Auteur Unique :** Meriam (SESAME University)

Ce guide a été conçu pour vous donner exactement **quoi lire, quoi réviser et quoi dire** lors de votre soutenance de mi-parcours. Il est basé sur vos diapositives (`presentation.html`) et votre rapport (`rapport_mi_parcours.tex`). 

---

## 📖 Sommaire des Fiches de Révision
1. [Fiche Technique 1 : L'Architecture en Couches (Angular & FastAPI)](#fiche1)
2. [Fiche Technique 2 : Le Fonctionnement de l'IA (NLP, LSTM & KNN)](#fiche2)
3. [Fiche Technique 3 : Le Cœur de l'Automatisation (UiPath RPA)](#fiche3)
4. [Fiche Technique 4 : Base de Données & Sécurité (PostgreSQL & JWT)](#fiche4)
5. [Script Parole Mot-à-Mot par Diapositive](#script)
6. [Questions Pièges du Jury & Réponses Clés](#questions)

---

<div id="fiche1"></div>

## 🛠️ Fiche Technique 1 : L'Architecture en Couches (Angular 21 & FastAPI)
*Ce que vous devez réviser si le jury pose des questions sur la structure du code.*

### Le Frontend Angular 21
*   **Pourquoi Angular 21 ?** C'est le standard industriel pour les applications bancaires d'entreprise. Il offre un typage statique fort avec **TypeScript**, facilitant la maintenance, et une architecture modulaire en Single Page Application (SPA).
*   **Composants Clés :**
    *   `DashboardComponent` : Affiche les métriques en temps réel à l'aide de **graphiques SVG natifs** construits dynamiquement avec le système de liaison d'Angular (pas de bibliothèque externe lourde, ce qui prouve votre maîtrise géométrique).
    *   `ChatComponent` : Gère l'interaction en direct avec l'assistant IA, les sessions multiples stockées dans le `localStorage` de l'utilisateur.
    *   `InboxComponent` : L'interface administrative pour le responsable IT pour trier, filtrer et répondre aux tickets.
*   **Le Routage & Sécurité :** Les routes sensibles (comme le dashboard ou l'inbox) sont protégées côté client par un garde d'accès Angular (`auth.guard.ts`). Si aucun jeton JWT valide n'est détecté dans le service d'authentification (`AuthService`), l'utilisateur est redirigé vers la page de connexion.

### Le Backend FastAPI
*   **Pourquoi FastAPI ?** C'est un framework Python asynchrone ultra-rapide (basé sur Starlette et Pydantic), idéal pour servir des modèles d'intelligence artificielle en temps réel.
*   **Communication asynchrone :** Il utilise le protocole ASGI (serveur Uvicorn) pour traiter des centaines de requêtes simultanées de manière non bloquante.
*   **CORS (Cross-Origin Resource Sharing) :** Configuré de manière sécurisée pour n'accepter que les requêtes provenant de l'origine de votre application Angular.

---

<div id="fiche2"></div>

## 🧠 Fiche Technique 2 : Le Fonctionnement de l'IA (NLP, LSTM & KNN)
*Ce que vous devez savoir pour prouver que vous maîtrisez la partie Intelligence Artificielle.*

### 1. Le Traitement du Langage Naturel (NLP)
*   **Le But :** Comprendre instantanément la réclamation saisie par l'utilisateur dans le chatbot.
*   **Le Pipeline :**
    1.  **Tokenisation & Lemmatisation (spaCy) :** Découpage du texte en mots (tokens) et réduction à leur forme canonique (ex: "serveurs en panne" $\rightarrow$ "serveur en panne").
    2.  **Embeddings BERT :** Conversion des mots nettoyés en vecteurs numériques de 768 dimensions capturant le sens sémantique de la phrase.

### 2. Le Modèle Prédictif LSTM (Long Short-Term Memory)
*   **Le But :** Prédire le score de sévérité d'une anomalie et le risque systémique pour l'infrastructure informatique de la banque.
*   **Pourquoi LSTM ?** Contrairement aux réseaux de neurones classiques, les LSTMs possèdent des cellules de mémoire capables de capturer les dépendances temporelles à long terme (les tendances d'incidents sur 7 à 30 jours).
*   **Sortie :** Un score entre `0` (requête de support standard) et `1` (anomalie critique mettant en péril un service bancaire).

### 3. Le Moteur de Recommandation KNN (K-Nearest Neighbors)
*   **Le But :** Recommander instantanément la meilleure solution à l'administrateur face à un nouvel incident.
*   **Le Fonctionnement :**
    1.  Le système prend le vecteur sémantique du nouveau ticket.
    2.  Il calcule la **similarité cosinus** entre ce vecteur et les vecteurs des **1507 réclamations historiques** stockées en base de données.
    3.  Il extrait les $K$ cas les plus proches ($K=3$) ayant des taux de similarité élevés.
    4.  Il affiche à l'administrateur la méthode de résolution historique qui a obtenu le meilleur taux de réussite.

---

<div id="fiche3"></div>

## 🤖 Fiche Technique 3 : Le Cœur de l'Automatisation (UiPath RPA)
*Comment l'IA déclenche l'action sans intervention humaine.*

*   **Le Seuil de Criticité :** Configuré à `0.75` (75% de score de risque).
*   **Déclenchement :**
    1.  Lorsqu'une réclamation est classée par l'IA avec un score $> 0.75$ (ex: "Base de données injoignable"), le backend FastAPI appelle automatiquement l'API REST de **UiPath Orchestrator**.
    2.  Un robot logiciel (RPA) est instancié en tâche de fond.
    3.  Le robot exécute les scripts de remédiation prédéfinis : vérification des ports réseaux, redémarrage du service PostgreSQL défaillant ou purge des fichiers temporaires.
    4.  Une fois l'action terminée avec succès, le robot met à jour le statut du ticket à "Résolu" via l'API FastAPI et envoie un email de notification automatique à l'équipe IT.

---

<div id="fiche4"></div>

## 💾 Fiche Technique 4 : Base de Données & Sécurité (PostgreSQL & JWT)

*   **Base de Données PostgreSQL :** Choisi pour sa conformité aux standards transactionnels bancaires (ACID) et sa robustesse par rapport à MySQL pour le traitement de volumes de logs importants.
    *   **Table `utilisateurs` :** Contient les identifiants, rôles RBAC (user, admin, responsable_it), et mots de passe hachés.
    *   **Table `reclamations` :** Stocke l'historique complet des tickets avec leur score d'anomalie, département IT, et statut.
    *   **Table `audit_logs` :** Journal d'audit obligatoire pour la conformité bancaire, enregistrant chaque action sensible (connexions, modifications de statuts, exécution RPA).
*   **Sécurité JWT (JSON Web Token) :**
    *   Lors de la connexion, le backend valide les identifiants et génère un jeton JWT crypté avec une clé secrète.
    *   Ce jeton est stocké dans le navigateur.
    *   Pour chaque requête ultérieure vers l'API, le frontend injecte le jeton dans les en-têtes HTTP (`Authorization: Bearer <token>`). Le backend décode et valide le jeton avant d'autoriser l'accès aux données.

---

<div id="script"></div>

## 🎙️ Script Parole Mot-à-Mot par Diapositive
*Imprimez ceci ou lisez-le pour votre entraînement oral.*

### Diapositive 1 : Page de Garde
> **Votre discours :**
> *"Bonjour à tous, membres du jury. Je suis ravie de vous présenter aujourd'hui l'état d'avancement de mon projet de fin d'études au sein de la Direction des Systèmes d'Information d'Attijari bank. Mon travail s'intitule : Système de Détection d'Opportunités d'Amélioration Continue des Processus Bancaires via l'Intelligence Artificielle et la RPA. Ce projet est réalisé sous la supervision de mon encadrant professionnel, Monsieur Firas Elabed, et de mon encadrant académique, Monsieur Wajih Ben Belgacem."*

### Diapositive 2 : Contexte & Problématique
> **Votre discours :**
> *"Pour introduire le contexte, la DSI d'Attijari bank fait face au quotidien à un flux très important d'incidents et de demandes informatiques. Cette situation engendre trois défis majeurs. Premièrement, une surcharge opérationnelle évidente sur le support de premier niveau qui passe un temps précieux à traiter des requêtes répétitives. Deuxièmement, la difficulté d'isoler les anomalies critiques au milieu de requêtes standards, ce qui peut retarder la résolution d'incidents graves. Enfin, le manque de capitalisation : la banque possède un historique riche de plus de 1500 tickets, mais chaque incident est traité comme s'il était nouveau. L'enjeu de mon projet est donc de transformer ce support réactif en un système proactif, intelligent et hautement automatisé."*

### Diapositive 3 : Solution Globale (4 Piliers)
> **Votre discours :**
> *"Pour répondre à cette problématique, j'ai conçu et développé une solution complète articulée autour de 4 piliers technologiques complémentaires :
> 1. Une interface utilisateur développée en Single Page Application sous **Angular 21**, offrant un tableau de bord analytique en temps réel.
> 2. Un cœur de services asynchrones sous **FastAPI (Python)** assurant des performances optimales.
> 3. Un pôle d'Intelligence Artificielle intégrant un réseau de neurones récurrents **LSTM** pour l'analyse temporelle des risques, et un algorithme **KNN** pour capitaliser sur l'historique des incidents.
> 4. Une couche d'action automatique via des robots logiciels **UiPath RPA** pour remédier instantanément aux pannes critiques. 
> Bien évidemment, l'ensemble est sécurisé par un contrôle d'accès strict basé sur des jetons JWT et une traçabilité complète."*

### Diapositive 4 : Portail d'Accès Sécurisé
> **Votre discours :**
> *"Voici le portail d'accès sécurisé que j'ai développé. Il s'agit du point d'entrée unique de l'application. La sécurité est assurée par un hachage robuste des mots de passe en base de données avec l'algorithme bcrypt, combiné à la génération de jetons expirables JWT. J'ai mis en place un contrôle d'accès basé sur les rôles, ce qui permet de restreindre l'accès au Dashboard uniquement aux profils Administrateurs et Responsables IT, tout en laissant les utilisateurs standards utiliser le chatbot d'assistance."*

### Diapositive 5 : Assistant Chatbot Intelligent
> **Votre discours :**
> *"L'interface utilisateur de soumission d'incidents prend la forme d'un assistant conversationnel intelligent. L'employé décrit sa réclamation en langage naturel. Instantanément, mon backend analyse la requête grâce à mon pipeline NLP, calcule le score de sévérité, et catégorise automatiquement le problème dans la bonne division IT. Une barre latérale réactive permet également à l'employé de suivre l'état de ses réclamations en temps réel."*

### Diapositive 6 : Inbox Centralisée
> **Votre discours :**
> *"Du côté du Responsable IT, j'ai développé une Inbox Centralisée de supervision. Les réclamations ne sont pas affichées au hasard : elles sont triées en priorité selon le score d'anomalie calculé par l'IA. Cette interface permet d'inspecter les requêtes en un clin d'œil, de modifier leur statut et de répondre directement à l'employé."*

### Diapositive 7 : Analyse Détaillée & Recommandation KNN
> **Votre discours :**
> *"Lorsqu'on inspecte un ticket spécifique, le système affiche les caractéristiques calculées par l'IA. Mais la force majeure de ma solution réside dans son moteur de recommandation basé sur l'algorithme KNN. En comparant sémantiquement l'incident actuel avec nos 1507 cas historiques grâce à la similarité cosinus, le système suggère instantanément les solutions les plus proches qui ont fonctionné dans le passé, avec leur taux de similarité. C'est un gain de temps inestimable pour les ingénieurs support."*

### Diapositive 8 : Déclenchement Automatique RPA
> **Votre discours :**
> *"Si l'IA estime que le score de risque d'un incident dépasse le seuil critique de 0.75, le système déclenche automatiquement le robot UiPath associé. Le robot exécute les scripts de remédiation système (comme le redémarrage d'un serveur ou d'un service de base de données). L'ingénieur informatique reçoit ensuite un email de confirmation automatique. Cette approche élimine le temps d'attente humain pour la résolution des pannes les plus critiques."*

### Diapositive 9 : Sécurité & Audit Trail
> **Votre discours :**
> *"Afin de respecter les standards stricts du secteur bancaire, j'ai intégré un module complet d'Audit Trail. Chaque action effectuée sur le système --- de la connexion utilisateur à la clôture automatique d'un ticket par le robot RPA --- est journalisée de manière immuable en base de données avec horodatage précis et identifiant de l'acteur, garantissant une traçabilité totale."*

### Diapositive 10 : Le Dashboard Directionnel
> **Votre discours :**
> *"Enfin, voici la tour de contrôle de notre solution : le Dashboard Directionnel. Il est entièrement construit en graphiques SVG natifs dynamiques et réactifs. Le responsable IT peut piloter l'ensemble de l'activité : consulter les indicateurs clés (KPI), suivre la courbe temporelle de détection d'anomalies sur les 7 derniers jours, et visualiser la distribution par département grâce à un graphique en barres et un Donut interactif segmentant la sévérité globale."*

### Diapositive 11 : Bilan & Perspectives
> **Votre discours :**
> *"Pour conclure, ce projet montre que l'Intelligence Artificielle ne remplace pas l'équipe informatique, mais qu'elle l'augmente considérablement. Nous obtenons une réduction drastique du temps moyen de résolution des incidents informatiques, une capitalisation intelligente sur notre savoir historique et une fiabilité totale grâce aux robots RPA. Les prochaines étapes consisteront à finaliser l'optimisation des hyperparamètres du modèle LSTM et à préparer le déploiement sur les environnements de pré-production d'Attijari bank. Je vous remercie pour votre attention et je suis disponible pour répondre à toutes vos questions."*

---

<div id="questions"></div>

## ❓ Questions Pièges du Jury & Réponses Clés

**Q1 : Pourquoi avez-vous développé vos graphiques en SVG natif plutôt que d'utiliser des bibliothèques standards comme Chart.js ou D3.js ?**
> **Réponse recommandée :** *"L'intégration de bibliothèques tierces dans un environnement bancaire hautement sécurisé pose des contraintes d'audit de sécurité et de dépendances externes. En développant les graphiques directement en SVG natif liés à l'état réactif d'Angular 21, j'ai garanti une sécurité maximale, zéro dépendance externe, des performances d'affichage optimales et un contrôle total sur l'identité visuelle d'Attijari bank."*

**Q2 : Le modèle KNN compare la nouvelle requête avec 1500 tickets historiques. Si le nombre de tickets monte à 100 000, comment garantissez-vous les performances en temps réel ?**
> **Réponse recommandée :** *"Actuellement, pour 1500 tickets, le calcul de similarité cosinus via NumPy en mémoire prend moins de 5 millisecondes. Si le volume augmente fortement, nous passerons d'une recherche KNN exhaustive à une indexation sémantique vectorielle en utilisant des bases de données vectorielles adaptées comme PostgreSQL avec l'extension `pgvector` ou un index Elasticsearch, permettant de maintenir des requêtes en moins de 10 millisecondes."*

**Q3 : Comment le modèle LSTM gère-t-il la temporalité des incidents ?**
> **Réponse recommandée :** *"Le LSTM reçoit en entrée des séquences chronologiques d'incidents sur une fenêtre glissante de 7 jours. Il analyse la fréquence, le type de département touché et la vitesse d'accumulation pour prédire si nous sommes face à un incident isolé ou au début d'une panne en cascade critique. Cela permet de calculer le score de risque global projeté."*

**Q4 : Que se passe-t-il si le robot RPA (UiPath) échoue lors de l'exécution de sa tâche de remédiation ?**
> **Réponse recommandée :** *"Si le script UiPath rencontre une erreur, le statut du ticket passe à 'Erreur RPA' et une alerte de priorité absolue est immédiatement levée sur le Dashboard avec envoi d'un email d'escalade automatique au Responsable IT pour intervention manuelle. Le système ne reste jamais bloqué."*
