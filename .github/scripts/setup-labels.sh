#!/usr/bin/env bash
# Crea (o actualiza) los labels de área/estado usados por el workflow
# .github/workflows/claude-issue-triage.yml
#
# Idempotente: se puede volver a ejecutar sin problema (--force sobreescribe
# color/descripción si el label ya existe).
#
# Requiere: gh CLI autenticado con permisos sobre el repo.
#
# Uso:
#   bash .github/scripts/setup-labels.sh

set -euo pipefail

declare -a LABELS=(
  "area:gameplay|Lógica de juego: colisión, rotación, wall kicks, spawn, game over|1d76db"
  "area:rendering|Dibujo en canvas, ghost piece, colores, preview|5319e7"
  "area:input|Teclado, controles, pausa|0e8a16"
  "area:scoring|Score, líneas, niveles, velocidad de caída|fbca04"
  "area:ui|HTML/CSS, layout, botones, textos|c2e0c6"
  "needs-info|Falta información para diagnosticar (repro, navegador, pasos)|d4c5f9"
)

for entry in "${LABELS[@]}"; do
  IFS='|' read -r name description color <<< "$entry"
  echo "Creando/actualizando label: $name"
  gh label create "$name" --color "$color" --description "$description" --force
done

echo "Listo. Labels actuales:"
gh label list
