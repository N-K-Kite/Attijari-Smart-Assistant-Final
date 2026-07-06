-- ============================================================
-- Attijari Bank Smart Assistant – Database Schema
-- Run this in phpMyAdmin or MySQL Workbench
-- ============================================================

CREATE DATABASE IF NOT EXISTS attijari_smartcenter
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE attijari_smartcenter;

CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  cin             VARCHAR(8)   NOT NULL UNIQUE COMMENT 'Carte d\'Identité Nationale (8 chiffres)',
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  password        VARCHAR(255) NOT NULL COMMENT 'bcrypt hashed',
  card_number     VARCHAR(19)  DEFAULT NULL COMMENT 'Format: XXXX XXXX XXXX XXXX',
  card_expiry     VARCHAR(7)   DEFAULT NULL COMMENT 'Format: MM/AAAA',
  card_type       VARCHAR(30)  DEFAULT 'Visa Gold',
  role            ENUM('user','admin') NOT NULL DEFAULT 'user',
  compte_courant  DECIMAL(15,3) DEFAULT 0.000,
  compte_epargne  DECIMAL(15,3) DEFAULT 0.000,
  is_active       TINYINT(1)   DEFAULT 1,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  last_login      TIMESTAMP    NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- DEFAULT ADMIN ACCOUNT
-- CIN: 00000001  |  Password: Admin@2026
-- ============================================================
INSERT INTO users
  (cin, first_name, last_name, password, role, compte_courant, compte_epargne)
VALUES
  ('00000001', 'Admin', 'Attijari',
   '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'admin', 0.000, 0.000);

-- ============================================================
-- DEMO USER: Meriam K.
-- CIN: 12345678  |  Password: Meriam@2026
-- ============================================================
INSERT INTO users
  (cin, first_name, last_name, password, card_number, card_expiry,
   card_type, role, compte_courant, compte_epargne)
VALUES
  ('12345678', 'Meriam', 'K.',
   '$2y$12$eImiTXuWVxfM37uY4JANjOezBHFb2VbKmVrexmyX6qNJ4kFxVfBmW',
   '4532 1234 5678 9012', '12/2027',
   'Visa Gold', 'user', 32000.000, 113000.000);

-- ============================================================
-- TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  description VARCHAR(200) NOT NULL,
  amount      DECIMAL(15,3) NOT NULL,
  merchant    VARCHAR(100) DEFAULT NULL,
  date        DATE NOT NULL,
  type        ENUM('credit','debit') NOT NULL DEFAULT 'debit',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SEED: 5 transactions for Meriam K. (user_id = 2)
-- ============================================================
INSERT INTO transactions (user_id, description, amount, merchant, date, type) VALUES
  (2, 'Virement salaire Mars 2026',     2300.000, 'Employeur SA',       '2026-03-28', 'credit'),
  (2, 'Facture STEG – Electricité',     -380.000, 'STEG',              '2026-03-25', 'debit'),
  (2, 'Achat supermarché',              -95.500,  'Carrefour Market',  '2026-03-24', 'debit'),
  (2, 'Virement vers bénéficiaire',     -280.000, 'Transfert bancaire','2026-03-22', 'debit'),
  (2, 'Remboursement assurance',         410.000, 'Assurances Maghreb','2026-03-20', 'credit');

-- ============================================================
-- SEED: 5 transactions for Admin (user_id = 1)
-- ============================================================
INSERT INTO transactions (user_id, description, amount, merchant, date, type) VALUES
  (1, 'Provision compte opérationnel',  5000.000, 'Attijari Bank',     '2026-03-28', 'credit'),
  (1, 'Frais de service plateforme',    -120.000, 'Hébergement Cloud', '2026-03-26', 'debit'),
  (1, 'Licence logiciel annuelle',      -850.000, 'Microsoft 365',     '2026-03-23', 'debit'),
  (1, 'Remboursement fournisseur',       340.000, 'Fournisseur IT',    '2026-03-21', 'debit'),
  (1, 'Virement interne',              -200.000, 'Transfert interne',  '2026-03-19', 'debit');

