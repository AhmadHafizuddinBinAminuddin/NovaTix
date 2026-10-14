<?php

    if ($path === 'events' && $method === 'POST') {
        authenticateJwtRequest($path, ['Staff', 'Administrator']);

        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {
            respond(400, [
                'success' => false,
                'message' => 'Invalid JSON request body.'
            ], $path);
        }

        $requiredFields = ['venue_id', 'event_name', 'event_date', 'event_time', 'total_tickets'];

        foreach ($requiredFields as $field) {
            if (!array_key_exists($field, $input)) {
                respond(422, [
                    'success' => false,
                    'message' => 'Missing required field: ' . $field . '.'
                ], $path);
            }
        }

        if (!is_string($input['event_name']) || !is_string($input['event_date']) || !is_string($input['event_time'])) {
            respond(422, [
                'success' => false,
                'message' => 'Event name, date and time must be strings.'
            ], $path);
        }

        $venueId = filter_var($input['venue_id'], FILTER_VALIDATE_INT);
        $eventName = trim($input['event_name']);
        $eventDate = $input['event_date'];
        $eventTime = $input['event_time'];
        $totalTickets = filter_var($input['total_tickets'], FILTER_VALIDATE_INT);
        $description = $input['description'] ?? null;
        $status = $input['status'] ?? 'Upcoming';
        $validStatuses = ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'];
        $dateObject = DateTime::createFromFormat('!Y-m-d', $eventDate);

        if (
            $venueId === false || $venueId < 1 ||
            $eventName === '' || strlen($eventName) > 150 ||
            !$dateObject || $dateObject->format('Y-m-d') !== $eventDate ||
            !preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/', $eventTime) ||
            $totalTickets === false || $totalTickets < 1 ||
            ($description !== null && !is_string($description)) ||
            !is_string($status) || !in_array($status, $validStatuses, true)
        ) {
            respond(422, [
                'success' => false,
                'message' => 'One or more event fields are invalid.'
            ], $path);
        }

        $venueStatement = $pdo->prepare('SELECT venue_id FROM venues WHERE venue_id = :venue_id');
        $venueStatement->execute(['venue_id' => $venueId]);

        if (!$venueStatement->fetch()) {
            respond(404, [
                'success' => false,
                'message' => 'Venue not found.'
            ], $path);
        }

        $statement = $pdo->prepare(
            'INSERT INTO events
                (venue_id, event_name, description, event_date, event_time,
                 total_tickets, available_tickets, status)
             VALUES
                (:venue_id, :event_name, :description, :event_date, :event_time,
                 :total_tickets, :available_tickets, :status)'
        );

        $statement->execute([
            'venue_id' => $venueId,
            'event_name' => $eventName,
            'description' => $description,
            'event_date' => $eventDate,
            'event_time' => $eventTime,
            'total_tickets' => $totalTickets,
            'available_tickets' => $totalTickets,
            'status' => $status
        ]);

        respond(201, [
            'success' => true,
            'message' => 'Event created successfully.',
            'data' => [
                'event_id' => (int) $pdo->lastInsertId(),
                'venue_id' => (int) $venueId,
                'event_name' => $eventName,
                'event_date' => $eventDate,
                'event_time' => $eventTime,
                'total_tickets' => (int) $totalTickets,
                'available_tickets' => (int) $totalTickets,
                'status' => $status
            ]
        ], $path);
    }

    if ($path === 'events' && $method === 'GET') {
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

        $countQuery = $pdo->query(
            'SELECT COUNT(*) FROM events'
        );

        $total = (int) $countQuery->fetchColumn();

        $query = '
            SELECT
                e.event_id,
                e.event_name,
                e.description,
                e.event_date,
                e.event_time,
                e.total_tickets,
                e.available_tickets,
                e.status,
                v.venue_id,
                v.venue_name,
                v.address AS venue_address
            FROM events e
            INNER JOIN venues v
                ON e.venue_id = v.venue_id
            ORDER BY e.event_date ASC, e.event_time ASC
            LIMIT :limit OFFSET :offset
        ';

        $statement = $pdo->prepare($query);

        $statement->bindValue(':limit', (int) $limit, PDO::PARAM_INT);
        $statement->bindValue(':offset', (int) $offset, PDO::PARAM_INT);

        $statement->execute();

        $events = $statement->fetchAll();

        respond(200, [
            'success' => true,
            'data' => $events,
            'pagination' => [
                'current_page' => (int) $page,
                'per_page' => (int) $limit,
                'total_records' => $total,
                'total_pages' => (int) ceil($total / $limit)
            ]
        ], $path);
    }

    if (preg_match('#^events/([1-9][0-9]*)$#', $path, $writeMatches) && in_array($method, ['PUT', 'DELETE'], true)) {
        authenticateJwtRequest($path, ['Staff', 'Administrator']);
        $eventId = (int) $writeMatches[1];

        if ($method === 'PUT') {
            $input = json_decode(file_get_contents('php://input'), true);

            if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {
                respond(400, [
                    'success' => false,
                    'message' => 'Invalid JSON request body.'
                ], $path);
            }

            $requiredFields = ['venue_id', 'event_name', 'event_date', 'event_time', 'total_tickets'];

            foreach ($requiredFields as $field) {
                if (!array_key_exists($field, $input)) {
                    respond(422, [
                        'success' => false,
                        'message' => 'Missing required field: ' . $field . '.'
                    ], $path);
                }
            }

            if (!is_string($input['event_name']) || !is_string($input['event_date']) || !is_string($input['event_time'])) {
                respond(422, [
                    'success' => false,
                    'message' => 'Event name, date and time must be strings.'
                ], $path);
            }

            $venueId = filter_var($input['venue_id'], FILTER_VALIDATE_INT);
            $eventName = trim($input['event_name']);
            $eventDate = $input['event_date'];
            $eventTime = $input['event_time'];
            $totalTickets = filter_var($input['total_tickets'], FILTER_VALIDATE_INT);
            $description = $input['description'] ?? null;
            $status = $input['status'] ?? 'Upcoming';
            $validStatuses = ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'];
            $dateObject = DateTime::createFromFormat('!Y-m-d', $eventDate);

            if (
                $venueId === false || $venueId < 1 ||
                $eventName === '' || strlen($eventName) > 150 ||
                !$dateObject || $dateObject->format('Y-m-d') !== $eventDate ||
                !preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/', $eventTime) ||
                $totalTickets === false || $totalTickets < 1 ||
                ($description !== null && !is_string($description)) ||
                !is_string($status) || !in_array($status, $validStatuses, true)
            ) {
                respond(422, [
                    'success' => false,
                    'message' => 'One or more event fields are invalid.'
                ], $path);
            }

            $venueStatement = $pdo->prepare('SELECT venue_id FROM venues WHERE venue_id = :venue_id');
            $venueStatement->execute(['venue_id' => $venueId]);

            if (!$venueStatement->fetch()) {
                respond(404, [
                    'success' => false,
                    'message' => 'Venue not found.'
                ], $path);
            }

            $pdo->beginTransaction();
            $currentStatement = $pdo->prepare(
                'SELECT total_tickets, available_tickets FROM events WHERE event_id = :event_id FOR UPDATE'
            );
            $currentStatement->execute(['event_id' => $eventId]);
            $currentEvent = $currentStatement->fetch();

            if (!$currentEvent) {
                $pdo->rollBack();
                respond(404, [
                    'success' => false,
                    'message' => 'Event not found.'
                ], $path);
            }

            $soldTickets = (int) $currentEvent['total_tickets'] - (int) $currentEvent['available_tickets'];

            if ($totalTickets < $soldTickets) {
                $pdo->rollBack();
                respond(422, [
                    'success' => false,
                    'message' => 'Total tickets cannot be lower than tickets already booked.'
                ], $path);
            }

            $availableTickets = $totalTickets - $soldTickets;
            $updateStatement = $pdo->prepare(
                'UPDATE events
                 SET venue_id = :venue_id,
                     event_name = :event_name,
                     description = :description,
                     event_date = :event_date,
                     event_time = :event_time,
                     total_tickets = :total_tickets,
                     available_tickets = :available_tickets,
                     status = :status
                 WHERE event_id = :event_id'
            );

            $updateStatement->execute([
                'venue_id' => $venueId,
                'event_name' => $eventName,
                'description' => $description,
                'event_date' => $eventDate,
                'event_time' => $eventTime,
                'total_tickets' => $totalTickets,
                'available_tickets' => $availableTickets,
                'status' => $status,
                'event_id' => $eventId
            ]);

            $pdo->commit();

            respond(200, [
                'success' => true,
                'message' => 'Event updated successfully.',
                'data' => [
                    'event_id' => $eventId,
                    'venue_id' => (int) $venueId,
                    'event_name' => $eventName,
                    'description' => $description,
                    'event_date' => $eventDate,
                    'event_time' => $eventTime,
                    'total_tickets' => (int) $totalTickets,
                    'available_tickets' => (int) $availableTickets,
                    'status' => $status
                ]
            ], $path);
        }

        $bookingCountStatement = $pdo->prepare(
            'SELECT COUNT(*) FROM bookings WHERE event_id = :event_id'
        );
        $bookingCountStatement->execute(['event_id' => $eventId]);

        if ((int) $bookingCountStatement->fetchColumn() > 0) {
            respond(409, [
                'success' => false,
                'message' => 'This event cannot be deleted because bookings are associated with it.'
            ], $path);
        }

        $deleteStatement = $pdo->prepare('DELETE FROM events WHERE event_id = :event_id');
        $deleteStatement->execute(['event_id' => $eventId]);

        if ($deleteStatement->rowCount() === 0) {
            respond(404, [
                'success' => false,
                'message' => 'Event not found.'
            ], $path);
        }

        respond(200, [
            'success' => true,
            'message' => 'Event deleted successfully.',
            'data' => ['event_id' => $eventId]
        ], $path);
    }

    if (preg_match('#^events/([1-9][0-9]*)$#', $path, $matches)) {
        if ($method !== 'GET') {
            respond(405, [
                'success' => false,
                'message' => 'This HTTP method is not available for this endpoint yet.'
            ], $path);
        }

        $eventId = (int) $matches[1];

        $statement = $pdo->prepare(
            'SELECT
                e.event_id,
                e.event_name,
                e.description,
                e.event_date,
                e.event_time,
                e.total_tickets,
                e.available_tickets,
                e.status,
                v.venue_id,
                v.venue_name,
                v.address AS venue_address
             FROM events e
             INNER JOIN venues v
                ON e.venue_id = v.venue_id
             WHERE e.event_id = :event_id'
        );

        $statement->execute([
            'event_id' => $eventId
        ]);

        $event = $statement->fetch();

        if (!$event) {
            respond(404, [
                'success' => false,
                'message' => 'Event not found.'
            ], $path);
        }

        respond(200, [
            'success' => true,
            'data' => $event
        ], $path);
    }

    if ($path === 'events') {
        respond(405, [
            'success' => false,
            'message' => 'This HTTP method is not available for this endpoint yet.'
        ], $path);
    }
