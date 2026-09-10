# Artizen V2: aviso persistente de revisión de formato

## Contexto

La API conserva una salida legible de `artizen-update-v2` y la marca como
`needs-review` cuando los bloques no cumplen completamente el contrato. La UI
sólo reconoce `artizen-update-v1`, de modo que el diagnóstico desaparece al
recargar aunque el borrador y su evaluación sigan persistidos.

## Alternativas consideradas

1. Mostrar un aviso genérico para cualquier `needs-review`. Es pequeño, pero no
   explica qué debe revisar la persona.
2. Reconocer V2 y explicar sus reglas. Es la opción elegida: mantiene
   compatibilidad V1, describe 2 párrafos por 3 oraciones de 15–20 palabras y
   deja claro que el original fue conservado sin otra inferencia.
3. Regenerar o reparar automáticamente. Se descarta porque añade costo, puede
   alterar hechos y rompe la garantía de una sola llamada.

## Diseño

`FormatReview.contract` acepta V1 y V2. Ambos contratos muestran conteos
persistidos, estado y problemas; `structured_output_invalid` usa texto específico
para V2 y el estado fallido recibe tratamiento visual ámbar con `role="alert"`.
No se añade ningún botón ni mutación. La ayuda previa al formulario también
describe V2 para que las preferencias de redacción no parezcan capaces de
cambiar su estructura.

## Verificación

Pruebas bilingües deben comprobar que V2 reaparece después de cargar el estado,
explica 2×3 y 15–20 palabras, conserva el conteo total y no ofrece una acción de
regeneración. Las pruebas V1 y resultados legacy continúan sin cambios.
