#!/usr/bin/env bash
# ALCANCE: solo verifica que cada "pnpm <script>" citado en la seccion
# Comandos de CLAUDE.md exista de verdad en package.json. Habria
# cazado el dia en que se documento `pnpm typecheck` sin que el script
# existiera.
#
# LO QUE NO CUBRE: cualquier comando que no sea `pnpm <algo>` --
# `supabase db push`, `cd services && uv run pytest`, etc. NO se
# verifican aqui. El fallo mas grave de los tres que motivaron esto
# (`supabase db reset` documentado apuntando a un stack abandonado)
# NO lo habria cazado este script. Un verificador del que se cree que
# cubre mas de lo que cubre es tan malo como uno que no verifica nada
# -- si se amplia el alcance algun dia, actualiza este comentario.
set -euo pipefail

commands_block=$(awk '/^## Comandos$/{found=1; next} found && /^```bash$/{incode=1; next} found && incode && /^```$/{exit} found && incode{print}' CLAUDE.md)

missing=0
while read -r script; do
  [ -z "$script" ] && continue
  if ! node -e "const s=require('./package.json').scripts||{}; process.exit(s['$script'] ? 0 : 1)"; then
    echo "CLAUDE.md cita 'pnpm $script' pero no existe en package.json scripts"
    missing=1
  fi
done < <(printf '%s\n' "$commands_block" | grep -oE '^pnpm [a-zA-Z0-9:_-]+' | awk '{print $2}' | sort -u)

if [ "$missing" -eq 1 ]; then
  echo "FALLO: CLAUDE.md documenta comandos pnpm que no existen en package.json."
  exit 1
fi

echo "OK: todos los comandos pnpm de CLAUDE.md existen en package.json."
