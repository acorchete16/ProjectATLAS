# ATLAS · Metodología de datos (Doctor, Radar, Comparar, Globo)

Todas las cifras se calculan en el navegador (`js/intel.js`) con ficheros que generan los workflows de GitHub Actions. No hay datos inventados: si falta un dato, la interfaz muestra «n/d», «sin desglose» o «sin dato».

## Fuentes

| Fichero | Script / workflow | Fuente | Frecuencia | Contenido |
|---|---|---|---|---|
| `data/expo.json` | `scripts/holdings.py` / `expo.yml` | justETF (por ISIN) | diaria, por tandas de ~45 ETFs (dato válido 6 días; si falla se conserva el último con su fecha) | % por país y sector, 10 mayores posiciones (ISIN), nº total de posiciones |
| `data/expo.json` | idem | Yahoo Finance (quoteSummary topHoldings) | idem | 10 mayores posiciones con ticker, pesos sectoriales, P/E y P/B de la cartera, TER |
| `data/p/*.json` | `fetch_prices.py` / `prices.yml` | Yahoo Finance | diaria | precios diarios 1 año + semanales 5 años |
| `data/rank.json` | `rankings.py` / `prices.yml` | derivado de los precios | diaria | rentabilidad 1m/6m/1a/YTD/3a, volatilidad 1a, tendencia (precio vs media 200 y 50), caída máx. 1a |
| `data/live.json` | `live_quotes.py` / `live.yml` | Yahoo Finance | cada 15 min en horario de mercado | último precio |
| `data/countries.geojson` | — | Natural Earth 1:110m (dominio público) | estática | fronteras |

Los ETFs de EE. UU. sin ficha en justETF usan, cuando existe, el ETF UCITS que replica el mismo índice (se indica en la interfaz como «tomado del ETF UCITS…»).

## Calidad del dato (se muestra en cada activo)
| Etiqueta | Significado |
|---|---|
| DATO REAL | Desglose completo publicado (p. ej. todos los países de justETF, todos los sectores de Yahoo) |
| APROXIMACIÓN | Tomado del ETF UCITS que replica el mismo índice (ETFs de EE. UU. sin ficha en justETF) |
| PARCIAL | Solo una parte (4 países + «otros», o las 10 mayores posiciones). El resto se muestra como «No desglosado / datos insuficientes» y **nunca se reparte** |
| SIN DATOS | La fuente no publica ese desglose |

## Histórico de composición
`data/holdings/<clave>/<AAAA-MM-DD>.json` + `latest.json`, e `data/holdings/index.json` con las fechas disponibles. Solo se guarda una foto nueva cuando la composición cambia. Cada foto incluye empresa, peso, país, sector, identificador (ISIN o ticker), fuente, fecha, calidad por dimensión, nº total de posiciones y peso no desglosado.

## Look-through (exposición real)
- **País y sector de la cartera** = Σ peso del activo × % del activo en ese país/sector. Acciones: 100 % en su país y sector.
- **Empresas**: se suman las 10 mayores posiciones de cada ETF + acciones directas. Clases de acciones de una misma empresa se agrupan (Alphabet A/C).
- **Solapamiento entre dos ETFs** = Σ mín(peso en A, peso en B) de las empresas comunes. Es un **mínimo** (solo mayores posiciones conocidas).
- **Exposición por empresa** se da como rango: mínimo = suma de lo publicado; máximo = mínimo + Σ (peso del ETF × su posición publicada más pequeña) en los ETFs donde la empresa no aparece entre las mayores (no puede pesar más que esa posición). Si un ETF de acciones no publica posiciones, el máximo queda abierto («≥»).
- **Empresas distintas**: entre el mayor nº de posiciones de un ETF y la suma de todas (solapamiento desconocido).
- **Empresas equivalentes** = 1 / Σ w² con las posiciones conocidas: cota **optimista** (la real es igual o menor).
- **Sedes vs exposición**: la vista «Exposición de cartera» usa el país que asigna el proveedor del índice; la vista «Sedes» usa la dirección real de la sede (base de datos de ATLAS) y solo cubre empresas localizadas. La exposición por **ingresos** por país no está disponible (sin fuente).

