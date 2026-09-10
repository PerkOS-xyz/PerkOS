# Artizen: programación única y espera sin polling

Se conserva Preparar borrador inmediato y se añade Programar una vez sólo si la
API anuncia la capacidad. El formulario usa fecha/hora local del navegador,
valida el rango de un minuto a 24 horas y muestra la fecha con zona horaria en
el diálogo web de confirmación. No activa recurrencia ni publica contenido.

La confirmación explica que reserva presupuesto y el cupo del proyecto ahora;
las notas se guardan al confirmar y no se recapturan silenciosamente al arrancar.
El mismo identificador idempotente se reutiliza ante respuesta incierta.

Un pendiente muestra «Programado · Hermes en reposo», fecha y cancelación con
confirmación web. Cancelar conserva los borradores anteriores. Si ganó el
arranque, la API rechaza la cancelación y la UI pide actualizar. El identificador
cancelado queda fijado al abrir el diálogo, sin apuntar a otro trabajo posterior.

Mientras espera no se sondea la API cada cinco segundos: se arma un timer local
y se revalida el reloj al recuperar visibilidad. Al llegar la hora vuelve el
seguimiento existente, incluida la lectura final conjunta de resultado y saldo
de PR355. El servidor ejecuta aunque el navegador esté cerrado.

Pruebas EN/ES: confirmación/payload, API antigua sin capacidad, fecha inválida,
recarga de pendiente sin polling, comienzo del seguimiento a la hora y cancelación.
Se mantienen las pruebas del flujo inmediato, revisión humana y liquidación.

Desplegar primero la API correspondiente y luego App en Dev después del merge.
La prueba real única sigue pendiente; el código y los mocks no demuestran un
nuevo ciclo ECS real ni generan consumo del modelo. QA/prod quedan fuera.
