# Contrato del marcador A2A ligado a instancia

## Contexto

El control plane de A2A `0.12.64` liga cada solicitud de mantenimiento a la instancia del bridge que publicó la capability fresca. El API devuelve el marcador opaco `PERKOS_A2A_UPDATE:<requestId>:<bridgeInstanceId>`, pero la App conservaba el validador legado de un solo UUID. El API creaba la solicitud, la App rechazaba el marcador y nunca lo enviaba al chat.

## Decisión

La App valida exactamente el mismo contrato consumido por PerkOS-A2A: prefijo fijo seguido por dos UUID canónicos y sin segmentos adicionales. La App no extrae ni reconstruye los identificadores; sólo permite transportar el marcador opaco devuelto por el API. Aceptar cualquier texto con el prefijo debilitaría el límite de seguridad, mientras reconstruir el marcador duplicaría lógica del servidor.

## Flujo y fallos

El propietario confirma **Update integration**. El API crea una solicitud ligada a la capability Chat activa y devuelve el marcador. La App valida su forma antes de enviarlo. Marcadores legados, identificadores inválidos o segmentos extra fallan cerrado y no llegan al agente. Las solicitudes creadas pero no enviadas expiran según el TTL del API y no pueden ser reclamadas sin conocer el marcador completo y presentar la instancia correcta.

## Verificación

La regresión cubre el marcador válido de dos UUID y rechaza el formato legado, una instancia inválida y segmentos extra. Después del despliegue en Dev, el E2E debe observar una sola solicitud nueva atravesando `pending → claimed → running → completed`; no se reutilizan solicitudes anteriores.

> Relacionado: [[PerkOS-Projects/README]] · [[PerkOS]] · [[PerkOS-A2A]] · [[PerkOS-API]]
