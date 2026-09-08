# Aviso de revisión Artizen sin cambios

Corrección aprobada tras el ensayo Dev: el proveedor devolvió la misma fuente
aunque había notas nuevas. API incorpora instrucciones específicas de revisión y
devuelve `revisionUnchanged` derivado, también para resultados históricos.

Mostrar aviso accesible EN/ES junto al borrador cuando la API confirme igualdad
ignorando espacios. El aviso describe el resultado generado, no juzga ediciones
locales ni certifica factualidad. La persona puede editar y aprobar mediante el
modal existente. No descartar respuesta, borrar memoria o regenerar por cuenta propia.

Campo opcional para despliegue API primero; API antigua sigue funcionando sin aviso.
Sin polling nuevo, llamadas de modelo, dependencias, cambios de permisos o contador.
Tests del componente cubren ambos idiomas, remount/recarga, casos negativos y
edición con aprobación explícita. Preview local usa fixtures, no evidencia E2E real.
