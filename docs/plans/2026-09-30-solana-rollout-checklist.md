# Solana: controles antes de habilitar el login

Estado: base de autenticación implementada, lanzamiento bloqueado por compatibilidad.
Decisión del usuario: cuentas independientes; ninguna asociación automática con EVM.

## Estado actualizado (01-10, capacidades UI)

Actualización de empaquetado: App381 y A2A107 fusionados. El workflow A2A
36873764354 informa publicación exitosa de 0.12.69; verificar disponibilidad
del registro antes de actualizar consumidores. Storage productivo releído:
su lógica coincide con la fuente probada (solo cambian comentarios/espacios),
sin despliegue necesario. Artefactos web/API actuales aún no incluyen Solana.

Preflight Docker detectó Git ausente en las imágenes mínimas App/API y flag
Solana no propagado al build web. La corrección usa el mismo commit Shared Types
por HTTPS, instala Git donde se necesita y expone el flag con default false en
los tres Compose. El contexto App excluye entornos/credenciales locales. CI
construye imágenes reales, además de las pruebas de código, con datos sintéticos.
No se modifican flags reales, permisos, versiones del contrato ni cuentas.

Esta sección sustituye los pendientes históricos de merge enumerados más abajo.

- Fusionados App #380, API #303/#304, Tools #14, A2A #106 y Chat #15.
  No equivale a servicios desplegados ni login habilitado.
- UI: cuentas no EVM no montan firmas, pagos, server wallets ni anclaje de recibos
  EVM. Avisos en ocho idiomas explican las restricciones y cuentas independientes.
  AccessGate exige código para Solana; el flujo EVM sin código permanece disponible.
- Wallet usa identidad unificada Dynamic/Mini App, con consulta server wallet
  particionada por cuenta EVM. Lecturas de recibos conservan Solana exacto.
  Resolución de avatares EVM rechaza otras identidades antes de consultar/escribir.
- A2A 0.12.69 todavía no publicado: workflow `36828215536` falló antes de publicar
  por `EALLOWGIT` tras actualizar npm a latest. Corrección en revisión fija npm
  11.20.0 y permite únicamente dependencias Git directas, en CI y publicación.
- Pendientes: revisión/merge de esta UI y corrección de publicación, publicación
  A2A, despliegue coordinado, Storage activo/dRPC/artefactos y E2E con firma real.
  No se alteraron flags, cuentas, códigos de campaña, agentes ni pagos reales.

## Continuación de workspace (30-09)

Base fusionada: App #377, API #302 y Shared Types #7. Esta continuación no activa
banderas ni despliega servicios. No confundir merge de código con login usable.

- App: identidad exacta en las rutas de datos de perfil, proyectos, miembros,
  tareas, documentos, conversaciones, menciones y cachés. Miembros y menciones
  incluyen la cuenta actual en su query key; Dynamic participa en las menciones.
- API: proyectos/organizaciones y sus miembros conservan el caso, incluida la
  autorización de lectura/escritura, mirrors y resolución de perfiles.
  La comprobación live de capacidades usa la misma política Solana inicial:
  allowlist exacta/modo público, suspensión prioritaria, sin admin/ECS/LLM/VPS
  ni consulta al saldo EVM. Esto no implementa billing Solana.
- Chat: claims Solana verificadas detrás de un gate independiente cerrado,
  frames y digests exactos, historial/recibos restringidos al history host y
  a participantes actuales. Sin persistir cuerpos de mensajes en Firestore.
- A2A: un único parser EVM/Solana para los dos bridges, scope de conversación y
  contexto del dispatcher sensibles al caso. No publicación npm ni actualización
  de agentes reales; Platform Tools y el resto del ciclo siguen por revisar.
- Sesión App: una firma por generación de cuenta, cancelación de prompts/HTTP
  obsoletos y commits Firebase serializados con limpieza antes de cambiar de UID.
  Logout compartido entre consumidores, sin relogin automático si falla la salida
  del proveedor; restauración, unmount y reintento explícito cubiertos en pruebas.
- Caché Chat: IndexedDB v2 con clave `[walletAddress, convId, id]`, migración
  transaccional de v1 y conexiones cerradas. Borrado/poda limitados al scope exacto.
  Una pestaña v1 antigua puede bloquear la migración: cerrarla y recargar. Un fallo
  revierte toda la migración, no borra la base anterior. No se puede reconstruir el
  caso de una dirección Solana que ya hubiera sido alterado por código histórico.
- Verificación local anterior: App 658 correctas/3 omitidas; API 1771/2; A2A 231/0;
  cuatro grupos de pruebas Chat correctos. Compilaciones App/API/A2A correctas.
  App usa Firebase sintético y flag local de compilación, sin credenciales reales.

Pruebas nuevas App: 24 regresiones de sesión/coordinador/autenticación y 11 de
IndexedDB usando fake-indexeddb 6.2.5 (solo desarrollo). Incluyen StrictMode,
consumidores simultáneos, EVM Mini App y cambios EVM/Solana durante firma/commit.
Son pruebas locales con proveedores y Firebase simulados, no E2E con wallets reales.
Verificación final de esta revisión: App 693 correctas, 3 omitidas; lint de archivos
modificados, TypeScript y build Next correctos. Sin despliegue ni activación.

Pendiente antes de habilitar: verificar Storage desplegado, rutas de agentes y recursos, Platform Tools,
billing/BYOK/límites, E2E real con recarga y permisos, artefacto productivo y dRPC.
Verificar también logout/cambio de wallet y migración IndexedDB en navegador real,
incluida interacción entre pestañas con Firebase persistido. La partición del caché
no es una frontera de autorización ni impide acceso local al perfil del navegador.

