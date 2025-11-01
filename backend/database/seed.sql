-- Minimal seed data
BEGIN;

-- Roles base
INSERT INTO roles (nombre)
VALUES ('admin'), ('vendedor'), ('gerente')
ON CONFLICT (nombre) DO NOTHING;

COMMIT;

