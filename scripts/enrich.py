#!/usr/bin/env python3
"""Amplía el universo de la app con acciones, ETFs y fondos de data/universe.json.
Para cada uno saca de Yahoo Finance: nombre, sector, sede, cifras clave, rentabilidad de cada año
y volatilidad; geocodifica la sede con OpenStreetMap (Nominatim) y lo guarda en data/universe_x.json.
También añade los símbolos nuevos a data/symbols.json para que fetch_prices.py baje sus precios."""
import json, time, os, re, math, datetime, urllib.request, urllib.parse, http.cookiejar, statistics

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, 'data', *a)
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.addheaders = [('User-Agent', UA), ('Accept', '*/*'), ('Accept-Language', 'en-US,en;q=0.9')]
log = []
def L(*a):
    s = ' '.join(str(x) for x in a); print(s); log.append(s)
def get(url, timeout=15, raw=False):
    with op.open(url, timeout=timeout) as r:
        b = r.read().decode('utf-8', 'replace')
    return b if raw else json.loads(b)

crumb = None
def init_crumb():
    global crumb
    for u in ('https://fc.yahoo.com', 'https://finance.yahoo.com/'):
        try: op.open(u, timeout=10).read()
        except Exception: pass
    for h in ('query1', 'query2'):
        try:
            c = get(f'https://{h}.finance.yahoo.com/v1/test/getcrumb', raw=True).strip()
            if c and len(c) < 40 and '<' not in c: crumb = c; return
        except Exception as e: L('crumb', h, e)

def summary(sym, modules):
    q = f'modules={",".join(modules)}' + (f'&crumb={urllib.parse.quote(crumb)}' if crumb else '')
    last = None
    for h in ('query2', 'query1'):
        try:
            j = get(f'https://{h}.finance.yahoo.com/v10/finance/quoteSummary/{urllib.parse.quote(sym)}?{q}')
            r = j['quoteSummary']['result']
            if r: return r[0]
        except Exception as e: last = e
    raise last or ValueError('sin resumen')

def raw_v(d, k):
    v = (d or {}).get(k)
    if isinstance(v, dict): return v.get('raw')
    return v

def monthly(sym):
    j = get(f'https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?range=11y&interval=1mo')
    r = j['chart']['result'][0]; q = r['indicators']
    cls = q['quote'][0].get('close') or []
    adj = (q.get('adjclose') or [{}])[0].get('adjclose') or cls
    pts = [(datetime.datetime.utcfromtimestamp(t), a if a is not None else c) for t, a, c in zip(r.get('timestamp') or [], adj, cls)]
    pts = [p for p in pts if p[1]]
    m = r.get('meta', {})
    if m.get('regularMarketPrice') and m.get('regularMarketTime'):
        pts.append((datetime.datetime.utcfromtimestamp(m['regularMarketTime']), m['regularMarketPrice']))
    return pts, m.get('currency')

def ann_stats(pts):
    """Rentabilidad de cada año natural 2016–2025 (+ año en curso), CAGR y volatilidad anual."""
    by_year = {}
    for d, v in pts: by_year[d.year] = v          # último cierre de cada año
    first_year = min(by_year) if by_year else 9999
    yrs = []
    for y in range(2016, 2026):
        if y - 1 in by_year and y in by_year and y > first_year: yrs.append(round((by_year[y] / by_year[y - 1] - 1) * 100, 2))
        else: yrs.append(None)
    cy = datetime.date.today().year
    ytd = round((pts[-1][1] / by_year[cy - 1] - 1) * 100, 2) if cy - 1 in by_year and pts else None
    yrs.append(ytd)
    full = [x for x in yrs[:10] if x is not None]
    r10 = round((math.prod(1 + x / 100 for x in full) ** (1 / len(full)) - 1) * 100, 2) if len(full) >= 3 else None
    mr = [pts[i][1] / pts[i - 1][1] - 1 for i in range(max(1, len(pts) - 61), len(pts))]
    vol = round(statistics.pstdev(mr) * math.sqrt(12) * 100, 2) if len(mr) > 12 else None
    tag = '10a' if len(full) >= 9 else '5a' if len(full) >= 5 else 'inicio'
    return yrs, r10, vol, tag

SEC = {'Technology': 'Tecnología', 'Communication Services': 'Telecomunicaciones', 'Healthcare': 'Salud', 'Financial Services': 'Finanzas',
       'Consumer Cyclical': 'Consumo', 'Consumer Defensive': 'Consumo', 'Energy': 'Energía', 'Utilities': 'Energía', 'Industrials': 'Industria',
       'Basic Materials': 'Materias primas', 'Real Estate': 'Inmobiliario'}
