# App de Stock, Contratos y Facturas — Workflows n8n

Tres workflows n8n para gestionar inventario y generar documentos profesionales en español, conectados a Google Sheets y Google Drive.

---

## Workflows incluidos

| Archivo | Descripción |
|---|---|
| `1-stock-management.json` | Control de inventario (ver, añadir, actualizar, alertas) |
| `2-contract-generator.json` | Generador de contratos con numeración automática |
| `3-invoice-generator.json` | Generador de facturas con cálculo de IVA |

---

## Requisitos previos

### 1. Instancia n8n
Necesitas n8n corriendo localmente o en la nube.  
Inicio rápido: `npm run start` desde la raíz del monorepo.

### 2. Credenciales de Google (una sola vez)
En n8n ve a **Settings → Credentials** y crea:
- **Google Sheets OAuth2** — para leer/escribir en la hoja de cálculo
- **Google Drive OAuth2** — para guardar documentos en Drive

### 3. Hoja de cálculo de Google Sheets
La hoja con ID `1g-1ZIuwTC6gtLEnFraCWP9OqLfp-lWndAjJqSXlhh-k` necesita **3 pestañas** con estos nombres exactos:

**Pestaña `Stock`** — columnas:
```
ID | Nombre | Descripcion | Categoria | Precio_Venta | Precio_Compra | Stock_Actual | Stock_Minimo | Unidad
```

**Pestaña `Contratos`** — columnas:
```
Num_Contrato | Fecha | Cliente_Nombre | Cliente_NIF | Cliente_Email | Descripcion_Servicio | Valor_Total | Fecha_Inicio | Fecha_Fin | Estado
```

**Pestaña `Facturas`** — columnas:
```
Num_Factura | Fecha | Cliente_Nombre | Cliente_NIF | Cliente_Email | Items_JSON | Base_Imponible | IVA_Porcentaje | Total | Estado
```

### 4. Carpetas de Google Drive
Crea estas dos carpetas en Drive y copia sus IDs (aparecen en la URL):

| Carpeta | Placeholder en el workflow |
|---|---|
| `📁 Contratos/` | `TU_CARPETA_CONTRATOS_ID` |
| `📁 Facturas/` | `TU_CARPETA_FACTURAS_ID` |

Los documentos se guardan automáticamente en una subcarpeta `Prueba/` (modo prueba). Cuando estés listo para producción, cambia el nombre en el nodo **"Crear Subcarpeta..."** a `2026/` o el periodo que prefieras.

---

## Importar los workflows

1. Abre n8n en el navegador
2. Ve a **Workflows → New** → menú `⋮` → **Import from file**
3. Importa cada uno de los 3 JSON
4. En cada workflow, haz clic sobre los nodos de **Google Sheets** y **Google Drive** y asigna tus credenciales
5. Reemplaza `TU_CARPETA_CONTRATOS_ID` y `TU_CARPETA_FACTURAS_ID` con los IDs reales de tus carpetas
6. Activa cada workflow con el toggle **Active**

---

## Personalizar tus datos de empresa

En los workflows `2-contract-generator.json` y `3-invoice-generator.json`, el nodo **"Generar Contrato"** / **"Generar Factura"** (nodo Code) contiene este bloque que debes editar:

```javascript
const empresa = {
  nombre:    "TU EMPRESA S.L.",      // ← Tu razón social
  nif:       "B12345678",            // ← Tu NIF/CIF
  direccion: "Calle Ejemplo, 123",   // ← Tu dirección
  ciudad:    "28001 Madrid",         // ← Tu ciudad y CP
  email:     "info@tuempresa.com",   // ← Tu email
  telefono:  "+34 600 000 000",      // ← Tu teléfono
  banco:     "ES00 0000 0000 0000 0000 0000", // ← Solo en facturas
};
```

---

## Uso

### Gestión de Stock (`1-stock-management.json`)
Abre la URL del Form Trigger → selecciona la acción:
- **Ver todo el stock** → tabla HTML completa con semáforo de stock
- **Añadir producto** → formulario de 2 pasos, guarda en pestaña `Stock`
- **Actualizar stock** → introduce ID + nueva cantidad, actualiza por matching de ID
- **Ver alertas** → lista productos con stock ≤ stock mínimo

### Generar Contrato (`2-contract-generator.json`)
Abre la URL del Form Trigger → rellena:
- Datos del cliente (nombre, NIF, email)
- Descripción del servicio
- Valor total, fechas de inicio/fin, condiciones de pago

Resultado:
- Número correlativo automático (CONT-2026-001, CONT-2026-002…)
- Contrato HTML mostrado en pantalla — usa **🖨️ Imprimir** para guardar como PDF
- Registro en pestaña `Contratos` de Google Sheets
- Archivo HTML guardado en `📁 Contratos/Prueba/`

### Generar Factura (`3-invoice-generator.json`)
Abre la URL del Form Trigger → rellena:
- Datos del cliente
- Líneas de factura — **formato**: `cantidad|descripción|precio_unitario` (una por línea)

Ejemplo de líneas:
```
2|Consultoría web|150
1|Diseño de logotipo|400
5|Horas de soporte|60
```

- % de IVA (por defecto 21%)

Resultado:
- Número correlativo automático (FAC-2026-001, FAC-2026-002…)
- Factura HTML con desglose de IVA, mostrada en pantalla
- Registro en pestaña `Facturas` con totales calculados
- Archivo HTML guardado en `📁 Facturas/Prueba/`

---

## Pasar a producción

Cuando hayas probado los workflows:
1. En los nodos **"Crear Subcarpeta Contrato"** y **"Crear Subcarpeta Factura"**, cambia el nombre `"Prueba"` por el periodo (p.ej. `"2026"`).
2. Mueve las carpetas raíz de Drive a donde las necesites.
3. Los números correlativos se calculan solos contando las filas de Google Sheets.
