from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from extensions import query_db
import re
import mysql.connector

admin_bp = Blueprint('admin', __name__)

@admin_bp.route("/customers")
@jwt_required()
def get_customers():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    sql = """
        SELECT customer_id, name, email, phone, address
        FROM customers
        ORDER BY customer_id
    """
    return jsonify(query_db(sql))


@admin_bp.route("/analytics")
@jwt_required()
def get_analytics():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    summary = query_db("""
        SELECT
            COUNT(DISTINCT o.order_id)        AS total_orders,
            SUM(o.total_amount)               AS total_sales,
            COUNT(DISTINCT o.customer_id)     AS active_customers,
            COUNT(DISTINCT p.product_id)      AS total_products
        FROM orders o
        CROSS JOIN products p
    """)[0]

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

    low_stock = query_db("""
        SELECT
            p.name,
            wi.quantity_stored
        FROM warehouse_inventory wi
        JOIN products p ON wi.product_id = p.product_id
        WHERE wi.quantity_stored < 10
        ORDER BY wi.quantity_stored ASC
    """)

    pending_orders = query_db("""
        SELECT
            order_id,
            DATE_FORMAT(order_date, '%Y-%m-%d') AS order_date,
            total_amount
        FROM orders
        WHERE status = 'pending'
        ORDER BY order_date ASC
        LIMIT 5
    """)

    customer_history = query_db("""
        SELECT
            c.name,
            COUNT(o.order_id)   AS total_orders,
            SUM(o.total_amount) AS total_spent
        FROM customers c
        JOIN orders o ON c.customer_id = o.customer_id
        GROUP BY c.customer_id, c.name
        ORDER BY total_spent DESC
        LIMIT 5
    """)

    return jsonify({
        "summary":          summary,
        "top_products":     top_products,
        "low_stock":        low_stock,
        "pending_orders":   pending_orders,
        "customer_history": customer_history
    })


BLOCKED = re.compile(
    r"\b(DROP|TRUNCATE|ALTER|CREATE|RENAME)\b",
    re.IGNORECASE
)

@admin_bp.route("/run-query", methods=["POST"])
@jwt_required()
def run_query():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

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


@admin_bp.route("/schema-metadata")
@jwt_required()
def get_schema_metadata():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    columns_sql = """
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME, ORDINAL_POSITION
    """
    columns = query_db(columns_sql)

    fks_sql = """
        SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
    """
    fks = query_db(fks_sql)

    tables = {}
    for col in columns:
        t_name = col["TABLE_NAME"]
        if t_name not in tables:
            tables[t_name] = {"columns": []}
        tables[t_name]["columns"].append({
            "name": col["COLUMN_NAME"],
            "type": col["DATA_TYPE"],
            "key": col["COLUMN_KEY"]
        })

    return jsonify({
        "tables": tables,
        "relationships": fks
    })
