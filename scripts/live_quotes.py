#!/usr/bin/env python3
"""Cotizaciones casi en vivo (≈15 min de retraso) para la app: último precio de cada valor.
Lee qué símbolo de Yahoo usa cada clave en data/p/*.json y pide las cotizaciones por lotes.
Salida: data/live.json -> {"u": hora UTC, "d": {clave: [precio, cierre_anterior, epoch]}}"""
import json, os, glob, time, datetime, urllib.parse, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import enrich as E

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    keys = {}
    for p in glob.glob(os.path.join(ROOT, 'data', 'p', '*.json')):
        if os.path.basename(p).startswith('_'): continue
        try: j = json.load(open(p))
        except Exception: continue
        y = str(j.get('y') or '')
        if y and ':' not in y and j.get('k'): keys.setdefault(y, []).append(j['k'])
    E.init_crumb(); out = {}; syms = list(keys); ok_batch = 0
    for i in range(0, len(syms), 40):
        part = syms[i:i + 40]
        q = 'symbols=' + urllib.parse.quote(','.join(part)) + '&fields=regularMarketPrice,regularMarketPreviousClose,regularMarketTime' + (f'&crumb={urllib.parse.quote(E.crumb)}' if E.crumb else '')
        res = None
        for h in ('query1', 'query2'):
            try: res = E.get(f'https://{h}.finance.yahoo.com/v7/finance/quote?{q}')['quoteResponse']['result']; break
            except Exception as e: print('v7', h, e)
        if res is None: continue
        ok_batch += 1
        for r in res:
            px, pc, tm = r.get('regularMarketPrice'), r.get('regularMarketPreviousClose'), r.get('regularMarketTime')
            if px and tm:
                for k in keys.get(r.get('symbol'), []): out[k] = [float(f'{px:.6g}'), float(f'{pc:.6g}') if pc else None, int(tm)]
        time.sleep(.4)
    # respaldo: si el endpoint por lotes falla, gráfico de 1 día símbolo a símbolo
    if not out:
        for y in syms:
            try:
                m = E.get(f'https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(y)}?range=1d&interval=1d')['chart']['result'][0]['meta']
                if m.get('regularMarketPrice') and m.get('regularMarketTime'):
                    for k in keys[y]: out[k] = [float(f"{m['regularMarketPrice']:.6g}"), m.get('chartPreviousClose'), int(m['regularMarketTime'])]
            except Exception: pass
            time.sleep(.15)
    json.dump({'u': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ'), 'd': out}, open(os.path.join(ROOT, 'data', 'live.json'), 'w'), separators=(',', ':'))
    print('live', len(out), 'de', sum(len(v) for v in keys.values()), 'lotes ok', ok_batch)

if __name__ == '__main__': main()
