# CHapp ERP — GH Aluminios Enterprise

Aplicación web ERP de alto rendimiento con arquitectura limpia, diseño profesional, iconos vectoriales y flujos de negocio optimizados para GH Aluminios.

---

## ✨ Módulos Incluidos

1. **Contactos (`res.partner`)**:
   - Vistas **Kanban**, **Lista** y **Formulario de Ficha Técnica**.
   - Clasificación Compañía / Individual, NIT/CC, etiquetas, plazos de pago y **Smart Buttons** conectados en tiempo real con las Ventas, Facturas y Gastos de cada tercero.
2. **Gastos (`hr.expense`)**:
   - Tablero superior de estados (`Por Enviar`, `Esperando Aprobación`, `Por Contabilizar`, `Por Reembolsar`, `Pagados`).
   - Flujo completo de gastos: `Borrador` ➔ `Enviar al Gerente` ➔ `Aprobar` ➔ `Publicar Asiento Contable` (genera automáticamente el asiento en **Contabilidad**) ➔ `Registrar Reembolso / Pago`.
   - Escáner de facturas con IA (Gemini Vision) y autocompletado inteligente de proveedores.
3. **Ventas (`sale.order` & `product.template`)**:
   - Gestión de **Cotizaciones**, **Pedidos de Venta** y **Catálogo de Productos**.
   - Editor dinámico de líneas de pedido con cálculo automático de Base Imponible, Descuentos, IVA y Total.
   - Confirmación de pedido y botón **Crear Factura** que genera automáticamente la factura `INV/2026/...` en **Contabilidad**.
4. **Contabilidad (`account.move`, `account.payment`, `account.account`)**:
   - **Tablero Contable** por diarios (`Facturas de Clientes`, `Facturas de Proveedores`, `Banco Bancolombia`, `Gastos y Operaciones Varias`).
   - Facturación de clientes y proveedores, visualización de **Apuntes Contables de Partida Doble (Debe / Haber)** en cuentas PUC, registro de pagos parciales o totales mediante modal nativo, y **Plan Único de Cuentas (PUC)**.
5. **Ajustes (`res.config.settings`)**:
   - Configuración de la compañía, moneda (`COP`, `USD`, `EUR`), alternancia entre **Modo Oscuro** y **Modo Claro**, parámetros de ventas/impuestos, exportación de respaldo JSON y restauración de datos demo.

---

## 🚀 Ejecución Local

```bash
# Iniciar el servidor en http://localhost:3000
npm start

# O en Windows haciendo doble clic en:
start.bat

# Ejecutar la suite de pruebas automatizadas:
npm test
```

---

## 🗄️ Persistencia en Supabase (PostgreSQL / PostgREST)

CHapp ERP cuenta con persistencia directa en **Supabase** mediante la API REST nativa de PostgREST, garantizando que los datos no se borren en plataformas con contenedores efímeros o suspensiones por inactividad (como **Vercel** o **Render**).

### Variables de Entorno

Configure las siguientes variables en su entorno de producción (Vercel / Render) o en un archivo `.env` local:

```env
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
```

### Características de la Integración

- **PostgREST Nativo:** Comunicación HTTP sin clientes pesados, permitiendo arranques en frío ultrarrápidos en serverless.
- **Fallback Transparente:** Si las variables no están presentes o se trabaja sin conexión, CHapp ERP continúa operando fluidamente utilizando almacenamiento local en `data/db.json` (o `/tmp` en serverless).
- **Esquema Relacional (`supabase_schema.sql`):** Estructura relacional con las tablas `res_partner`, `product_template`, `hr_expense`, `sale_order`, `sale_order_line`, `account_move`, `account_payment` y `res_config_settings`.
