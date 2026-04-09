from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
import re

app = Flask(__name__)
CORS(app)

# -------------------------------------------------------------------
# DB Connection
# -------------------------------------------------------------------
DB_CONFIG = {
    "host":     "localhost",
    "user":     "root",
    "password": "Hellokitty@2",   # <-- update this
    "database": "ecommerce_db"
}

def get_connection():
    return mysql.connector.connect(**DB_CONFIG)


def query_db(sql, params=None):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, params or ())
    
    if cursor.description:
        rows = cursor.fetchall()
    else:
        conn.commit()
        rows = [{"affected_rows": cursor.rowcount}]
        
    cursor.close()
    conn.close()
    return rows


# -------------------------------------------------------------------
# /products  — list all products with supplier name
# -------------------------------------------------------------------
@app.route("/products")
def get_products():
    sql = """
        SELECT
            p.product_id,
            p.name,
            p.price,
            p.category,
            s.name AS supplier
        FROM products p
        JOIN suppliers s ON p.supplier_id = s.supplier_id
        ORDER BY p.product_id
    """
    return jsonify(query_db(sql))


# -------------------------------------------------------------------
# /customers  — list all customers
# -------------------------------------------------------------------
@app.route("/customers")
def get_customers():
    sql = """
        SELECT customer_id, name, email, phone, address
        FROM customers
        ORDER BY customer_id
    """
    return jsonify(query_db(sql))


# -------------------------------------------------------------------
# /orders  — list all orders with customer name and item count
# -------------------------------------------------------------------
@app.route("/orders")
def get_orders():
    sql = """
        SELECT
            o.order_id,
            c.name        AS customer,
            o.order_date,
            o.status,
            o.total_amount,
            COUNT(oi.order_item_id) AS item_count
        FROM orders o
        JOIN customers  c  ON o.customer_id  = c.customer_id
        JOIN order_items oi ON o.order_id    = oi.order_id
        GROUP BY o.order_id, c.name, o.order_date, o.status, o.total_amount
        ORDER BY o.order_date DESC
    """
    return jsonify(query_db(sql))


# -------------------------------------------------------------------
# /analytics  — aggregated stats for dashboard
# -------------------------------------------------------------------
@app.route("/analytics")
def get_analytics():
    # Summary cards
    summary = query_db("""
        SELECT
            COUNT(DISTINCT o.order_id)        AS total_orders,
            SUM(o.total_amount)               AS total_sales,
            COUNT(DISTINCT o.customer_id)     AS active_customers,
            COUNT(DISTINCT p.product_id)      AS total_products
        FROM orders o
        CROSS JOIN products p
    """)[0]

    # Top 5 selling products by quantity
    top_products = query_db("""
        SELECT
            p.name,
            SUM(oi.quantity) AS total_qty,
            SUM(oi.quantity * oi.unit_price) AS revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.product_id
        GROUP BY p.product_id, p.name
        ORDER BY total_qty DESC
        LIMIT 5
    """)

    # Sales by category
    by_category = query_db("""
        SELECT
            p.category,
            SUM(oi.quantity * oi.unit_price) AS revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.product_id
        GROUP BY p.category
        ORDER BY revenue DESC
    """)

    # Sales by month
    by_month = query_db("""
        SELECT
            DATE_FORMAT(o.order_date, '%Y-%m') AS month,
            SUM(o.total_amount)                AS revenue
        FROM orders o
        GROUP BY month
        ORDER BY month
    """)

    # Customer order history
    customer_history = query_db("""
        SELECT
            c.name,
            COUNT(o.order_id)   AS total_orders,
            SUM(o.total_amount) AS total_spent
        FROM customers c
        JOIN orders o ON c.customer_id = o.customer_id
        GROUP BY c.customer_id, c.name
        ORDER BY total_spent DESC
    """)

    return jsonify({
        "summary":          summary,
        "top_products":     top_products,
        "by_category":      by_category,
        "by_month":         by_month,
        "customer_history": customer_history
    })


# -------------------------------------------------------------------
# /run-query  — safe read-only query execution
# -------------------------------------------------------------------
BLOCKED = re.compile(
    r"\b(DROP|TRUNCATE|ALTER|CREATE|RENAME)\b",
    re.IGNORECASE
)

@app.route("/run-query", methods=["POST"])
def run_query():
    data = request.get_json()
    sql  = (data or {}).get("query", "").strip()

    if not sql:
        return jsonify({"error": "Empty query."}), 400

    if BLOCKED.search(sql):
        return jsonify({"error": "Queries that change the schema are not allowed."}), 403

    try:
        rows = query_db(sql)
        return jsonify({"columns": list(rows[0].keys()) if rows else [], "rows": rows})
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 400


# -------------------------------------------------------------------
# Views (created at startup if they don't exist)
# -------------------------------------------------------------------
def create_views():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE OR REPLACE VIEW sales_summary AS
        SELECT
            p.name                              AS product,
            p.category,
            SUM(oi.quantity)                    AS units_sold,
            SUM(oi.quantity * oi.unit_price)    AS revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.product_id
        GROUP BY p.product_id, p.name, p.category
    """)

    cursor.execute("""
        CREATE OR REPLACE VIEW inventory_view AS
        SELECT
            w.name          AS warehouse,
            w.location,
            p.name          AS product,
            p.category,
            wi.quantity_stored
        FROM warehouse_inventory wi
        JOIN warehouses w ON wi.warehouse_id = w.warehouse_id
        JOIN products   p ON wi.product_id   = p.product_id
        ORDER BY w.name, p.name
    """)

    conn.commit()
    cursor.close()
    conn.close()


if __name__ == "__main__":
    create_views()
    app.run(debug=True, port=5001)
