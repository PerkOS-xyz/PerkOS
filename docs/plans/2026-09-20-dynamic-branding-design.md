# Identidad PerkOS en Dynamic

El propietario solicita continuar la migración y que la interfaz de wallet
muestre el logo de PerkOS y la información necesaria.

Se usa la marca común PerkOS en el entorno Live compartido con Floor, conservando
el nombre administrativo del proyecto y su environmentId. No se cambia Stack.
Dashboard: nombre visible, logo HTTPS existente y enlace de ayuda a la comunidad
oficial. App: nombre/logo explícitos y enlace de privacidad existente, tema oscuro.
Así la marca no depende exclusivamente del dashboard ni sólo del componente web.

Alternativas: sólo dashboard simplifica mantenimiento pero permite diferencias
por overrides; sólo código deja otras pantallas sin identidad. Se eligen ambas
capas, manteniendo los flujos de seguridad del proveedor sin CSS estructural.

No se inventan términos, contactos ni garantías sobre límites. La política de
privacidad existente es un aviso del sitio y necesita una revisión separada de
cobertura de wallets/autenticación. No se redacta ni sustituye texto legal aquí.

Verificación: logo y privacidad responden HTTP 200; pruebas de props del proveedor,
tipos/build; confirmar persistencia de configuración en dashboard y hacer smoke
visual del modal. No firmar transacciones ni crear delegaciones para esta prueba.
