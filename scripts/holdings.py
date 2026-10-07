#!/usr/bin/env python3
"""Composición real de ETFs y fondos para el análisis de exposición de ATLAS.

Dos fuentes, siempre con fecha:
 1. Carteras COMPLETAS publicadas por iShares (CSV oficial: empresa, peso, sector, país) para los índices de
    referencia. Un ETF/fondo que replica ese índice hereda la composición (marcado como 'proxy').
 2. Yahoo Finance quoteSummary (topHoldings, fundProfile, summaryDetail): 10 mayores posiciones, reparto
    sectorial, P/E y P/B de la cartera, % en acciones/bonos/liquidez y gastos. El peso que no cubren las 10
    mayores queda como 'sin desglose': no se inventa.

Salida: data/expo.json
  idx[clave]  = {name, src, asof, n, country{ISO2:%}, sector{sector:%}, top[[nombre,ticker,%,ISO2,sector]...]}
  fund[clave] = {proxy, idx_name, asof, src, sector{}, top[], cover, pe, pb, stock, bond, cash, ter, cat}
Registro: data/expo_log.txt"""
import csv, io, json, os, re, sys, time, glob, datetime, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import enrich as E

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = []
def L(*a):
    s = ' '.join(str(x) for x in a); print(s); LOG.append(s)

# ---------- normalización ----------
SECT = {  # GICS (iShares) y claves de Yahoo -> nombre ATLAS
    'information technology': 'Tecnología', 'technology': 'Tecnología',
    'financials': 'Finanzas', 'financial_services': 'Finanzas', 'financial services': 'Finanzas',
    'health care': 'Salud', 'healthcare': 'Salud',
    'consumer discretionary': 'Consumo discrecional', 'consumer_cyclical': 'Consumo discrecional', 'consumer cyclical': 'Consumo discrecional',
    'consumer staples': 'Consumo básico', 'consumer_defensive': 'Consumo básico', 'consumer defensive': 'Consumo básico',
    'industrials': 'Industria', 'communication': 'Comunicaciones', 'communication services': 'Comunicaciones', 'communication_services': 'Comunicaciones',
    'energy': 'Energía', 'materials': 'Materiales', 'basic_materials': 'Materiales', 'basic materials': 'Materiales',
    'real estate': 'Inmobiliario', 'realestate': 'Inmobiliario', 'utilities': 'Servicios públicos',
    'cash and/or derivatives': 'Liquidez', 'cash': 'Liquidez', 'money market': 'Liquidez',
}
def sect(x): return SECT.get((x or '').strip().lower(), 'Otros')

COUNTRY = {'united states': 'US', 'japan': 'JP', 'united kingdom': 'GB', 'canada': 'CA', 'france': 'FR', 'switzerland': 'CH', 'germany': 'DE',
  'australia': 'AU', 'netherlands': 'NL', 'denmark': 'DK', 'sweden': 'SE', 'italy': 'IT', 'spain': 'ES', 'hong kong': 'HK', 'singapore': 'SG',
  'finland': 'FI', 'belgium': 'BE', 'israel': 'IL', 'norway': 'NO', 'ireland': 'IE', 'new zealand': 'NZ', 'austria': 'AT', 'portugal': 'PT',
  'china': 'CN', 'taiwan': 'TW', 'india': 'IN', 'korea (south)': 'KR', 'south korea': 'KR', 'korea': 'KR', 'brazil': 'BR', 'saudi arabia': 'SA',
  'south africa': 'ZA', 'mexico': 'MX', 'indonesia': 'ID', 'thailand': 'TH', 'malaysia': 'MY', 'united arab emirates': 'AE', 'poland': 'PL',
  'qatar': 'QA', 'kuwait': 'KW', 'turkey': 'TR', 'chile': 'CL', 'greece': 'GR', 'philippines': 'PH', 'peru': 'PE', 'hungary': 'HU',
  'colombia': 'CO', 'czech republic': 'CZ', 'egypt': 'EG', 'luxembourg': 'LU', 'macau': 'MO', 'argentina': 'AR', 'bermuda': 'BM',
  'cayman islands': 'KY', 'jersey': 'JE', 'guernsey': 'GG', 'puerto rico': 'PR', 'uruguay': 'UY', 'zambia': 'ZM', 'jordan': 'JO',
  'european union': 'EU', 'cash': 'XX', 'other': 'XX', '-': 'XX'}
