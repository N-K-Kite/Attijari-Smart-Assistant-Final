<?php
// ============================================================
// register.php – Create new user account
// POST { cin, first_name, last_name, password, confirm_password,
//        card_number, card_expiry, card_type }
// ============================================================
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Méthode non autorisée']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);

$cin             = isset($body['cin'])              ? trim($body['cin'])              : '';
$first_name      = isset($body['first_name'])       ? trim($body['first_name'])       : '';
$last_name       = isset($body['last_name'])        ? trim($body['last_name'])        : '';
$password        = isset($body['password'])         ? trim($body['password'])         : '';
$confirm_pass    = isset($body['confirm_password']) ? trim($body['confirm_password']) : '';
$card_number     = isset($body['card_number'])      ? trim($body['card_number'])      : '';
$card_expiry     = isset($body['card_expiry'])      ? trim($body['card_expiry'])      : '';
$card_type       = isset($body['card_type'])        ? trim($body['card_type'])        : 'Visa Gold';

// ---- Validation ----
$errors = [];

if (!preg_match('/^\d{8}$/', $cin))
    $errors[] = 'Le CIN doit contenir exactement 8 chiffres';

if (empty($first_name) || strlen($first_name) < 2)
    $errors[] = 'Prénom invalide';

if (empty($last_name) || strlen($last_name) < 2)
    $errors[] = 'Nom invalide';

if (strlen($password) < 6)
    $errors[] = 'Le mot de passe doit contenir au moins 6 caractères';

if ($password !== $confirm_pass)
    $errors[] = 'Les mots de passe ne correspondent pas';

// Card number: 16 digits (spaces allowed)
$cardClean = preg_replace('/\s+/', '', $card_number);
if (!empty($card_number) && !preg_match('/^\d{16}$/', $cardClean))
    $errors[] = 'Numéro de carte invalide (16 chiffres requis)';

if (!empty($errors)) {
    echo json_encode(['success' => false, 'errors' => $errors]);
    exit;
}

// Check CIN uniqueness
$check = $conn->prepare('SELECT id FROM users WHERE cin = ? LIMIT 1');
$check->bind_param('s', $cin);
$check->execute();
$check->store_result();
if ($check->num_rows > 0) {
    echo json_encode(['success' => false, 'error' => 'Ce CIN est déjà enregistré. Connectez-vous.']);
    $check->close();
    exit;
}
$check->close();

// Format card number with spaces
$formatted_card = implode(' ', str_split($cardClean, 4));

// Hash password
$hashed = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

// Insert user
$stmt = $conn->prepare(
    'INSERT INTO users
       (cin, first_name, last_name, password, card_number, card_expiry, card_type, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, "user")'
);
$stmt->bind_param(
    'sssssss',
    $cin, $first_name, $last_name, $hashed,
    $formatted_card, $card_expiry, $card_type
);

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'message' => 'Compte créé avec succès. Vous pouvez maintenant vous connecter.'
    ]);
} else {
    echo json_encode(['success' => false, 'error' => 'Erreur lors de la création du compte: ' . $conn->error]);
}

$stmt->close();