## Portfolio Health (0–100, media simple de los componentes disponibles)
La vista principal agrupa los 11 componentes en 4 dimensiones (media simple de los disponibles en cada una; la salud total sigue siendo la media de los 11):
- **Diversificación**: diversificación real, apuestas independientes, solapamiento entre ETFs.
- **Concentración**: empresa, sectores, geografía, concentración por producto.
- **Riesgo**: volatilidad, caída máxima, correlación.
- **Coste**: TER medio ponderado. (No hay métrica de valoración en la salud: no se inventa.)

| Componente | Fórmula |
|---|---|
| Diversificación real | 100 · ln(N efectivo) / ln(200) |
| Concentración por producto | 100 − 1,5·(acciones sueltas + ETFs con >60 % en un sector − 10 pp) |
| Concentración por empresa | 100 − 6·(mayor empresa − 3 pp) − 1,2·(10 mayores − 25 pp) |
| Geografía | 100 − 2·(1er país − 60 pp) si >60 %; −15 si <5 países con >1 % |
| Sectores | 100 − 2,5·(1er sector − 25 pp) si >25 % |
| Correlación | (1 − correlación media ponderada) × 130 |
| Solapamiento entre ETFs | 100 − 1,5 · solapamiento medio ponderado entre pares de ETFs |
| Apuestas independientes | grupos de activos con correlación semanal ≥ 0,85; apuestas = 1/Σ(peso del grupo)²; score = 25 · apuestas (máx. 100) |
| Volatilidad | 100 − 4·(vol. anual − 8) |
| Caída máxima | 100 − 2,5·(|caída máx.| − 10) |
| Coste | 100 − 50 · TER medio |

Riesgo y correlaciones: rentabilidades **semanales en euros**, 5 años, con los pesos actuales aplicados hacia atrás. Es historia, no previsión.

Los umbrales (60 % en un país, 25 % en un sector, etc.) son criterios de ATLAS, no normas del mercado: se muestran en la interfaz para que el usuario los valore.

## ATLAS Score (Radar)
Cada componente es un **percentil** (0–100) frente a los demás ETFs de ATLAS:
- Valoración: P/E de la cartera, invertido (solo ETFs de acciones). Relativo, no frente a su propia historia.
- Momentum: rentabilidad del horizonte elegido (1m / 6m / 1a).
- Tendencia: precio vs media de 200 sesiones + ½ (media 50 vs 200).
- Riesgo: media de volatilidad 1a (invertida) y caída máx. 1a.
- Diversificación: 100 − (0,6 × solapamiento de empresas ×1,5 + 0,4 × parecido por países) frente a la cartera elegida (o MSCI World si no hay).
- Crecimiento: rentabilidad anualizada a 3 años (del **precio**, no de beneficios).

Pesos por defecto 20/20/10/15/20/15 (configurables). Confianza: Alta con 6 componentes, Media con 4–5, Baja con ≤3.

## Limitaciones conocidas
- Solo se conocen las 10 mayores posiciones de cada ETF; solapamientos y concentración son cotas inferiores.
- País = país que publica justETF (domicilio de la empresa), no país de los ingresos.
- Fondos de gestión activa (Cobas, Azvalor…) y ETFs USA sin equivalente UCITS: sin reparto por países (se aproxima con sus 10 mayores posiciones; el resto queda «sin desglose»).
- No hay datos de beneficios ni de valoración histórica por ETF.

## Radar · señales para investigar
Comparaciones relativas con datos reales (rankings diarios de ATLAS + composición). Ninguna señal es una recomendación.
- **Geografía**: ETFs con ≥ 80 % en un país (excepto EE. UU.): rentabilidad a 12 meses menos la del MSCI World (URTH). Se muestran los 2 mejores (≥ +5 pp) y el peor (≤ −10 pp).
- **Sector**: ETFs con ≥ 60 % en un sector: rentabilidad a 6 meses menos la del MSCI World (≥ +4 pp), uno por sector.
- **Valoración**: P/E de la cartera del ETF ≤ 0,8 × la mediana de los ETFs de su mismo sector o país (mínimo 3 comparables).
- **Riesgo**: volatilidad de 1 año ≥ 1,6 × la mediana de los ETFs de acciones.
- Se excluyen ETFs apalancados. Los cambios de composición quedan pendientes hasta tener historial de fotos.

