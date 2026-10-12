# Creators: presentación independiente y compatibilidad

## Decisión aprobada

Julio aprobó sustituir la marca anterior por **Creators** en App, Admin,
plantillas, formularios, páginas públicas y textos del agente. Se eligió esta
capa de presentación frente a una migración completa de bases de datos y AWS.
La implementación no borra historia ni cambia presupuestos, autoridad o datos
introducidos por usuarios. No se publica ninguna acusación sobre terceros.

## Arquitectura

- API ofrece `/creators-projects`, `/creators-hooks` y
  `/admin/creators-pilot`, conservando las rutas anteriores con idénticos
  controles de autenticación, autorización, coste e idempotencia.
- El template, el modo de ejecución, las claves de respuestas, los contratos
  del proveedor y los IDs de agentes/colecciones permanecen estables.
- Los templates antiguos reciben una proyección de presentación al leerlos:
  nombre/textos Creators y pregunta URL HTTPS de proyecto genérica. No se
  sobrescriben revisiones publicadas ni respuestas/historial existentes.
- Nueva validación `project-url` acepta HTTPS sin credenciales embebidas. La
  validación anterior sigue siendo legible; el template canónico utiliza la
  validación genérica al crear/configurar nuevos proyectos.
- App usa las rutas Creators, etiquetas/accesibilidad/errores legibles y
  nombres de presentación para agentes bajo demanda; las identidades usadas
  para despachar y autorizar no se modifican.
- `/creators` es la página pública genérica. `/artizen` redirige con307.
- Admin usa `/creators-pilot`; la ruta anterior redirige. El editor conserva
  las claves de cuestionario, pero presenta etiquetas y validación genéricas.
- Las URLs de webhook recién emitidas usan el alias Creators. Webhooks y
  firmas existentes siguen funcionando sin rotación ni cambio de HMAC.

## Límites

No migración Firestore/AWS, backfill, cambio de owner o permisos, nueva
inferencia, publicación externa, agente privado, gateway, scheduling o
presupuesto. Los identificadores de compatibilidad pueden seguir existiendo
en código/contratos internos; no se promete eliminarlos de todo el repositorio.
Textos escritos por usuarios y documentos históricos no se reescriben.

## Plan y verificación

1. API: proyección de templates, validación HTTPS genérica, aliases y errores.
2. App: página pública, formulario/errores/etiquetas y rutas Creators.
3. Admin: navegación/página/editor/feedback y redirect compatible.
4. Pruebas unitarias/componentes de ausencia de marca en contenido visible,
   compatibilidad de IDs/respuestas/rutas antiguas, rechazo de URL insegura y
   ausencia de cambios de datos/autoridad/contabilidad por lectura.
5. Typecheck/build, PRs separados y CI. Aceptación primero Dev; QA/Producción
   requieren sus propios gates, sin despliegue automático al crear PR.

## Base de trabajo

Worktree limpio reutilizado, rama `feature/creators-branding`, desde el SHA
App que actualmente corre en Dev `74a7b9917afc05f23c3fbdca9618570274e34b36`.
El checkout original con cambios de Julio permanece intacto. La rama remota
development divergente no se despliega sobre las protecciones AP02 actuales.
