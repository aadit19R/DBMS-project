from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from extensions import query_db

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route("/admin/analytics/revenue")
@jwt_required()
def analytics_revenue():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    sql = """
        SELECT DATE_FORMAT(order_date, '%Y-%m') AS time_period, SUM(total_amount) AS revenue 
        FROM orders 
        WHERE status != 'cancelled'
    """
    params = []
    
    if start_date and end_date:
        sql += " AND order_date BETWEEN %s AND %s"
        # Append end of day to end_date as simple date picker sends YYYY-MM-DD
        params.extend([start_date, end_date + " 23:59:59"])
        
    sql += " GROUP BY time_period ORDER BY time_period"
    
    results = query_db(sql, tuple(params))
    return jsonify(results)

@analytics_bp.route("/admin/analytics/categories")
@jwt_required()
def analytics_categories():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403

    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    sql = """
        SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue
        FROM orders o
        JOIN order_items oi ON o.order_id = oi.order_id
        JOIN products p ON oi.product_id = p.product_id
        WHERE o.status != 'cancelled'
    """
    params = []
    
    if start_date and end_date:
        sql += " AND o.order_date BETWEEN %s AND %s"
        params.extend([start_date, end_date + " 23:59:59"])

    sql += " GROUP BY p.category ORDER BY revenue DESC"
    
    results = query_db(sql, tuple(params))
    return jsonify(results)
