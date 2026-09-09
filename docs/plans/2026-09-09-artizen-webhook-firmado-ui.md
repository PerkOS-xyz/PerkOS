# UI del webhook one-shot de Artizen

## Objetivo

Dar al propietario una forma entendible de preparar una activación externa sin confundirla con publicación automática o recurrencia. La interfaz debe mantener la seguridad y el costo visibles, y no exponer la credencial después de abandonar el diálogo inicial.

## Decisión

El workspace de Artizen incorpora una sección compacta “Webhook de una ejecución” junto al scheduler. Cuando la API anuncia la capability, el usuario puede armarla mediante un diálogo web que explica que el siguiente evento válido podrá reservar hasta el máximo de la ejecución y que Hermes volverá a reposo. La operación no llama al modelo.

Al crear o rotar, un segundo diálogo muestra URL y secreto una sola vez, con botones explícitos para copiar. El estado persistido sólo comunica `disabled`, `armed` o `consumed`; nunca vuelve a enviar el secreto. Rotar invalida inmediatamente la URL anterior. Deshabilitar exige confirmación y no cancela una ejecución que ya fue admitida.

La UI explica el contrato mínimo para la fuente: JSON con un ID único, hechos confirmados y preferencias opcionales, timestamp reciente y firma HMAC. No intenta firmar eventos ni almacena la credencial en el navegador. Un evento inválido o repetido no debe crear un nuevo borrador. El resultado aparece en el mismo panel de revisión humana y nunca se publica automáticamente.

## Verificación

Pruebas de componente cubrirán ocultamiento fail-closed, confirmaciones, secreto visible sólo en la respuesta de rotación, estados armed/consumed, copia y ausencia de llamadas de generación al configurar. El E2E Dev verificará responsive básico, persistencia del estado y la transición a un único borrador después del evento firmado.
