# Flujo de seguridad (explicado en simple)

> Versión en texto del esquema visual. Pensado para entenderlo sin ser experto
> en ciberseguridad. La metáfora: la app es un edificio municipal con puertas,
> porteros y cerraduras que cada persona (y cada acción) debe pasar.

## Paso 1 — Entrar por la puerta

Según quién seas, la app te pide una cosa u otra.

- **Un vecino** teclea la contraseña del portal. Ahora se comprueba **en el
  servidor**, no en su móvil, y recibe un "carné" firmado que no se puede
  falsificar ni escribir a mano. *(antes la contraseña viajaba en la propia web
  y el acceso se falseaba desde la consola del navegador).*
- **Un gestor o el Ayuntamiento** entra con email y contraseña. La contraseña se
  guarda **cifrada de forma robusta** y un **portero limita los intentos**
  (máx. 5 cada 15 minutos) para que nadie las pruebe a lo bruto.

## Paso 2 — Hacer algo que cambia datos

Publicar un evento, editar, borrar… Antes de tocar nada, **tres guardias**
revisan la petición a la vez:

1. **¿Tienes carné válido?** — La cookie de sesión va firmada y el navegador no
   puede leerla ni trucarla. Sin carné, no se pasa.
2. **¿Vienes de nuestra puerta?** — La acción solo se acepta si nace dentro de
   la propia app. Una web ajena que intente actuar en tu nombre queda **fuera**.
3. **¿No te estás pasando?** — El portero cuenta cuántas peticiones haces; si
   son demasiadas en poco tiempo, tiene que esperar.

## Siempre encendido (de fondo, 24/7)

- **Las rejas del edificio** — El navegador recibe instrucciones de seguridad
  que frenan trucos habituales de robo de datos o de suplantación de la web
  (cabeceras HTTP + CSP).
- **El robot nocturno** — Cada noche actualiza la agenda de eventos. Ahora solo
  arranca con su **llave secreta**; sin ella, no abre.

## Lo que ha cambiado, en tres frases

| | Antes | Ahora |
| --- | --- | --- |
| **Contraseña del portal** | Viajaba dentro de la web; cualquiera con maña la leía y se colaba sin saberla. | Vive solo en el servidor. El móvil nunca la ve y el acceso no se puede falsear. |
| **Contraseñas guardadas** | Protegidas de forma débil; una fuga se descifraba en minutos. | Cifrado robusto con sal: aunque robaran la base de datos, aguantan. |
| **Intentos** | Nada los frenaba; se probaban sin límite. | Hay un portero: demasiados intentos seguidos se cortan solos. |

## Los nombres "técnicos", por si los ves

| Nombre sencillo | Nombre técnico | Qué es |
| --- | --- | --- |
| Carné firmado | cookie httpOnly + JWT | Pase de sesión que el servidor firma y el navegador no puede leer ni modificar. |
| Cifrado robusto | PBKDF2 con sal | Forma moderna de guardar contraseñas para que una fuga no las revele. |
| El portero | rate-limiting (Upstash) | Límite de cuántas veces se puede intentar algo en un rato. |
| Desde nuestra puerta | protección CSRF / Origin | Evita que otra web actúe en tu nombre a tus espaldas. |
| Las rejas | cabeceras HTTP + CSP | Reglas que el navegador aplica para bloquear robos y suplantaciones. |
| El robot nocturno | cron con secreto | La sincronización diaria solo arranca con su llave. |

---

**En una frase:** antes la casa estaba bien construida pero con un par de
cerraduras de adorno. Ahora cada puerta tiene cerradura de verdad, hay un
portero, y las acciones importantes se comprueban tres veces antes de ocurrir.

Detalle técnico completo en [SEGURIDAD.md](SEGURIDAD.md). Pasos de puesta en
marcha (Upstash, variables de entorno) pendientes de ejecutar antes de desplegar.