SUFFIX_CC = {'TW': 'TW', 'TWO': 'TW', 'AS': 'NL', 'T': 'JP', 'L': 'GB', 'PA': 'FR', 'DE': 'DE', 'F': 'DE', 'SW': 'CH', 'HK': 'HK', 'KS': 'KR', 'KQ': 'KR',
  'MC': 'ES', 'MI': 'IT', 'CO': 'DK', 'ST': 'SE', 'TO': 'CA', 'V': 'CA', 'AX': 'AU', 'NS': 'IN', 'BO': 'IN', 'SS': 'CN', 'SZ': 'CN', 'HE': 'FI',
  'BR': 'BE', 'OL': 'NO', 'IR': 'IE', 'LS': 'PT', 'VI': 'AT', 'SA': 'BR', 'MX': 'MX', 'JK': 'ID', 'BK': 'TH', 'SI': 'SG', 'TA': 'IL', 'SR': 'SA', 'JO': 'ZA'}

# ---------- 1. carteras completas de iShares ----------
INDEX = {  # clave: (ticker iShares, nombre del índice, id de producto conocido, slug)
    'world': ('URTH', 'MSCI World', 239696, 'ishares-msci-world-etf'),
    'sp500': ('IVV', 'S&P 500', 239726, 'ishares-core-sp-500-etf'),
    'acwi': ('ACWI', 'MSCI ACWI (mundo + emergentes)', 239600, 'ishares-msci-acwi-etf'),
    'em': ('EEM', 'MSCI Emerging Markets', 239637, 'ishares-msci-emerging-markets-etf'),
    'eafe': ('EFA', 'MSCI EAFE (desarrollados sin EE. UU.)', 239623, 'ishares-msci-eafe-etf'),
    'europe': ('IEUR', 'MSCI Europe IMI', 264617, 'ishares-core-msci-europe-etf'),
    'emu': ('EZU', 'MSCI EMU (zona euro)', 239644, 'ishares-msci-eurozone-etf'),
    'japan': ('EWJ', 'MSCI Japan', 239665, 'ishares-msci-japan-etf'),
    'small': ('IWM', 'Russell 2000 (pequeñas EE. UU.)', 239710, 'ishares-russell-2000-etf'),
    'wsmall': ('ACWX', 'MSCI ACWI ex US', 239601, 'ishares-msci-acwi-ex-us-etf'),
    'india': ('INDA', 'MSCI India', 239659, 'ishares-msci-india-etf'),
    'china': ('MCHI', 'MSCI China', 239619, 'ishares-msci-china-etf'),
    'semis': ('SOXX', 'NYSE Semiconductor', 239705, 'ishares-semiconductor-etf'),
    'tech': ('IYW', 'Russell 1000 Technology', 239522, 'ishares-us-technology-etf'),
    'health': ('IYH', 'Russell 1000 Health Care', 239511, 'ishares-us-healthcare-etf'),
    'biotech': ('IBB', 'NYSE Biotechnology', 239699, 'ishares-nasdaq-biotechnology-etf'),
    'defense': ('ITA', 'Dow Jones US Select Aerospace & Defense', 239502, 'ishares-us-aerospace-defense-etf'),
    'cleanen': ('ICLN', 'S&P Global Clean Energy', 239738, 'ishares-global-clean-energy-etf'),
    'infra': ('IGF', 'S&P Global Infrastructure', 239746, 'ishares-global-infrastructure-etf'),
    'eufin': ('EUFN', 'MSCI Europe Financials', 239647, 'ishares-msci-europe-financials-etf'),
}
UA = {'User-Agent': E.UA, 'Accept': 'text/csv,application/json,*/*'}
def raw(url, t=25):
    req = E.urllib.request.Request(url, headers=UA)
    with E.urllib.request.urlopen(req, timeout=t) as r: return r.read().decode('utf-8-sig', 'replace')

def ishares_urls():
    """Mapa ticker -> URL de producto desde el buscador oficial de iShares (si responde)."""
    try:
        j = json.loads(raw('https://www.ishares.com/us/product-screener/product-screener-v3.1.jsn?dcrPath=/templatedata/config/product-screener-v3/data/en/us-ishares/ishares-product-screener-backend-config&siteEntryPassthrough=true', 40))
        out = {}
        for pid, p in j.items():
            if not isinstance(p, dict): continue
            t = p.get('localExchangeTicker'); u = p.get('productPageUrl')
            if t and u: out[t] = u
        L('screener iShares:', len(out), 'productos'); return out
    except Exception as e:
        L('screener iShares no disponible:', str(e)[:80]); return {}

