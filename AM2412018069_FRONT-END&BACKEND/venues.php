<?php

    if ($path === 'venues' && $method === 'POST') {
        authenticateJwtRequest($path, ['Staff', 'Administrator']);

        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {
            respond(400, [
                'success' => false,
                'message' => 'Invalid JSON request body.'
            ], $path);
        }

        if (!isset($input['venue_name'], $input['address'], $input['capacity'])) {
            respond(422, [
                'success' => false,
                'message' => 'Venue name, address and capacity are required.'
            ], $path);
        }

        if (!is_string($input['venue_name']) || !is_string($input['address'])) {
            respond(422, [
                'success' => false,
                'message' => 'Venue name and address must be strings.'
            ], $path);
        }

        $venueName = trim($input['venue_name']);
        $address = trim($input['address']);
        $capacity = filter_var($input['capacity'], FILTER_VALIDATE_INT);
        $description = $input['description'] ?? null;

        if (
            $venueName === '' || strlen($venueName) > 150 ||
            $address === '' || strlen($address) > 255 ||
            $capacity === false || $capacity < 1 ||
            ($description !== null && !is_string($description))
        ) {
            respond(422, [
                'success' => false,
                'message' => 'One or more venue fields are invalid.'
            ], $path);
        }

        $statement = $pdo->prepare(
            'INSERT INTO venues (venue_name, address, capacity, description)
             VALUES (:venue_name, :address, :capacity, :description)'
        );

        $statement->execute([
            'venue_name' => $venueName,
            'address' => $address,
            'capacity' => $capacity,
            'description' => $description
        ]);

        respond(201, [
            'success' => true,
            'message' => 'Venue created successfully.',
            'data' => [
                'venue_id' => (int) $pdo->lastInsertId(),
                'venue_name' => $venueName,
                'address' => $address,
                'capacity' => (int) $capacity,
                'description' => $description
            ]
        ], $path);
    }

    if ($path === 'venues' && $method === 'GET') {
        $page = isset($_GET['page'])
            ? filter_var($_GET['page'], FILTER_VALIDATE_INT)
            : 1;

        $limit = isset($_GET['limit'])
            ? filter_var($_GET['limit'], FILTER_VALIDATE_INT)
            : 10;

        if (
            $page === false || $page === null || $page < 1 ||
            $limit === false || $limit === null ||
            $limit < 1 || $limit > 50
        ) {
            respond(400, [
                'success' => false,
                'message' => 'Page must be at least 1 and limit must be between 1 and 50.'
            ], $path);
        }

        $offset = ($page - 1) * $limit;

        $total = (int) $pdo
            ->query('SELECT COUNT(*) FROM venues')
            ->fetchColumn();

        $statement = $pdo->prepare(
            'SELECT venue_id, venue_name, address, capacity, description
             FROM venues
             ORDER BY venue_id ASC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue(':limit', (int) $limit, PDO::PARAM_INT);
        $statement->bindValue(':offset', (int) $offset, PDO::PARAM_INT);
        $statement->execute();

        respond(200, [
            'success' => true,
            'data' => $statement->fetchAll(),
            'pagination' => [
                'current_page' => (int) $page,
                'per_page' => (int) $limit,
                'total_records' => $total,
                'total_pages' => (int) ceil($total / $limit)
            ]
        ], $path);
    }

    if (preg_match('#^venues/([1-9][0-9]*)$#', $path, $writeMatches) && in_array($method, ['PUT', 'DELETE'], true)) {
        authenticateJwtRequest($path, ['Staff', 'Administrator']);
        $venueId = (int) $writeMatches[1];

        if ($method === 'PUT') {
            $input = json_decode(file_get_contents('php://input'), true);

            if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {
                respond(400, [
                    'success' => false,
                    'message' => 'Invalid JSON request body.'
                ], $path);
            }

            if (!isset($input['venue_name'], $input['address'], $input['capacity'])) {
                respond(422, [
                    'success' => false,
                    'message' => 'Venue name, address and capacity are required.'
                ], $path);
            }

            if (!is_string($input['venue_name']) || !is_string($input['address'])) {
                respond(422, [
                    'success' => false,
                    'message' => 'Venue name and address must be strings.'
                ], $path);
            }

            $venueName = trim($input['venue_name']);
            $address = trim($input['address']);
            $capacity = filter_var($input['capacity'], FILTER_VALIDATE_INT);
            $description = $input['description'] ?? null;

            if (
                $venueName === '' || strlen($venueName) > 150 ||
                $address === '' || strlen($address) > 255 ||
                $capacity === false || $capacity < 1 ||
                ($description !== null && !is_string($description))
            ) {
                respond(422, [
                    'success' => false,
                    'message' => 'One or more venue fields are invalid.'
                ], $path);
            }

            $statement = $pdo->prepare(
                'UPDATE venues
                 SET venue_name = :venue_name,
                     address = :address,
                     capacity = :capacity,
                     description = :description
                 WHERE venue_id = :venue_id'
            );

            $statement->execute([
                'venue_name' => $venueName,
                'address' => $address,
                'capacity' => $capacity,
                'description' => $description,
                'venue_id' => $venueId
            ]);

            if ($statement->rowCount() === 0) {
                $checkStatement = $pdo->prepare('SELECT venue_id FROM venues WHERE venue_id = :venue_id');
                $checkStatement->execute(['venue_id' => $venueId]);

                if (!$checkStatement->fetch()) {
                    respond(404, [
                        'success' => false,
                        'message' => 'Venue not found.'
                    ], $path);
                }
            }

            respond(200, [
                'success' => true,
                'message' => 'Venue updated successfully.',
                'data' => [
                    'venue_id' => $venueId,
                    'venue_name' => $venueName,
                    'address' => $address,
                    'capacity' => (int) $capacity,
                    'description' => $description
                ]
            ], $path);
        }

        $eventCountStatement = $pdo->prepare(
            'SELECT COUNT(*) FROM events WHERE venue_id = :venue_id'
        );
        $eventCountStatement->execute(['venue_id' => $venueId]);

        if ((int) $eventCountStatement->fetchColumn() > 0) {
            respond(409, [
                'success' => false,
                'message' => 'This venue cannot be deleted because events are associated with it.'
            ], $path);
        }

        $deleteStatement = $pdo->prepare('DELETE FROM venues WHERE venue_id = :venue_id');
        $deleteStatement->execute(['venue_id' => $venueId]);

        if ($deleteStatement->rowCount() === 0) {
            respond(404, [
                'success' => false,
                'message' => 'Venue not found.'
            ], $path);
        }

        respond(200, [
            'success' => true,
            'message' => 'Venue deleted successfully.',
            'data' => ['venue_id' => $venueId]
        ], $path);
    }

    if (preg_match('#^venues/([1-9][0-9]*)$#', $path, $matches)) {
        if ($method !== 'GET') {
            respond(405, [
                'success' => false,
                'message' => 'This HTTP method is not available for this endpoint yet.'
            ], $path);
        }

        $venueId = (int) $matches[1];

        $statement = $pdo->prepare(
            'SELECT venue_id, venue_name, address, capacity, description
             FROM venues
             WHERE venue_id = :venue_id'
        );

        $statement->execute([
            'venue_id' => $venueId
        ]);

        $venue = $statement->fetch();

        if (!$venue) {
            respond(404, [
                'success' => false,
                'message' => 'Venue not found.'
            ], $path);
        }

        respond(200, [
            'success' => true,
            'data' => $venue
        ], $path);
    }

    if ($path === 'venues') {
        respond(405, [
            'success' => false,
            'message' => 'This HTTP method is not available for this endpoint yet.'
        ], $path);
    }
