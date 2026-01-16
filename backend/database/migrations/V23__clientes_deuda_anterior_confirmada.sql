-- Marcar si ya se confirmo la deuda anterior del cliente
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS deuda_anterior_confirmada BOOLEAN NOT NULL DEFAULT FALSE;
