# Login web con Dynamic y políticas de agente

## Decisión autorizada

Migrar el login del navegador de Privy a Dynamic primero en producción; QA y
Dev recibirán después el mismo cambio. El propietario se encarga de los
usuarios existentes: no importar llaves, fondos ni identidades automáticamente.

## Entrega 1: navegador

- Sustituir el adaptador de BrowserWalletContext, conservando firma de nonce,
  Firebase y allowlist. Un login Dynamic no concede permisos en PerkOS.
- Mantener los conectores de Farcaster/Base Mini App sin Dynamic.
- Cargar el SDK solamente en navegador, conservar las redes existentes.
- Google/email y wallets externas se ofrecen según el entorno Dynamic configurado.
- Verificar tipos, tests del adaptador, aislamiento Mini App, build y smoke
  de producción; conservar la imagen previa para rollback.

## Entrega 2: políticas

La delegación actual se indexa por propietario y usuario Dynamic. Antes de
ofrecer límites independientes por agente, exigir coincidencia del agente
autorizado al ejecutar, conservar revocación y evitar reutilizar la delegación
de otro agente. Los límites por transacción no son presupuestos acumulados.
La UI de múltiples agentes y los presupuestos requieren su contrato explícito;
no anunciar enforcement del enclave cuando la regla no fue verificada.

No realizar operaciones reales ni modificar límites o delegaciones activas
para probar. La migración de cuentas queda fuera de esta entrega.
