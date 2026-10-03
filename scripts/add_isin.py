#!/usr/bin/env python3
"""Añade al universo de la app una inversión identificada por su ISIN (o ticker).
Uso: python scripts/add_isin.py IE00B5BMR087 [IE00... ...]
Busca el ISIN en Yahoo Finance, decide si es acción, ETF o fondo y lo apunta en data/universe.json
(marcado como 'mine' para no descartarlo por historia corta) y en data/isin_map.json, que la app usa para
reconocer el ISIN. El flujo de precios diario hace el resto (ficha, sede y precios)."""
import json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import enrich as E

EU = ('.DE', '.AS', '.MI', '.PA', '.L', '.SW', '.MC', '.F', '.VI', '.IR', '.BR', '.LS')

def lookup(q):
    j = E.get('https://query2.finance.yahoo.com/v1/finance/search?q=' + urllib.parse.quote(q) + '&quotesCount=10&newsCount=0')
    qs = [x for x in j.get('quotes', []) if x.get('symbol') and x.get('quoteType') in ('EQUITY', 'ETF', 'MUTUALFUND')]
    if not qs: return None
    qt = qs[0]['quoteType']; same = [x for x in qs if x['quoteType'] == qt]
    if qt == 'EQUITY':
        if q.startswith('US'): pick = next((x for x in same if '.' not in x['symbol']), same[0])
        else: pick = next((x for x in same if '.' not in x['symbol'] or x['symbol'].endswith(EU)), same[0])
    elif qt == 'ETF': pick = next((x for x in same if x['symbol'].endswith(('.DE', '.AS', '.MI', '.PA'))), same[0])
    else: pick = same[0]
    return qt, pick['symbol'], pick.get('longname') or pick.get('shortname') or pick['symbol']

def main(args):
    u = json.load(open(E.P('universe.json')))
    try: m = json.load(open(E.P('isin_map.json')))
    except Exception: m = {}
    added = []
    for raw in args:
        q = re.sub(r'[^A-Za-z0-9.\-]', '', raw).upper()
        if not q: continue
        try: r = lookup(q)
        except Exception as e: print('ERROR', q, e); continue
        if not r: print('NO ENCONTRADO', q); m[q] = {'err': 'no encontrado'}; continue
        qt, sym, name = r
        if qt == 'EQUITY':
            if sym not in u['stocks']: u['stocks'].append(sym)
            m[q] = {'k': 's', 't': sym, 'n': name}
        elif qt == 'ETF':
            if not any(e['t'] == sym for e in u['etfs']): u['etfs'].append({'t': sym, 'isin': q, 'mine': True})
            m[q] = {'k': 'e', 't': sym, 'n': name}
        else:
            if not any(f.get('isin') == q for f in u['funds']): u['funds'].append({'isin': q, 'n': name, 'mine': True})
            m[q] = {'k': 'f', 'isin': q, 'n': name}
        added.append(f'{q} → {sym} ({qt.lower()}): {name}'); print('OK', added[-1])
    json.dump(u, open(E.P('universe.json'), 'w'), ensure_ascii=False, indent=0)
    json.dump(m, open(E.P('isin_map.json'), 'w'), ensure_ascii=False, indent=0)
    open(E.P('isin_log.txt'), 'w').write('\n'.join(added) or 'nada añadido')

if __name__ == '__main__':
    E.init_crumb(); main(sys.argv[1:] or os.environ.get('ISINS', '').split())
