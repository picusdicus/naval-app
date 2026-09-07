---
description: Despliega la rama actual — la fusiona en develop y develop en main, con push en cada paso
allowed-tools: "Bash(sh scripts/desplegar.sh:*), Bash(git status:*), Bash(git log:*), Bash(git branch:*), Bash(git rev-parse:*)"
---

Despliega la rama en la que está el usuario siguiendo el flujo del proyecto
(rama → develop → main), ejecutando el script que hace cumplir sus reglas.

## Qué hacer

1. Ejecuta `sh scripts/desplegar.sh $ARGUMENTS` desde la raíz del repo.
2. Si el script aborta, **no intentes sortear la comprobación que falló**:
   explícale al usuario cuál fue y qué tiene que hacer (commitear, hacer push
   de su rama, resolver un conflicto…). Cada guarda existe por una razón.
3. Cuando termine bien, resume en dos líneas: qué rama se fusionó, en qué
   commits quedaron `develop` y `main`, y que Vercel desplegará `main` solo.

Argumentos que acepta (pásalos tal cual): `--dry-run` para ver lo que haría sin
tocar nada, `--solo-develop` para quedarse en develop sin tocar main.

## Antes de ejecutar

Si el usuario **no ha revisado el diff** de la rama y no lo ha dicho
explícitamente, menciónaselo en una línea antes de desplegar — su flujo es
revisar en GitHub línea a línea antes de aprobar. No lo bloquees por ello: si
pide desplegar, despliega.

## Lo que el script garantiza (no lo repliques a mano)

- Merges con `--no-ff` siempre. Un fast-forward no deja frontera de revisión en
  el log y puede colar contenido no revisado hasta main sin rastro.
- `ALLOW_MAIN_PUSH=1` solo en el push a `main`, que es lo que el hook
  `hooks/pre-push` exige en sesiones no interactivas.
- Aborta si hay cambios sin commitear, si la rama no coincide con su remoto, si
  `develop`/`main` han divergido, o si un merge da conflicto (en ese caso
  deshace el merge y te devuelve a tu rama).
- Te deja de vuelta en tu rama de trabajo, no en `main`.

## Después

Si la rama tocaba `db/schema.sql`, recuérdale aplicar el esquema en producción
(`npm run db:setup`): el despliegue de Vercel no lo hace.
