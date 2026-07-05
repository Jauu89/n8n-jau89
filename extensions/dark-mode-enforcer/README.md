# Dark Mode Enforcer

Extensión de navegador (Manifest V3) que fuerza el modo oscuro en cualquier web, incluso en sitios que no lo soportan de forma nativa. Invierte los colores de la página y contra-invierte imágenes, vídeos e iconos para que no se vean como negativos.

## Instalación (modo desarrollador)

### Chrome / Edge / Brave (basados en Chromium)

1. Abre `chrome://extensions` (o `edge://extensions`).
2. Activa **Modo de desarrollador** (arriba a la derecha).
3. Pulsa **Cargar descomprimida** y selecciona la carpeta `extensions/dark-mode-enforcer/`.
4. El icono aparecerá en la barra de herramientas.

### Firefox

1. Abre `about:debugging#/runtime/this-firefox`.
2. Pulsa **Cargar complemento temporal...**
3. Selecciona el archivo `manifest.json` dentro de `extensions/dark-mode-enforcer/`.
4. Nota: en Firefox la extensión se elimina al cerrar el navegador (carga temporal). Para una instalación permanente hay que firmarla con addons.mozilla.org.

## Uso

- Clic en el icono de la barra de herramientas para abrir el popup.
- **Modo oscuro global**: activa/desactiva el forzado en todas las webs.
- **Desactivar en este sitio**: excluye el dominio actual mientras el modo global está activo.
- Atajo de teclado por defecto: `Ctrl+Shift+D` (`Cmd+Shift+D` en Mac) para alternar el modo global. Se puede cambiar en `chrome://extensions/shortcuts`.

## Personalización

- El algoritmo de inversión de color está en `content.js` (variable `CSS`). Se puede sustituir por otro enfoque (paleta fija, `prefers-color-scheme`, etc.) si el efecto de inversión no convence en según qué páginas.
- Los iconos (`icons/icon-on-*.png` e `icon-off-*.png`) son un placeholder simple; sustitúyelos por un diseño propio antes de publicar en la Chrome Web Store.
- El atajo de teclado se define en `manifest.json` bajo `commands`.

## Estructura

```
manifest.json     Declaración de la extensión (MV3)
background.js     Service worker: estado global/por dominio, iconos, atajos
content.js        Inyecta/retira el CSS de inversión en cada página
popup.html/js/css UI del icono de la barra de herramientas
icons/            Iconos activo/inactivo en 16/32/48/128px
```
