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

## Corrección: el recargo de producto de Glovo NO es cero (2026-09-08)

`load_glovo_channel.py` (docstring) y una nota anterior afirmaban que
el recargo de producto de Glovo frente a Dia era "esencialmente cero"
(~0.4% ponderado, medido como 27.85 € vs 27.73 € sobre la cesta real
del 2026-08-27). **Es falso**, y el motivo es un dato promocional
metido en la media sin detectarlo: aquella muestra incluía "Patatas 4
Kg" a 3.49 € en Glovo contra 4.99 € en Dia (-30 %) -- una promoción
puntual de ese día, no el precio estructural. Sondeado de nuevo el
2026-09-08 20:33 (tienda abierta, catálogo completo, sin promociones
detectadas), el mismo producto vale 4.99 € en los dos canales.

**El recargo real de producto de Glovo ronda el 10-15 %**, medido
sobre 8 productos de la cesta ese día:

```
Producto                                  Dia web   Glovo    desvío
Patatas 4 Kg                               4.99      4.99      0 %
Huevos grandes L 12 uds                    3.05      3.20     +4.9 %
Maxi pavo Dia Nuestra Alacena 900 g        3.19      3.45     +8.2 %
Queso fresco batido Granja Rinya 400 g     1.89      2.09    +10.6 %
Filetes merluza Argentina sin piel 400 g   3.49      3.89    +11.5 %
Escalopín de lomo marinado 600 g           3.99      4.49    +12.5 %
Champiñones laminados Vegecampo 185 g      1.00      1.15    +15.0 %
Mezcla de pimientos Vegecampo 400 g        1.07      1.35    +26.2 %
```

**Aprendizaje, mismo error que ya se evita en los datos
nutricionales:** un precio observado una sola vez puede ser
promocional, no estructural -- meterlo en una media sin más lo
disfraza de dato normal. `product_prices.observed_at` existe
precisamente para poder detectar esto comparando observaciones en el
tiempo, no solo para "saber cuándo se midió".

**Dos productos de la cesta no existen en Glovo con el mismo SKU**
(confirma el punto (a) de arriba -- el catálogo de Glovo es un
subconjunto distinto, el ganador debería resolverse por canal):

- "Pechuga de pollo entera formato familiar 1.3 Kg" (Dia) -- en
  Glovo solo está "Pechugas Enteras De Pollo Selección De Dia 720 g
  Aprox." a 4.89 € (6.79 €/kg vs 6.49 €/kg en Dia).
- "Plátano de canarias 1 Kg aprox." a 1.50 € (Dia) -- en Glovo solo
  hay "Plátano Bio 1 Kg" a 2.99 €, el doble (producto distinto, no
  el mismo plátano más caro).
