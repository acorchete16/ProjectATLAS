#!/usr/bin/env python3
"""Descarga el último año de cierres diarios de cada acción, ETF y fondo de la app
y los guarda en data/prices.json para que las fichas carguen al instante.
Fuentes, por orden: Yahoo Finance -> Stooq -> EODHD (máx. 18 consultas por ejecución).
Deja un diagnóstico en data/prices_log.txt. Lo ejecuta GitHub Actions dos veces al día."""
import json, time, urllib.request, urllib.parse, datetime, sys, os, csv, io

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYM = os.path.join(ROOT, 'data', 'symbols.json')
OUT = os.path.join(ROOT, 'data', 'prices.json')
LOG = os.path.join(ROOT, 'data', 'prices_log.txt')
EOD_KEY = os.environ.get('EODHD_KEY') or '6ac044dd2ffb75.42832912'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9'}
log = []
def L(*a):
    s = ' '.join(str(x) for x in a); print(s); log.append(s)

def raw(url, timeout=12):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return r.read().decode('utf-8', 'replace')

def pack(pts, cur, src):
    pts = sorted(p for p in pts if p[1])
    cut = datetime.date.today() - datetime.timedelta(days=372)
    pts = [p for p in pts if p[0] >= cut]
    if len(pts) < 5: raise ValueError('pocos datos')
    d0 = pts[0][0]
    return {'d0': d0.isoformat(), 'o': [(d - d0).days for d, _ in pts],
            'c': [float(f'{c:.5g}') for _, c in pts], 'cur': cur, 'y': src}

# ---- Yahoo ----
yahoo_ok = True; yahoo_fail_streak = 0
def yahoo(sym):
    last = None
    for host in ('query1', 'query2'):
        try:
            j = json.loads(raw(f'https://{host}.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?range=1y&interval=1d'))
            r = j['chart']['result'][0]; q = r['indicators']
            cls = q['quote'][0].get('close') or []
            adj = (q.get('adjclose') or [{}])[0].get('adjclose') or [None] * len(cls)
            cl = [a if a is not None else c for a, c in zip(adj, cls)]  # el último día a veces no trae ajustado
            pts = [(datetime.datetime.utcfromtimestamp(t).date(), c) for t, c in zip(r.get('timestamp') or [], cl)]
            return pack(pts, r['meta'].get('currency'), sym)
        except Exception as e:
            last = e
    raise last
def yahoo_isin(isin):
    for host in ('query2', 'query1'):
        try:
            j = json.loads(raw(f'https://{host}.finance.yahoo.com/v1/finance/search?q={isin}&quotesCount=5&newsCount=0'))
            q = [x for x in j.get('quotes', []) if x.get('symbol')]
            if q: return q[0]['symbol']
        except Exception: pass
    return None

# ---- Stooq ----
STQ = {'.DE': '.de', '.L': '.uk', '.T': '.jp', '.HK': '.hk', '.PA': '.fr', '.MC': '.es'}
CUR = {'.us': 'USD', '.de': 'EUR', '.uk': 'GBp', '.jp': 'JPY', '.hk': 'HKD', '.fr': 'EUR', '.es': 'EUR'}
def stooq(y):
    if '.' in y and not y.startswith('BRK'):
        base, suf = y.rsplit('.', 1); suf = '.' + suf
        if suf not in STQ: raise ValueError('sin mercado en stooq')
        s = base.lower() + STQ[suf]
    else:
        s = y.lower() + '.us'
    d1 = (datetime.date.today() - datetime.timedelta(days=372)).strftime('%Y%m%d')
    txt = raw(f'https://stooq.com/q/d/l/?s={s}&i=d&d1={d1}')
    rows = list(csv.DictReader(io.StringIO(txt)))
    if not rows or 'Close' not in rows[0]: raise ValueError('stooq: ' + txt[:60].replace('\n', ' '))
    pts = [(datetime.date.fromisoformat(r['Date']), float(r['Close'])) for r in rows if r.get('Close') not in (None, '', 'N/D')]
    return pack(pts, CUR.get('.' + s.rsplit('.', 1)[1], None), 'stooq:' + s)

