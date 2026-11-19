# Manual de usuario — Orígenes SV

## Acceso

1. Inicia PostgreSQL y la aplicación según el `README`.
2. Accede con el correo y la contraseña de administrador configurados en `.env`.
3. Selecciona la sucursal en la barra superior. Los informes y operaciones usan esa sucursal.

## Abrir caja

Antes de cobrar, entra a **Caja y turnos**, ingresa el fondo inicial y selecciona **Abrir turno**. El sistema no permitirá registrar ventas si no hay caja abierta.

## Registrar una venta

1. Abre **Punto de venta** y agrega los artículos.
2. Revisa subtotal e IVA del 13%.
3. Selecciona factura de consumidor final o CCF y el medio de pago.
4. Selecciona **Cobrar y emitir factura**. Guarda el correlativo mostrado.

Una venta consume los ingredientes de la receta o una unidad de cada producto empacado, crea el registro de venta y reserva el correlativo en una sola transacción. Si el stock no alcanza, la venta se rechaza completa.

## Revisar existencias

En **Inventario y recetas** consulta la cantidad disponible y los mínimos. Las alertas resaltan ingredientes por debajo del mínimo y productos empacados con cinco unidades o menos. La receta de latte grande usa 18 g de café, 250 ml de leche, vaso de 16 oz, tapadera y viñeta.

## Registrar compras

En **Compras y proveedores**, selecciona proveedor, número de factura, fechas y artículos. Cada línea puede ser un insumo de receta o un producto empacado. Confirma la cantidad y el costo unitario antes de registrar. La compra crea la cuenta por pagar y aumenta existencias.

## Cerrar caja

El panel de caja muestra ventas por forma de pago y efectivo esperado (fondo de apertura más ventas en efectivo). Ingresa los montos contados de cada medio y cierra el turno. La diferencia se calcula contra las ventas registradas y queda guardada.

## Administrar personal y planilla

1. Registra cada empleado con puesto y salario mensual.
2. Selecciona el período quincenal y genera el cálculo.
3. Revisa bruto, ISSS, AFP, ISR y neto antes de utilizar los resultados.

La planilla es una herramienta académica de cálculo, no una liquidación certificada. Verifica los límites y tablas legales del período antes de efectuar pagos.

## Cambiar contraseña

1. En la navegación lateral, abre **Seguridad**.
2. Ingresa tu contraseña actual y la nueva contraseña dos veces.
3. La nueva contraseña debe tener al menos 12 caracteres. Selecciona **Actualizar contraseña**.

Al completar el cambio, tu sesión actual continúa activa y las demás sesiones se invalidan.

## Cerrar sesión

Usa **Cerrar sesión** en la navegación lateral. Los tokens vencen a las ocho horas; vuelve a ingresar si la sesión expira.
