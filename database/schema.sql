-- E-Commerce DBMS Schema
-- Normalized to 3NF

CREATE DATABASE IF NOT EXISTS ecommerce_db;
USE ecommerce_db;

-- -----------------------------------------------------
-- Table: suppliers
-- -----------------------------------------------------
CREATE TABLE suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) NOT NULL UNIQUE,
    phone       VARCHAR(20),
    address     TEXT
);

-- -----------------------------------------------------
-- Table: products
-- -----------------------------------------------------
CREATE TABLE products (
    product_id  INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    price       DECIMAL(10, 2) NOT NULL,
    category    VARCHAR(50) NOT NULL,
    supplier_id INT NOT NULL,
    CONSTRAINT fk_product_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
);

-- -----------------------------------------------------
-- Table: customers
-- -----------------------------------------------------
CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) NOT NULL UNIQUE,
    phone       VARCHAR(20),
    address     TEXT
);

-- -----------------------------------------------------
-- Table: orders
-- -----------------------------------------------------
CREATE TABLE orders (
    order_id     INT AUTO_INCREMENT PRIMARY KEY,
    customer_id  INT NOT NULL,
    order_date   DATE NOT NULL,
    status       ENUM('pending', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- -----------------------------------------------------
-- Table: order_items  (M:N junction: orders <-> products)
-- -----------------------------------------------------
CREATE TABLE order_items (
    order_item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id      INT NOT NULL,
    product_id    INT NOT NULL,
    quantity      INT NOT NULL,
    unit_price    DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_oi_order   FOREIGN KEY (order_id)   REFERENCES orders(order_id),
    CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(product_id),
    CONSTRAINT uq_order_product UNIQUE (order_id, product_id)
);

-- -----------------------------------------------------
-- Table: warehouses
-- -----------------------------------------------------
CREATE TABLE warehouses (
    warehouse_id INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    location     VARCHAR(150) NOT NULL,
    capacity     INT NOT NULL
);

-- -----------------------------------------------------
-- Table: warehouse_inventory  (M:N junction: warehouses <-> products)
-- -----------------------------------------------------
CREATE TABLE warehouse_inventory (
    inventory_id      INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_id      INT NOT NULL,
    product_id        INT NOT NULL,
    quantity_stored   INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_wi_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id),
    CONSTRAINT fk_wi_product   FOREIGN KEY (product_id)   REFERENCES products(product_id),
    CONSTRAINT uq_warehouse_product UNIQUE (warehouse_id, product_id)
);
