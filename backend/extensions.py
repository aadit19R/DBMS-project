import os
import mysql.connector
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

load_dotenv()

jwt = JWTManager()

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "user":     os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "ecommerce_db")
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
