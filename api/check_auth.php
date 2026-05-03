<?php
// ============================================================
// check_auth.php – Returns current session/auth status
// Called by auth.js on every page load
// ============================================================
require_once 'config.php';

if (!empty($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
    echo json_encode([
        'loggedIn'   => true,
        'role'       => $_SESSION['role'],
        'first_name' => $_SESSION['first_name'],
        'last_name'  => $_SESSION['last_name'],
        'cin'        => $_SESSION['cin'],
        'user_id'    => $_SESSION['user_id'],
    ]);
} else {
    echo json_encode(['loggedIn' => false]);
}
