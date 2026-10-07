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

## «N productos → ≈ X apuestas reales»
Grupos = activos unidos por correlación semanal ≥ 0,85 (5 años, en euros; enlace simple: basta con parecerse mucho a otro del grupo). Apuestas = 1 / Σ(peso de cada grupo)². La etiqueta de cada grupo sale de su propia exposición: país si uno supera el 50 % («Emergentes» si los emergentes suman ≥ 50 %, «Global» si no), y sector si uno supera el 30 %. Se muestra la correlación media y la mínima entre pares del grupo; un activo suelto muestra su correlación máxima con el resto. Activos sin 40 semanas de precios cuentan como grupo propio y se indica.

## Comparar · estado inicial
Sin A y B elegidos se proponen puntos de partida calculados con tu cartera (no son recomendaciones): tus dos fondos de más peso entre sí, tu cartera frente al MSCI World de referencia y tu cartera + 10 % del ETF amplio de ATLAS con menor correlación semanal con ella (se excluyen apalancados y temáticos).

## Cartera rápida (pegar texto)
Una línea por producto con peso (%) o importe (€); se aceptan ticker, ISIN o nombre. Los importes se convierten en pesos. Lo que no se reconoce **no se incluye** y se avisa. Sin pesos, se reparte a partes iguales (y se avisa). Se guarda solo en el dispositivo.

## Tarjeta compartible «Rayos X»
Nunca incluye importes. Muestra productos, apuestas reales, primer sector, primer país, 10 mayores empresas y mayor empresa, con fuente y fecha. Los nombres de los productos solo aparecen si el usuario lo marca.
