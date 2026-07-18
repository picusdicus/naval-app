# Consulta de arquitectura y escalabilidad

> **Notas de una consulta** (julio 2026) para retomar el lunes. Recoge el
> análisis sobre si la arquitectura actual aguanta el crecimiento previsto,
> Vercel vs AWS, coste del plan Pro y la duda sobre el chatbot de IA.
> No implica cambios de código; son decisiones a tomar.

## La pregunta de partida

Si la app se abre al público y alcanza una media de **20.000 usuarios/día**,
¿aguanta la arquitectura actual (Vercel + Neon) o conviene migrar a AWS?

## Conclusión

**Aguanta de sobra sin cambios. Migrar a AWS ahora sería resolver un problema
que no existe.** El límite a esta escala no es la capacidad técnica, sino el
coste del chatbot de IA y tener el plan/vigilancia adecuados.

## Por qué 20.000/día no es mucho para este diseño

20.000 usuarios/día no son 20.000 a la vez: se reparten con picos de, como
mucho, unos cientos de usuarios simultáneos. Tres piezas ya presentes absorben
casi toda la carga:

1. **CDN de Vercel** — páginas e imágenes se sirven desde la red de
   distribución, no desde el backend. Prácticamente ilimitado y barato.
2. **Caché de 60 s** en las dos consultas más usadas (agenda de eventos y
   destacados): aunque 5.000 personas abran la app en un minuto, la base de
   datos responde una vez y el resto recibe la copia cacheada. Divide la carga
   real por un factor enorme.
3. **Driver HTTP de Neon** — cada petición entra y sale sin ocupar conexiones
   persistentes; es justo lo que suele reventar bajo pico en arquitecturas
   tradicionales, y aquí no aplica.

En números redondos: ~150.000 llamadas al backend/día ≈ menos de 2 por segundo
de media. Vercel lo maneja sin problema.

## El cuello de botella real: coste, no capacidad

El riesgo a 20.000/día no es que se caiga, es la **factura**, en dos puntos:

- **Asistente de IA.** Cada conversación cuesta dinero real (pago por uso a
  Anthropic) y está con el modelo más caro. Puede ser la mayor línea de gasto,
  por encima del hosting. **Cambiar de nube no lo arregla**; lo arreglan
  límites de uso, un modelo más barato para lo simple y caché de respuestas.
- **Plan de Vercel.** El plan gratuito (Hobby) es solo para uso no comercial;
  una app municipal necesita **Pro** de todas formas — por licencia y soporte,
  no por capacidad.

## Vercel vs AWS, sin mitos

**Vercel funciona por encima de AWS**: las funciones ya corren en
infraestructura de Amazon. Vercel es la capa que evita configurarla. La
pregunta no es "¿AWS es más potente?" (mismo motor debajo) sino "¿montas y
mantienes tú las piezas o te las dan montadas?".

- **Quedarse en Vercel:** despliegue con `git push`, sin gestionar servidores,
  escalado automático, CI/CD integrado. Más caro por unidad, muchas horas de
  ingeniería ahorradas.
- **Migrar a AWS en crudo:** más control y potencialmente más barato **a gran
  escala**, a cambio de gestionar media docena de servicios (funciones, base
  de datos, red, permisos, despliegues, monitorización). Para 20.000/día esa
  complejidad no se paga sola.

**AWS tendría sentido solo si:** se crece un orden de magnitud (cientos de
miles/millones), o el Ayuntamiento **exige por normativa** un proveedor o
región concretos (relevante en el sector público español con el Esquema
Nacional de Seguridad — pero Vercel también puede alojar en la UE, así que se
resuelve sin migrar), o se necesitan servicios muy específicos de AWS.

## Coste de Vercel Pro (precios consultados en vercel.com/pricing, jul 2026)

**20 $/mes por desarrollador** (los asientos de solo lectura son gratis). Si lo
lleva una persona, 20 $/mes de base. Incluye una bolsa mensual de consumo:

| Recurso incluido | Cantidad |
| --- | --- |
| Peticiones CDN (Edge) | 10 millones/mes |
| Transferencia de datos | 1 TB/mes |
| Ejecuciones de funciones | 1 millón/mes |
| CPU activa | 4 horas/mes |
| Crédito de consumo | 20 $/mes por usuario |

Excesos por uso: **2 $/millón** de peticiones CDN extra, **0,15 $/GB** de
transferencia extra, **0,60 $/millón** de funciones extra.

### Estimación para 20.000 usuarios/día

- Peticiones CDN: ~15-18 M/mes → pequeño exceso, **~10-20 $/mes**.
- Funciones: pocas llamadas reales gracias a la caché → **~1-3 $/mes**.
- Transferencia: el 1 TB incluido puede quedarse justo en picos con imágenes.

**Presupuesto realista de Vercel: 20 $ (base) a ~60-80 $/mes.** Contenido y
predecible. **No incluye el asistente de IA**, que va por otro contador
(Anthropic) y es la variable de verdad a vigilar.

## Duda abierta: ¿es necesario el chatbot de IA?

Valoración: **no es imprescindible, y conviene justificarlo antes de darlo por
hecho.**

- **Lo que aporta:** casi toda su información (eventos, noticias, transporte,
  comercios) ya es navegable por los menús. No añade datos nuevos, sino una
  forma más cómoda de preguntarlos. Donde sí brilla: preguntas de trámites en
  lenguaje coloquial, lo más difícil de encontrar navegando.
- **Coste:** su mayor gasto variable, potencialmente por encima del hosting.
- **Riesgo reputacional (el importante):** si inventa un teléfono, fecha o
  requisito de un trámite oficial, el error sale con el nombre del
  Ayuntamiento. En un servicio civico, dar información oficial equivocada es un
  problema de confianza pública, y los datos concretos (importes, plazos,
  direcciones) son justo lo que la gente pregunta.

### Recomendación: que se gane su sitio

1. **Medir uso real primero.** Ya hay analíticas que registran las preguntas
   al asistente (`chat_question`). Ver si lo usa el 15 % o el 0,5 % antes de
   invertir en mantenerlo o protegerlo. Eso solo casi decide.
2. **Si se mantiene, acotarlo:** modelo más barato para la mayoría de
   preguntas, aviso visible ("respuestas orientativas, confirma en la sede
   electrónica"), ceñido estrictamente a información verificada.
3. **Alternativa más segura y barata:** un buscador de preguntas frecuentes
   (respuestas fijas, escritas y revisadas por el Ayuntamiento) entrega el
   ~80 % del valor sin coste por uso y sin riesgo de invención. La IA se
   reservaría a lo que el FAQ no cubra, o se elimina.

## Decisiones pendientes para el lunes

| Decisión | Recomendación |
| --- | --- |
| ¿Quedarse en Vercel o migrar a AWS? | Quedarse en Vercel |
| ¿Plan? | Subir a Vercel **Pro** (obligatorio por ser uso comercial/municipal) |
| ¿Base de datos (Neon)? | Verificar tramo; con la caché de 60 s va sobrada a esta escala |
| ¿Chatbot de IA? | Revisar uso real en analíticas y decidir: acotar vs FAQ vs eliminar |
| Prioridad transversal | Añadir vigilancia (alertas de errores y caídas), hoy inexistente |
| Prerrequisito | Resolver los P0 de seguridad (ver SEGURIDAD.md) antes de abrir al público |