# ---- EODHD ----
eod_budget = 18
EOD_SUF = {'.DE': '.XETRA', '.L': '.LSE', '.T': '.TSE', '.NS': '.NSE', '.CO': '.CO', '.HK': '.HK', '.PA': '.PA', '.MC': '.MC'}
EOD_CUR = {'US': 'USD', 'XETRA': 'EUR', 'LSE': 'GBp', 'TSE': 'JPY', 'NSE': 'INR', 'CO': 'DKK', 'HK': 'HKD', 'PA': 'EUR', 'MC': 'EUR', 'EUFUND': 'EUR'}
def eodhd(v):
    global eod_budget
    if eod_budget <= 0: raise ValueError('sin cupo EODHD')
    if v.get('isin'): s = v['isin'] + '.EUFUND'
    else:
        y = v['y']
        if '.' in y and not y.startswith('BRK'):
            base, suf = y.rsplit('.', 1); s = base + EOD_SUF.get('.' + suf, '.' + suf)
        else: s = y.replace('.', '-') + '.US'
    eod_budget -= 1
    frm = (datetime.date.today() - datetime.timedelta(days=360)).isoformat()
    j = json.loads(raw(f'https://eodhd.com/api/eod/{s}?api_token={EOD_KEY}&fmt=json&from={frm}', timeout=20))
    if not isinstance(j, list): raise ValueError('eodhd: ' + str(j)[:80])
    pts = [(datetime.date.fromisoformat(x['date']), float(x.get('adjusted_close') or x['close'])) for x in j]
    return pack(pts, EOD_CUR.get(s.rsplit('.', 1)[1]), 'eodhd:' + s)

def main():
    global yahoo_ok, yahoo_fail_streak
    syms = json.load(open(SYM))
    try: old = json.load(open(OUT))
    except Exception: old = {'data': {}}
    data, fails, src_n = {}, [], {}
    order = sorted(syms.items(), key=lambda kv: 0 if kv[0].startswith('f:') else 1)  # fondos primero (necesitan EODHD si Yahoo falla)
    t0 = time.time()
    for key, v in order:
        if time.time() - t0 > 14 * 60: fails.append(key + ': sin tiempo'); continue
        got, errs = None, []
        y = v.get('y')
        if yahoo_ok:
            try:
                if not y and v.get('isin'):
                    y = yahoo_isin(v['isin'])
                    if y: v['y_yahoo'] = y
                if y:
                    got = yahoo(v.get('y_yahoo') or y); yahoo_fail_streak = 0
            except Exception as e:
                errs.append('yahoo ' + str(e)[:60]); yahoo_fail_streak += 1
                if yahoo_fail_streak >= 8 and not any(k2 for k2 in data if data[k2]['y'] and not str(data[k2]['y']).startswith(('stooq', 'eodhd'))):
                    yahoo_ok = False; L('Yahoo parece bloqueado: se omite el resto')
        if not got and v.get('y'):
            try: got = stooq(v['y'])
            except Exception as e: errs.append('stooq ' + str(e)[:60])
        if not got:
            try: got = eodhd(v)
            except Exception as e: errs.append('eodhd ' + str(e)[:60])
        if got:
            data[key] = got; s = got['y'].split(':')[0] if ':' in got['y'] else 'yahoo'; src_n[s] = src_n.get(s, 0) + 1
        else:
            fails.append(key + ' | ' + ' ; '.join(errs))
            if key in old.get('data', {}): data[key] = old['data'][key]
        time.sleep(0.25)
    out = {'updated': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ'), 'data': data}
    json.dump(out, open(OUT, 'w'), separators=(',', ':'))
    L(f'OK {len(data)}/{len(syms)} · fuentes {src_n} · fallos {len(fails)} · {int(time.time()-t0)} s')
    for f in fails: L('  -', f)
    open(LOG, 'w').write('\n'.join(log) + '\n')

if __name__ == '__main__':
    main()
