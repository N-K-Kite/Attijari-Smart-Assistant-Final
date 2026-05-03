<?php
// ============================================================
// login.php – Authenticate user by CIN + password
// POST { cin, password }
// ============================================================
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
$cin      = isset($body['cin'])      ? trim($body['cin'])      : '';
$password = isset($body['password']) ? trim($body['password']) : '';

// Basic validation
if (empty($cin) || empty($password)) {
    echo json_encode(['success' => false, 'error' => 'CIN et mot de passe requis']);
    exit;
}

if (!preg_match('/^\d{8}$/', $cin)) {
    echo json_encode(['success' => false, 'error' => 'CIN invalide (8 chiffres requis)']);
    exit;
}

// Fetch user
$stmt = $conn->prepare(
    'SELECT id, cin, first_name, last_name, password, role, card_type,
            compte_courant, compte_epargne, is_active
     FROM users WHERE cin = ? LIMIT 1'
);
$stmt->bind_param('s', $cin);
$stmt->execute();
$result = $stmt->get_result();
$user   = $result->fetch_assoc();
$stmt->close();

if (!$user) {
    echo json_encode(['success' => false, 'error' => 'CIN ou mot de passe incorrect']);
    exit;
}

if (!$user['is_active']) {
    echo json_encode(['success' => false, 'error' => 'Compte désactivé. Contactez votre agence.']);
    exit;
}

// Verify password (supports bcrypt)
$passwordMatch = false;
if (substr($user['password'], 0, 4) === '$2y$') {
    $passwordMatch = password_verify($password, $user['password']);
} else {
    // Legacy MD5 fallback
    $passwordMatch = ($user['password'] === md5($password));
}

if (!$passwordMatch) {
    echo json_encode(['success' => false, 'error' => 'CIN ou mot de passe incorrect']);
    exit;
}

// Update last_login
$upd = $conn->prepare('UPDATE users SET last_login = NOW() WHERE id = ?');
$upd->bind_param('i', $user['id']);
$upd->execute();
$upd->close();

// Create session
$_SESSION['user_id']     = $user['id'];
$_SESSION['cin']         = $user['cin'];
$_SESSION['first_name']  = $user['first_name'];
$_SESSION['last_name']   = $user['last_name'];
$_SESSION['role']        = $user['role'];
$_SESSION['logged_in']   = true;

echo json_encode([
    'success'    => true,
    'role'       => $user['role'],
    'first_name' => $user['first_name'],
    'last_name'  => $user['last_name'],
    'redirect'   => $user['role'] === 'admin' ? '../index.html' : '../index.html'
]);
