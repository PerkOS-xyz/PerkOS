# Solana: controles antes de habilitar el login

Estado: base de autenticación implementada, lanzamiento bloqueado por compatibilidad.
Decisión del usuario: cuentas independientes; ninguna asociación automática con EVM.

## Implementado y probado localmente

- Shared Types conserva `AddressSchema` exclusivamente EVM y añade validación de
  identidad Solana base58 de 32 bytes. Solo EVM se convierte a minúsculas.
- Dynamic 4.91.6 expone firmas Solana de mensajes en Base64; el verificador usa
  Ed25519 local, sin RPC ni transacciones. No solicitar firmas de transacciones
  como alternativa si una wallet no soporta mensajes.
- API emite un desafío vinculado a wallet exacta, cadena, origen y vencimiento.
  Consume el nonce en transacción antes de emitir el token Firebase.
- La cuenta Solana inicial solo obtiene rol de usuario, sin ECS ni LLM patrocinado.
  Se respeta suspensión y acceso público/allowlist exacta. El flujo de financiación
  EVM no se reutiliza: su compatibilidad sigue pendiente.
- App conserva el flujo EVM local y envía pruebas Solana al proxy de API.
- Ambas banderas están desactivadas por defecto. No se modificaron entornos reales.

## Bloqueos verificados en código

| Área | Consumidores relevantes | Trabajo pendiente |
| --- | --- | --- |
| Persistencia App | `app/lib/perkosApi.ts`, `useUserProfile.ts`, `useWalletAgents.ts`, `useProjectTasks.ts`, `useDocs.ts`, `useProjectMessages.ts` | Sustituir únicamente normalización de identidad y probar rutas exactas. No tocar búsquedas, estados ni nombres de agentes. |
| Identidad y chat App | `conversationsApi.ts`, `chatCache.ts`, `chatClient.ts`, `useConversation.ts`, `edges.ts`, `notifications.ts`, `activityEvents.ts`, `onboardingState.tsx` | Preservar mayúsculas en almacenamiento, claves de caché y participantes. |
| Autorización API | `src/routes/projects.ts`, `src/services/orgMembers.ts`, `src/services/accessControl.ts` y consumidores de wallet en rutas de agentes | Revisar propietario, invitaciones, miembros y permisos usando identidad exacta. No ampliar esquemas de transacciones EVM. |
| Chat | `src/auth.mjs`, `src/router.mjs`, `src/internal.mjs` en PerkOS-Chat | Rechazo actual de UID no `0x`, minúsculas en frames, historial y digest. Actualizar con pruebas de aislamiento entre dos wallets y participantes. |
| Plugins de agentes | PerkOS-A2A y adaptadores de runtimes | Auditar propagación de `forWallet`, respuestas e historial antes de prometer chat funcional. No acceder a hosts privados. |
| Cambio de wallet | `useWalletSession.ts` | Probar cambio EVM/Solana, desconexión y logout mientras hay firma pendiente. La prueba del bridge no acredita el ciclo Firebase completo. |
| Billing y límites | Access, BYOK, cuotas, provisión y server wallets | Conectar una wallet no autoriza infraestructura, patrocinio ni transacciones. No vincular cuentas ni heredar saldos EVM. |

## Secuencia de activación

1. Completar los bloqueos anteriores y pruebas de reglas Firebase/Storage con
   identidades exactas. Confirmar aislamiento y ausencia de acceso cruzado.
2. Reconciliar fuente y artefacto desplegado de producción antes de construir.
   Una observación anterior encontró Privy en producción aunque main usa Dynamic;
   volver a verificar, no asumir que continúa igual.
3. Fijar dependencias compartidas en un commit inmutable revisado e instalar con
   Node 22. No introducir claves RPC en código, logs, documentación o PR.
4. En un entorno de prueba aprobado, habilitar API
   `PERKOS_SOLANA_LOGIN_ENABLED=true` y construir App con
   `NEXT_PUBLIC_SOLANA_LOGIN_ENABLED=true` solo con consumidores compatibles.
   La bandera pública no es un control de seguridad; el gate de API es independiente.
5. El usuario firma con su wallet. Validar login, logout, cambio de cuenta,
   reload, perfil, organización, proyecto, chat e historial. No requiere fondos.
6. Validar EVM, Google/email y Mini App. Confirmar que usuario ordinario requiere
   BYOK y aprobación separada de infraestructura. Sin agentes ni pagos automáticos.
7. Aprobar despliegue y smoke antes de activar producción. Documentar restricciones
   y límites dRPC; CORS no protege una clave contra clientes fuera del navegador.

Rollback: desactivar API impide nuevos nonces y rechaza tokens Solana en middleware;
desactivar App exige reconstrucción y despliegue. No borrar cuentas ni datos. Probar
también accesos directos a Firebase con tokens ya emitidos antes de declarar que un
rollback revoca toda sesión: los flags no modifican las reglas ni revocan tokens.

No realizado: E2E con wallet real, despliegue, apertura de registro Solana, cambios
de Chat/plugins, publicación npm o modificación de credenciales/permisos reales.
