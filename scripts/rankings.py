#!/usr/bin/env python3
"""Calcula los rankings en vivo a partir de los precios descargados (data/p/*.json).
Para cada valor: rentabilidad de 1 mes, 6 meses, 1 año, en lo que va de año, 3 años, volatilidad de 1 año,
tendencia (precio frente a su media de 200 sesiones y media de 50 frente a la de 200) y caída máxima del último año.
Salida compacta: data/rank.json -> {"u": fecha, "f": [campos], "d": {clave: [valores]}}"""
import json, os, glob, math, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = ['r1m', 'r6m', 'r1y', 'ytd', 'r3y', 'vol', 'tr200', 'tr50', 'dd1y']

def series(s):
    d0 = datetime.date.fromisoformat(s['d0']); return [(d0 + datetime.timedelta(days=o), c) for o, c in zip(s['o'], s['c']) if c]

def at(ser, day):
    best = None
    for d, c in ser:
        if d <= day: best = c
        else: break
    return best

def main():
    out = {}
    for p in glob.glob(os.path.join(ROOT, 'data', 'p', '*.json')):
        b = os.path.basename(p)
        if b.startswith('_') or b.startswith('x_'): continue
        try: j = json.load(open(p))
        except Exception: continue
        if not j.get('o') or len(j['o']) < 20: continue
        ser = series(j); last_d, last = ser[-1]
        def ret(days):
            t = last_d - datetime.timedelta(days=days); v = at(ser, t)
            if v is None and (ser[0][0] - t).days <= 7: v = ser[0][1]
            if v is None and j.get('w') and j['w'].get('o'): v = at(series(j['w']), t)
            return round((last / v - 1) * 100, 2) if v else None
        ytd0 = at(ser, datetime.date(last_d.year - 1, 12, 31)) or (ser[0][1] if ser[0][0].year == last_d.year else None)
        lr = [math.log(ser[i][1] / ser[i - 1][1]) for i in range(1, len(ser)) if ser[i - 1][1] > 0 and ser[i][1] > 0]
        vol = round(math.sqrt(sum((x - sum(lr) / len(lr)) ** 2 for x in lr) / (len(lr) - 1)) * math.sqrt(252) * 100, 1) if len(lr) > 30 else None
        r3 = None
        if j.get('w') and j['w'].get('o'):
            ws = series(j['w']); v = at(ws, last_d - datetime.timedelta(days=3 * 365))
            if v and ws[0][0] <= last_d - datetime.timedelta(days=3 * 365 - 10): r3 = round(((last / v) ** (1 / 3) - 1) * 100, 2)
        cs = [c for _, c in ser]
        ma = lambda n: sum(cs[-n:]) / n if len(cs) >= n else None
        m200, m50 = ma(200), ma(50)
        tr200 = round((last / m200 - 1) * 100, 2) if m200 else None
        tr50 = round((m50 / m200 - 1) * 100, 2) if m50 and m200 else None
        pk, dd = cs[0], 0.0
        for c in cs: pk = max(pk, c); dd = min(dd, c / pk - 1)
        out[j.get('k') or b[:-5]] = [ret(30), ret(182), ret(365), round((last / ytd0 - 1) * 100, 2) if ytd0 else None, r3, vol, tr200, tr50, round(dd * 100, 2)]
    json.dump({'u': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ'), 'f': F, 'd': out}, open(os.path.join(ROOT, 'data', 'rank.json'), 'w'), separators=(',', ':'))
    print('rankings:', len(out))

if __name__ == '__main__': main()