IND = {'Aerospace & Defense': 'Defensa y espacio', 'Auto Manufacturers': 'Automoción', 'Luxury Goods': 'Lujo', 'Banks—Diversified': 'Finanzas', 'Banks - Diversified': 'Finanzas'}
CC = {'United States': 'US', 'Germany': 'DE', 'France': 'FR', 'Italy': 'IT', 'Switzerland': 'CH', 'United Kingdom': 'GB', 'Netherlands': 'NL', 'Spain': 'ES',
      'South Korea': 'KR', 'Hong Kong': 'HK', 'Japan': 'JP', 'Taiwan': 'TW', 'India': 'IN', 'Australia': 'AU', 'Canada': 'CA', 'Mexico': 'MX', 'Argentina': 'AR',
      'Ireland': 'IE', 'Denmark': 'DK', 'Belgium': 'BE', 'China': 'CN', 'Brazil': 'BR', 'Luxembourg': 'LU', 'Israel': 'IL', 'Uruguay': 'UY', 'Singapore': 'SG'}
PAIS = {'United States': 'EE. UU.', 'Germany': 'Alemania', 'France': 'Francia', 'Italy': 'Italia', 'Switzerland': 'Suiza', 'United Kingdom': 'Reino Unido',
        'Netherlands': 'Países Bajos', 'Spain': 'España', 'South Korea': 'Corea del Sur', 'Hong Kong': 'Hong Kong', 'Japan': 'Japón', 'Taiwan': 'Taiwán',
        'India': 'India', 'Australia': 'Australia', 'Canada': 'Canadá', 'Mexico': 'México', 'Argentina': 'Argentina', 'Ireland': 'Irlanda', 'Denmark': 'Dinamarca'}

def etf_sector(cat, name):
    s = f'{cat} {name}'.lower()
    for k, v in [('money market', 'Bonos y oro'), ('overnight', 'Bonos y oro'), ('bond', 'Bonos y oro'), ('gold', 'Bonos y oro'), ('commodit', 'Bonos y oro'),
                 ('technology', 'Tecnología'), ('nasdaq', 'Tecnología'), ('information tech', 'Tecnología'), ('artificial', 'Tecnología'), ('robot', 'Tecnología'), ('semiconductor', 'Tecnología'),
                 ('health', 'Salud'), ('biotech', 'Salud'), ('clean energy', 'Energía'), ('energy', 'Energía'), ('electric', 'Energía'),
                 ('emerging', 'Regiones y países'), ('japan', 'Regiones y países'), ('india', 'Regiones y países'), ('europe', 'Regiones y países'), ('euro', 'Regiones y países'),
                 ('spain', 'Regiones y países'), ('ibex', 'Regiones y países'), ('pacific', 'Regiones y países'), ('china', 'Regiones y países'), ('gaming', 'Tecnología')]:
        if k in s: return v
    return 'Mercado amplio'

# ---- geocodificación (OpenStreetMap Nominatim, 1 consulta/s) ----
geo_cache = {}
def geocode(q):
    if q in geo_cache: return geo_cache[q]
    time.sleep(1.1)
    try:
        req = urllib.request.Request('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + urllib.parse.quote(q),
                                     headers={'User-Agent': 'ProjectATLAS/1.0 (github.com/acorchete16/ProjectATLAS)'})
        with urllib.request.urlopen(req, timeout=15) as r: j = json.loads(r.read())
        res = (float(j[0]['lat']), float(j[0]['lon']), j[0].get('class'), j[0].get('type')) if j else None
    except Exception as e:
        L('geocode', q, e); res = None
    geo_cache[q] = res; return res

def geo_for(addr_parts, city_parts):
    a = ', '.join(x for x in addr_parts if x)
    g = geocode(a) if a else None
    if g: return [round(g[0], 5), round(g[1], 5), a, 'edificio' if g[2] in ('building', 'office', 'amenity') or g[3] in ('house', 'building', 'office', 'commercial') else 'direccion']
    c = ', '.join(x for x in city_parts if x)
    g = geocode(c) if c else None
    if g: return [round(g[0], 5), round(g[1], 5), a or c, 'ciudad']
    return None

def bn(v): return round(v / 1e9, 2) if v is not None else None
def es_num(v, d=0): return f'{v:,.{d}f}'.replace(',', 'X').replace('.', ',').replace('X', '.')

