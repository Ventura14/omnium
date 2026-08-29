# Notas — shopping_list (Fase 5)

## grams_leftover mezcla stock con pérdida (2026-09-01, sin resolver)

`shopping_list.grams_leftover` (y el `leftover_pct` derivado) es la
diferencia entre lo comprado en envases enteros y lo que hace falta
para las tandas de la semana. Ese número significa cosas opuestas
según el alimento:

```
Patata (seca/tubérculo de larga conservación): sobran 3284 g -> es
  stock para la semana que viene, dinero adelantado, no perdido.
Aceite de oliva (larga conservación):          sobran  744 g -> igual, stock.
Brécol (verdura fresca):                       sobran  700 g -> no
  llega a la semana que viene, es dinero tirado.
Plátano (fruta fresca):                        sobran  560 g -> madura
  y se pasa, mismo problema que el brécol.
```

La vista los presenta idénticos -- un sobrante de brécol se ve tan
inocuo como uno de patata. Misma familia de fallo que ya se corrigió
tres veces en este proyecto (un null que parecía cero, un
"sin_comprobar" que parecía "ok", un ranking sobre un dato que no
existía): aquí "sobra" tiene dos significados y la vista no los
distingue.

Arreglarlo de verdad necesita un dato que no existe todavía: vida
útil por alimento (o al menos una clasificación perecedero/no
perecedero). No se ha construido -- a diez días de que el usuario
llegue a Madrid, no es la prioridad. Candidato para una fase futura:
una columna en `foods` (`shelf_life_days` o un enum
`perishable`/`pantry`) que `shopping_list` pueda usar para separar
"sobrante que es stock" de "sobrante que es pérdida".

## Combinar formatos de envase reduciría el sobrante (2026-09-01, sin resolver)

El sistema elige UN producto ganador por alimento y compra N envases
de ese mismo producto. Para la patata (necesita 4700 g, "Patatas 4
Kg" gana con pack_size_g=3992 g derivado): comprar 2 packs de 4 Kg dan
7984 g, 3284 g de sobrante. Combinar un pack de 4 Kg + un pack de 2 Kg
("Patatas para freír 2 Kg", el mismo candidato que antes ganaba por el
desempate incorrecto) cubriría los 4700 g con bastante menos sobrante
y algo menos de coste.

Elegir la combinación óptima de envases (potencialmente de varios
productos distintos) para minimizar sobrante y coste a la vez es un
problema de optimización combinatoria -- no es una consulta, es una
fase aparte. No construido, anotado como candidato futuro.

## store_zones.zone_order está sin calibrar contra la tienda real (2026-08-27)

El orden 1-6 de `store_zones` (verdura → panadería → carne/pescado →
charcutería → lácteos → despensa) es una suposición de recorrido de
supermercado genérico, no el recorrido real de la Dia del usuario.
Lo único que no es suposición es que `congelados` va el último
(orden 7): se descongela si se coge antes que el resto.

Esto solo se puede verificar andando por el pasillo, no desde aquí --
pendiente de que el usuario haga la primera compra real con esta
lista y corrija `zone_order` con un UPDATE si el recorrido no
coincide. La patata en particular es dudosa: en muchos Dia el saco de
4 kg está en despensa, no en frutería con la verdura suelta -- se
dejó en `verdura_fruta` a falta de verificación, corregible con una
sola línea.

## checklist sin cobertura: la casilla puede mentir (2026-08-29, sin resolver)

`ShoppingBoard` marca la casilla al instante con `useOptimistic` y
lanza la Server Action (`setShoppingCheck`/`clearShoppingCheck`) sin
`try/catch`. Estado real hoy, sin arreglar todavía:

- Si la Server Action falla (RLS, dato inválido), lanza un `Error`
  que nadie captura en el componente -- rechazo de promesa sin
  manejar dentro de la transición.
- Si la llamada ni siquiera llega al servidor (sin cobertura -- un
  supermercado grande, a menudo bajo rasante, es de los peores sitios
  de Madrid para esto), el fallo es el mismo: no hay `catch`.
- No hay ningún aviso visible de que algo no se guardó. En el mejor
  caso (si `useOptimistic` revierte solo al fallar la transición,
  comportamiento documentado de React pero no verificado aquí en
  vivo) la casilla se destachar sin explicación. En el peor caso, el
  error sin capturar podría propagarse al límite de errores de
  Next.js y tirar toda la pantalla, no solo esa fila -- perder la
  lista entera a media compra por un fallo de red en una casilla
  sería peor que el problema que se quería evitar.

Dos opciones sobre la mesa, ninguna construida:

  A) Mínimo defensible: `try/catch` alrededor de la Server Action,
     revertir el estado optimista explícitamente en el `catch` (no
     fiarse solo del comportamiento por defecto de React), y un aviso
     visible ("no se pudo guardar X"). Coste bajo, sin dependencias
     nuevas, cabe antes de que el usuario llegue a Madrid.

  B) Tolerante a sin-cobertura de verdad: persistir el check en
     localStorage/IndexedDB al momento de marcar (sobrevive un
     reload aunque la escritura no haya llegado) y reintentar cuando
     vuelva la conexión. Un Service Worker con Background Sync no es
     fiable en iOS Safari, así que sería un reintento manual/por
     evento `online` con la pestaña abierta, no sync en segundo
     plano de verdad. Coste bastante mayor -- cola local, lógica de
     reintento, indicador de "pendiente de sincronizar" por fila,
     manejo del caso de que el estado del servidor haya cambiado
     mientras tanto. Riesgo real de retrasar la entrega.
