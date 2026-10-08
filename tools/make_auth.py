#!/usr/bin/env python3
"""Make auth.json for the Control Center sign-in gate.

Reads a password (hidden prompt via getpass, typed twice; or one line on stdin when
stdin is not a terminal), checks the same rules the login page shows, and prints
auth.json to stdout with a fresh random salt and "enabled": true.
The password itself is never printed or written anywhere.

Format (must match login.html):
  {"v":1,"alg":"PBKDF2-SHA256","enabled":true,"salt":<b64>,"iterations":<int>,"hash":<b64>}
  - key material: the password encoded as UTF-8 (no trimming, no normalization)
  - salt: 16 random bytes, standard base64 with padding
  - iterations: integer >= 100000 (default 210000)
  - hash: PBKDF2-HMAC-SHA256 output, 32 bytes, standard base64 with padding

Usage:
  python3 tools/make_auth.py > auth.json
  python3 tools/make_auth.py --iterations 300000 > auth.json
"""
import argparse, base64, getpass, hashlib, json, re, secrets, sys

MIN_ITER = 100_000


def rule_problems(pw: str):
    probs = []
    if len(pw) < 6:
        probs.append("at least 6 characters")
    if not re.search(r"[A-Z]", pw):
        probs.append("at least one capital letter (A-Z)")
    if not re.search(r"[^A-Za-z0-9\s]", pw):
        probs.append("at least one symbol (like !)")
    return probs


def read_password() -> str:
    if sys.stdin.isatty():
        pw = getpass.getpass("New Control Center password: ")
        again = getpass.getpass("Type it again: ")
        if pw != again:
            sys.exit("Passwords did not match. Nothing was made.")
        return pw
    line = sys.stdin.readline()
    return line[:-1] if line.endswith("\n") else line


def make(pw: str, iterations: int) -> dict:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt, iterations, dklen=32)
    return {
        "v": 1,
        "alg": "PBKDF2-SHA256",
        "enabled": True,
        "salt": base64.b64encode(salt).decode("ascii"),
        "iterations": iterations,
        "hash": base64.b64encode(dk).decode("ascii"),
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--iterations", type=int, default=210_000)
    args = ap.parse_args()
    if args.iterations < MIN_ITER:
        sys.exit(f"iterations must be at least {MIN_ITER}.")
    pw = read_password()
    probs = rule_problems(pw)
    if probs:
        sys.exit("Password needs: " + "; ".join(probs) + ". Nothing was made.")
    print(json.dumps(make(pw, args.iterations), separators=(",", ":")))
    print("Remember: also set GATE_ENABLED=true at the top of gate.js.", file=sys.stderr)


if __name__ == "__main__":
    main()
