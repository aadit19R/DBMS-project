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
            s.name AS supplier
        FROM products p
        JOIN suppliers s ON p.supplier_id = s.supplier_id
        ORDER BY p.product_id
    """
    return jsonify(query_db(sql))