## Comparar · «¿cuál diversifica mejor mi cartera?»
Se añade un 10 % de cada ETF a tu cartera (el resto se reduce en proporción) y se recalcula la salud. Gana el que más la mejora, penalizando 5 puntos por cada 1,0 de correlación con tu cartera actual. Sharpe = (rentabilidad anual histórica − tipo sin riesgo de Ajustes) / volatilidad.

## «N productos → ≈ X apuestas independientes» (estimación)
**Qué es:** una estimación de cuántas apuestas *diferenciadas en riesgo* contiene la cartera, basada en cómo se han movido los productos. No es una clasificación económica: dos productos poco correlacionados no son por fuerza apuestas económicas independientes, y una correlación histórica alta puede no mantenerse (en crisis suele subir).

**Cifra:** ratio de diversificación al cuadrado (Choueifaty): N = (Σ wᵢσᵢ)² / Σᵢⱼ wᵢwⱼσᵢσⱼρ⁺ᵢⱼ, con rentabilidades semanales en euros de 5 años y correlaciones negativas puestas a 0 (prudente). Todo se mueve igual → 1; nada se parece y mismo riesgo → nº de productos. Sin umbral elegido a mano.

**Por qué no el umbral de correlación:** el método anterior (agrupar si ρ ≥ 0,85) salta de golpe. Con 0,80 / 0,85 / 0,90: Nasdaq + Semiconductores + NVIDIA daba 1,0 / 1,8 / 3,0 apuestas, y Mundo + Emergentes + Small caps + Bonos 2,3 / 2,3 / 3,6. Los grupos con 0,85 se siguen mostrando solo para explicar de dónde viene el parecido.

**Estabilidad:** se recalcula con 3 años. Robusta si la diferencia es ≤ 0,25 (o ≤ 15 %); moderada ≤ 0,5 (o ≤ 30 %); sensible si no, y entonces se muestra un rango.

**Confianza:** depende de los precios (la cifra no usa la composición). Alta: todos los productos con 5 años de precios comunes y resultado no sensible. Media: algún producto sin precios, < 200 semanas o resultado sensible. Baja: > 10 % del peso sin precios o < 2 años.

**Exposición duplicada (p. ej. NVIDIA directa + dentro de QQQ y SMH):** no se cuenta dos veces como apuesta, porque los precios de esos ETFs ya la incluyen. La exposición económica consolidada se muestra aparte («≥ X % de tu cartera»).

**Precisión mostrada:** un decimal por debajo de 3 (la variación medida entre periodos es de ~0,05–0,1) y entero por encima.

**Perfiles de control (5 años, oct 2026):** 100 % S&P 500 → 1,0 · Mundo+S&P+Nasdaq → 1,05 · Mundo+S&P+Nasdaq+Semis → 1,1 · Nasdaq+Semis+NVIDIA → 1,1 · S&P+Emergentes → 1,3 · Mundo+Emergentes+Small caps+Bonos → 1,4 · Mundo+Emergentes+Bonos → 1,7 · Mundo+Emergentes+Bonos+Oro → 2,1.

## Comparar · estado inicial
Sin A y B elegidos se proponen puntos de partida calculados con tu cartera (no son recomendaciones): tus dos fondos de más peso entre sí, tu cartera frente al MSCI World de referencia y tu cartera + 10 % del ETF amplio de ATLAS con menor correlación semanal con ella (se excluyen apalancados y temáticos).

## Cartera rápida (pegar texto)
Una línea por producto con peso (%) o importe (€); se aceptan ticker, ISIN o nombre. Los importes se convierten en pesos. Lo que no se reconoce **no se incluye** y se avisa. Sin pesos, se reparte a partes iguales (y se avisa). Se guarda solo en el dispositivo.

## Tarjeta compartible «Rayos X»
Nunca incluye importes. Muestra productos, apuestas reales, primer sector, primer país, 10 mayores empresas y mayor empresa, con fuente y fecha. Los nombres de los productos solo aparecen si el usuario lo marca.

