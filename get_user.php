<?php
// ============================================================
// get_user.php – Returns full profile of logged-in user
// ============================================================
require_once 'config.php';

if (empty($_SESSION['logged_in'])) {
    echo json_encode(['success' => false, 'error' => 'Non authentifié']);
    exit;
}

$stmt = $conn->prepare(
    'SELECT id, cin, first_name, last_name, card_number, card_expiry,
            card_type, role, compte_courant, compte_epargne, created_at, last_login
     FROM users WHERE id = ? LIMIT 1'
);
$stmt->bind_param('i', $_SESSION['user_id']);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ($user) {
    // Mask card number: show only last 4 digits
    if ($user['card_number']) {
        $parts = explode(' ', $user['card_number']);
        $masked = '';
        foreach ($parts as $i => $part) {
            $masked .= ($i === count($parts) - 1) ? $part : '****';
            if ($i < count($parts) - 1) $masked .= ' ';
        }
        $user['card_number_masked'] = $masked;
    }

    // Fetch Recent Transactions (Limit 5)
    $stmt2 = $conn->prepare('SELECT description, amount, merchant, date, type FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 5');
    $stmt2->bind_param('i', $_SESSION['user_id']);
    $stmt2->execute();
    $txRes = $stmt2->get_result();
    $txs = [];
    while ($t = $txRes->fetch_assoc()) {
        $txs[] = $t;
    }
    $stmt2->close();
    $user['transactions'] = $txs;

    unset($user['password']);
    echo json_encode(['success' => true, 'user' => $user]);
} else {
    echo json_encode(['success' => false, 'error' => 'Utilisateur introuvable']);
}
