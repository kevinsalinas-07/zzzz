# Restaurante Orígenes SV — ERP y POS

Aplicación web de referencia para administrar ventas, recetas e inventario, compras y cuentas por pagar, caja por turno, personal y planilla quincenal en más de una sucursal.

## Requisitos

- Node.js 20.19+ o 22.12+
- Docker Desktop con Docker Compose

## Inicio rápido

1. Copia `.env.example` a `.env` y define `JWT_SECRET` (mínimo 32 caracteres) y una contraseña de administrador de al menos 12 caracteres. En PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Inicia PostgreSQL:

   ```powershell
   docker compose up -d db
   ```

3. Instala dependencias e inicia el cliente y la API:

   ```powershell
   npm install
   npm run dev
   ```

4. Abre `http://127.0.0.1:5173` e inicia sesión con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

El esquema y los datos de demostración se preparan al arrancar la API. El API responde en `http://127.0.0.1:3000/api`; el cliente usa el proxy de Vite durante desarrollo. Para producción, ejecuta `npm run build` y después `npm start`. Configura secretos únicos, HTTPS, copias de seguridad y un PostgreSQL administrado antes de publicar.

Docker publica PostgreSQL en el puerto `5433` del equipo para evitar conflictos con instalaciones locales que ya usen `5432`; la URL correspondiente viene configurada en `.env.example`.

## Funcionalidad

- POS con menú inicial de 12 productos elaborados y dos productos empacados de reventa.
- Factura de consumidor final o CCF con correlativos por sucursal, tipo de documento y año; IVA de venta del 13%.
- Recetas con consumo transaccional de ingredientes; reventa con descuento por unidad y alertas de stock mínimo.
- Compras de insumos y artículos empacados con actualización de inventario y saldo en cuentas por pagar.
- Apertura y cierre de caja con comparación de efectivo, tarjeta, Bitcoin y Chivo Wallet.
- Empleados y planillas quincenales con ISSS, AFP e ISR.

## Validación

```powershell
npm test
npm run build
```

Consulta [la guía de usuario](docs/manual-usuario.md), [el diseño técnico](docs/diseno-tecnico.md), [el borrador de investigación IEEE](docs/investigacion-ieee.md) y [la plantilla de seguimiento del equipo](docs/seguimiento-equipo.csv).

## Alcance legal y contable

Los correlativos y comprobantes generados son internos para el prototipo: no son Documentos Tributarios Electrónicos (DTE) autorizados por el Ministerio de Hacienda. Antes de emitir documentos fiscales reales hay que integrar y certificar el flujo DTE vigente. Los porcentajes y tramos de nómina son una configuración inicial para el ejercicio académico; un profesional local debe validar base imponible, límites, topes y tabla de retención vigente antes de pagar planilla real.

## Trabajo colaborativo y uso de IA

La entrega académica requiere un repositorio remoto colaborativo, contribuciones verificables de cada integrante, defensa individual y grupal, y que todos comprendan la implementación. Este directorio no crea un repositorio remoto ni inventa autores o commits. Completa la plantilla de seguimiento con los nombres y actividades reales del equipo, crea el repositorio de GitHub del grupo y registra las contribuciones reales.

Este prototipo fue desarrollado con asistencia de IA. El equipo debe revisar, probar y comprender cada cambio y declarar el uso de IA en la bibliografía final del documento IEEE, siguiendo la política de la asignatura.