## Inicio · «Hoy / Lo que importa ahora»
- **Por producto (DATO):** rentabilidad en euros de cada producto desde el cierre anterior (último precio de Yahoo, cada 15 min con mercado abierto, más la divisa) × su peso al cierre anterior. La suma de las contribuciones es exactamente el movimiento de la cartera con esos pesos. Con importes se muestra en €; con pesos, solo en %.
- **Por dentro de tus ETFs (ESTIMACIÓN):** movimiento de la empresa × su peso en tu cartera contando solo las posiciones publicadas (por eso «≥»). Es una atribución dentro del movimiento de los ETFs; no se suma a él. Solo empresas con precio propio en ATLAS.
- «X explica ≈ N % del movimiento» solo aparece si la estimación tiene el mismo signo que el movimiento y es al menos el 25 %.
- Estado: «En directo» (última cotización < 40 min), «Actualizado HH:MM» o «Mercado cerrado · cierre del …» (se muestra la última sesión). Un producto sin cotización de la sesión cuenta como 0 % y se avisa.
- La franja superior «Mi cartera» usa la misma cifra (antes calculaba el día en la divisa de cada producto, sin el efecto del euro).

## Tests
`python tests/regression.py` recalcula 8 carteras de control y comprueba invariantes (100 % S&P = 1 apuesta, Mundo+EM+Bonos > Mundo+S&P+Nasdaq…), que las pantallas principales no fallan y que la contribución diaria cuadra. Las referencias (`tests/golden.json`) llevan tolerancia porque los precios cambian a diario.

## Optimizar (Doctor → Optimizar)

ATLAS no busca una "cartera ideal". Propone cambios pequeños y explicables sobre la cartera real.

- **Problemas detectados:** sector ≥ 35 %, país ≥ 70 %, empresa ≥ 8 %, solapamiento ≥ 20 %, TER medio > 0,40 %, un solo producto, apuestas efectivas bajas (< 1,3 o < 40 % del nº de productos).
- **Candidatos:** solo ETFs amplios y baratos (los 3 más baratos por hueco: emergentes, Europa, Japón, ex-EE. UU., small caps, value, bonos, oro, mundo). Nunca apalancados ni temáticos estrechos.
- **Contribución marginal:** se quita cada producto (redistribuyendo pro-rata) y se mide el efecto en apuestas, sector, volatilidad, coste y salud. "Poco eficiente" = quitarlo mejora la salud ≥ 3, apenas resta apuestas (≤ 0,05) y solapa ≥ 50 % o correla ≥ 0,8 con el resto.
- **Puntuación interna:** `ΔSalud + 12·ΔApuestas − 20·rotación − 1,5·productos nuevos + 0,5·productos eliminados` (+ ajuste según prioridad). Solo se propone si mejora salud ≥ 2 o apuestas ≥ 0,15 y la puntuación ≥ 3. Si nada lo cumple: "No cambiaría nada".
- **Opciones A/B/C:** A mínima (10 %), B equilibrada (≤ 20 %), C transformación (≤ 40 %, máx. 2 productos nuevos).
- **Confianza:** baja si faltan desgloses o precios de algún producto relevante.
- La rentabilidad pasada nunca es criterio de optimización. Preferencias y decisiones se guardan solo en el dispositivo.
- Tests obligatorios A–F en `tests/regression.py`.

## Motor de escenarios «¿Y si…?» (P0 · `js/scenarios.js`, `ATLASI.scenarios`)

Responde «si la cartera cambiara así, ¿qué cambiaría cuantitativamente?». No decide qué comprar o vender: no hay ganador, «mejor» ni «recomendado» en ninguna salida (lo comprueba `tests/scenarios.py`).
Durante P0 la pestaña **Optimizar está oculta**; su código sigue en `intel.js` hasta que P1 lo sustituya.

**Flujo:** `parse(texto)` → escenario JSON v1 → `build()` (pura) → pesos P1 → `simulate()` → `ATLASI.simP` sobre P0 y P1 (el mismo simulador que Doctor) → métricas + calidad + comparación + explicación.

**Escenario v1:** `{v, type, base:{sig,mode}, changes[], objectives[], constraints{}, assumptions[], source{text,parsedBy}}`. Activos con id `k:t` (p. ej. `e:QQQ`). Pesos en tanto por uno.
Operaciones (se aplican en orden): `set` (fijar peso), `adjust` (± puntos o % relativo), `shift` (mover una cantidad), `remove`, `add` (financiado pro-rata, desde un activo o una lista), `replace`, `contrib` (aportaciones).
JSON canónico: claves ordenadas, destinos ordenados por id, números a 1e-6. `source.text` no forma parte de la clave.

