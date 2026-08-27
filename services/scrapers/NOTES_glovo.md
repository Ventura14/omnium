# Notas — catálogo y tarifas de Glovo

## El catálogo de Glovo no es el de dia.es, y varía (2026-08-27/28)

Sondeado el mismo día con la tienda de Dia en Glovo abierta (tarde) y
cerrada (22:26). Comparado contra la consulta de la tarde:

```
Filete de cinta de lomo 500 g   3.75 € -> DESAPARECIDO del catálogo
Patatas 4 Kg                    3.49 € -> DESAPARECIDO del catálogo
Queso batido Granja Rinya 400g  2.09 € -> 2.09 € (sin cambios)
Gastos de envío                 1.99 € -> 3.49 € (+75 %)
```

No es un cambio de precio: los productos dejaron de aparecer en el
catálogo. Hipótesis del usuario, plausible y **sin verificar todavía**:
la tienda física de Dia había cerrado esa hora. Pendiente de repetir
el sondeo por la mañana para confirmar o descartar.

## Tres consecuencias para el modelo de datos (anotadas, no implementadas)

**a) El enlace alimento→producto es global, debería ser por canal.**
`products.store` distingue tienda pero no canal (presencial vs
Glovo) — un producto que existe en dia.es puede no estar en el
catálogo de Glovo en un momento dado. `cheapest_dia_proposal` (y por
tanto `shopping_list`) hoy propone un ganador sin saber si ese
producto concreto está disponible en el canal que se vaya a usar para
comprar.

**b) `channel_fees` guarda el envío de Glovo como 1.99 € fijo; se ha
medido 3.49 €.** La tarifa depende de hora, distancia y demanda — el
número que hay en la tabla es UNA observación puntual, no una
constante del canal. La comparación de canales en `/compra` debería
presentarse como estimación, no como precio fijo, y el comentario de
`channel_fees` debería decirlo explícitamente.

**c) `product_prices.observed_at` se vuelve importante de verdad
para canales con catálogo volátil.** Un precio de Glovo observado
hace tres días puede no ser el de hoy (ver el caso del filete de
cinta / patatas 4kg arriba, desaparecidos en horas). `shopping_list`
podría avisar cuando el precio usado tenga más de N días de
antigüedad, en vez de darlo por vigente sin más.

Ninguna de las tres está construida. Candidatas para cuando se
retome el trabajo de canales — después del frontend y de la despensa,
salvo que se decida que la comparación de canales necesita ser fiable
antes.
