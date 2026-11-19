# Diseño técnico — Orígenes SV

## Arquitectura

- **Cliente:** React, Vite, React Router y componentes Reactstrap sobre Bootstrap.
- **API:** Node.js y Express, JSON sobre HTTP/REST.
- **Persistencia:** PostgreSQL mediante `pg` y consultas parametrizadas.
- **Validación:** Zod en límites HTTP; restricciones y claves foráneas en PostgreSQL.
- **Autenticación:** JWT con expiración de ocho horas, hash de contraseña bcrypt y límite de intentos de inicio de sesión.

## Módulos y datos

`branches`, `users`, `employees`, `products`, `ingredients` y `recipe_items` describen la operación. `inventory_balances` mantiene existencias por sucursal, con claves únicas parciales para insumos y artículos empacados. `sales`, `sale_items`, `invoices` e `invoice_counters` guardan ventas y correlativos. Compras, líneas y `accounts_payable` reflejan adquisiciones y obligaciones. `cash_shifts` agrupa ventas por turno y medio de pago. `payroll_runs` y `payroll_lines` guardan cada cálculo como una instantánea histórica.

## Reglas principales

- Las ventas y compras ejecutan en una transacción SQL. Un error revierte las líneas, la actualización de existencias y el correlativo.
- El POS combina pedidos repetidos por producto, calcula subtotal y aplica IVA del 13% sobre los precios registrados (precios antes de IVA).
- Los productos con receta descuentan cantidades acumuladas por insumo. Los productos de reventa descuentan existencias por unidad. No se permite inventario negativo.
- El correlativo es independiente por sucursal, documento y año, con bloqueo atómico en PostgreSQL para evitar duplicados concurrentes.
- La caja compara fondo de apertura más ventas en efectivo con el conteo; tarjeta, Bitcoin y Chivo Wallet se comparan por separado.
- La planilla quincenal usa salario mensual dividido entre dos, ISSS al 3%, AFP al 7.25% e ISR según el tramo configurado en `src/server/domain.js`.

## API

Las rutas de negocio requieren `Authorization: Bearer <JWT>`.

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/health` | Estado de la API y conexión a DB |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/branches` | Sucursales activas |
| GET | `/api/dashboard?branchId=` | Indicadores de sucursal |
| GET | `/api/products` | Menú y recetas |
| GET | `/api/inventory?branchId=` | Existencias y alertas |
| GET / POST | `/api/purchases` | Listar y registrar compras |
| GET | `/api/suppliers` | Proveedores activos |
| GET | `/api/cash/status?branchId=` | Turno activo y totales |
| POST | `/api/cash/open`, `/api/cash/close` | Apertura y cierre de turno |
| POST | `/api/sales` | Registrar venta y comprobante interno |
| GET / POST | `/api/employees` | Consultar y registrar empleados |
| GET / POST | `/api/payroll` | Consultar y generar planillas |

## Seguridad, configuración y operación

- No se almacenan contraseñas en texto claro; `ADMIN_PASSWORD` solo se utiliza para crear el primer usuario.
- Las consultas usan parámetros, los esquemas validan la entrada y el JSON entrante tiene un límite de tamaño.
- `helmet` agrega encabezados de seguridad; CORS queda limitado al origen configurado en `APP_ORIGIN`.
- Los secretos locales se guardan en `.env`, que está excluido de Git.
- Configure respaldo y restauración probada de PostgreSQL, TLS, rotación de secretos y alertas antes de producción.

## Límites pendientes para producción

1. Integrar y certificar DTE de Hacienda (firma, ambiente de pruebas/producción, contingencia, anulación y almacenamiento legal). Los correlativos del prototipo no reemplazan esos requisitos.
2. Validar con documentación oficial vigente y asesoría contable las tablas ISR, bases, topes de ISSS/AFP, excepciones y redondeos. La tasa de IVA de venta está fijada al 13% por el enunciado.
3. Agregar gestión de roles y usuarios, pagos parciales de proveedores, auditoría de movimientos de inventario, devoluciones, cierres históricos consultables y pruebas de integración con PostgreSQL.
4. Desplegar sobre infraestructura con HTTPS, secretos administrados, respaldos cifrados, monitoreo y un procedimiento de recuperación.

## Asistencia de IA

Se utilizó un asistente de IA para apoyar la implementación y la documentación inicial. El equipo debe verificar todo el código, validar los cálculos con fuentes oficiales, ejecutar las pruebas y declarar esta asistencia en la bibliografía IEEE requerida por el curso. La defensa debe reflejar comprensión propia del sistema.
