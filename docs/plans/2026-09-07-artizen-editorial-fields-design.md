# Artizen: campos separados para hechos y redacción

El usuario aprobó corregir el borrador que copiaba instrucciones editoriales. Mantener el campo de hechos `notes` (4000 caracteres) y añadir un textarea opcional de preferencias `editorialNotes` (1000): tono, extensión y formato, sin añadir hechos. Etiquetas, ayuda y checklist EN/ES; diseño apilado responsivo, labels explícitos y ayudas aria-describedby. Mantener el estado local de ambos campos y el modal web de confirmación de costo.

Enviar preferencias sólo si no están vacías para compatibilidad con payload anterior. Incluirlas en el fingerprint local: ante respuesta incierta, un cambio de preferencias no dispara otra ejecución silenciosa. Las preferencias por sí solas no sustituyen los hechos obligatorios. Sin autosave, nuevas consultas, reintentos LLM o cambios en aprobación/memoria.

Alternativas: prompt solo no elimina la mezcla en el formulario; limpieza LLM adicional aumenta el costo. Campos separados más política server-owned resulta verificable sin esa llamada. No afirmar que el modelo nunca copiará instrucciones: checklist humano también pide revisar eso.

Regresión: etiquetas/ayudas y longitudes EN/ES, payload prepare/revise separado, omisión vacía, bloqueo sin hechos, idempotencia frente a cambios tras respuesta incierta, idle sin polling. Comprobar layout móvil y desktop. Desplegar API compatible antes de App tras revisión/merge; una sola prueba real Dev dentro del presupuesto original. QA/producción, horarios/webhooks, Voice y publicación fuera de alcance.