def parse_ishares(txt, tk):
    lines = txt.splitlines(); asof = None
    for ln in lines[:12]:
        m = re.match(r'"?Fund Holdings as of"?,\s*"?([^"]+)"?', ln)
        if m: asof = m.group(1).strip()
    hi = next((i for i, ln in enumerate(lines) if ln.startswith('Ticker,') or ln.startswith('"Ticker"')), None)
    if hi is None: raise ValueError('sin cabecera: ' + repr(txt[:260]))
    rows = list(csv.DictReader(io.StringIO('\n'.join(lines[hi:]))))
    hold, country, sector, tot = [], {}, {}, 0.0
    for r in rows:
        try: w = float(str(r.get('Weight (%)', '0')).replace(',', ''))
        except Exception: continue
        ac = (r.get('Asset Class') or '').lower()
        if not w or ('equity' not in ac and ac): continue
        cc = COUNTRY.get((r.get('Location') or '').strip().lower(), 'XX'); sc = sect(r.get('Sector'))
        country[cc] = country.get(cc, 0) + w; sector[sc] = sector.get(sc, 0) + w; tot += w
        hold.append([r.get('Name', '').strip().title()[:48], (r.get('Ticker') or '').strip(), round(w, 3), cc, sc])
    if tot < 50: raise ValueError(f'solo {tot:.0f} % en acciones')
    k = 100 / tot  # re-escalado a 100 % de la parte en acciones
    hold.sort(key=lambda h: -h[2])
    try: asof_iso = datetime.datetime.strptime(asof, '%b %d, %Y').date().isoformat()
    except Exception: asof_iso = asof
    return {'asof': asof_iso, 'n': len(hold), 'country': {c: round(v * k, 2) for c, v in sorted(country.items(), key=lambda x: -x[1])},
            'sector': {s: round(v * k, 2) for s, v in sorted(sector.items(), key=lambda x: -x[1])},
            'top': [[h[0], h[1], round(h[2] * k, 3), h[3], h[4]] for h in hold[:120]]}

def parse_ishares_json(txt):
    j = json.loads(txt.lstrip('\ufeff'))
    rows = j.get('aaData') or []
    hold, country, sector, tot = [], {}, {}, 0.0
    for r in rows:
        try:
            tk, nm, sc, ac = r[0], r[1], r[2], r[3]
            w = r[5]['raw'] if isinstance(r[5], dict) else float(r[5])
            loc = next((x for x in r if isinstance(x, str) and x.strip().lower() in COUNTRY), '')
        except Exception: continue
        if not w or 'equity' not in str(ac).lower(): continue
        cc = COUNTRY.get(loc.strip().lower(), 'XX'); s2 = sect(sc)
        country[cc] = country.get(cc, 0) + w; sector[s2] = sector.get(s2, 0) + w; tot += w
        hold.append([str(nm).title()[:48], str(tk), round(w, 3), cc, s2])
    if tot < 50: raise ValueError(f'json: solo {tot:.0f} %')
    k = 100 / tot; hold.sort(key=lambda h: -h[2])
    return {'asof': None, 'n': len(hold), 'country': {c: round(v * k, 2) for c, v in sorted(country.items(), key=lambda x: -x[1])},
            'sector': {s: round(v * k, 2) for s, v in sorted(sector.items(), key=lambda x: -x[1])}, 'top': [[h[0], h[1], round(h[2] * k, 3), h[3], h[4]] for h in hold[:120]]}

UK = {'world': ('SWDA', 251882, 'ishares-msci-world-ucits-etf-acc-fund'), 'sp500': ('CSPX', 253743, 'ishares-sp-500-b-ucits-etf-acc-fund'),
      'acwi': ('SSAC', 251850, 'ishares-msci-acwi-ucits-etf'), 'em': ('EIMI', 264659, 'ishares-msci-emerging-markets-imi-ucits-etf'),
      'europe': ('IMEU', 251861, 'ishares-msci-europe-ucits-etf-acc-fund'), 'japan': ('IJPA', 251852, 'ishares-msci-japan-ucits-etf-acc-fund')}

def get_index(key, urls):
    tk, name, pid, slug = INDEX[key]
    base = ('https://www.ishares.com' + urls[tk]) if tk in urls else f'https://www.ishares.com/us/products/{pid}/{slug}'
    tries = [('csv', base + f'/1467271812596.ajax?fileType=csv&fileName={tk}_holdings&dataType=fund'),
             ('json', base + '/1467271812596.ajax?tab=all&fileType=json'),
             ('csv', base + f'/1395165510754.ajax?fileType=csv&fileName={tk}_holdings&dataType=fund')]
    if key in UK:
        t2, p2, s2 = UK[key]; ub = f'https://www.ishares.com/uk/individual/en/products/{p2}/{s2}'
        tries += [('csv', ub + f'/1506575576011.ajax?fileType=csv&fileName={t2}_holdings&dataType=fund'), ('json', ub + '/1506575576011.ajax?tab=all&fileType=json')]
    for kind, u in tries:
        try:
            txt = raw(u)
            d = parse_ishares(txt, tk) if kind == 'csv' else parse_ishares_json(txt)
            d.update(name=name, src=f'iShares {tk} (cartera completa publicada)', etf=tk)
            L(f'  índice {key} ← {kind} OK: {d["n"]} empresas a {d["asof"]} · EE. UU. {d["country"].get("US", 0):.1f} % · {u[:120]}'); return d
        except Exception as e: L(f'  índice {key} {kind} falló: {str(e)[:160]} · {u[:130]}')
    return None

