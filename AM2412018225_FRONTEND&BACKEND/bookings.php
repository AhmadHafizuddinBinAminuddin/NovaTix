<?php

    if ($path === 'bookings' && $method === 'GET') {
        $payload = authenticateJwtRequest(
            $path,
            ['Customer', 'Staff', 'Administrator']
        );

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
        $isCustomer = $payload['role'] === 'Customer';

        if ($isCustomer) {
            $countStatement = $pdo->prepare(
                'SELECT COUNT(*) FROM bookings WHERE user_id = :user_id'
            );
            $countStatement->execute([
                'user_id' => (int) $payload['sub']
            ]);
            $total = (int) $countStatement->fetchColumn();

            $query = '
                SELECT
                    b.booking_id,
                    b.user_id,
                    u.full_name,
                    b.event_id,
                    e.event_name,
                    e.event_date,
                    e.event_time,
                    v.venue_name,
                    b.ticket_quantity,
                    b.booking_date,
                    b.booking_status,
                    b.qr_code
                FROM bookings b
                INNER JOIN users u ON b.user_id = u.user_id
                INNER JOIN events e ON b.event_id = e.event_id
                INNER JOIN venues v ON e.venue_id = v.venue_id
                WHERE b.user_id = :user_id
                ORDER BY b.booking_date DESC
                LIMIT :limit OFFSET :offset
            ';

            $statement = $pdo->prepare($query);
            $statement->bindValue(':user_id', (int) $payload['sub'], PDO::PARAM_INT);
        } else {
            $total = (int) $pdo->query(
                'SELECT COUNT(*) FROM bookings'
            )->fetchColumn();

            $query = '
                SELECT
                    b.booking_id,
                    b.user_id,
                    u.full_name,
                    b.event_id,
                    e.event_name,
                    e.event_date,
                    e.event_time,
                    v.venue_name,
                    b.ticket_quantity,
                    b.booking_date,
                    b.booking_status,
                    b.qr_code
                FROM bookings b
                INNER JOIN users u ON b.user_id = u.user_id
                INNER JOIN events e ON b.event_id = e.event_id
                INNER JOIN venues v ON e.venue_id = v.venue_id
                ORDER BY b.booking_date DESC
                LIMIT :limit OFFSET :offset
            ';

            $statement = $pdo->prepare($query);
        }

        $statement->bindValue(':limit', (int) $limit, PDO::PARAM_INT);
        $statement->bindValue(':offset', (int) $offset, PDO::PARAM_INT);
        $statement->execute();

        respond(200, [
            'success' => true,
            'message' => $isCustomer
                ? 'Your bookings retrieved successfully.'
                : 'Booking list retrieved successfully.',
            'data' => $statement->fetchAll(),
            'pagination' => [
                'current_page' => (int) $page,
                'per_page' => (int) $limit,
                'total_records' => $total,
                'total_pages' => (int) ceil($total / $limit)
            ]
        ], $path);
    }

    if ($path === 'bookings' && $method === 'POST') {
        $payload = authenticateJwtRequest($path, ['Customer']);
        $input = json_decode(file_get_contents('php://input'), true);

        if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {
            respond(400, [
                'success' => false,
                'message' => 'Invalid JSON request body.'
            ], $path);
        }

        if (!isset($input['event_id'], $input['ticket_quantity'])) {
            respond(422, [
                'success' => false,
                'message' => 'Event ID and ticket quantity are required.'
            ], $path);
        }

        $eventId = filter_var($input['event_id'], FILTER_VALIDATE_INT);
        $ticketQuantity = filter_var($input['ticket_quantity'], FILTER_VALIDATE_INT);

        if (
            $eventId === false || $eventId === null || $eventId < 1 ||
            $ticketQuantity === false || $ticketQuantity === null || $ticketQuantity < 1
        ) {
            respond(422, [
                'success' => false,
                'message' => 'Event ID and ticket quantity must be positive whole numbers.'
            ], $path);
        }

        $pdo->beginTransaction();

        $eventStatement = $pdo->prepare(
            'SELECT event_id, event_name, status, available_tickets
             FROM events
             WHERE event_id = :event_id
             FOR UPDATE'
        );
        $eventStatement->execute(['event_id' => $eventId]);
        $event = $eventStatement->fetch();

        if (!$event) {
            $pdo->rollBack();
            respond(404, [
                'success' => false,
                'message' => 'Event not found.'
            ], $path);
        }

        if ($event['status'] !== 'Upcoming') {
            $pdo->rollBack();
            respond(409, [
                'success' => false,
                'message' => 'Bookings are available only for upcoming events.'
            ], $path);
        }

        if ((int) $event['available_tickets'] < $ticketQuantity) {
            $pdo->rollBack();
            respond(409, [
                'success' => false,
                'message' => 'There are not enough tickets available.'
            ], $path);
        }

        $updateStatement = $pdo->prepare(
            'UPDATE events
             SET available_tickets = available_tickets - :quantity
             WHERE event_id = :event_id'
        );
        $updateStatement->execute([
            'quantity' => $ticketQuantity,
            'event_id' => $eventId
        ]);

        $insertStatement = $pdo->prepare(
            "INSERT INTO bookings
                (user_id, event_id, ticket_quantity, booking_status, qr_code)
             VALUES
                (:user_id, :event_id, :ticket_quantity, 'Confirmed', NULL)"
        );
        $insertStatement->execute([
            'user_id' => (int) $payload['sub'],
            'event_id' => $eventId,
            'ticket_quantity' => $ticketQuantity
        ]);

        $bookingId = (int) $pdo->lastInsertId();
        $pdo->commit();

        $qrCodeUrl = generateQrCodeUrl('NovaTix Booking #' . $bookingId);

        if ($qrCodeUrl !== null) {
            $qrUpdateStatement = $pdo->prepare(
                'UPDATE bookings SET qr_code = :qr_code WHERE booking_id = :booking_id'
            );
            $qrUpdateStatement->execute([
                'qr_code' => $qrCodeUrl,
                'booking_id' => $bookingId
            ]);
        }

        respond(201, [
            'success' => true,
            'message' => 'Booking created successfully.',
            'data' => [
                'booking_id' => $bookingId,
                'user_id' => (int) $payload['sub'],
                'event_id' => (int) $eventId,
                'event_name' => $event['event_name'],
                'ticket_quantity' => (int) $ticketQuantity,
                'booking_status' => 'Confirmed',
                'qr_code_url' => $qrCodeUrl,
                'qr_code_status' => $qrCodeUrl !== null ? 'generated' : 'unavailable'
            ]
        ], $path);
    }

    if (preg_match('#^bookings/([1-9][0-9]*)$#', $path, $matches)) {
        $bookingId = (int) $matches[1];

        if ($method === 'GET') {
            $payload = authenticateJwtRequest(
                $path,
                ['Customer', 'Staff', 'Administrator']
            );

            $statement = $pdo->prepare(
                'SELECT
                    b.booking_id,
                    b.user_id,
                    u.full_name,
                    b.event_id,
                    e.event_name,
                    e.description AS event_description,
                    e.event_date,
                    e.event_time,
                    v.venue_id,
                    v.venue_name,
                    v.address AS venue_address,
                    b.ticket_quantity,
                    b.booking_date,
                    b.booking_status,
                    b.qr_code AS qr_code_url
                 FROM bookings b
                 INNER JOIN users u ON u.user_id = b.user_id
                 INNER JOIN events e ON e.event_id = b.event_id
                 INNER JOIN venues v ON v.venue_id = e.venue_id
                 WHERE b.booking_id = :booking_id'
            );
            $statement->execute(['booking_id' => $bookingId]);
            $booking = $statement->fetch();

            if (!$booking) {
                respond(404, [
                    'success' => false,
                    'message' => 'Booking not found.'
                ], $path);
            }

            if (
                $payload['role'] === 'Customer' &&
                (int) $booking['user_id'] !== (int) $payload['sub']
            ) {
                respond(403, [
                    'success' => false,
                    'message' => 'You do not have permission to view this booking.'
                ], $path);
            }

            respond(200, [
                'success' => true,
                'message' => 'Booking details retrieved successfully.',
                'data' => $booking
            ], $path);
        }

        if ($method === 'PATCH') {
            $payload = authenticateJwtRequest(
                $path,
                ['Customer', 'Staff', 'Administrator']
            );

            $input = json_decode(file_get_contents('php://input'), true);

            if (!is_array($input) || json_last_error() !== JSON_ERROR_NONE) {
                respond(400, [
                    'success' => false,
                    'message' => 'Invalid JSON request body.'
                ], $path);
            }

            if (
                array_keys($input) !== ['ticket_quantity'] ||
                !array_key_exists('ticket_quantity', $input)
            ) {
                respond(422, [
                    'success' => false,
                    'message' => 'Only ticket_quantity can be updated through this endpoint.'
                ], $path);
            }

            $newQuantity = filter_var(
                $input['ticket_quantity'],
                FILTER_VALIDATE_INT
            );

            if ($newQuantity === false || $newQuantity === null || $newQuantity < 1) {
                respond(422, [
                    'success' => false,
                    'message' => 'Ticket quantity must be a positive whole number.'
                ], $path);
            }

            $pdo->beginTransaction();

            $statement = $pdo->prepare(
                'SELECT
                    b.booking_id,
                    b.user_id,
                    b.event_id,
                    b.ticket_quantity,
                    b.booking_status,
                    e.status AS event_status,
                    e.available_tickets,
                    e.total_tickets
                 FROM bookings b
                 INNER JOIN events e ON e.event_id = b.event_id
                 WHERE b.booking_id = :booking_id
                 FOR UPDATE'
            );
            $statement->execute(['booking_id' => $bookingId]);
            $booking = $statement->fetch();

            if (!$booking) {
                $pdo->rollBack();
                respond(404, [
                    'success' => false,
                    'message' => 'Booking not found.'
                ], $path);
            }

            if (
                $payload['role'] === 'Customer' &&
                (int) $booking['user_id'] !== (int) $payload['sub']
            ) {
                $pdo->rollBack();
                respond(403, [
                    'success' => false,
                    'message' => 'You do not have permission to update this booking.'
                ], $path);
            }

            if ($booking['booking_status'] !== 'Confirmed') {
                $pdo->rollBack();
                respond(409, [
                    'success' => false,
                    'message' => 'Only confirmed bookings can be updated.'
                ], $path);
            }

            if ($booking['event_status'] !== 'Upcoming') {
                $pdo->rollBack();
                respond(409, [
                    'success' => false,
                    'message' => 'Only bookings for upcoming events can be updated.'
                ], $path);
            }

            $currentQuantity = (int) $booking['ticket_quantity'];
            $availableTickets = (int) $booking['available_tickets'];
            $totalTickets = (int) $booking['total_tickets'];
            $quantityDifference = (int) $newQuantity - $currentQuantity;

            if ($quantityDifference > 0 && $availableTickets < $quantityDifference) {
                $pdo->rollBack();
                respond(409, [
                    'success' => false,
                    'message' => 'There are not enough tickets available to increase this booking.'
                ], $path);
            }

            if ($quantityDifference > 0) {
                $ticketStatement = $pdo->prepare(
                    'UPDATE events
                     SET available_tickets = available_tickets - :quantity
                     WHERE event_id = :event_id'
                );
                $ticketStatement->execute([
                    'quantity' => $quantityDifference,
                    'event_id' => (int) $booking['event_id']
                ]);
            } elseif ($quantityDifference < 0) {
                $ticketStatement = $pdo->prepare(
                    'UPDATE events
                     SET available_tickets = LEAST(
                         total_tickets,
                         available_tickets + :quantity
                     )
                     WHERE event_id = :event_id'
                );
                $ticketStatement->execute([
                    'quantity' => abs($quantityDifference),
                    'event_id' => (int) $booking['event_id']
                ]);
            }

            $updateStatement = $pdo->prepare(
                'UPDATE bookings
                 SET ticket_quantity = :ticket_quantity
                 WHERE booking_id = :booking_id'
            );
            $updateStatement->execute([
                'ticket_quantity' => (int) $newQuantity,
                'booking_id' => $bookingId
            ]);

            $pdo->commit();

            respond(200, [
                'success' => true,
                'message' => 'Booking updated successfully.',
                'data' => [
                    'booking_id' => $bookingId,
                    'user_id' => (int) $booking['user_id'],
                    'event_id' => (int) $booking['event_id'],
                    'previous_ticket_quantity' => $currentQuantity,
                    'ticket_quantity' => (int) $newQuantity,
                    'booking_status' => $booking['booking_status'],
                    'ticket_inventory_adjusted' => $quantityDifference !== 0
                ]
            ], $path);
        }

        if ($method !== 'DELETE') {
            respond(405, [
                'success' => false,
                'message' => 'This HTTP method is not available for this endpoint yet.'
            ], $path);
        }

        $payload = authenticateJwtRequest(
            $path,
            ['Customer', 'Staff', 'Administrator']
        );

        $pdo->beginTransaction();

        $statement = $pdo->prepare(
            'SELECT b.booking_id, b.user_id, b.event_id, b.ticket_quantity,
                    b.booking_status, e.status AS event_status
             FROM bookings b
             INNER JOIN events e ON e.event_id = b.event_id
             WHERE b.booking_id = :booking_id
             FOR UPDATE'
        );
        $statement->execute(['booking_id' => $bookingId]);
        $booking = $statement->fetch();

        if (!$booking) {
            $pdo->rollBack();
            respond(404, [
                'success' => false,
                'message' => 'Booking not found.'
            ], $path);
        }

        if (
            $payload['role'] === 'Customer' &&
            (int) $booking['user_id'] !== (int) $payload['sub']
        ) {
            $pdo->rollBack();
            respond(403, [
                'success' => false,
                'message' => 'You do not have permission to cancel this booking.'
            ], $path);
        }

        if ($booking['booking_status'] === 'Cancelled') {
            $pdo->rollBack();
            respond(409, [
                'success' => false,
                'message' => 'This booking has already been cancelled.'
            ], $path);
        }

        if ($booking['booking_status'] !== 'Confirmed') {
            $pdo->rollBack();
            respond(409, [
                'success' => false,
                'message' => 'Only confirmed bookings can be cancelled.'
            ], $path);
        }

        if ($booking['event_status'] !== 'Upcoming') {
            $pdo->rollBack();
            respond(409, [
                'success' => false,
                'message' => 'Only bookings for upcoming events can be cancelled.'
            ], $path);
        }

        $updateBooking = $pdo->prepare(
            "UPDATE bookings
             SET booking_status = 'Cancelled'
             WHERE booking_id = :booking_id"
        );
        $updateBooking->execute(['booking_id' => $bookingId]);

        $restoreTickets = $pdo->prepare(
            'UPDATE events
             SET available_tickets = LEAST(total_tickets, available_tickets + :quantity)
             WHERE event_id = :event_id'
        );
        $restoreTickets->execute([
            'quantity' => (int) $booking['ticket_quantity'],
            'event_id' => (int) $booking['event_id']
        ]);

        $pdo->commit();

        respond(200, [
            'success' => true,
            'message' => 'Booking cancelled successfully.',
            'data' => [
                'booking_id' => $bookingId,
                'booking_status' => 'Cancelled',
                'tickets_restored' => (int) $booking['ticket_quantity']
            ]
        ], $path);
    }

    if ($path === 'bookings') {
        respond(405, [
            'success' => false,
            'message' => 'This HTTP method is not available for this endpoint yet.'
        ], $path);
    }
