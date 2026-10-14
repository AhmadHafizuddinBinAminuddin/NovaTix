<?php

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/helpers.php';

$path = trim($_SERVER['PATH_INFO'] ?? '', '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    require_once __DIR__ . '/db.php';

    if ($path === 'health' || $path === 'system/status') {
        require __DIR__ . '/system.php';
    } elseif ($path === 'login') {
        require __DIR__ . '/login.php';
    } elseif ($path === 'users' || str_starts_with($path, 'users/')) {
        require __DIR__ . '/users.php';
    } elseif ($path === 'events' || str_starts_with($path, 'events/')) {
        require __DIR__ . '/events.php';
    } elseif ($path === 'venues' || str_starts_with($path, 'venues/')) {
        require __DIR__ . '/venues.php';
    } elseif ($path === 'bookings' || str_starts_with($path, 'bookings/')) {
        require __DIR__ . '/bookings.php';
    }

    respond(404, [
        'success' => false,
        'message' => 'API endpoint not found.'
    ], $path);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('[NovaTix API Error] ' . $e->getMessage());

    respond(500, [
        'success' => false,
        'message' => 'An internal server error occurred.'
    ], $path);
}
