# Artizen: estado honesto y aviso editorial

El detalle de tarea usaba Online/punto verde constantes. Una tarea histórica
no prueba presencia. Reutilizar únicamente nombre/runtime/estado de la lectura
de agentes que getWalletProject ya hace, sin nuevos listeners ni polling.
Mostrar nombre visible y «Último estado consultado», no presencia en vivo.
Si falta acceso al roster o el estado es desconocido, mostrar sin confirmar;
nunca deducir reposo o trabajo del resultado de una tarea vieja. Otros runtimes
tampoco obtienen un Online ficticio. No cambiar permisos para resolver un nombre.

Alternativas descartadas: añadir consulta periódica a todos los agentes
(contradice el objetivo de costos); usar task.executionPhase como presencia
(incorrecto al ejecutar una tarea nueva); sustituir Online por Resting constante.

El nuevo draftEchoesNotes de API activa un aviso EN/ES sin cambiar borrador,
aprobación o memoria. La ausencia del flag mantiene compatibilidad con API
anterior. No se hacen llamadas adicionales ni regeneración automática.

Pruebas: estados actuales independientes de tareas históricas, nombre visible,
desconocido/ausencia de metadata, EN/ES y sin Online/punto verde inventado;
aviso para prepare/revise, historial intacto y sin POST automático. No certificar
eficacia editorial del modelo por una prueba con mocks. Rollout tras revisión:
API primero y App después, sólo Dev; inspeccionar el borrador histórico sin gasto.