def get_ndx():
    """Nasdaq-100 desde el CSV oficial de Invesco (QQQ). No trae país: se usa el sufijo/mercado (aproximado)."""
    try:
        txt = raw('https://www.invesco.com/us/financial-products/etfs/holdings/main/holdings/0?audienceType=Investor&action=download&ticker=QQQ')
        rows = list(csv.DictReader(io.StringIO(txt)))
        L('  invesco cabecera:', repr(txt[:300]))
        hold = []; sector = {}; asof = None
        for r in rows:
            try: w = float(str(r.get('Weight', '0')).replace('%', ''))
            except Exception: continue
            if not w: continue
            sc = sect(r.get('Sector')); sector[sc] = sector.get(sc, 0) + w; asof = asof or r.get('Date')
            hold.append([(r.get('Name') or '').title()[:48], (r.get('Holding Ticker') or '').strip(), w, 'US', sc])
        tot = sum(h[2] for h in hold)
        if tot < 50: raise ValueError('pocos datos')
        k = 100 / tot; hold.sort(key=lambda h: -h[2])
        L(f'  índice ndx ← QQQ (Invesco): {len(hold)} empresas')
        return {'name': 'Nasdaq-100', 'src': 'Invesco QQQ (cartera completa; país supuesto EE. UU.)', 'etf': 'QQQ', 'asof': asof, 'n': len(hold),
                'country': {'US': 100.0}, 'country_note': 'Invesco no publica el país: se asume EE. UU. (cotizan allí); hay excepciones como ASML o AstraZeneca.',
                'sector': {s: round(v * k, 2) for s, v in sorted(sector.items(), key=lambda x: -x[1])}, 'top': [[h[0], h[1], round(h[2] * k, 3), h[3], h[4]] for h in hold[:120]]}
    except Exception as e:
        L('  índice ndx (Invesco) falló:', str(e)[:90]); return None

# ---------- 2. qué replica cada ETF / fondo ----------
TICK_IDX = {'URTH': 'world', 'SPY': 'sp500', 'IVV': 'sp500', 'VOO': 'sp500', 'SSO': 'sp500', 'VT': 'acwi', 'ACWI': 'acwi', 'EEM': 'em', 'IEMG': 'em', 'VWO': 'em',
            'EWJ': 'japan', 'DXJ': 'japan', 'VGK': 'europe', 'IEUR': 'europe', 'EZU': 'emu', 'IWM': 'small', 'INDA': 'india', 'EPI': 'india', 'MCHI': 'china', 'FXI': 'china',
            'SOXX': 'semis', 'QQQ': 'ndx', 'QLD': 'ndx', 'TQQQ': 'ndx', 'IBB': 'biotech', 'ITA': 'defense', 'ICLN': 'cleanen', 'IGF': 'infra', 'EUFN': 'eufin', 'IYW': 'tech'}
RULES = [(r'msci world small', None), (r'equal weight', None), (r'msci world|developed world|world index', 'world'), (r'all[- ]world|acwi|total world|all country', 'acwi'),
         (r's&p 500|s&p500|sp 500|\b500\b', 'sp500'), (r'nasdaq[- ]?100', 'ndx'), (r'emerging', 'em'), (r'\bemu\b|euro ?zone|eurozone', 'emu'),
         (r'europe|stoxx 600', 'europe'), (r'japan|topix|nikkei', 'japan'), (r'india', 'india'), (r'china', 'china'), (r'semiconductor', 'semis'),
         (r'russell 2000', 'small'), (r'eafe|ex[- ]u\.?s', 'eafe')]
LEV = re.compile(r'\b(2x|3x|ultra|lev|bull|bear|short)\b', re.I)

def names():
    s = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    nm = {}
    i = s.find('const UNIV='); j = s.find('\n];', i)
    for t, n in re.findall(r'\{t:"([^"]+)",node:"[^"]*",n:"([^"]+)"', s[i:j]): nm['e:' + t] = n
    i = s.find('const FUNDS='); j = s.find('];', i)
    try:
        for f in json.loads(s[i + len('const FUNDS='):j + 1]): nm['f:' + f['t']] = ' '.join(x for x in (f.get('full'), f.get('n'), f.get('idx') or '') if x)
    except Exception as e: L('FUNDS no legible', e)
    try:
        U = json.load(open(os.path.join(ROOT, 'data', 'universe_x.json')))
        for x in U.get('e', []): nm['e:x:' + x['t']] = (x.get('full') or x.get('n') or '') + ' ' + (x.get('cat') or '')
        for x in U.get('f', []): nm['f:x:' + x['t']] = (x.get('full') or x.get('n') or '') + ' ' + (x.get('cat') or '')
    except Exception: pass
    return nm

def which_index(key, sym, name):
    base = key.split(':')[-1]
    if base in TICK_IDX: return TICK_IDX[base]
    if LEV.search(name or ''): return None
    for pat, ix in RULES:
        if re.search(pat, (name or '').lower()): return ix
    return None

