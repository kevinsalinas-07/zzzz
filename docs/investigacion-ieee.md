# Borrador de investigación (estructura IEEE)

> **Pendiente de investigación y validación del equipo.** Este archivo es una base para preparar el documento IEEE solicitado; no es una investigación terminada ni sustituye las fuentes primarias, mediciones, revisión docente o bibliografía. Completen resultados propios, citas dentro del texto y referencias verificadas antes de enviarlo.

## Sistema web para integrar punto de venta e inventario por recetas en un restaurante con sucursales

**Equipo:** [Nombres y afiliaciones reales de los ocho integrantes]  
**Curso:** Programación Web, ciclo 02-2026  
**Institución:** [Nombre de la institución]

### Resumen

Los restaurantes con varias sucursales deben relacionar ventas, consumos de ingredientes, compras y cierres de caja para mantener la operación visible y coherente. Este trabajo propone diseñar e implementar un prototipo ERP/POS para Restaurante Orígenes SV con API REST, interfaz web y base de datos relacional. Cada venta se valida contra el inventario de su receta y descuenta sus componentes dentro de una transacción; las compras reponen existencias y generan una cuenta por pagar. El prototipo incluye correlativos internos, cálculo de IVA, caja por medios de pago y cálculo quincenal de nómina configurable. El equipo debe completar este resumen con el método, el entorno experimental y resultados medidos de sus pruebas.

**Palabras clave—** ERP, punto de venta, inventario, recetas, transacción, restaurante.

### I. Introducción

Un POS aislado del inventario registra ingresos, pero no necesariamente representa el costo ni el consumo de los ingredientes que intervienen en cada preparación. La integración de las recetas con las existencias permite plantear controles por sucursal y validar la disponibilidad antes de confirmar una orden. El enunciado de la asignatura requiere abordar ventas, facturación, recetas, productos de reventa, alertas, compras, caja y nómina para el contexto salvadoreño [1].

### II. Problema y objetivos

**Problema.** Explicar con evidencia del equipo cómo la separación de registros de ventas, inventario, compras y caja dificulta la conciliación y la reposición de insumos en un negocio de alimentos con varias sucursales.

**Objetivo general.** Desarrollar y evaluar un prototipo web que centralice procesos básicos de ventas, inventario por receta, compras, caja y planilla.

**Objetivos específicos.**

1. Modelar ventas y compras por sucursal con persistencia relacional.
2. Evitar que una venta confirmada deje descontados solo algunos ingredientes cuando falta existencias.
3. Comparar los montos esperados y contados por medio de pago en el cierre de turno.
4. Evaluar el prototipo con casos de prueba reproducibles y datos de demostración.

### III. Diseño de la solución

La arquitectura separa el cliente React, la API Express y PostgreSQL. Las solicitudes de venta ejecutan la validación del turno, el consumo de recetas, el registro de detalle y la asignación del correlativo dentro de una transacción. La base de datos impone restricciones de integridad y cantidades no negativas. La documentación técnica describe las rutas, las reglas y los límites.

### IV. Metodología y evaluación (completar)

Definan un conjunto de pruebas con datos y resultados observables. Incluyan al menos: una venta de latte grande que consuma 18 g de café, 250 ml de leche y tres componentes de empaque; intento de venta con stock insuficiente que no deje movimientos parciales; compra que aumente existencias y cuentas por pagar; secuencia de facturas de consumidor final y CCF; y cierre con diferencia cero y con diferencia distinta de cero.

| Prueba | Entrada | Resultado esperado | Resultado observado |
|---|---|---|---|
| Venta de receta | [Completar] | Consumo exacto por receta | [Completar] |
| Stock insuficiente | [Completar] | Venta revertida sin consumo parcial | [Completar] |
| Compra de insumo | [Completar] | Existencia y cuenta por pagar actualizadas | [Completar] |
| Cuadre de caja | [Completar] | Diferencia por medio de pago | [Completar] |

### V. Resultados y discusión (completar)

Reporten número de pruebas ejecutadas, aprobadas y fallidas; errores encontrados; latencia medida; límites del ambiente; y análisis de los resultados. No presenten métricas sin medición reproducible. Discutan por separado el carácter interno de los correlativos, la integración DTE pendiente y la validación legal de las deducciones de nómina.

### VI. Conclusiones (completar)

Redacten conclusiones basadas en los resultados anteriores y no solo en las funcionalidades implementadas. Incluyan trabajo futuro y limitaciones.

### Declaración de uso de IA

Se utilizó un asistente de IA para apoyar la generación inicial de código y documentación. Los autores verificaron, probaron y comprendieron el material final; deben adaptar esta declaración a las reglas de la institución y describir las tareas específicas en las que se usó la herramienta.

### Referencias

[1] Cátedra de Programación Web, “Proyecto de Cátedra: Desarrollo de Aplicaciones Web, ciclo 02-2026,” enunciado del curso proporcionado para Restaurante Orígenes SV, 2026.

> Añadan fuentes científicas y normativas primarias consultadas por el equipo, en el estilo IEEE; verifiquen títulos, autores, edición, año, páginas y URL/DOI antes de entregar.
