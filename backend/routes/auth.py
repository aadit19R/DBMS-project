from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import check_password_hash, generate_password_hash
from flask_jwt_extended import create_access_token
from itsdangerous import URLSafeTimedSerializer
from extensions import get_connection, query_db
import mysql.connector

auth_bp = Blueprint('auth', __name__)

@auth_bp.route("/login", methods=["POST"])
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
    
    additional_claims = {
        "role": user["role"],
        "customer_id": user["customer_id"]
    }
    
    access_token = create_access_token(identity=str(user["user_id"]), additional_claims=additional_claims)
    
    return jsonify({
        "access_token": access_token,
        "role": user["role"],
        "customer_id": user["customer_id"]
    }), 200

@auth_bp.route("/register", methods=["POST"])
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
        cursor.execute("SELECT user_id FROM users WHERE username = %s OR email = %s", (username, email))
        if cursor.fetchone():
            return jsonify({"error": "Username or email already exists"}), 400

        cursor.execute("INSERT INTO customers (name, email) VALUES (%s, %s)", (name, email))
        customer_id = cursor.lastrowid
        
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

@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()
    email = data.get("email")
    if not email:
        return jsonify({"error": "Missing email"}), 400
    
    users = query_db("SELECT user_id FROM users WHERE email = %s", (email,))
    if not users:
        return jsonify({"message": "If the email exists, a reset link has been sent."}), 200
        
    serializer = URLSafeTimedSerializer(current_app.config["JWT_SECRET_KEY"])
    token = serializer.dumps(email, salt='password-reset')
    reset_link = f"http://localhost:8000/?reset_token={token}"
    print(f"Password Reset Link: {reset_link}")
    
    return jsonify({"message": "If the email exists, a reset link has been sent."}), 200

@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    token = data.get("token")
    new_password = data.get("new_password")
    
    if not token or not new_password:
        return jsonify({"error": "Missing token or new password"}), 400
        
    serializer = URLSafeTimedSerializer(current_app.config["JWT_SECRET_KEY"])
    try:
        email = serializer.loads(token, salt='password-reset', max_age=3600)
    except Exception:
        return jsonify({"error": "Invalid or expired token"}), 400
        
    password_hash = generate_password_hash(new_password)
    query_db("UPDATE users SET password_hash = %s WHERE email = %s", (password_hash, email))
    
    return jsonify({"message": "Password updated successfully"}), 200
