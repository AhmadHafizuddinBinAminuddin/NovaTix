<?php

function respond(int $status, array $data, string $path): void
{
    http_response_code($status);

    error_log(
        '[NovaTix API] ' .
        ($_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN') .
        ' /' . $path .
        ' ' . $status
    );

    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function base64UrlEncode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function createJwt(array $payload, string $secret): string
{
    $header = [
        'typ' => 'JWT',
        'alg' => 'HS256'
    ];

    $encodedHeader = base64UrlEncode(
        json_encode($header, JSON_UNESCAPED_SLASHES)
    );

    $encodedPayload = base64UrlEncode(
        json_encode($payload, JSON_UNESCAPED_SLASHES)
    );

    $signature = hash_hmac(
        'sha256',
        $encodedHeader . '.' . $encodedPayload,
        $secret,
        true
    );

    return $encodedHeader . '.' .
        $encodedPayload . '.' .
        base64UrlEncode($signature);
}

function base64UrlDecode(string $data): string|false
{
    $remainder = strlen($data) % 4;

    if ($remainder > 0) {
        $data .= str_repeat('=', 4 - $remainder);
    }

    $decoded = base64_decode(strtr($data, '-_', '+/'), true);

    return $decoded === false ? false : $decoded;
}

function verifyJwt(string $token, string $secret): ?array
{
    $parts = explode('.', $token);

    if (count($parts) !== 3) {
        return null;
    }

    $headerJson = base64UrlDecode($parts[0]);
    $payloadJson = base64UrlDecode($parts[1]);
    $signature = base64UrlDecode($parts[2]);

    if (
        $headerJson === false ||
        $payloadJson === false ||
        $signature === false
    ) {
        return null;
    }

    $header = json_decode($headerJson, true);
    $payload = json_decode($payloadJson, true);

    if (
        !is_array($header) ||
        !is_array($payload) ||
        ($header['alg'] ?? '') !== 'HS256'
    ) {
        return null;
    }

    $expectedSignature = hash_hmac(
        'sha256',
        $parts[0] . '.' . $parts[1],
        $secret,
        true
    );

    if (!hash_equals($expectedSignature, $signature)) {
        return null;
    }

    if (
        ($payload['iss'] ?? '') !== 'NovaTix' ||
        !isset($payload['sub'], $payload['exp'], $payload['role']) ||
        !is_numeric($payload['sub']) ||
        !is_numeric($payload['exp']) ||
        (int) $payload['sub'] < 1 ||
        (int) $payload['exp'] <= time() ||
        !in_array(
            $payload['role'],
            ['Customer', 'Staff', 'Administrator'],
            true
        )
    ) {
        return null;
    }

    return $payload;
}

function getAuthorizationHeader(): ?string
{
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        return trim($_SERVER['HTTP_AUTHORIZATION']);
    }

    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                return trim($value);
            }
        }
    }

    return null;
}

function authenticateJwtRequest(string $path, array $allowedRoles = []): array
{
    require_once __DIR__ . '/config.php';

    $authorization = getAuthorizationHeader();

    if (!$authorization || !preg_match('/^Bearer\s+(\S+)$/i', $authorization, $matches)) {
        respond(401, [
            'success' => false,
            'message' => 'A valid Bearer token is required.'
        ], $path);
    }

    $payload = verifyJwt($matches[1], NOVATIX_JWT_SECRET);

    if ($payload === null) {
        respond(401, [
            'success' => false,
            'message' => 'Invalid or expired access token.'
        ], $path);
    }

    if ($allowedRoles !== [] && !in_array($payload['role'], $allowedRoles, true)) {
        respond(403, [
            'success' => false,
            'message' => 'You do not have permission to access this resource.'
        ], $path);
    }

    return $payload;
}

function requireApiKey(string $path): void
{
    require_once __DIR__ . '/config.php';

    $providedKey = $_SERVER['HTTP_X_API_KEY'] ?? '';

    if ($providedKey === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp($name, 'X-API-Key') === 0) {
                $providedKey = trim($value);
                break;
            }
        }
    }

    if (!is_string($providedKey) || $providedKey === '' || !hash_equals(NOVATIX_API_KEY, $providedKey)) {
        respond(401, [
            'success' => false,
            'message' => 'A valid X-API-Key header is required.'
        ], $path);
    }
}

function generateQrCodeUrl(string $text): ?string
{
    if (!function_exists('curl_init')) {
        error_log('[NovaTix QR API] PHP cURL extension is not enabled.');
        return null;
    }

    $curl = curl_init('https://quickchart.io/qr-url');

    if ($curl === false) {
        error_log('[NovaTix QR API] Could not initialise cURL.');
        return null;
    }

    $requestBody = json_encode([
        'text' => $text,
        'size' => 250,
        'format' => 'png'
    ], JSON_UNESCAPED_SLASHES);

    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $requestBody,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12
    ]);

    $responseBody = curl_exec($curl);
    $httpStatus = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);

    if ($responseBody === false || $httpStatus < 200 || $httpStatus >= 300) {
        error_log('[NovaTix QR API] External request failed. HTTP status: ' . $httpStatus . '. ' . $curlError);
        return null;
    }

    $responseData = json_decode($responseBody, true);
    $qrUrl = is_array($responseData) ? ($responseData['url'] ?? null) : null;

    if (!is_string($qrUrl) || filter_var($qrUrl, FILTER_VALIDATE_URL) === false) {
        error_log('[NovaTix QR API] External response did not contain a valid QR URL.');
        return null;
    }

    $urlParts = parse_url($qrUrl);

    if (
        !is_array($urlParts) ||
        ($urlParts['scheme'] ?? '') !== 'https' ||
        ($urlParts['host'] ?? '') !== 'quickchart.io' ||
        ($urlParts['path'] ?? '') !== '/qr'
    ) {
        error_log('[NovaTix QR API] External response returned an unexpected URL.');
        return null;
    }

    return $qrUrl;
}