def stock(sym, old):
    r = summary(sym, ['assetProfile', 'price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'incomeStatementHistory'])
    ap, pr, sd, ks, fd = r.get('assetProfile', {}), r.get('price', {}), r.get('summaryDetail', {}), r.get('defaultKeyStatistics', {}), r.get('financialData', {})
    pts, cur = monthly(sym); yrs, r10, vol, tag = ann_stats(pts)
    name = pr.get('shortName') or pr.get('longName') or sym
    name = re.sub(r'\s+(Inc\.?|Corporation|Corp\.?|plc|PLC|S\.A\.|SA|AG|SE|N\.V\.|NV|Ltd\.?|Limited|Co\.,? Ltd\.?|Holdings?)$', '', name.strip(), flags=re.I).strip(' ,')
    country = ap.get('country') or ''
    sec = IND.get(ap.get('industry')) or SEC.get(ap.get('sector')) or 'Otros'
    inc = (r.get('incomeStatementHistory') or {}).get('incomeStatementHistory') or []
    hist = []
    for s in reversed(inc):
        y = (s.get('endDate') or {}).get('fmt', '')[:4]; rv = raw_v(s, 'totalRevenue'); oi = raw_v(s, 'operatingIncome')
        if y and rv: hist.append([y, round(rv / 1e6), round((oi or 0) / 1e6)])
    rev, cash, debt, fcf = raw_v(fd, 'totalRevenue'), raw_v(fd, 'totalCash'), raw_v(fd, 'totalDebt'), raw_v(fd, 'freeCashflow')
    mcap = raw_v(pr, 'marketCap') or raw_v(sd, 'marketCap')
    fcur = fd.get('financialCurrency') or cur
    geo = old.get('geo') if old.get('geo') and old.get('addr_src') == ap.get('address1') else geo_for(
        [ap.get('address1'), ap.get('city'), ap.get('zip'), country], [ap.get('city'), country])
    tk = sym.split('.')[0] if '.' in sym and not sym.startswith('BRK') else sym
    fpe, beta = raw_v(sd, 'forwardPE') or raw_v(ks, 'forwardPE'), raw_v(sd, 'beta') or raw_v(ks, 'beta')
    ch52 = raw_v(ks, '52WeekChange'); ch52 = round(ch52 * 100, 2) if ch52 is not None else None
    growth = None
    if len(hist) >= 2 and hist[0][1] > 0: growth = (hist[-1][1] / hist[0][1]) ** (1 / (len(hist) - 1)) - 1
    thesis = f"{ap.get('industry') or sec} con sede en {ap.get('city') or '—'} ({PAIS.get(country, country)}). Vale {es_num(bn(mcap) or 0, 0)} mil millones en bolsa" + (f" y sus ventas {'crecen' if growth >= 0 else 'caen'} un {es_num(abs(growth) * 100, 0)} % al año." if growth is not None else '.')
    risk = (f"Beta {es_num(beta, 2)}" if beta else 'Sin beta') + (f" y PER futuro de {es_num(fpe, 1)}" if fpe else '') + ': ' + (
        'se mueve bastante más que el mercado.' if (beta or 1) > 1.3 else 'se mueve parecido al mercado.' if (beta or 1) > 0.8 else 'más tranquila que el mercado.')
    return {'t': sym, 'tk': tk, 'n': name, 'sec': sec, 'ind': ap.get('industry'), 'hq': f"{ap.get('city') or '—'} ({PAIS.get(country, country)})", 'cc': CC.get(country, ''),
            'cur': cur, 'px': raw_v(pr, 'regularMarketPrice'), 'mcap': bn(mcap), 'rev': bn(rev), 'opm': round(raw_v(fd, 'operatingMargins') * 100, 2) if raw_v(fd, 'operatingMargins') is not None else None,
            'cash': bn(cash), 'debt': bn(debt), 'net': bn((cash or 0) - (debt or 0)) if cash is not None or debt is not None else None, 'fcf': bn(fcf), 'fpe': fpe, 'beta': beta,
            'dy': round(raw_v(sd, 'dividendYield') * 100, 2) if raw_v(sd, 'dividendYield') is not None else 0, 'ch52': ch52, 'hist': hist, 'histCur': f'M {fcur}',
            'bank': 'Banks' in (ap.get('industry') or ''), 'thesis': thesis, 'risk': risk, 'about': (ap.get('longBusinessSummary') or '')[:600],
            'web': ap.get('website'), 'yrs': yrs, 'r10': r10, 'vol': vol, 'tag': tag, 'geo': geo, 'addr_src': ap.get('address1')}

def fund_like(sym, kind, isin, hint, managers, old):
    r = summary(sym, ['price', 'summaryDetail', 'fundProfile', 'defaultKeyStatistics'])
    pr, fp, ks = r.get('price', {}), r.get('fundProfile', {}), r.get('defaultKeyStatistics', {})
    pts, cur = monthly(sym); yrs, r10, vol, tag = ann_stats(pts)
    name = pr.get('longName') or pr.get('shortName') or hint or sym
    fam = fp.get('family') or ks.get('fundFamily') or ''
    cat = fp.get('categoryName') or ks.get('category') or ''
    ter = raw_v((fp.get('feesExpensesInvestment') or {}), 'annualReportExpenseRatio')
    ter = round(ter * 100, 2) if ter is not None and ter < 0.1 else (round(ter, 2) if ter else None)
    probe = f'{fam} {name} {hint or ""}'.lower()
    mk = next((k for k in managers if k.lower() in probe), None)
    geo = old.get('geo') if old.get('geo') and old.get('mgr') == mk else (geo_for([managers[mk]], [managers[mk].split(',')[-1]]) if mk else None)
    iss = mk or fam or '—'
    act = kind == 'f' and not re.search(r'index|indexado|índice', f'{name} {hint}', re.I)
    sec = 'Gestión activa' if act else etf_sector(cat, f'{name} {hint}')
    tk = (sym.split('.')[0] if kind == 'e' else re.sub(r'[^A-Z]', '', (hint or name).upper())[:4])
    return {'t': sym, 'tk': tk, 'n': (hint or name), 'full': name, 'isin': isin, 'iss': iss, 'mgr': mk, 'fam': fam, 'cat': cat, 'ter': ter, 'cur': cur, 'sec': sec,
            'kind': 'act' if act else 'idx', 'yrs': yrs, 'r10': r10, 'vol': vol, 'tag': tag, 'geo': geo}

def search_isin(isin, hint):
    for q in (isin, hint):
        if not q: continue
        try:
            j = get('https://query2.finance.yahoo.com/v1/finance/search?q=' + urllib.parse.quote(q) + '&quotesCount=6&newsCount=0')
            qs = [x for x in j.get('quotes', []) if x.get('symbol') and x.get('quoteType') in ('MUTUALFUND', 'ETF', 'EQUITY', None)]
            if qs: return qs[0]['symbol']
        except Exception as e: L('search', q, e)
    return None

def main():
    u = json.load(open(P('universe.json')))
    try: old = json.load(open(P('universe_x.json')))
    except Exception: old = {}
    oldmap = {x['t']: x for k in ('s', 'e', 'f') for x in old.get(k, [])}
    init_crumb(); L('crumb', 'ok' if crumb else 'NO')
    out = {'s': [], 'e': [], 'f': []}; fails = []; t0 = time.time()
    for sym in u['stocks']:
        try: out['s'].append(stock(sym, oldmap.get(sym, {})))
        except Exception as e: fails.append(f's {sym}: {str(e)[:80]}'); (oldmap.get(sym) and out['s'].append(oldmap[sym]))
        time.sleep(0.3)
    for e in u['etfs']:
        try: out['e'].append(fund_like(e['t'], 'e', e.get('isin'), None, u['managers'], oldmap.get(e['t'], {})))
        except Exception as ex: fails.append(f"e {e['t']}: {str(ex)[:80]}"); (oldmap.get(e['t']) and out['e'].append(oldmap[e['t']]))
        time.sleep(0.3)
    sym_cache = {x.get('isin'): x['t'] for x in old.get('f', [])}
    for f in u['funds']:
        sym = sym_cache.get(f['isin']) or search_isin(f['isin'], f['n'])
        if not sym: fails.append(f"f {f['isin']}: no encontrado en Yahoo"); continue
        try: out['f'].append(fund_like(sym, 'f', f['isin'], f['n'], u['managers'], oldmap.get(sym, {})))
        except Exception as ex: fails.append(f"f {f['isin']} {sym}: {str(ex)[:80]}"); (oldmap.get(sym) and out['f'].append(oldmap[sym]))
        time.sleep(0.3)
    out['updated'] = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ')
    json.dump(out, open(P('universe_x.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    syms = json.load(open(P('symbols.json')))
    for k, lst in (('s', out['s']), ('e', out['e']), ('f', out['f'])):
        for x in lst: syms.setdefault(f"{k}:x:{x['t']}", {'y': x['t']})
    json.dump(syms, open(P('symbols.json'), 'w'), separators=(',', ':'))
    nogeo = [x['t'] for k in 'sef' for x in out[k] if not x.get('geo')]
    L(f"OK acciones {len(out['s'])}/{len(u['stocks'])} · ETFs {len(out['e'])}/{len(u['etfs'])} · fondos {len(out['f'])}/{len(u['funds'])} · sin sede {len(nogeo)} · {int(time.time()-t0)} s")
    for f in fails: L('  -', f)
    if nogeo: L('  sin sede:', ' '.join(nogeo))
    open(P('universe_log.txt'), 'w').write('\n'.join(log) + '\n')

if __name__ == '__main__':
    main()
