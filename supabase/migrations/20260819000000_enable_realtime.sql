-- ============================================================================
-- Habilitar Supabase Realtime en las 6 tablas principales
-- ============================================================================
-- Supabase Realtime escucha cambios (INSERT/UPDATE/DELETE) en tablas que
-- estén agregadas a la publicación "supabase_realtime". Sin esto, las
-- suscripciones del cliente no recibirán ningún evento.
--
-- Replica Identity = FULL确保 que el payload del evento incluya la fila
-- completa (necesario para UPDATE y DELETE, que de otra forma solo traen
-- la primary key).
--
-- Ejecutar con: supabase db push  (o aplicar manualmente en Supabase SQL Editor)
-- ============================================================================

-- 1. Agregar tablas a la publicación Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE checklists;
ALTER PUBLICATION supabase_realtime ADD TABLE weekly_rentals;
ALTER PUBLICATION supabase_realtime ADD TABLE maintenances;

-- 2. Establecer Replica Identity = FULL para payloads completos
ALTER TABLE drivers        REPLICA IDENTITY FULL;
ALTER TABLE vehicles       REPLICA IDENTITY FULL;
ALTER TABLE assignments    REPLICA IDENTITY FULL;
ALTER TABLE checklists     REPLICA IDENTITY FULL;
ALTER TABLE weekly_rentals REPLICA IDENTITY FULL;
ALTER TABLE maintenances   REPLICA IDENTITY FULL;