## Canje de acceso Solana (01-10)

- App #378 y #379 están fusionados. API #303, Chat #15 y A2A #106 continúan
  pendientes; esta implementación no enciende flags ni despliega servicios.
- El formulario usa un desafío Ed25519 de un solo uso con propósito exclusivo
  `redeem-access-code`. API verifica la firma antes de canjear, conserva base58
  exacto y aplica límite/cupo, suspensión y unicidad del usuario en transacción.
- Una firma de login no sirve para canjear ni viceversa. Reintentos no duplican
  cupos ni restauran una entrada eliminada. No concede infra, LLM o saldo.
- La App cancela esperas al cambiar/desconectar la wallet y conserva el endpoint
  EVM existente. No consume ningún código real durante las pruebas.
- Verificación: API 1782 correctas/2 omitidas; App 706 correctas/24 omitidas;
  TypeScript y builds correctos. Incluye concurrencia por el último cupo,
  firmas Ed25519 reales generadas en memoria, replay y cancelación de firma.
- El canje implementado no equivale a login activado. Quedan rutas de agentes
  y billing con normalización EVM; deben corregirse o rechazar Solana de forma
  explícita antes de abrir el acceso. Falta E2E con wallet real y servicios
  coordinados desplegados. El formulario sin código sigue siendo EVM-only.

## Reglas Firestore y Storage: validación local (30-09)

- `npm run test:rules` inicia ambos emuladores, ejecuta las suites wallet y Artizen
  y los detiene al finalizar. Firebase CLI 13.35.1 fijada, Node 22/Java 17, proyecto
  ficticio `demo-artizen-workspace`. Los tests rechazan hosts no loopback; ninguna
  credencial, cuenta, saldo o archivo real participa. CI ejecuta el mismo comando.
- 31 pruebas del bloque correctas, sin omitidas: 7 del guard local y 24 de reglas,
  incluidas las 3 regresiones Artizen existentes. Cobertura de UID exacto EVM/Solana,
  variantes base58 válidas con distinto caso, roles viewer/editor, revocación,
  escalamiento por roster/orgId, enumeración, archivos privados, avatares públicos
  y límites de 25/5 MiB. Admin SDK continúa escribiendo datos canónicos.
- Cuatro pruebas rojas antes de corregir reprodujeron tres familias de permisos
  aditivos excesivos: créditos/ledger editables por el dueño, recibos reescribibles
  y cuerpos privados de chat permitidos en Firestore. El wildcard ahora excluye
  esas escrituras; conversaciones solo conceden acceso a metadata y recibos usan
  la regla específica de creación/anclaje único. Lectura propia de billing sigue.
- Actualización 01-10: Firestore de producción fue desplegado con autorización
  y verificado por hash remoto a las 05:19 UTC. SHA-256:
  `93cf92928551274059f4b73f010591f5ea20600dc2ac32bf8eed809edbb1502d`.
  Dashboard/proyecto siguen legibles. No se investigó abuso histórico ni se hizo
  una prueba productiva de escritura con dos miembros. Storage no fue desplegado.
- Storage mantiene enlaces de descarga como capacidades compartibles. Los tests
  comprueban permisos del SDK por UID, no revocación de enlaces ya divulgados.
- Estas reglas no consultan el flag Solana de API. Apagar ese flag no revoca
  sesiones Firebase emitidas ni cambia por sí solo la política de Storage.

Referencia del harness: [Firebase Rules unit tests](https://firebase.google.com/docs/rules/unit-tests).

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

## Inventario inicial (progreso de esta continuación arriba)

| Área | Consumidores relevantes | Trabajo pendiente |
| --- | --- | --- |
| Persistencia App | `app/lib/perkosApi.ts`, `useUserProfile.ts`, `useWalletAgents.ts`, `useProjectTasks.ts`, `useDocs.ts`, `useProjectMessages.ts` | Sustituir únicamente normalización de identidad y probar rutas exactas. No tocar búsquedas, estados ni nombres de agentes. |
| Identidad y chat App | `conversationsApi.ts`, `chatCache.ts`, `chatClient.ts`, `useConversation.ts`, `edges.ts`, `notifications.ts`, `activityEvents.ts`, `onboardingState.tsx` | Preservar mayúsculas en almacenamiento, claves de caché y participantes. |
| Autorización API | `src/routes/projects.ts`, `src/services/orgMembers.ts`, `src/services/accessControl.ts` y consumidores de wallet en rutas de agentes | Revisar propietario, invitaciones, miembros y permisos usando identidad exacta. No ampliar esquemas de transacciones EVM. |
| Chat | `src/auth.mjs`, `src/router.mjs`, `src/internal.mjs` en PerkOS-Chat | Rechazo actual de UID no `0x`, minúsculas en frames, historial y digest. Actualizar con pruebas de aislamiento entre dos wallets y participantes. |
| Plugins de agentes | PerkOS-A2A y adaptadores de runtimes | Auditar propagación de `forWallet`, respuestas e historial antes de prometer chat funcional. No acceder a hosts privados. |
| Cambio de wallet | `useWalletSession.ts`, `walletSignInCoordinator.ts` | Cobertura local de cambios EVM/Solana, firma/commit pendientes, logout y Mini App; falta E2E real y múltiples pestañas. |
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

No realizado: E2E con wallet real, despliegue de servicios Solana, apertura de registro Solana,
publicación npm o modificación de credenciales/permisos reales. Chat y A2A tienen
cambios locales coordinados, todavía no están instalados en los servicios/agentes.
