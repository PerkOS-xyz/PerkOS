# Knowledge Graph y Agent Execution Graph

## Decisión de producto

PerkOS separa dos historias visuales que no deben mezclarse:

- **Knowledge Graph:** conocimiento persistente y relaciones de una organización o proyecto.
- **Agent Execution Graph:** comunicación, delegación y workflow de los agentes durante el trabajo de un proyecto.

El dashboard muestra el Knowledge Graph de la organización. El overview del detalle de proyecto muestra su Knowledge Graph contextual. El antiguo tab `Map` pasa a presentarse como `Execution` y contiene el Agent Execution Graph de todas las tareas del proyecto.

## Primera entrega

Los grafos reutilizan los datos actuales sin inventar telemetría:

- Organización → proyectos → agentes realmente asignados.
- Proyecto → agentes → tareas.
- Objetivo del proyecto → coordinador → agentes → todas las tareas.
- Estados activos animan discretamente sus conexiones y respetan `prefers-reduced-motion`.
- Cada grafo puede maximizarse y mantiene navegación hacia proyectos y tareas.
- Los componentes aceptan fuentes externas, pero solo muestran nodos cuando existan integraciones configuradas.

## Evolución del modelo

La siguiente etapa debe consumir relaciones tipadas y con procedencia: participantes, documentos, decisiones, artefactos y sistemas externos en Knowledge Graph; handoffs, reintentos, verificadores, human gates, duración y costo en Execution Graph. Hasta que el runtime emita esa telemetría, la UI identifica expresamente que el flujo se deriva del workflow y de las asignaciones actuales.

## Límites de UX

Se limita la densidad inicial para evitar un “hairball”. La exploración detallada debe incorporar filtros, clustering, zoom/pan y expansión progresiva antes de elevar el número de nodos visibles.
