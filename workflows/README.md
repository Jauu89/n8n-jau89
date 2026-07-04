# App de Stock, Contratos y Facturas — Workflows n8n

Cuatro workflows n8n para gestionar inventario y generar documentos profesionales en español, conectados a Google Sheets y Google Drive.

> **La hoja de cálculo original nunca se modifica.** El workflow de setup crea una copia de trabajo sobre la que operan los demás workflows.

---

## Workflows incluidos

| Archivo | Descripción |
|---|---|
| `0-setup.json` | **Ejecutar UNA SOLA VEZ** — copia el spreadsheet y crea las carpetas de Drive |
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
- **Google Drive OAuth2** — para copiar el spreadsheet y guardar documentos
- **Google Sheets OAuth2** — para leer/escribir en la hoja de cálculo

---

## Puesta en marcha (orden importante)

### Paso 1 — Importar y ejecutar el setup

1. Abre n8n → **Workflows → New** → menú `⋮` → **Import from file**
2. Importa `0-setup.json`
3. En el nodo **"Copiar Spreadsheet Original"** y los nodos **"Crear Carpeta..."**, asigna tu credencial de Google Drive
4. Ejecuta el workflow manualmente con el botón **Test workflow**
5. Se abrirá una pantalla con **3 IDs** — mantenla abierta o cópialos a un bloc de notas:
   - ID del spreadsheet copia (`TU_SPREADSHEET_COPIA_ID`)
   - ID de la carpeta Contratos (`TU_CARPETA_CONTRATOS_ID`)
   - ID de la carpeta Facturas (`TU_CARPETA_FACTURAS_ID`)

> El setup crea en tu Google Drive:
> - Una copia del spreadsheet llamada **`[APP] Stock Contratos Facturas`**
> - Una carpeta **`Contratos/`**
> - Una carpeta **`Facturas/`**

### Paso 2 — Preparar la hoja de cálculo

Abre la **copia** del spreadsheet (la que se llama `[APP] Stock Contratos Facturas`) y crea **3 pestañas** con estos nombres exactos:

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

### Paso 3 — Importar y configurar los workflows 1, 2 y 3

1. Importa `1-stock-management.json`, `2-contract-generator.json` y `3-invoice-generator.json`
2. En cada workflow, reemplaza los placeholders con los IDs del paso 1:

| Placeholder | Workflows | Dónde |
|---|---|---|
| `TU_SPREADSHEET_COPIA_ID` | 1, 2 y 3 | Nodos Google Sheets (campo Spreadsheet) |
| `TU_CARPETA_CONTRATOS_ID` | 2 | Nodo "Crear Subcarpeta Contrato" (campo Parent Folder) |
| `TU_CARPETA_FACTURAS_ID` | 3 | Nodo "Crear Subcarpeta Factura" (campo Parent Folder) |

3. En cada workflow, asigna tus credenciales en los nodos **Google Sheets** y **Google Drive**
4. Activa cada workflow con el toggle **Active**

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
2. Los números correlativos se calculan solos contando las filas de Google Sheets.
