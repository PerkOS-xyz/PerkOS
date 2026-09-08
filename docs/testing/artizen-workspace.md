# Artizen: proyecto y agente bajo demanda

Identidad estable Hermes, sin servicio ECS permanente ni credenciales de chat/voz. Cada ejecución del controlador presupuestario se refleja en una tarea canónica. Los resultados se revisan antes de aprobar un ejemplo; la aprobación no publica contenido.

## Pruebas

- `npm test`: incluye UI de asociación explícita, tareas de sólo lectura y comportamiento en reposo.
- Con Java 17+ y Node 22, ejecutar reglas contra un proyecto ficticio local:

```sh
npx --yes --package=firebase-tools@13.35.1 firebase emulators:exec --only firestore --project demo-artizen-workspace --config firebase.rules-test.json 'npx vitest run tests/artizenFirestoreRules.test.ts'
```

La suite carga el archivo real de reglas y verifica lectura autorizada, bloqueo de aprobación/modo/roster desde el cliente, aislamiento entre propietarios y conservación de operaciones normales. Sin emulador estos tres casos se omiten explícitamente; no cuentan como aprobados en `npm test`.

## Rollout Dev tras revisión

1. Desplegar API con proyección canónica y guards; preservar flags, presupuesto y configuración del runtime.
2. Publicar `firestore.rules` **sólo al proyecto Firebase Dev verificado**. No usar el alias default sin comprobar el destino.
3. Desplegar App. Abrir proyecto Artizen existente y confirmar «Asociar Hermes al proyecto». Registra identidad y hasta20 ejecuciones históricas, sin gasto ni inferencia.
4. Comprobar un agente/responsable, membresía bidireccional y una tarea por ejecución histórica; sin duplicados al repetir o recargar.
5. Una prueba manual dentro del presupuesto autorizado: tarea Por hacer → En curso → Revisión, resultado persistido tras salir/volver/recargar, runtime detenido y reserva cero. No aprobar automáticamente el borrador. Aprobar un ejemplo por separado marca Completada.

Las rutas genéricas de despertar, chat, planificación y edición de tareas no ejecutan este template. El trabajo se inicia únicamente mediante su formulario con confirmación presupuestaria. Horarios, webhooks, voz y QA/producción permanecen fuera del rollout.

Si se revierte App, conservar los guards de API y reglas: la interfaz anterior no debe poder saltarse el controlador. No borrar identidades ni tareas para ocultar una regresión.
