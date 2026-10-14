<?php

    if ($path === 'login' && $method === 'POST') {
        require_once __DIR__ . '/config.php';

        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {
            respond(400, [
                'success' => false,
                'message' => 'Invalid JSON request body.'
            ], $path);
        }

        if (
            !isset($input['email'], $input['password']) ||
            !is_string($input['email']) ||
            !is_string($input['password'])
        ) {
            respond(422, [
                'success' => false,
                'message' => 'Email and password are required.'
            ], $path);
        }

        $email = strtolower(trim($input['email']));
        $password = $input['password'];

        if (
            strlen($email) > 150 ||
            !filter_var($email, FILTER_VALIDATE_EMAIL) ||
            $password === ''
        ) {
            respond(422, [
                'success' => false,
                'message' => 'A valid email and password are required.'
            ], $path);
        }

        $statement = $pdo->prepare(
            'SELECT user_id, full_name, email, password_hash, role
             FROM users
             WHERE email = :email
             LIMIT 1'
        );

        $statement->execute([
            'email' => $email
        ]);

        $user = $statement->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            respond(401, [
                'success' => false,
                'message' => 'Invalid email or password.'
            ], $path);
        }

        $issuedAt = time();
        $expiresAt = $issuedAt + NOVATIX_JWT_EXPIRY;

        $token = createJwt([
            'iss' => 'NovaTix',
            'sub' => (int) $user['user_id'],
            'role' => $user['role'],
            'iat' => $issuedAt,
            'exp' => $expiresAt
        ], NOVATIX_JWT_SECRET);

        respond(200, [
            'success' => true,
            'message' => 'Login successful.',
            'token_type' => 'Bearer',
            'expires_in' => NOVATIX_JWT_EXPIRY,
            'access_token' => $token,
            'data' => [
                'user_id' => (int) $user['user_id'],
                'full_name' => $user['full_name'],
                'email' => $user['email'],
                'role' => $user['role']
            ]
        ], $path);
    }

    if ($path === 'login') {
        respond(405, [
            'success' => false,
            'message' => 'This HTTP method is not available for this endpoint yet.'
        ], $path);
    }