def yahoo_fund(sym):
    r = E.summary(sym, ['topHoldings', 'fundProfile', 'summaryDetail'])
    th = r.get('topHoldings') or {}; fp = r.get('fundProfile') or {}; sd = r.get('summaryDetail') or {}
    v = lambda d, k: (d.get(k) or {}).get('raw') if isinstance(d.get(k), dict) else d.get(k)
    sec = {}
    for d in th.get('sectorWeightings') or []:
        for k, x in d.items():
            w = (x or {}).get('raw') if isinstance(x, dict) else x
            if w: s = sect(k); sec[s] = round(sec.get(s, 0) + w * 100, 2)
    top = []
    for h in th.get('holdings') or []:
        t = h.get('symbol') or ''; w = (h.get('holdingPercent') or {}).get('raw')
        if not w: continue
        suf = t.rsplit('.', 1)[1] if '.' in t else ''; cc = SUFFIX_CC.get(suf, 'US' if t and not suf and not t[:1].isdigit() else 'XX')
        if not suf and t.isdigit(): cc = 'HK' if len(t) == 5 else 'CN' if len(t) == 6 else 'XX'
        top.append([(h.get('holdingName') or t).title()[:48], t, round(w * 100, 3), cc, None])
    eq = th.get('equityHoldings') or {}
    fees = (fp.get('feesExpensesInvestment') or {})
    return {'sector': dict(sorted(sec.items(), key=lambda x: -x[1])), 'top': top, 'cover': round(sum(t[2] for t in top), 1),
            'pe': v(eq, 'priceToEarnings') or v(sd, 'trailingPE'), 'pb': v(eq, 'priceToBook'),
            'stock': (v(th, 'stockPosition') or 0) * 100 if v(th, 'stockPosition') is not None else None,
            'bond': (v(th, 'bondPosition') or 0) * 100 if v(th, 'bondPosition') is not None else None,
            'cash': (v(th, 'cashPosition') or 0) * 100 if v(th, 'cashPosition') is not None else None,
            'ter': (v(fees, 'annualReportExpenseRatio') or 0) * 100 if v(fees, 'annualReportExpenseRatio') else None,
            'cat': fp.get('categoryName'), 'yld': v(sd, 'yield')}


# ---------- 3. SEC N-PORT: cartera completa oficial de cada ETF registrado en EE. UU. (con país ISO) ----------
import xml.etree.ElementTree as ET
SEC_UA = {'User-Agent': 'ProjectATLAS atlas-bot@users.noreply.github.com', 'Accept-Encoding': 'identity', 'Host': 'www.sec.gov'}
def sec_get(url, t=60):
    req = E.urllib.request.Request(url, headers=SEC_UA)
    with E.urllib.request.urlopen(req, timeout=t) as r: return r.read()
_SECMAP = None
def sec_series(ticker):
    global _SECMAP
    if _SECMAP is None:
        try:
            j = json.loads(sec_get('https://www.sec.gov/files/company_tickers_mf.json'))
            f = j['fields']; _SECMAP = {r[f.index('symbol')]: (r[f.index('cik')], r[f.index('seriesId')]) for r in j['data']}
            L('SEC: mapa de', len(_SECMAP), 'clases de fondos/ETFs')
        except Exception as e: L('SEC mapa falló:', str(e)[:120]); _SECMAP = {}
    return _SECMAP.get(ticker)
STOCK_CC, STOCK_SEC = {}, {}
def load_stock_meta():
    s = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    for t, cc in re.findall(r'"t":"([^"]+)"[^{}]*?"cc":"([A-Z]{2})"', s): STOCK_CC[t] = cc
    for t, sc in re.findall(r'"t":"([^"]+)"[^{}]*?"sec":"([^"]+)"', s): STOCK_SEC[t] = sc
    try:
        for x in json.load(open(os.path.join(ROOT, 'data', 'universe_x.json'))).get('s', []):
            if x.get('cc'): STOCK_CC[x['t']] = x['cc']
            if x.get('sec'): STOCK_SEC[x['t']] = x['sec']
    except Exception: pass
SEC_ES = {'Tecnología': 'Tecnología', 'Finanzas': 'Finanzas', 'Salud': 'Salud', 'Energía': 'Energía', 'Consumo': 'Consumo discrecional', 'Industria': 'Industria',
          'Telecomunicaciones': 'Comunicaciones', 'Inmobiliario': 'Inmobiliario', 'Materias primas': 'Materiales', 'Automoción': 'Consumo discrecional',
          'Defensa y espacio': 'Industria', 'Infraestructuras': 'Industria', 'Lujo': 'Consumo discrecional'}
