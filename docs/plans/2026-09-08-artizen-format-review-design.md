# Revisión visible del formato original Artizen

Diseño aprobado: template explícito de dos párrafos y90–120palabras; preferencias
para tono/estilo, nunca parser libre que controle permisos o formato de proveedor.
API congela ese contrato en nuevas ejecuciones; UI muestra formato sólo si API lo
declara. Contrato de evaluación opcional permite leer históricos sin inventar PASS.

Mostrar número de párrafos/palabras e incidencias del original, EN/ES y accesible.
Un PASS sólo cubre esos controles: hechos y redacción requieren revisión humana.
Si se edita, indicar que el diagnóstico del original no evalúa los cambios.
No recalcular ni guardar en segundo plano, no consultas/polling nuevos. Ningún
botón de regeneración automática. Edición manual gratis de inferencia; revisión
con Hermes conserva confirmación de reserva, aprobación explícita y no-publicación.

Preferido sobre ocultar borradores inválidos o rellenarlos/cortarlos: conservar
texto y evidencia. Errores inutilizables siguen la alerta existente de ejecución
sin borrador válido, sin retry. Mostrar evaluación también en borradores previos
que ya la tengan; no migrar los anteriores a esta feature.

Pruebas EN/ES, cifras/incidencias, compatibilidad legacy, edición sin POST, aviso
de cambios locales y contrato visible. No deploy en este PR. Coordinar API/LLM
antes del E2E Dev y documentar resultado real, sin proclamar calidad por tests.

Regla confirmada: fuera del grupo de pruebas cada usuario aporta su propia API
key LLM. El template no implica cómputo patrocinado. Antes de apertura general,
onboarding debe exigir proveedor/clave válida y explicar su coste, sin fallback
a claves PerkOS. Este PR no implementa BYOK ni amplía acceso al piloto; no guardar
claves en prompts, notas, logs ni almacenamiento local del navegador.
