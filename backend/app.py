from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
import re
from werkzeug.security import check_password_hash, generate_password_hash
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt, get_jwt_identity
from itsdangerous import URLSafeTimedSerializer

app = Flask(__name__)
CORS(app)

# JWT Setup
app.config["JWT_SECRET_KEY"] = "super-secret-key"  # Change this in production
jwt = JWTManager(app)
serializer = URLSafeTimedSerializer(app.config["JWT_SECRET_KEY"])

# -------------------------------------------------------------------
# DB Connection
# -------------------------------------------------------------------
DB_CONFIG = {
    "host":     "localhost",
    "user":     "root",
    "password": "Hellokitty@2", 
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
# /login  — authenticate and return JWT
# -------------------------------------------------------------------
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Missing username or password"}), 400

    sql = "SELECT user_id, username, password_hash, role, customer_id FROM users WHERE username = %s"
    users = query_db(sql, (username,))

    if not users:
        return jsonify({"error": "Invalid username or password"}), 401
    
    user = users[0]
    if not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid username or password"}), 401
    
    # Create token with additional claims
    additional_claims = {
        "role": user["role"],
        "customer_id": user["customer_id"]
    }
    # Identity must be a string or number, we'll use user_id
    access_token = create_access_token(identity=str(user["user_id"]), additional_claims=additional_claims)
    
    return jsonify({
        "access_token": access_token,
        "role": user["role"],
        "customer_id": user["customer_id"]
    }), 200


# -------------------------------------------------------------------
# /register  — register new user
# -------------------------------------------------------------------
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    name = data.get("name")
    email = data.get("email")
    username = data.get("username")
    password = data.get("password")
    
    if not all([name, email, username, password]):
        return jsonify({"error": "Missing fields"}), 400

    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Check if username or email exists in users table
        cursor.execute("SELECT user_id FROM users WHERE username = %s OR email = %s", (username, email))
        if cursor.fetchone():
            return jsonify({"error": "Username or email already exists"}), 400

        # Insert customer
        cursor.execute("INSERT INTO customers (name, email) VALUES (%s, %s)", (name, email))
        customer_id = cursor.lastrowid
        
        # Insert user
        password_hash = generate_password_hash(password)
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, role, customer_id) VALUES (%s, %s, %s, 'user', %s)",
            (username, email, password_hash, customer_id)
        )
        conn.commit()
        return jsonify({"message": "Registration successful"}), 201
    except mysql.connector.Error as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 400
    finally:
        cursor.close()
        conn.close()

# -------------------------------------------------------------------
# /forgot-password  — mock sending reset token
# -------------------------------------------------------------------
@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()
    email = data.get("email")
    if not email:
        return jsonify({"error": "Missing email"}), 400
    
    users = query_db("SELECT user_id FROM users WHERE email = %s", (email,))
    if not users:
        # Don't reveal if email exists or not
        return jsonify({"message": "If the email exists, a reset link has been sent."}), 200
        
    token = serializer.dumps(email, salt='password-reset')
    reset_link = f"http://localhost:8000/?reset_token={token}"
    print(f"Password Reset Link: {reset_link}")
    
    return jsonify({"message": "If the email exists, a reset link has been sent."}), 200

# -------------------------------------------------------------------
# /reset-password  — reset password with token
# -------------------------------------------------------------------
@app.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    token = data.get("token")
    new_password = data.get("new_password")
    
    if not token or not new_password:
        return jsonify({"error": "Missing token or new password"}), 400
        
    try:
        email = serializer.loads(token, salt='password-reset', max_age=3600)
    except Exception:
        return jsonify({"error": "Invalid or expired token"}), 400
        
    password_hash = generate_password_hash(new_password)
    query_db("UPDATE users SET password_hash = %s WHERE email = %s", (password_hash, email))
    
    return jsonify({"message": "Password updated successfully"}), 200


# -------------------------------------------------------------------
# /products  — list all products with supplier name
# -------------------------------------------------------------------
@app.route("/products")
@jwt_required()
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


# -------------------------------------------------------------------
# /orders  — list all orders with customer name and item count
# -------------------------------------------------------------------
@app.route("/orders")
@jwt_required()
def get_orders():
    claims = get_jwt()
    role = claims.get("role")
    customer_id = claims.get("customer_id")

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
    """
    
    params = []
    if role == "user":
        sql += " WHERE o.customer_id = %s "
        params.append(customer_id)

    sql += """
        GROUP BY o.order_id, c.name, o.order_date, o.status, o.total_amount
        ORDER BY o.order_date DESC
    """
    return jsonify(query_db(sql, tuple(params)))



# -------------------------------------------------------------------
# /analytics  — aggregated stats for dashboard
# -------------------------------------------------------------------
@app.route("/analytics")
@jwt_required()
def get_analytics():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

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


# -------------------------------------------------------------------
# /schema-metadata  — get database structure for visualizer
# -------------------------------------------------------------------
@app.route("/schema-metadata")
@jwt_required()
def get_schema_metadata():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    # Query tables and columns
    columns_sql = """
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME, ORDINAL_POSITION
    """
    columns = query_db(columns_sql)

    # Query relationships (foreign keys)
    fks_sql = """
        SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
    """
    fks = query_db(fks_sql)

    # Group columns by table
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
