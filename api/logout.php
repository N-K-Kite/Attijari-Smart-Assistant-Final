<?php
require_once 'config.php';
// Destroy session and redirect
session_destroy();
echo json_encode(['success' => true, 'redirect' => '../login.html']);
