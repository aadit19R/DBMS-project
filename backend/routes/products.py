from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from extensions import query_db

products_bp = Blueprint('products', __name__)

@products_bp.route("/products")
@jwt_required()
def get_products():
    # Fetches the master product catalog, joining with suppliers and summing inventory across all warehouses.
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
        # Checks the current existence and total quantity of stock for a specific product.
        cursor.execute(
            "SELECT COUNT(*) AS cnt, IFNULL(SUM(quantity_stored), 0) AS total FROM warehouse_inventory WHERE product_id = %s",
            (product_id,)
        )
        row = cursor.fetchone()
        row_exists = row["cnt"] > 0
        current    = row["total"] or 0

        if current + delta < 0:
            return jsonify({"error": "Stock cannot go below 0"}), 400

        new_total = int(current) + delta  # guaranteed >= 0

        if not row_exists:
            # No row exists yet: insert into warehouse 1 (default)
            # Initializes the first inventory record for a product in the primary warehouse.
            cursor.execute(
                "INSERT INTO warehouse_inventory (warehouse_id, product_id, quantity_stored) VALUES (1, %s, %s)",
                (product_id, new_total)
            )
        else:
            # Get warehouse 1's current quantity
            # Retrieves the inventory level of the first assigned warehouse for modification.
            cursor.execute(
                "SELECT warehouse_id, quantity_stored FROM warehouse_inventory WHERE product_id = %s ORDER BY warehouse_id LIMIT 1",
                (product_id,)
            )
            first_wh   = cursor.fetchone()
            new_w1_qty = int(first_wh["quantity_stored"]) + delta

            if new_w1_qty < 0:
                # Warehouse 1 alone can't absorb the full subtraction.
                # Zero out all warehouses, then set warehouse 1 to the target total.
                # Zeroes out all warehouses before reapplying a large negative adjustment to a single location.
                cursor.execute(
                    "UPDATE warehouse_inventory SET quantity_stored = 0 WHERE product_id = %s",
                    (product_id,)
                )
                # Sets the primary warehouse quantity to the new calculated total.
                cursor.execute(
                    "UPDATE warehouse_inventory SET quantity_stored = %s WHERE product_id = %s ORDER BY warehouse_id LIMIT 1",
                    (new_total, product_id)
                )
            else:
                # Warehouse 1 can absorb the full delta, update only it.
                # Updates the primary warehouse quantity with the calculated delta.
                cursor.execute(
                    "UPDATE warehouse_inventory SET quantity_stored = %s WHERE product_id = %s ORDER BY warehouse_id LIMIT 1",
                    (new_w1_qty, product_id)
                )
        conn.commit()
        # Final verification call to get the updated aggregate stock level after the commit.
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
