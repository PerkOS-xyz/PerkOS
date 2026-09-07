# Etiquetas legibles en respuestas de templates

## Alcance

Pulido de la implementación de Artizen ya aprobada: el resumen del wizard y
la configuración persistida deben mostrar la etiqueta localizada de una opción,
no su código (`en`, `x`). No modifica respuestas, revisiones, API ni ejecución.

## Decisión

Usar un formateador compartido basado en las opciones de la revisión del template.
Duplicar mapas de etiquetas en los componentes permitiría inconsistencias;
guardar etiquetas traducidas en la API rompería los valores canónicos.
Los valores desconocidos se muestran literalmente para no ocultar información;
las respuestas opcionales vacías mantienen el indicador «—».

La galería publicada ya aparece antes de los equipos de negocio en código y Dev:
no necesita reordenamiento. El perfil sigue separado de proyectos y agentes.

## Verificación

Probar etiquetas EN/ES, variantes regionales, fallback al inglés, valores
desconocidos y texto libre; comprobar ambos componentes y que el POST conserva
los códigos originales. El piloto permanece configurado, sin activar Hermes.
