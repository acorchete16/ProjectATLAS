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

## Look-through (exposición real)
- **País y sector de la cartera** = Σ peso del activo × % del activo en ese país/sector. Acciones: 100 % en su país y sector.
- **Empresas**: se suman las 10 mayores posiciones de cada ETF + acciones directas. Clases de acciones de una misma empresa se agrupan (Alphabet A/C).
- **Solapamiento entre dos ETFs** = Σ mín(peso en A, peso en B) de las empresas comunes. Es un **mínimo** (solo mayores posiciones conocidas).
- **Empresas efectivas** = 1 / Σ w². Las posiciones no conocidas de cada ETF se reparten a partes iguales entre sus demás posiciones (nº total de justETF; si no se conoce se asume 20, mínimo aproximado de la regla UCITS 5/10/40). **Aproximación.**

## Portfolio Health (0–100, media simple de los componentes disponibles)
| Componente | Fórmula |
|---|---|
| Diversificación real | 100 · ln(N efectivo) / ln(200) |
| Concentración | 100 − 6·(mayor empresa − 3 pp) − 1,2·(10 mayores − 25 pp) |
| Geografía | 100 − 2·(1er país − 60 pp) si >60 %; −15 si <5 países con >1 % |
| Sectores | 100 − 2,5·(1er sector − 25 pp) si >25 % |
| Correlación | (1 − correlación media ponderada) × 130 |
| Volatilidad | 100 − 4·(vol. anual − 8) |
| Caída máxima | 100 − 2,5·(|caída máx.| − 10) |
| Riesgo a la baja | 100 + 2 · peor rentabilidad en 52 semanas |
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
