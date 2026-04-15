from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from extensions import query_db

products_bp = Blueprint('products', __name__)

@products_bp.route("/products")
@jwt_required()
def get_products():
    sql = """
        SELECT
            p.product_id,
            p.name,
            p.price,
            p.category,
            s.name AS supplier,
            IFNULL(SUM(wi.quantity_stored), 0) AS total_stock
        FROM products p
        JOIN suppliers s ON p.supplier_id = s.supplier_id
        LEFT JOIN warehouse_inventory wi ON p.product_id = wi.product_id
        GROUP BY p.product_id, p.name, p.price, p.category, s.name
        ORDER BY p.product_id
    """
    return jsonify(query_db(sql))

@products_bp.route("/products/<int:product_id>/stock", methods=["PATCH"])
@jwt_required()
def adjust_stock(product_id):
    from flask import request
    from extensions import get_connection
    data = request.get_json()
    delta = data.get("delta", 0)

    if not isinstance(delta, int) or delta == 0:
        return jsonify({"error": "delta must be a non-zero integer"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Check if any warehouse_inventory row exists for this product
        cursor.execute(
            "SELECT SUM(quantity_stored) AS total FROM warehouse_inventory WHERE product_id = %s",
            (product_id,)
        )
        row = cursor.fetchone()
        current = row["total"] or 0

        if current + delta < 0:
            return jsonify({"error": "Stock cannot go below 0"}), 400

        if current == 0 and delta > 0:
            # No row exists yet: insert into warehouse 1 (default)
            cursor.execute(
                "INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity_stored) VALUES (1, %s, %s)",
                (product_id, delta)
            )
        else:
            # Spread the delta proportionally across all warehouses for this product
            cursor.execute(
                """UPDATE warehouse_inventory
                   SET quantity_stored = GREATEST(0, quantity_stored + %s)
                   WHERE product_id = %s""",
                (delta, product_id)
            )
        conn.commit()
        cursor.execute(
            "SELECT IFNULL(SUM(quantity_stored), 0) AS total_stock FROM warehouse_inventory WHERE product_id = %s",
            (product_id,)
        )
        new_stock = cursor.fetchone()["total_stock"]
        return jsonify({"product_id": product_id, "total_stock": int(new_stock)})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()
