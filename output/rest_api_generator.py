#!/usr/bin/env python3
"""
REST API Generator - Convert any CSV/JSON data into a working Flask REST API
Solves: Developers need quick mock APIs for testing without writing boilerplate
Sells for: $29.99 Gumroad / $50-150 Fiverr
"""

import json
import csv
import sys
from flask import Flask, jsonify, request

class APIGenerator:
    def __init__(self, data_file):
        self.data = self.load_data(data_file)
        self.app = Flask(__name__)
        self.setup_routes()
    
    def load_data(self, filepath):
        if filepath.endswith('.json'):
            with open(filepath) as f:
                return json.load(f)
        elif filepath.endswith('.csv'):
            with open(filepath) as f:
                reader = csv.DictReader(f)
                return list(reader)
        return []
    
    def setup_routes(self):
        @self.app.route('/api/data', methods=['GET'])
        def get_all():
            page = request.args.get('page', 1, type=int)
            limit = request.args.get('limit', 10, type=int)
            start = (page-1) * limit
            end = start + limit
            return jsonify({
                'data': self.data[start:end],
                'total': len(self.data),
                'page': page,
                'limit': limit
            })
        
        @self.app.route('/api/data/<int:id>', methods=['GET'])
        def get_one(id):
            if 0 <= id < len(self.data):
                return jsonify(self.data[id])
            return jsonify({'error': 'Not found'}), 404
        
        @self.app.route('/api/data', methods=['POST'])
        def create():
            self.data.append(request.json)
            return jsonify(request.json), 201
        
        @self.app.route('/health', methods=['GET'])
        def health():
            return jsonify({'status': 'running', 'records': len(self.data)})
    
    def run(self, port=5000):
        print(f"🚀 API running on http://localhost:{port}")
        print(f"📊 Loaded {len(self.data)} records")
        self.app.run(debug=True, port=port)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python rest_api_generator.py <data.json or data.csv>")
        sys.exit(1)
    
    generator = APIGenerator(sys.argv[1])
    generator.run()
