import mysql.connector
from flask_jwt_extended import JWTManager

jwt = JWTManager()

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
