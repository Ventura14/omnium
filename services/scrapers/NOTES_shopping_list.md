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
