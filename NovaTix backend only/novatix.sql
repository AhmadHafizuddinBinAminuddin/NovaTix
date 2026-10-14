CREATE DATABASE IF NOT EXISTS novatix_db;
USE novatix_db;

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Customer', 'Staff', 'Administrator') NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE venues (
    venue_id INT AUTO_INCREMENT PRIMARY KEY,
    venue_name VARCHAR(150) NOT NULL,
    address VARCHAR(255) NOT NULL,
    capacity INT NOT NULL,
    description TEXT,
    CHECK (capacity > 0)
);

CREATE TABLE events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    venue_id INT NOT NULL,
    event_name VARCHAR(150) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    total_tickets INT NOT NULL,
    available_tickets INT NOT NULL,
    status ENUM('Upcoming', 'Ongoing', 'Completed', 'Cancelled')
        DEFAULT 'Upcoming',
    FOREIGN KEY (venue_id)
        REFERENCES venues(venue_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CHECK (total_tickets >= 0),
    CHECK (available_tickets >= 0),
    CHECK (available_tickets <= total_tickets)
);

CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    event_id INT NOT NULL,
    ticket_quantity INT NOT NULL,
    booking_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    booking_status ENUM('Pending', 'Confirmed', 'Cancelled')
        DEFAULT 'Pending',
    qr_code VARCHAR(500) DEFAULT NULL,
    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    FOREIGN KEY (event_id)
        REFERENCES events(event_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CHECK (ticket_quantity > 0)
);

USE novatix_db;

INSERT INTO users
(full_name, email, password_hash, role)
VALUES
('Amir Hakim', 'amir@example.com',
 '$2y$10$.wmY/8Lwd45Ps7XxwNPgw.31ZQjVSbUPn4YCuP6moVHKFlm5CfMZG',
 'Customer'),
('Aina Sofea', 'aina@example.com',
 '$2y$10$.wmY/8Lwd45Ps7XxwNPgw.31ZQjVSbUPn4YCuP6moVHKFlm5CfMZG',
 'Customer'),
('Daniel Lee', 'daniel@example.com',
 '$2y$10$.wmY/8Lwd45Ps7XxwNPgw.31ZQjVSbUPn4YCuP6moVHKFlm5CfMZG',
 'Staff'),
('Nur Iman', 'iman@example.com',
 '$2y$10$.wmY/8Lwd45Ps7XxwNPgw.31ZQjVSbUPn4YCuP6moVHKFlm5CfMZG',
 'Administrator'),
('Siti Hana', 'hana@example.com',
 '$2y$10$.wmY/8Lwd45Ps7XxwNPgw.31ZQjVSbUPn4YCuP6moVHKFlm5CfMZG',
 'Customer');

INSERT INTO venues
(venue_name, address, capacity, description)
VALUES
('Nova Hall', 'Kuala Lumpur', 500, 'Indoor event hall'),
('City Convention Centre', 'Shah Alam, Selangor', 1000,
 'Convention and exhibition venue'),
('Harmony Auditorium', 'Petaling Jaya, Selangor', 300,
 'Auditorium for public events'),
('Creative Space', 'Klang, Selangor', 200,
 'Venue for workshops and creative events'),
('Grand Event Gallery', 'Putrajaya', 400,
 'Multi-purpose event venue');

INSERT INTO events
(venue_id, event_name, description, event_date, event_time,
 total_tickets, available_tickets, status)
VALUES
(1, 'Technology Expo 2026', 'Technology exhibition',
 '2026-11-15', '10:00:00', 100, 98, 'Upcoming'),
(2, 'Digital Innovation Forum', 'Digital technology forum',
 '2026-11-20', '09:00:00', 50, 49, 'Upcoming'),
(3, 'Cybersecurity Conference', 'Cybersecurity awareness event',
 '2026-12-05', '10:30:00', 80, 75, 'Upcoming'),
(4, 'Creative Business Workshop', 'Business and creative workshop',
 '2026-12-12', '14:00:00', 100, 97, 'Upcoming'),
(5, 'New Year Music Festival', 'Live music event',
 '2027-01-10', '18:00:00', 40, 39, 'Upcoming');

INSERT INTO bookings
(user_id, event_id, ticket_quantity, booking_date,
 booking_status, qr_code)
VALUES
(1, 1, 2, '2026-10-10 10:00:00', 'Confirmed', NULL),
(2, 2, 1, '2026-10-10 10:30:00', 'Confirmed', NULL),
(1, 3, 5, '2026-10-10 11:00:00', 'Confirmed', NULL),
(5, 4, 3, '2026-10-10 11:30:00', 'Confirmed', NULL),
(5, 5, 1, '2026-10-10 12:00:00', 'Confirmed', NULL);