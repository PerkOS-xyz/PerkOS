# Artizen: trabajador bajo demanda y revisión clara

Julio autorizó corregir las inconsistencias observadas en el E2E Dev. Trabajar desde development, sin activar horarios, publicar ni gastar en otra inferencia durante esta corrección.

## Decisión

Mostrar «Hermes bajo demanda» como categoría separada de agentes permanentes y tareas del tablero. No inflar contadores ni crear registros ficticios. Un texto cercano al estado explica que cada ejecución inicia un trabajador temporal y que no pertenece al contador general.

Separar borrador original, edición local y ejemplo aprobado. Mostrar el ejemplo guardado expandido, revisión y relación con la ejecución cuando existe; conservar el original y advertir que editarlo no cambia el ejemplo hasta confirmar el guardado. No etiquetar como aprobado otro borrador por compartir texto.

Sustituir sugerencias libres del modelo por comprobaciones neutrales EN/ES escritas por producto. Aplicar también a resultados históricos sin migrar ni borrar datos. La API refuerza el prompt y omite notas generadas del resultado público nuevo; los borradores siguen requiriendo revisión humana.

## Alternativas

- Registrar un agente permanente: contradice el diseño efímero y añade estado/operación innecesarios.
- Sólo retocar el prompt: no garantiza que una sugerencia futura no presuponga adopción.
- Decisión elegida: categoría explícita y checklist determinista, sin llamadas adicionales.

## Verificación

Tests del componente real para EN/ES, reposo/salida incierta, memoria guardada tras remontaje, origen correcto, edición no guardada y supresión de sugerencias históricas. Mantener confirmaciones web, presupuesto e idempotencia, sin nuevo polling. Comprobar diseño a 390 px y escritorio con fixtures locales identificadas, sin inferencia real. API con regresiones de prompt y normalización/recovery. Publicar PRs a development; desplegar tras merge.
