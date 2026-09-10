# Sincronización final del workflow Artizen

## Evidencia y alcance

El E2E Dev guarda el borrador, termina Hermes y liquida el presupuesto, pero la UI conserva la reserva y el bloqueo de revisión hasta actualizar. Al recibir el run terminal, el efecto publica ese run antes de terminar la lectura del workspace. Cambia `needsPoll`, React limpia el efecto y aborta su propia lectura final.

## Decisión

Sincronizar una vez el workspace completo antes de publicar el estado terminal. Saldo, reserva, run e identificador activo deben llegar juntos desde la API: no calcular ni liberar dinero en el cliente. Mantener las actualizaciones parciales de runs activos y de atención operativa.

Alternativas: una suscripción nueva ampliaría la superficie de datos; polling permanente introduciría consultas en reposo. La lectura final ya existe y basta con preservar su ciclo de vida.

## Fallos y permisos

Si falla la lectura final, conservar el snapshot anterior, mostrar el error existente y permitir «Actualizar estado». No reintentar automáticamente, iniciar tareas, aprobar contenido ni modificar contabilidad. Desmontar/cambiar proyecto sigue abortando las peticiones. No ampliar Voice, QA/prod, IAM o límites del piloto.

## Verificación

Regresión EN/ES con respuesta final diferida: no autoabortar, saldo y botones coherentes, borrador/memoria conservados, cero consultas posteriores en reposo. Cubrir fallo de lectura y recuperación manual, desmontaje, atención operativa y transición activa. Mantener suites existentes y typecheck. El E2E pagado ya concluyó; estas pruebas son simuladas y no generan gasto LLM.
