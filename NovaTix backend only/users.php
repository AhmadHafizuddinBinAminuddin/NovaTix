<?php

    if ($path === 'users/me' && $method === 'GET') {
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

        $statement = $pdo->prepare(
            'SELECT user_id, full_name, email, role, created_at
             FROM users
             WHERE user_id = :user_id
             LIMIT 1'
        );

        $statement->execute([
            'user_id' => (int) $payload['sub']
        ]);

        $user = $statement->fetch();

        if (!$user) {
            respond(401, [
                'success' => false,
                'message' => 'The account associated with this token no longer exists.'
            ], $path);
        }

        respond(200, [
            'success' => true,
            'message' => 'Authenticated user retrieved successfully.',
            'data' => $user
        ], $path);
    }

    if ($path === 'users/me') {
        respond(405, [
            'success' => false,
            'message' => 'This HTTP method is not available for this endpoint.'
        ], $path);
    }

    if ($path === 'users' && $method === 'GET') {
        authenticateJwtRequest($path, ['Administrator']);

        $statement = $pdo->query(
            'SELECT user_id, full_name, email, role, created_at
             FROM users
             ORDER BY user_id ASC'
        );

        respond(200, [
            'success' => true,
            'message' => 'User list retrieved successfully.',
            'data' => $statement->fetchAll()
        ], $path);
    }

    if ($path === 'users' && $method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {
            respond(400, [
                'success' => false,
                'message' => 'Invalid JSON request body.'
            ], $path);
        }

        if (
            !isset($input['full_name'], $input['email'], $input['password']) ||
            !is_string($input['full_name']) ||
            !is_string($input['email']) ||
            !is_string($input['password'])
        ) {
            respond(422, [
                'success' => false,
                'message' => 'Full name, email and password are required.'
            ], $path);
        }

        $fullName = trim($input['full_name']);
        $email = strtolower(trim($input['email']));
        $password = $input['password'];

        if ($fullName === '' || strlen($fullName) > 100) {
            respond(422, [
                'success' => false,
                'message' => 'Full name must contain between 1 and 100 characters.'
            ], $path);
        }

        if (
            strlen($email) > 150 ||
            !filter_var($email, FILTER_VALIDATE_EMAIL)
        ) {
            respond(422, [
                'success' => false,
                'message' => 'A valid email address is required.'
            ], $path);
        }

        if (strlen($password) < 8 || strlen($password) > 72) {
            respond(422, [
                'success' => false,
                'message' => 'Password must contain between 8 and 72 bytes.'
            ], $path);
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        if ($passwordHash === false) {
            throw new RuntimeException('Password hashing failed.');
        }

        try {
            $statement = $pdo->prepare(
                'INSERT INTO users (full_name, email, password_hash, role)
                 VALUES (:full_name, :email, :password_hash, :role)'
            );

            $statement->execute([
                'full_name' => $fullName,
                'email' => $email,
                'password_hash' => $passwordHash,
                'role' => 'Customer'
            ]);
        } catch (PDOException $e) {
            if (
                isset($e->errorInfo[1]) &&
                (int) $e->errorInfo[1] === 1062
            ) {
                respond(409, [
                    'success' => false,
                    'message' => 'This email address is already registered.'
                ], $path);
            }

            throw $e;
        }

        respond(201, [
            'success' => true,
            'message' => 'Customer registered successfully.',
            'data' => [
                'user_id' => (int) $pdo->lastInsertId(),
                'full_name' => $fullName,
                'email' => $email,
                'role' => 'Customer'
            ]
        ], $path);
    }

    if (preg_match('#^users/([1-9][0-9]*)$#', $path, $userMatches)) {
        $userId = (int) $userMatches[1];

        if (!in_array($method, ['PUT', 'PATCH', 'DELETE'], true)) {
            respond(405, [
                'success' => false,
                'message' => 'This HTTP method is not available for this endpoint.'
            ], $path);
        }

        $administrator = authenticateJwtRequest($path, ['Administrator']);

        $userStatement = $pdo->prepare(
            'SELECT user_id, full_name, email, role, created_at
             FROM users
             WHERE user_id = :user_id
             LIMIT 1'
        );
        $userStatement->execute(['user_id' => $userId]);
        $existingUser = $userStatement->fetch();

        if (!$existingUser) {
            respond(404, [
                'success' => false,
                'message' => 'User not found.'
            ], $path);
        }

        if ($method === 'DELETE') {
            if ((int) $administrator['sub'] === $userId) {
                respond(409, [
                    'success' => false,
                    'message' => 'You cannot delete your own administrator account.'
                ], $path);
            }

            $bookingCheck = $pdo->prepare(
                'SELECT COUNT(*) FROM bookings WHERE user_id = :user_id'
            );
            $bookingCheck->execute(['user_id' => $userId]);

            if ((int) $bookingCheck->fetchColumn() > 0) {
                respond(409, [
                    'success' => false,
                    'message' => 'This user cannot be deleted because bookings are associated with the account.'
                ], $path);
            }

            $deleteUser = $pdo->prepare(
                'DELETE FROM users WHERE user_id = :user_id'
            );
            $deleteUser->execute(['user_id' => $userId]);

            respond(200, [
                'success' => true,
                'message' => 'User deleted successfully.',
                'data' => ['user_id' => $userId]
            ], $path);
        }

        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {
            respond(400, [
                'success' => false,
                'message' => 'Invalid JSON request body.'
            ], $path);
        }

        if ($method === 'PUT') {
            foreach (['full_name', 'email', 'role'] as $requiredField) {
                if (!array_key_exists($requiredField, $input)) {
                    respond(422, [
                        'success' => false,
                        'message' => 'Missing required field: ' . $requiredField . '.'
                    ], $path);
                }
            }
        } elseif ($input === []) {
            respond(422, [
                'success' => false,
                'message' => 'At least one field must be provided for the update.'
            ], $path);
        }

        $allowedFields = ['full_name', 'email', 'role', 'password'];
        foreach (array_keys($input) as $field) {
            if (!in_array($field, $allowedFields, true)) {
                respond(422, [
                    'success' => false,
                    'message' => 'Unsupported user field: ' . $field . '.'
                ], $path);
            }
        }

        $updates = [];
        $parameters = ['user_id' => $userId];

        if (array_key_exists('full_name', $input)) {
            if (!is_string($input['full_name'])) {
                respond(422, [
                    'success' => false,
                    'message' => 'Full name must be a string.'
                ], $path);
            }

            $fullName = trim($input['full_name']);
            if ($fullName === '' || strlen($fullName) > 100) {
                respond(422, [
                    'success' => false,
                    'message' => 'Full name must contain between 1 and 100 characters.'
                ], $path);
            }

            $updates[] = 'full_name = :full_name';
            $parameters['full_name'] = $fullName;
        }

        if (array_key_exists('email', $input)) {
            if (!is_string($input['email'])) {
                respond(422, [
                    'success' => false,
                    'message' => 'Email must be a string.'
                ], $path);
            }

            $email = strtolower(trim($input['email']));
            if (strlen($email) > 150 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                respond(422, [
                    'success' => false,
                    'message' => 'A valid email address is required.'
                ], $path);
            }

            $updates[] = 'email = :email';
            $parameters['email'] = $email;
        }

        if (array_key_exists('role', $input)) {
            if (
                !is_string($input['role']) ||
                !in_array($input['role'], ['Customer', 'Staff', 'Administrator'], true)
            ) {
                respond(422, [
                    'success' => false,
                    'message' => 'Role must be Customer, Staff or Administrator.'
                ], $path);
            }

            if (
                (int) $administrator['sub'] === $userId &&
                $input['role'] !== 'Administrator'
            ) {
                respond(409, [
                    'success' => false,
                    'message' => 'You cannot remove the Administrator role from your own account.'
                ], $path);
            }

            $updates[] = 'role = :role';
            $parameters['role'] = $input['role'];
        }

        if (array_key_exists('password', $input)) {
            if (
                !is_string($input['password']) ||
                strlen($input['password']) < 8 ||
                strlen($input['password']) > 72
            ) {
                respond(422, [
                    'success' => false,
                    'message' => 'Password must contain between 8 and 72 bytes.'
                ], $path);
            }

            $passwordHash = password_hash($input['password'], PASSWORD_DEFAULT);
            if ($passwordHash === false) {
                throw new RuntimeException('Password hashing failed.');
            }

            $updates[] = 'password_hash = :password_hash';
            $parameters['password_hash'] = $passwordHash;
        }

        if ($updates === []) {
            respond(422, [
                'success' => false,
                'message' => 'No valid fields were provided for the update.'
            ], $path);
        }

        try {
            $updateUser = $pdo->prepare(
                'UPDATE users SET ' . implode(', ', $updates) . ' WHERE user_id = :user_id'
            );
            $updateUser->execute($parameters);
        } catch (PDOException $e) {
            if (isset($e->errorInfo[1]) && (int) $e->errorInfo[1] === 1062) {
                respond(409, [
                    'success' => false,
                    'message' => 'This email address is already registered.'
                ], $path);
            }
            throw $e;
        }

        $updatedStatement = $pdo->prepare(
            'SELECT user_id, full_name, email, role, created_at
             FROM users
             WHERE user_id = :user_id'
        );
        $updatedStatement->execute(['user_id' => $userId]);

        respond(200, [
            'success' => true,
            'message' => 'User updated successfully.',
            'data' => $updatedStatement->fetch()
        ], $path);
    }

    if ($path === 'users') {
        respond(405, [
            'success' => false,
            'message' => 'This HTTP method is not available for this endpoint yet.'
        ], $path);
    }
