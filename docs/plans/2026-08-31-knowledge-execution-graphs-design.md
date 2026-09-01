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

## Follow-up 3D interactivo

Las referencias visuales confirmaron que la experiencia objetivo es un grafo
force-directed tridimensional, no un diagrama radial. El renderer usa
Three.js/WebGL mediante `react-force-graph-3d` y ofrece rotación libre con
mouse o touch, zoom con rueda o gesto pinch, drag de nodos y selección.

La primera métrica de influencia es el grado de conectividad: los nodos con más
relaciones son mayores. El color comunica el tipo o cluster y los enlaces activos
usan partículas direccionales. Al seleccionar un nodo, el resto del grafo baja
de intensidad, se resaltan sus vecinos directos y aparece un panel contextual.

La evolución analítica seguirá los patrones validados en el research de Nodus
Labs: comunidades reales, centralidad, nodos puente, gaps estructurales, filtros
por umbral y evolución temporal. Estas métricas no se simulan en cliente: deben
provenir del modelo de relaciones y de telemetría confiable.

## Execution con bloques 3D

El tab `Execution` prioriza legibilidad operativa sobre la estética de una nube
de nodos. La meta del proyecto, el coordinador, los agentes y las tareas se
distribuyen en carriles tridimensionales de izquierda a derecha. Agentes y
tareas usan bloques con contorno e identificación persistente; los conectores
tienen flecha, color de responsable y partículas cuando el trabajo está activo.

Las tareas se agrupan alrededor del agente asignado. El usuario puede rotar,
hacer zoom, seleccionar un bloque, aislar vecinos y abrir el detalle de la
tarea. La posición por carriles es estable para que el flujo siga siendo
comprensible tras rotar la escena, mientras la profundidad evita solapamientos.
Esta vista continúa derivándose de asignaciones y estados actuales: no representa
handoffs o mensajes que el runtime todavía no haya publicado.

## Composición del overview de proyecto

En desktop, el encabezado y sus acciones conservan todo el ancho. Debajo se usa
una composición 60/40: el Knowledge Graph ocupa la columna izquierda y la
información del proyecto ocupa la derecha, con objetivo, métricas y carga del
equipo. El grafo conserva su control de maximizar sin alterar los tabs.

En pantallas menores se apilan las columnas: primero la información operativa y
después el grafo, para evitar que WebGL retrase el acceso al estado esencial. La
navegación por tabs permanece debajo del conjunto en todos los breakpoints.