**Supuestos (siempre visibles en el resultado):** el peso liberado o necesario se reparte pro-rata salvo que el escenario diga otra cosa; «reparte entre A y B» sin porcentajes = a partes iguales; aportaciones = **precios constantes** (no se proyectan rentabilidades): peso final = (V + C)/(total + C). `monthsTo()` da los meses de aportación para llegar a un peso objetivo bajo ese mismo supuesto.

**Calidad de cada métrica:** DATA (pesos, nº de productos, TER, clase de activo; sector cuando el desglose cubre ≥ 99,5 %), ESTIMATE (sector/país con cobertura parcial, empresas, solapamiento), MODEL (apuestas efectivas, salud, volatilidad, caída máxima, historia, aportaciones, plusvalía), INCOMPLETE (< 60 % del peso con dato, < 104 semanas de precios o > 10 % del peso sin precios). Cada métrica lleva su cobertura y `bound:'lower'` cuando es una **cota inferior**: empresas y solapamiento se calculan con las 10 mayores posiciones publicadas de cada ETF (cobertura mediana ≈ 35 %), así que la exposición real puede ser superior. Los productos que provocan un hueco se listan por nombre.

**Dirección fija:** se considera mejora ↑ apuestas efectivas, ↑ salud, ↓ mayor posición, ↓ mayor empresa / 10 mayores empresas, ↓ solapamiento, ↓ TER. Sector, país, clase de activo, volatilidad, caída máxima y rentabilidad histórica solo «cambian», salvo que el escenario declare un objetivo sobre ellas.
**Materialidad** (`none` / `oneSided` / `mixed`): umbrales apuestas ±0,15 · salud ±2 · sector, país, clase de activo y emergentes ±3 pp · solapamiento ±3 pp · volatilidad ±0,5 pp · caída máxima ±1 pp · TER ±0,02 pp · mayor posición ±3 pp · mayor empresa ±1 pp · 10 mayores ±3 pp. Si nada los supera: «No se observa un cambio material en los escenarios explorados».

**Histórico:** solo `riskOf()` (5 años, semanal, en euros, pesos constantes = reequilibrio semanal implícito). Etiqueta «SIMULACIÓN HISTÓRICA»; nunca predicción ni rentabilidad esperada. Series: «precio ajustado por dividendos según el proveedor; no verificado para todos los productos» (Yahoo `adjclose` / EODHD `adjusted_close`, con cierre sin ajustar como respaldo).
**Reproducibilidad:** la ventana termina el último viernes con ≥ 3 días de antigüedad respecto a la fecha de `data/p/_meta.json`, nunca en la hora del navegador; así la cotización intradía no entra y el resultado no depende de que el mercado esté abierto. Clave de caché = cartera + escenario canónico + `dataVersion()` (`expo:<u>|px:<updated>`) + contexto.
**Fiscalidad:** capa separada. En modo importes, plusvalía estimada de lo que se vendería (coste medio, MODEL, sin tipo impositivo ni reglas por país). Con solo pesos: «no calculable».

**Parser:** gramática española determinista (sin IA). Resuelve primero en la cartera y luego en el universo de ATLAS. Si la frase es ambigua pregunta en vez de adivinar: «un 10 %» (¿puntos o relativo?), dos productos del mismo índice en cartera, una categoría sin producto concreto (lista con el criterio de orden visible, TER), objetivo sectorial sin porcentaje, aportaciones sin meses o sin importe.
**Exploración:** `removals`, `reductions` (−10 pp y pares), `additions` (exige `sortKey` explícito; universo = 3 de menor TER por categoría de `candidates()`, o todos los de una categoría), `pareto` (devuelve `front` y `dominated`, nunca un elegido).
**Límites de P0:** objetivos por sector/país/riesgo/solapamiento se reconocen pero generar escenarios para ellos es P2 (`GENERATOR_P2`). Universo cerrado (~150 ETFs + acciones de ATLAS). `annStats` (tabla anual fija de `index.html`) es otra fuente distinta de `riskOf`: deuda técnica para P3; What If no la usa.
**Tests:** `tests/scenarios.py` (46 frases del parser, invariantes en 6 carteras, operaciones exactas, aportaciones, coherencia con Doctor, materialidad, datos incompletos, mercado cerrado, cartera vacía, importes vs pesos, reproducibilidad, exploración, lenguaje, golden en `tests/scenarios_golden.json`, pantallas sin errores a 1280 y 390 px).
