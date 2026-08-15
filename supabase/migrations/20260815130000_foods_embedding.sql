-- 20260815130000_foods_embedding.sql
-- Preparatoria para el matching BEDCA/Dia por embeddings (ver
-- services/scrapers/VIABILIDAD_matching_dia_bedca.md). Solo esquema:
-- no se generan embeddings todavia, eso es un paso aparte.
--
-- 384 dimensiones: encaja con sentence-transformers/all-MiniLM-L6-v2
-- o paraphrase-multilingual-MiniLM-L12-v2 (mejor en español, mismo
-- tamano de salida). pgvector ya estaba habilitado desde
-- 0001_core.sql.

alter table foods add column embedding vector(384);

create index foods_embedding_hnsw_idx
  on foods using hnsw (embedding vector_cosine_ops);
