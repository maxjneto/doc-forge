"""Local-only stand-in for Clerk, so the real backend accepts a dev session.

The backend validates Clerk JWTs against CLERK_JWKS_URL. This script generates
an RSA keypair (cached under .preview-state/), serves its JWKS over HTTP and
mints a long-lived RS256 token with the same claims Clerk would send. No
backend code path changes: point CLERK_JWKS_URL at this server and send the
token as the Bearer header (the frontend's dev Clerk stub does that).

Usage (from the backend venv):
    python dev_auth.py token          # print a JWT for the preview user
    python dev_auth.py serve [port]   # serve /.well-known/jwks.json (default 8765)
"""

import json
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwk, jwt

STATE_DIR = Path(__file__).resolve().parent / ".preview-state"
KEY_PATH = STATE_DIR / "dev_key.pem"
KID = "docforge-preview"

PREVIEW_USER = {
    "sub": "user_preview",
    "email": "preview@docforge.local",
    "name": "Preview User",
}


def _private_pem() -> bytes:
    if KEY_PATH.exists():
        return KEY_PATH.read_bytes()
    STATE_DIR.mkdir(exist_ok=True)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    KEY_PATH.write_bytes(pem)
    return pem


def jwks() -> dict:
    pem = _private_pem()
    public = serialization.load_pem_private_key(pem, password=None).public_key()
    public_pem = public.public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    key = jwk.construct(public_pem, "RS256").to_dict()
    key.update({"kid": KID, "use": "sig", "alg": "RS256"})
    return {"keys": [key]}


def token() -> str:
    now = int(time.time())
    claims = {**PREVIEW_USER, "azp": "http://localhost:5173", "iat": now, "exp": now + 30 * 86400}
    return jwt.encode(claims, _private_pem().decode(), algorithm="RS256", headers={"kid": KID})


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        body = json.dumps(jwks()).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "token"
    if cmd == "token":
        print(token())
    elif cmd == "serve":
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
        HTTPServer(("127.0.0.1", port), _Handler).serve_forever()
    else:
        sys.exit(f"unknown command: {cmd}")