def nport(ticker):
    m = sec_series(ticker)
    if not m: raise ValueError('sin serie SEC')
    cik, series = m
    atom = sec_get(f'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={series}&type=NPORT-P&dateb=&owner=include&count=5&output=atom').decode('utf-8', 'replace')
    hrefs = re.findall(r'<filing-href>([^<]+)</filing-href>', atom)
    if not hrefs: raise ValueError('sin N-PORT')
    folder = hrefs[0].rsplit('/', 1)[0]
    xml = sec_get(folder + '/primary_doc.xml', 120)
    root = ET.fromstring(xml); ns = {'n': 'http://www.sec.gov/edgar/nport'}
    asof = (root.findtext('.//n:genInfo/n:repPdDate', namespaces=ns) or '').strip()
    hold = {}; country = {}; tot = 0.0
    for it in root.iterfind('.//n:invstOrSec', ns):
        cat = (it.findtext('n:assetCat', namespaces=ns) or '').strip()
        try: pct = float(it.findtext('n:pctVal', namespaces=ns) or 0)
        except Exception: continue
        if cat not in ('EC', 'EP') or pct <= 0: continue
        nm = (it.findtext('n:name', namespaces=ns) or it.findtext('n:title', namespaces=ns) or '').strip()
        tkel = it.find('n:identifiers/n:ticker', ns); tk = tkel.get('value') if tkel is not None else ''
        cc = (it.findtext('n:invCountry', namespaces=ns) or 'XX').strip() or 'XX'
        key = (nm.upper(), cc)
        h = hold.setdefault(key, [nm.title()[:48], tk or '', 0.0, cc, None]); h[2] += pct
        country[cc] = country.get(cc, 0) + pct; tot += pct
    if tot < 30: raise ValueError(f'solo {tot:.0f} % en acciones')
    k = 100 / tot; top = sorted(hold.values(), key=lambda h: -h[2])
    for h in top:
        h[2] = round(h[2] * k, 3)
        b = h[1].split('.')[0] if h[1] else ''
        if b in STOCK_SEC: h[4] = SEC_ES.get(STOCK_SEC[b], STOCK_SEC[b])
    return {'asof': asof, 'n': len(top), 'country': {c: round(v * k, 2) for c, v in sorted(country.items(), key=lambda x: -x[1]) if v * k >= .01},
            'top': top[:150], 'src': f'SEC N-PORT de {ticker} (cartera completa oficial, trimestral)'}


# ---------- 4. justETF (por ISIN): reparto por países y sectores + 10 mayores posiciones con ISIN ----------
import http.cookiejar
_JCJ = http.cookiejar.CookieJar(); _JOP = E.urllib.request.build_opener(E.urllib.request.HTTPCookieProcessor(_JCJ))
JUA = {'User-Agent': E.UA, 'Accept-Language': 'en-US,en;q=0.9'}
JSECT = {'technology': 'Tecnología', 'finance': 'Finanzas', 'financials': 'Finanzas', 'industrials': 'Industria', 'healthcare': 'Salud', 'health care': 'Salud',
         'consumer discretionary': 'Consumo discrecional', 'consumer staples': 'Consumo básico', 'telecommunication': 'Comunicaciones', 'communication services': 'Comunicaciones',
         'energy': 'Energía', 'basic materials': 'Materiales', 'materials': 'Materiales', 'real estate': 'Inmobiliario', 'utilities': 'Servicios públicos', 'other': 'Otros'}
def jget(url, ajax_base=None):
    h = dict(JUA)
    if ajax_base: h.update({'Wicket-Ajax': 'true', 'Wicket-Ajax-BaseURL': ajax_base, 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'text/xml, application/xml, */*'})
    with _JOP.open(E.urllib.request.Request(url, headers=h), timeout=40) as r: return r.read().decode('utf-8', 'replace')
def jrows(html, kind):
    names = re.findall(rf'tl_etf-holdings_{kind}_value_name">([^<]+)<', html); vals = re.findall(rf'tl_etf-holdings_{kind}_value_percentage">([\d.,]+)%<', html)
    return [(n.strip(), float(v.replace(',', ''))) for n, v in zip(names, vals)]
