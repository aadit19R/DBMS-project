from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from extensions import get_connection, query_db
import mysql.connector

orders_bp = Blueprint('orders', __name__)

@orders_bp.route("/orders")
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

@orders_bp.route("/admin/orders/<int:order_id>/status", methods=["PUT"])
@jwt_required()
def update_order_status(order_id):
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json()
    new_status = data.get("status")
    if not new_status or new_status not in ["pending", "shipped", "delivered", "cancelled"]:
        return jsonify({"error": "Invalid status"}), 400

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE orders SET status = %s WHERE order_id = %s", (new_status, order_id))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"error": "Order not found"}), 404
        return jsonify({"message": f"Order #{order_id} status updated to {new_status}"}), 200
    except mysql.connector.Error as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@orders_bp.route("/checkout", methods=["POST"])
@jwt_required()
def checkout():
    claims = get_jwt()
    customer_id = claims.get("customer_id")
    if not customer_id:
        return jsonify({"error": "No customer associated with this user"}), 400

    data = request.get_json()
    cart_items = data.get("cart", [])
    
    if not cart_items:
        return jsonify({"error": "Cart is empty"}), 400

    total_amount = sum(float(item["unit_price"]) * int(item["quantity"]) for item in cart_items)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO orders (customer_id, order_date, status, total_amount) VALUES (%s, NOW(), 'pending', %s)",
            (customer_id, total_amount)
        )
        order_id = cursor.lastrowid
        
        for item in cart_items:
            product_id = item["product_id"]
            quantity = int(item["quantity"])
            
            update_sql = """
                UPDATE warehouse_inventory 
                SET quantity_stored = quantity_stored - %s 
                WHERE product_id = %s AND quantity_stored >= %s LIMIT 1
            """
            cursor.execute(update_sql, (quantity, product_id, quantity))
            
            if cursor.rowcount == 0:
                product_name = item.get("name", f"ID {product_id}")
                raise ValueError(f"Insufficient stock for product: {product_name}")
            
            cursor.execute(
                "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (%s, %s, %s, %s)",
                (order_id, product_id, quantity, item["unit_price"])
            )
            
        conn.commit()
        return jsonify({"message": "Order placed successfully", "order_id": order_id}), 201
    except ValueError as ve:
        conn.rollback()
        print(f"Checkout Validation Error: {ve}")
        return jsonify({"error": str(ve)}), 400
    except mysql.connector.Error as e:
        conn.rollback()
        print(f"Checkout SQL Error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@orders_bp.route("/my-orders")
@jwt_required()
def get_my_orders():
    claims = get_jwt()
    user_id = get_jwt_identity()
    customer_id = claims.get("customer_id")
    print(f"MY-ORDERS: user_id={user_id}, customer_id={customer_id}")

    if not customer_id:
        return jsonify({"error": "No customer associated with this user"}), 400

    orders = query_db(
        "SELECT order_id, order_date, status, total_amount FROM orders WHERE customer_id = %s ORDER BY order_date DESC",
        (customer_id,)
    )
    print(f"MY-ORDERS: found {len(orders)} orders")

    for o in orders:
        if o.get("order_date") and not isinstance(o["order_date"], str):
            o["order_date"] = str(o["order_date"])

    if orders:
        order_ids = [str(o["order_id"]) for o in orders]
        format_strings = ','.join(['%s'] * len(order_ids))
        items = query_db(
            f"SELECT oi.order_id, p.name AS product_name, oi.quantity, oi.unit_price FROM order_items oi JOIN products p ON oi.product_id = p.product_id WHERE oi.order_id IN ({format_strings})",
            tuple(order_ids)
        )

        items_by_order = {}
        for item in items:
            oid = item["order_id"]
            if oid not in items_by_order:
                items_by_order[oid] = []
            items_by_order[oid].append(item)

        for o in orders:
            o["items"] = items_by_order.get(o["order_id"], [])

    return jsonify(orders)
