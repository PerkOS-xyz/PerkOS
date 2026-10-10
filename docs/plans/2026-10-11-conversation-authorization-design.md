# AP02: metadatos de chat controlados por servidor

La implementación aprobada combina reglas de cliente y validación de consumidores. Se elimina la creación directa de conversaciones desde el navegador. La API autenticada crea DM/canales con agentes autorizados; para projectId se usa la ruta existente de nuevo hilo con roster del proyecto controlado por servidor.

Firestore mantiene la lectura realtime y solo permite cambios de presentación propios: título, pinned, archived y updatedAt. Se impide alterar participantes, historyHost, projectId, mirrorOf o el marcador de autorización. El borrado de metadatos propios no elimina cuerpos canónicos ni concede acceso. Los mensajes siguen fuera de la colección de metadatos.

Se conserva el contrato de UI de creación y navegación. Cambiar historyHost no tiene un consumidor UI actual y deja de exponerse como parche de cliente. Los registros históricos no se certifican automáticamente; Dev prueba hilos nuevos y DM canónicos asegurados por API antes de QA/Prod.

Pruebas de cliente y emulador demo: creación pasa por API sin wallet en el cuerpo, projectId usa la ruta existente, error de API no crea documento, presentación permitida, identidad/host/marker/mirror prohibidos y aislamiento EVM/Solana. No hay queries de heartbeat, pagos ni recursos nuevos.
