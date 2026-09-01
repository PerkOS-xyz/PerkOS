# Voice settings: envío directo al chat

## Decisión

La configuración de Voice de un agente externo enviará las acciones seguras
por la conversación directa que PerkOS ya mantiene con ese agente. El usuario
elige `Actualizar integración`, `Verificar compatibilidad` o `Activar
llamadas`, revisa una confirmación explícita y PerkOS publica el mensaje en el
mismo chat. El mensaje aparece en el historial como cualquier instrucción del
propietario y la interfaz cambia a la vista de conversación después del envío.

El chat sigue siendo el único dueño del transporte WebSocket, el estado local
del transcript y las reglas de disponibilidad del runtime. `AgentChatPanel`
expone una referencia imperativa mínima `sendMessage(text)`; el detalle del
agente la conecta a `VoiceEnrollmentPanel`. Voice nunca crea una segunda
conexión, no duplica lógica de autenticación y no usa el portapapeles como ruta
principal.

La invitación inicial A2A conserva su flujo externo porque un agente aún no
conectado no puede recibir mensajes por PerkOS Chat. Después del primer
onboarding, el botón de actualización sólo envía el comando versionado
`update-hermes`, que reutiliza la credencial local. Los pasos de Voice envían
exclusivamente `PERKOS_VOICE_PROBE` o `PERKOS_VOICE_ENROLL`; ninguna
credencial, URL de enrollment o secret entra al chat.

## Errores y verificación

La confirmación no prepara enrollment hasta que el usuario acepta. Si el chat,
la wallet o el runtime no están disponibles, el envío falla sin marcar la
acción como completada y mantiene el panel abierto. El copy manual permanece
como fallback secundario. Las pruebas cubren el prompt de actualización sin
secretos, confirmación antes del envío, envío de cada acción, conservación del
historial y rechazo cuando el chat no puede aceptar el mensaje. Typecheck,
tests focalizados, suite relevante y build de Next son gates del PR.
