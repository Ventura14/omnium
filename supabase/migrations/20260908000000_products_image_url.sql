-- 20260908000000_products_image_url.sql
-- URL de ORIGEN de la foto de producto en Dia -- no la ruta donde se
-- sirve (public/products/<id>.jpg, servida estatica por Next). Sirve
-- para poder comprobar en el futuro si la foto sigue siendo la misma
-- sin volver a rastrear el catalogo entero, y para re-descargar si
-- hace falta. Nullable: sin foto, sin fila -- no se reserva hueco
-- (regla 15, y decision explicita del usuario: una fila sin imagen
-- no debe ocupar el sitio gris que ocupaba antes).
alter table products add column image_url text;
