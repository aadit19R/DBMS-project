from flask import Flask
from flask_cors import CORS
from extensions import jwt, get_connection

from routes.auth import auth_bp
from routes.products import products_bp
from routes.orders import orders_bp
from routes.admin import admin_bp
from routes.analytics import analytics_bp

def create_views():
    conn = get_connection()
    cursor = conn.cursor()

    # Creates a virtual view for sales reporting, aggregating total units sold and revenue per product.
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

    # Creates a virtual view for inventory management, mapping products to their specific warehouse locations.
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

app = Flask(__name__)
CORS(app)

app.config["JWT_SECRET_KEY"] = "super-secret-key"  # Change this in production
jwt.init_app(app)

app.register_blueprint(auth_bp)
app.register_blueprint(products_bp)
app.register_blueprint(orders_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(analytics_bp)

if __name__ == "__main__":
    create_views()
    app.run(debug=True, port=5001)
