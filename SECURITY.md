Security Notes (sistemas-de-gestion)

Immediate actions when deploying
- Rotate all secrets (JWT, DB, SMTP, SendGrid, AI keys) before production.
- Do not commit .env files. Use .env.example as a template.
- Invalidate all old sessions after rotating secrets (refresh tokens are hashed with secrets).
- If secrets were ever committed, rewrite git history and rotate again.
- This version invalidates existing refresh tokens because stored values are now hashed.

Recommended defaults
- REFRESH_TOKEN_BIND_UA=false (enable if user agents are stable)
- REFRESH_TOKEN_BIND_IP=false (enable only if IPs are stable)
- ALLOW_PLAINTEXT_PASSWORD_RESPONSE=false in production

Operational hygiene
- Keep backups encrypted and restrict DB access.
- Keep CORS allowlist tight per environment.
- Enable HTTPS and TRUST_PROXY appropriately when behind a reverse proxy.

Verification
- Run `npm run security:check` in `backend/server` and `frontend-react`.
- Add dependency scanning to CI when available.
