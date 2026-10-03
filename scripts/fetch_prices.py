#!/usr/bin/env python3
"""Descarga el último año de cierres diarios de cada acción, ETF y fondo de la app
y los guarda en data/prices.json para que las fichas carguen al instante.
Fuente: Yahoo Finance (gráfico diario). Los fondos se buscan por ISIN.
Lo ejecuta GitHub Actions (.github/workflows/prices.yml) dos veces al día."""
import json, time, urllib.request, urllib.parse, datetime, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYM = os.path.join(ROOT, 'data', 'symbols.json')
OUT = os.path.join(ROOT, 'data', 'prices.json')
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept': 'application/json'}

def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            err = e
            time.sleep(1.5 * (i + 1))
    raise err

def resolve_isin(isin):
    for host in ('query2', 'query1'):
        try:
            j = get(f'https://{host}.finance.yahoo.com/v1/finance/search?q={isin}&quotesCount=5&newsCount=0')
            q = [x for x in j.get('quotes', []) if x.get('symbol')]
            if q:
                return q[0]['symbol']
        except Exception:
            pass
    return None

def chart(sym):
    last = None
    for host in ('query1', 'query2'):
        try:
            j = get(f'https://{host}.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?range=1y&interval=1d&includeAdjustedClose=true')
            r = j['chart']['result'][0]
            ts = r.get('timestamp') or []
            q = r['indicators']
            cl = (q.get('adjclose') or [{}])[0].get('adjclose') or q['quote'][0]['close']
            cur = r['meta'].get('currency')
            pts = [(datetime.datetime.utcfromtimestamp(t).date(), c) for t, c in zip(ts, cl) if c]
            if len(pts) < 5:
                raise ValueError('pocos datos')
            d0 = pts[0][0]
            return {'d0': d0.isoformat(), 'o': [(d - d0).days for d, _ in pts],
                    'c': [float(f'{c:.4g}') if c < 1000 else round(c, 1) for _, c in pts], 'cur': cur, 'y': sym}
        except Exception as e:
            last = e
    raise last

def main():
    syms = json.load(open(SYM))
    try:
        old = json.load(open(OUT))
    except Exception:
        old = {'data': {}}
    data, fails, changed_syms = {}, [], False
    for key, v in syms.items():
        y = v.get('y')
        if not y and v.get('isin'):
            y = resolve_isin(v['isin'])
            if y:
                v['y'] = y; changed_syms = True
        if not y:
            fails.append(key); continue
        try:
            data[key] = chart(y)
        except Exception as e:
            fails.append(f'{key}({y}): {e}')
            if key in old.get('data', {}):
                data[key] = old['data'][key]   # conserva el último dato bueno
        time.sleep(0.35)
    out = {'updated': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ'), 'source': 'Yahoo Finance', 'data': data}
    json.dump(out, open(OUT, 'w'), separators=(',', ':'))
    if changed_syms:
        json.dump(syms, open(SYM, 'w'), separators=(',', ':'))
    print(f'OK {len(data)}/{len(syms)}  fallos: {len(fails)}')
    for f in fails:
        print('  -', f)
    if len(data) < len(syms) * 0.5:
        sys.exit(1)

if __name__ == '__main__':
    main()