def justetf(isin):
    base = f'en/etf-profile.html?isin={isin}'
    h = jget('https://www.justetf.com/' + base)
    if 'etf-holdings_countries_table' not in h: raise ValueError('sin composición')
    cty, sec = jrows(h, 'countries'), jrows(h, 'sectors'); full = {'countries': False, 'sectors': False}
    for kind, comp in (('countries', 'countries-loadMoreCountries'), ('sectors', 'sectors-loadMoreSectors')):
        m = re.search(r'"u":"(/en/etf-profile\.html\?[\d\-.]+holdingsSection-' + comp + r'[^"]*)"', h)
        if not m: continue
        try:
            x = jget('https://www.justetf.com' + m.group(1).replace('\\/', '/'), base)
            rows = jrows(x, kind)
            if rows and len(rows) >= len(cty if kind == 'countries' else sec):
                if kind == 'countries': cty = rows
                else: sec = rows
                full[kind] = True
        except Exception as e: L(f'    justETF {isin} {kind} ampliado falló: {str(e)[:60]}')
        time.sleep(.6)
    top = []
    for m in re.finditer(r'stock-profiles/([A-Z]{2}[A-Z0-9]{9}\d)" title="([^"]+)".*?top-holdings_value_percentage">([\d.,]+)%', h, re.S):
        top.append([html_unescape(m.group(2))[:48], m.group(1), float(m.group(3).replace(',', '')), m.group(1)[:2], None])
    n = re.search(r'top-holdings_count">out of ([\d,]+)<', h)
    country = {}
    for nm, v in cty:
        c = 'XX' if nm.lower() == 'other' else COUNTRY.get(nm.lower(), 'XX'); country[c] = round(country.get(c, 0) + v, 2)
    sector = {}
    for nm, v in sec:
        sc = JSECT.get(nm.lower(), 'Otros'); sector[sc] = round(sector.get(sc, 0) + v, 2)
    return {'country': country, 'sector': sector, 'top_j': top[:10], 'n': int(n.group(1).replace(',', '')) if n else None, 'full': full,
            'src_j': f'justETF ({isin})', 'asof_j': datetime.date.today().isoformat()}
def html_unescape(x):
    import html as H; return H.unescape(x)
IDX_ISIN = {'world': 'IE00B4L5Y983', 'sp500': 'IE00B5BMR087', 'acwi': 'IE00B6R52259', 'em': 'IE00BKM4GZ66', 'europe': 'IE00B4K48X80', 'emu': 'IE00B53QG562',
            'japan': 'IE00B4L5YX21', 'india': 'IE00BZCQB185', 'china': 'IE00BJ5JPG56', 'semis': 'IE000I8KRLL9', 'ndx': 'IE00B53SZB19', 'small': 'IE00BJZ2DC62',
            'eafe': 'IE00B4L5YX21', 'wsmall': 'IE00BF4RFH31'}
def isin_map():
    s = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read(); m = {}
    i = s.find('const UNIV='); j = s.find('\n];', i)
    for t, isin in re.findall(r'\{t:"([^"]+)",[^\n]*?u:U\("[^"]*","[^"]*","([A-Z]{2}[A-Z0-9]{9}\d)"', s[i:j]): m['e:' + t] = isin
    i = s.find('const FUNDS='); j = s.find('];', i)
    try:
        for f in json.loads(s[i + len('const FUNDS='):j + 1]):
            if f.get('isin'): m['f:' + f['t']] = f['isin']
    except Exception: pass
    try:
        U = json.load(open(os.path.join(ROOT, 'data', 'universe_x.json')))
        for x in U.get('e', []):
            if x.get('isin'): m['e:x:' + x['t']] = x['isin']
        for x in U.get('f', []):
            if x.get('isin'): m['f:x:' + x['t']] = x['isin']
    except Exception: pass
    return m

