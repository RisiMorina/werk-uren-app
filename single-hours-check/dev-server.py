"""Kleine testserver voor Mijn uren: python dev-server.py  ->  http://localhost:8124 (draai hem in deze map of daarbuiten)"""
import http.server, socketserver, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.css': 'text/css'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', 8124), H) as s:
    s.serve_forever()
