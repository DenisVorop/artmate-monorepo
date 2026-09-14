"""Standalone password and short-lived signed session; no shared Artmate auth."""

import base64
import getpass
import hashlib
import hmac
import secrets
import time

COOKIE = "coloring_session"
SESSION_SECONDS = 12 * 3600


def password_hash(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600000).hex()
    return f"pbkdf2_sha256:600000:{salt}:{digest}"


def verify_password(password, encoded):
    try:
        _, rounds, salt, expected = encoded.split(":")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(rounds)).hex()
        return hmac.compare_digest(digest, expected)
    except (ValueError, OverflowError):
        return False


def issue_session(key, now=None):
    payload = f"{int(time.time() if now is None else now)}:{secrets.token_hex(16)}".encode()
    signature = hmac.new(key.encode(), payload, hashlib.sha256).hexdigest().encode()
    return base64.urlsafe_b64encode(payload + b":" + signature).decode()


def valid_session(token, key, now=None):
    if not token or len(token) > 256:
        return False
    try:
        raw = base64.urlsafe_b64decode(token)
        issued, nonce, signature = raw.decode().split(":")
        payload = f"{issued}:{nonce}".encode()
        expected = hmac.new(key.encode(), payload, hashlib.sha256).hexdigest()
        age = (time.time() if now is None else now) - int(issued)
        return 0 <= age <= SESSION_SECONDS and hmac.compare_digest(signature, expected)
    except (ValueError, UnicodeError):
        return False


def main():
    password = getpass.getpass("Новый пароль студии (не менее 12 символов): ")
    if len(password) < 12 or password != getpass.getpass("Повторите пароль: "):
        raise SystemExit("Пароли не совпадают или слишком короткие.")
    print(password_hash(password))
