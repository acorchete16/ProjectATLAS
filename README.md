# Atlas 3D ETF Command

Herramienta de planes de inversión en ETFs por perfil de riesgo, con globo 3D. App web instalable (PWA), sin backend.

- Archivo principal: `index.html` (todo el código está dentro).
- No lleva ninguna clave dentro. La API key de Google AI Studio (modo Live) la pega cada usuario en la propia app y se guarda solo en su navegador.
- Actualizaciones: cada `git push` a `main` se publica solo en GitHub Pages. La app instalada coge la versión nueva al abrirse con conexión.
- Si cambias la estructura de caché, sube `VERSION` en `sw.js`.

Aviso: las cifras son estimaciones educativas, no asesoramiento financiero.
