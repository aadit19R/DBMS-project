-- E-Commerce DBMS Sample Data
USE ecommerce_db;

-- -----------------------------------------------------
-- Suppliers
-- -----------------------------------------------------
INSERT INTO suppliers (name, email, phone, address) VALUES
('TechSource Inc.',   'contact@techsource.com',  '555-1001', '12 Silicon Ave, San Jose, CA'),
('FashionHub Ltd.',   'info@fashionhub.com',     '555-1002', '88 Textile Lane, New York, NY'),
('HomeGoods Co.',     'supply@homegoods.com',    '555-1003', '34 Oak Street, Chicago, IL');

-- -----------------------------------------------------
-- Products (no stock_quantity — inventory managed in warehouse_inventory)
-- -----------------------------------------------------
INSERT INTO products (name, price, category, supplier_id) VALUES
('Wireless Headphones',  79.99,  'Electronics', 1),
('USB-C Hub',            34.99,  'Electronics', 1),
('Running Shoes',        59.99,  'Footwear',    2),
('Denim Jacket',         89.99,  'Apparel',     2),
('Coffee Maker',         49.99,  'Appliances',  3),
('Desk Lamp',            24.99,  'Furniture',   3);

-- -----------------------------------------------------
-- Customers
-- -----------------------------------------------------
INSERT INTO customers (name, email, phone, address) VALUES
('Alice Johnson', 'alice@example.com', '555-2001', '10 Maple St, Austin, TX'),
('Bob Smith',     'bob@example.com',   '555-2002', '22 Pine Rd, Seattle, WA'),
('Carol White',   'carol@example.com', '555-2003', '5 Cedar Blvd, Denver, CO');

-- -----------------------------------------------------
-- Orders
-- -----------------------------------------------------
INSERT INTO orders (customer_id, order_date, status, total_amount) VALUES
(1, '2026-03-10', 'delivered', 114.98),
(2, '2026-03-15', 'shipped',    59.99),
(3, '2026-04-01', 'pending',   114.98),
(1, '2026-04-05', 'pending',    24.99);

-- -----------------------------------------------------
-- Order Items
-- -----------------------------------------------------
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
(1, 1, 1, 79.99),   -- Alice: Wireless Headphones
(1, 2, 1, 34.99),   -- Alice: USB-C Hub
(2, 3, 1, 59.99),   -- Bob: Running Shoes
(3, 4, 1, 89.99),   -- Carol: Denim Jacket
(3, 5, 1, 24.99),   -- Carol: Coffee Maker  -- corrected total below
(4, 6, 1, 24.99);   -- Alice: Desk Lamp

-- -----------------------------------------------------
-- Warehouses
-- -----------------------------------------------------
INSERT INTO warehouses (name, location, capacity) VALUES
('West Coast Hub',   'Los Angeles, CA', 10000),
('Central Depot',    'Dallas, TX',       8000),
('East Coast Hub',   'Newark, NJ',      12000);

-- -----------------------------------------------------
-- Warehouse Inventory
-- -----------------------------------------------------
INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity_stored) VALUES
(1, 1, 200),  -- West Coast: Wireless Headphones
(1, 2, 350),  -- West Coast: USB-C Hub
(2, 3, 180),  -- Central: Running Shoes
(2, 4, 120),  -- Central: Denim Jacket
(3, 5, 300),  -- East Coast: Coffee Maker
(3, 6, 250),  -- East Coast: Desk Lamp
(1, 5,  80),  -- West Coast: Coffee Maker (also stocked here)
(2, 1, 100);  -- Central: Wireless Headphones (also stocked here)

-- -----------------------------------------------------
-- Users
-- -----------------------------------------------------
-- password for all users is "password"
INSERT INTO users (username, email, password_hash, role, customer_id) VALUES
('admin', 'admin@example.com', 'scrypt:32768:8:1$DKPyZxIaf7Dqt9Se$57e604faeba8a0488917d9b4687c9e2200a1b5fe54320144375d8dd5439a2102edbb4a10b8c39a6c439de095f81572871655b31eccf5a0755eae934681fc5586', 'admin', NULL),
('user1', 'user1@example.com', 'scrypt:32768:8:1$DKPyZxIaf7Dqt9Se$57e604faeba8a0488917d9b4687c9e2200a1b5fe54320144375d8dd5439a2102edbb4a10b8c39a6c439de095f81572871655b31eccf5a0755eae934681fc5586', 'user', 1);
