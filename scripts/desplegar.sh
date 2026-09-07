#!/bin/sh
# Despliegue: rama actual → develop → main, con push en cada paso.
#
#   sh scripts/desplegar.sh              # despliega la rama en la que estás
#   sh scripts/desplegar.sh --dry-run    # enseña lo que haría, sin tocar nada
#   sh scripts/desplegar.sh --solo-develop   # se queda en develop, no toca main
#
# Reglas del proyecto que este script hace cumplir (ver CLAUDE.md):
#
#  · Los merges van SIEMPRE con --no-ff. Un fast-forward no deja commit de
#    merge ni frontera de revisión en el log, así que una rama cortada desde el
#    sitio equivocado puede arrastrar contenido no revisado hasta main sin que
#    nadie lo note (pasó el 2026-09-02).
#  · El push a main usa ALLOW_MAIN_PUSH=1 porque el hook local hooks/pre-push
#    bloquea main sin terminal interactiva. Aquí el push a main es deliberado y
#    es justo el caso de uso para el que existe esa variable — pero solo se
#    aplica al push de main, nunca al de develop.
#
# El script ABORTA (sin dejar nada a medias) si: hay cambios sin commitear, la
# rama no está subida, un merge da conflicto, o se lanza desde develop/main.
# Ante un conflicto deshace el merge y te devuelve a tu rama.

set -e

DRY_RUN=0
SOLO_DEVELOP=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --solo-develop) SOLO_DEVELOP=1 ;;
    *) echo "Opción desconocida: $arg"; exit 1 ;;
  esac
done

info()  { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fatal() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

ejecutar() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '  \033[33m[dry-run]\033[0m %s\n' "$*"
  else
    "$@"
  fi
}

RAMA=$(git symbolic-ref --short HEAD 2>/dev/null) || fatal "No estás en ninguna rama (HEAD suelto)."

# ---------------------------------------------------------------- comprobaciones
info "Comprobaciones previas"

case "$RAMA" in
  develop|main)
    fatal "Estás en '$RAMA'. Este script despliega una rama de trabajo: haz checkout de tu rama primero."
    ;;
esac
ok "Rama de trabajo: $RAMA"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short --untracked-files=no
  fatal "Tienes cambios sin commitear. Commitéalos o guárdalos antes de desplegar."
fi
ok "Árbol de trabajo limpio"

git fetch origin --quiet
ok "Remoto actualizado (git fetch)"

# La rama debe existir en el remoto y coincidir: si el diff que se revisa en
# GitHub no es lo que se está fusionando, la revisión no vale de nada.
if ! git rev-parse --verify --quiet "origin/$RAMA" >/dev/null; then
  fatal "'$RAMA' no está en el remoto. Súbela primero: git push -u origin $RAMA"
fi
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$RAMA")" ]; then
  fatal "'$RAMA' y 'origin/$RAMA' no coinciden. Haz push (o pull) antes de desplegar."
fi
ok "'$RAMA' coincide con el remoto"

if [ "$DRY_RUN" = "1" ]; then
  info "Modo dry-run: a partir de aquí solo se imprime lo que se haría."
fi

# ------------------------------------------------------------ función de merge
# $1 = rama destino, $2 = rama a fusionar, $3 = 1 si hay que usar ALLOW_MAIN_PUSH
fusionar_y_subir() {
  destino=$1
  origen=$2
  es_main=$3

  info "$origen → $destino"

  ejecutar git checkout "$destino"
  # --ff-only: si el destino local hubiera divergido del remoto, mejor parar
  # aquí que resolverlo dentro de un despliegue.
  if [ "$DRY_RUN" = "0" ]; then
    git merge --ff-only "origin/$destino" >/dev/null 2>&1 \
      || fatal "'$destino' local ha divergido de 'origin/$destino'. Resuélvelo a mano."
  fi
  ok "'$destino' al día con el remoto"

  if [ "$DRY_RUN" = "0" ]; then
    if ! git merge --no-ff "$origen" -m "Merge branch '$origen' into $destino"; then
      git merge --abort 2>/dev/null || true
      git checkout "$RAMA" 2>/dev/null || true
      fatal "Conflicto al fusionar '$origen' en '$destino'. Merge abortado; sigues en '$RAMA'."
    fi
  else
    printf '  \033[33m[dry-run]\033[0m git merge --no-ff %s\n' "$origen"
  fi
  ok "Fusionado con --no-ff"

  if [ "$es_main" = "1" ]; then
    # Solo el push a main lleva el bypass; el de develop pasa por el hook normal.
    if [ "$DRY_RUN" = "0" ]; then
      ALLOW_MAIN_PUSH=1 git push origin "$destino"
    else
      printf '  \033[33m[dry-run]\033[0m ALLOW_MAIN_PUSH=1 git push origin %s\n' "$destino"
    fi
  else
    ejecutar git push origin "$destino"
  fi
  ok "Push de '$destino' hecho"
}

fusionar_y_subir develop "$RAMA" 0

if [ "$SOLO_DEVELOP" = "1" ]; then
  info "--solo-develop: main queda sin tocar."
else
  fusionar_y_subir main develop 1
fi

# Volver a la rama de trabajo: el despliegue no debe dejarte en main sin querer.
ejecutar git checkout "$RAMA"

info "Listo"
if [ "$DRY_RUN" = "0" ]; then
  git --no-pager log --oneline --graph -4
  printf '\nVercel desplegará main automáticamente. Estás de vuelta en «%s».\n' "$RAMA"
  if [ "$SOLO_DEVELOP" = "0" ]; then
    printf 'Si la rama tocaba db/schema.sql, aplica el esquema en producción: npm run db:setup\n'
  fi
fi
