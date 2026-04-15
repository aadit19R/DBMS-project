from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
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
        SELECT DATE_FORMAT(order_date, '%Y-%m') AS time_period, SUM(total_amount) AS revenue, AVG(total_amount) AS aov
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

@analytics_bp.route("/admin/analytics/kpis")
@jwt_required()
def analytics_kpis():
    claims = get_jwt()
    if claims.get("role") != "admin": return jsonify({"error": "Admin access required"}), 403

    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    
    current_sql = "SELECT AVG(total_amount) as aov, COUNT(*) as orders FROM orders WHERE status != 'cancelled'"
    
    if not (start_date and end_date):
        res = query_db(current_sql)[0]
        return jsonify({
            "current_aov": float(res['aov'] or 0),
            "current_orders": res['orders'] or 0,
            "has_trend": False
        })
        
    current_sql += " AND order_date BETWEEN %s AND %s"
    res_curr = query_db(current_sql, (start_date, end_date + " 23:59:59"))[0]
    
    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_dt = datetime.strptime(end_date, "%Y-%m-%d")
    delta_days = (end_dt - start_dt).days + 1
    
    prev_end = start_dt - timedelta(days=1)
    prev_start = prev_end - timedelta(days=delta_days - 1)
    
    prev_start_str = prev_start.strftime("%Y-%m-%d")
    prev_end_str = prev_end.strftime("%Y-%m-%d")
    
    # Needs a new query without the date filter appended previously
    base_sql = "SELECT AVG(total_amount) as aov, COUNT(*) as orders FROM orders WHERE status != 'cancelled' AND order_date BETWEEN %s AND %s"
    res_prev = query_db(base_sql, (prev_start_str, prev_end_str + " 23:59:59"))[0]
    
    curr_aov = float(res_curr['aov'] or 0)
    prev_aov = float(res_prev['aov'] or 0)
    curr_orders = res_curr['orders'] or 0
    prev_orders = res_prev['orders'] or 0
    
    aov_trend = 0
    if prev_aov > 0: aov_trend = ((curr_aov - prev_aov) / prev_aov) * 100
        
    orders_trend = 0
    if prev_orders > 0: orders_trend = ((curr_orders - prev_orders) / prev_orders) * 100
    
    return jsonify({
        "current_aov": curr_aov,
        "current_orders": curr_orders,
        "has_trend": True,
        "aov_trend_percent": aov_trend,
        "orders_trend_percent": orders_trend
    })

@analytics_bp.route("/admin/analytics/inventory-velocity")
@jwt_required()
def analytics_velocity():
    claims = get_jwt()
    if claims.get("role") != "admin": return jsonify({"error": "Admin access required"}), 403

    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    sql = """
        SELECT p.name, 
               CAST(SUM(oi.quantity) AS CHAR) as sold, 
               CAST(MAX(wi.quantity_stored) AS CHAR) as stock,
               (SUM(oi.quantity) / MAX(wi.quantity_stored)) as velocity
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        JOIN products p ON oi.product_id = p.product_id
        LEFT JOIN warehouse_inventory wi ON p.product_id = wi.product_id
        WHERE o.status != 'cancelled'
    """
    params = []
    if start_date and end_date:
        sql += " AND o.order_date BETWEEN %s AND %s"
        params.extend([start_date, end_date + " 23:59:59"])

    sql += " GROUP BY p.product_id, p.name HAVING MAX(wi.quantity_stored) > 0 ORDER BY velocity DESC LIMIT 5"
    
    results = query_db(sql, tuple(params))
    # format dicts for JSON
    res = []
    for r in results:
        res.append({
            "name": r["name"],
            "sold": float(r["sold"] or 0),
            "stock": float(r["stock"] or 0),
            "velocity": float(r["velocity"] or 0)
        })
    return jsonify(res)

@analytics_bp.route("/admin/analytics/sales-days")
@jwt_required()
def analytics_days():
    claims = get_jwt()
    if claims.get("role") != "admin": return jsonify({"error": "Admin access required"}), 403

    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    sql = """
        SELECT DAYNAME(order_date) as day_name, COUNT(*) as order_count
        FROM orders
        WHERE status != 'cancelled'
    """
    params = []
    if start_date and end_date:
        sql += " AND order_date BETWEEN %s AND %s"
        params.extend([start_date, end_date + " 23:59:59"])

    sql += " GROUP BY day_name ORDER BY FIELD(day_name, 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')"
    
    results = query_db(sql, tuple(params))
    return jsonify(results)
