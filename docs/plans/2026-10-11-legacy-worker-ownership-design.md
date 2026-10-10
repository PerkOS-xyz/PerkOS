# AP02: límite del worker antiguo de App

## Objetivo y alcance aprobado

Continuación de #466. La imagen todavía incluye el provisioner retirado y el curator opcional. Ninguno debe consumir credenciales ni modificar recursos basándose únicamente en una cola o espejo de agente. No reactivar esos workers ni desplegar.

## Opciones y decisión

1. Confiar en los callers: deja la cola y los callers internos sin defensa.
2. Eliminar el código antiguo: requiere un inventario de consumidores y una migración operativa independiente.
3. Mantenerlo cerrado por defecto con prueba de identidad en sus límites. Es la opción elegida.

Un helper server-only exige registro global con propietario, ID y nombre exactos, más espejo del mismo propietario. Los callers internos que usan nombre como ID solo pueden resolver el ID desde el registro global. Nunca crear ni reparar un espejo durante autorización.

Las primitivas antiguas forman nombres y prefijos convirtiendo wallets a minúsculas. Se admiten únicamente wallets EVM válidas; Solana y registros de plataforma deben usar el worker API, que tiene las convenciones actuales. Rechazar esos casos antes de leer secretos o llamar AWS/LLM.

## Efectos protegidos

- Provisioner: validar antes de leer BYOK, registrar una key o provisionar; usar el registro verificado para relay; no marcar un espejo como fallido si la identidad no fue autorizada.
- Hibernate, wake y status: validar antes de AWS y escrituras de estado; resolver el ID canónico.
- Upgrade: validar antes del ciclo y revalidar antes de provisionar, sin un fallback que continúe después de fallar la lectura del registro.

## Verificación y límites

Pruebas con datos sintéticos del helper real y servicios externos simulados. Negativos: registro ausente, propietario o ID ajeno, espejo adulterado, fallo de lectura, Solana y plataforma. Positivos: EVM normalizado, ID exacto y resolución interna por nombre. Comprobar cero llamadas de recursos o secretos y cero escrituras de espejos en rechazos.

No añadir lecturas al heartbeat ni cambiar su cache. No introducir credenciales, nuevos runtimes ni acceso público. La compatibilidad de datos históricos y el inventario de consumidores son gates previos a cualquier despliegue.