JFRESH = 6; JMAX = 45; JST = {'n': 0, 'fails': 0, 'blocked': False}
def main():
    now = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ')
    E.init_crumb(); L('crumb', 'ok' if E.crumb else 'NO')
    try: old = json.load(open(os.path.join(ROOT, 'data', 'expo.json')))
    except Exception: old = {'idx': {}, 'fund': {}}
    load_stock_meta(); idx = {}
    for k in INDEX:
        d = None
        try: raise ValueError('omitido (SEC bloquea a GitHub)'); d = None; L(f'  índice {k} ← N-PORT {INDEX[k][0]}: {d["n"]} empresas a {d["asof"]} · EE. UU. {d["country"].get("US", 0):.1f} %')
        except Exception as e: L(f'  índice {k} N-PORT falló: {str(e)[:120]}')
        if d:
            try: yf = yahoo_fund(INDEX[k][0]); d['sector'] = yf['sector']; d['pe'] = round(1 / yf['pe'], 2) if yf.get('pe') and yf['pe'] < 1 else yf.get('pe')
            except Exception as e: L(f'  índice {k}: sin sectores Yahoo ({str(e)[:60]})')
        if d: idx[k] = d
        elif k in old.get('idx', {}): idx[k] = old['idx'][k]; L(f'  índice {k}: se conserva el anterior ({old["idx"][k].get("asof")})')
        time.sleep(.6)
    try: raise ValueError('omitido'); d.update(name='Nasdaq-100', etf='QQQM'); L(f'  índice ndx ← N-PORT QQQM: {d["n"]}')
    except Exception as e: d = None; L('  ndx N-PORT falló:', str(e)[:100])
    if d:
        try: yf = yahoo_fund('QQQM'); d['sector'] = yf['sector']
        except Exception: pass
        idx['ndx'] = d
    elif 'ndx' in old.get('idx', {}): idx['ndx'] = old['idx']['ndx']
    nm = names(); fund = {}; nok = 0; IM = isin_map(); JC = {}
    for p in sorted(glob.glob(os.path.join(ROOT, 'data', 'p', '*.json'))):
        b = os.path.basename(p)
        if not (b.startswith('e_') or b.startswith('f_')): continue
        try: j = json.load(open(p))
        except Exception: continue
        k = j.get('k'); y = str(j.get('y') or '')
        if not k: continue
        ix = which_index(k, y, nm.get(k, ''))
        rec = {'proxy': ix if ix in idx else None, 'idx_name': idx[ix]['name'] if ix in idx else None}
        if y and ':' not in y:
            try: rec.update(yahoo_fund(y)); rec['src'] = 'Yahoo Finance (10 mayores posiciones y sectores)'; nok += 1
            except Exception as e: L(f'  {k} {y}: Yahoo sin composición ({str(e)[:50]})')
            time.sleep(.35)
        isin = IM.get(k); jisin = isin if (isin and not k.startswith('f:')) else (IDX_ISIN.get(ix) if ix else None)
        if not jisin and isin and k.startswith('f:') and ix: jisin = IDX_ISIN.get(ix)
        if jisin:
            o = old.get('fund', {}).get(k) or {}
            fresh = o.get('jisin') == jisin and o.get('asof_j') and (datetime.date.today() - datetime.date.fromisoformat(o['asof_j'])).days < JFRESH
            if jisin in JC: jd = JC[jisin]
            elif fresh: jd = None
            elif JST['blocked'] or JST['n'] >= JMAX: jd = None
            else:
                jd = None
                for att in range(2):
                    try:
                        jd = justetf(jisin); JST['n'] += 1; JST['fails'] = 0
                        L(f'  {k}: justETF {jisin} · {len(jd["country"])} países{" (completo)" if jd["full"]["countries"] else " (4 + otros)"} · {len(jd["sector"])} sectores'); break
                    except Exception as e:
                        L(f'  {k}: justETF {jisin} falló: {str(e)[:60]}')
                        if '403' in str(e) or '429' in str(e):
                            JST['fails'] += 1
                            if JST['fails'] >= 3: JST['blocked'] = True; L('  justETF limita peticiones: se para y se reintenta en la próxima ejecución'); break
                            time.sleep(90)
                        else: break
                JC[jisin] = jd; time.sleep(4)
            if not jd and o.get('asof_j') and o.get('jisin') == jisin:  # conserva el último dato bueno (con su fecha)
                jd = {'country': o.get('country') or {}, 'sector': o.get('sector_j') or {}, 'top_j': o.get('top_j') or [], 'n': o.get('n'), 'src_j': o.get('src_j'), 'asof_j': o['asof_j'], 'full': o.get('full') or {}}
            if jd:
                rec.update(country=jd['country'], sector_j=jd['sector'], top_j=jd['top_j'], n=jd['n'], src_j=jd['src_j'], asof_j=jd['asof_j'], full=jd['full'], jisin=jisin,
                           jproxy=(jisin != isin))
        base = k.split(':')[-1]
        if False and k.startswith('e:') and ':x:' not in k and not (rec.get('proxy') and INDEX.get(rec['proxy'], ('',))[0] == base):
            try:
                dn = nport(base); rec.update(country=dn['country'], top_full=dn['top'], n=dn['n'], asof_h=dn['asof'], src_h=dn['src']); L(f'  {k}: N-PORT {dn["n"]} posiciones a {dn["asof"]}')
            except Exception as e: L(f'  {k}: N-PORT no ({str(e)[:60]})')
            time.sleep(.25)
        if rec.get('pe') and rec['pe'] < 1: rec['pe'] = round(1 / rec['pe'], 2)
        if rec.get('pb') and rec['pb'] < 1 and rec['pb'] > 0: rec['pb'] = round(1 / rec['pb'], 2)
        for t in rec.get('top') or []:
            b2 = t[1].split('.')[0]
            if b2 in STOCK_CC: t[3] = STOCK_CC[b2]
            if b2 in STOCK_SEC: t[4] = SEC_ES.get(STOCK_SEC[b2], STOCK_SEC[b2])
        rec['asof'] = now[:10]
        if not rec.get('proxy') and not rec.get('top') and not rec.get('sector') and not rec.get('country') and k in old.get('fund', {}): rec = old['fund'][k]
        fund[k] = rec
    json.dump({'u': now, 'idx': idx, 'fund': fund}, open(os.path.join(ROOT, 'data', 'expo.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    np = sum(1 for f in fund.values() if f.get('proxy'))
    L(f'OK · {len(idx)} índices completos · {len(fund)} ETFs/fondos ({np} por índice, {nok} con datos de Yahoo)')
    open(os.path.join(ROOT, 'data', 'expo_log.txt'), 'w').write('\n'.join(LOG) + '\n')

if __name__ == '__main__': main()
