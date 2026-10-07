#!/usr/bin/env python3
"""«Ones to watch»: valores con noticias recientes favorables (catalizadores) y que no se han disparado ya.
Fuente: titulares RSS de Yahoo Finance por símbolo. Puntuación sencilla y transparente:
  noticias = suma de (tono del titular × peso por antigüedad); + empuje del último mes; − si ya ha subido demasiado.
Salida: data/watch.json"""
import json, os, glob, re, time, math, datetime, urllib.request, urllib.parse, html
from email.utils import parsedate_to_datetime
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'}
POS = {  # palabra/expresión -> (peso, etiqueta)
 r'\bupgrad': (2.0, 'Mejora de recomendación'), r'\bbeat(s)?\b|tops estimates|above estimates|better-than-expected': (2.0, 'Supera previsiones'),
 r'raises? (its |full-year )?(guidance|outlook|forecast)|boosts? (guidance|outlook)': (2.5, 'Sube previsiones'), r'record (revenue|sales|quarter|profit)': (1.5, 'Ventas récord'),
 r'\b(wins?|awarded|secures?|lands?)\b.*\b(contract|deal|order)': (2.0, 'Nuevo contrato'), r'\bcontract\b': (.8, 'Contrato'),
 r'fda (approv|clear)|approval': (2.0, 'Aprobación'), r'partnership|partners with|collaborat|teams up': (1.2, 'Alianza'),
 r'buyback|share repurchase': (1.5, 'Recompra de acciones'), r'dividend (hike|increase)|raises dividend': (1.5, 'Sube dividendo'),
 r'price target (raised|hike)|raises (price )?target|lifts target': (1.8, 'Suben precio objetivo'), r'\boutperform|\bbuy rating|overweight': (1.2, 'Recomendación de compra'),
 r'surge|soar|jump|rall(y|ies)|climbs?': (.3, 'Sube con fuerza'), r'strong demand|demand (boom|surge)': (1.2, 'Demanda fuerte'),
 r'\bai\b|artificial intelligence|data center': (.25, 'Tirón de la IA'), r'launch(es|ed)?|unveil': (.6, 'Lanzamiento'), r'acquir|takeover|to buy ': (.8, 'Operación corporativa'),
}
NEG = {
 r'\bdowngrad': 2.2, r'\bmiss(es|ed)?\b|below estimates|worse-than-expected': 2.0, r'cuts? (its )?(guidance|outlook|forecast)|lowers? (guidance|outlook)': 2.5,
 r'lawsuit|sued|probe|investigation|subpoena|antitrust|fine[ds]?\b': 1.6, r'recall|halt|suspend': 1.5, r'layoffs?|job cuts': .8, r'plunge|tumble|sink|slump|falls?|drops?|slides?|dips?': .9,
 r'price target (cut|lowered)|cuts (price )?target': 1.8, r'underperform|sell rating|underweight': 1.5, r'bankrupt|default|going concern': 3.0, r'short seller|fraud': 2.5,
}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=12) as r: return r.read()

def news(sym):
    out = []
    for url in (f'https://feeds.finance.yahoo.com/rss/2.0/headline?s={urllib.parse.quote(sym)}&region=US&lang=en-US',):
        try:
            root = ET.fromstring(get(url))
            for it in root.iter('item'):
                t = html.unescape((it.findtext('title') or '').strip()); l = (it.findtext('link') or '').strip()
                try: d = parsedate_to_datetime(it.findtext('pubDate')).astimezone(datetime.timezone.utc)
                except Exception: continue
                if t: out.append((t, l, d))
        except Exception: pass
    return out

GENERIC = re.compile(r'futures|\bdow\b|s&p 500|nasdaq|stock market|stocks to (buy|watch)|top (stocks|movers)|wall street|market (today|wrap)|premarket|midday|biggest movers|\betfs?\b', re.I)
def names_map():
    m = {}
    try:
        txt = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
        for t, n in re.findall(r'\{"t":"([^"]+)"[^{}]*?"n":"([^"]+)"', txt): m[t] = n
    except Exception: pass
    try:
        for x in json.load(open(os.path.join(ROOT, 'data', 'universe_x.json'))).get('s', []): m[x['t']] = x.get('n') or m.get(x['t'])
    except Exception: pass
    return m
def relevant(title, sym, name):
    tl = title.lower(); base = sym.split('.')[0].lower()
    keys = {base} if len(base) >= 2 and not base.isdigit() else set()
    if name:
        w = re.sub(r'[^a-z0-9 ]', ' ', name.lower()).split()
        stop = {'the', 'inc', 'corp', 'co', 'group', 'holdings', 'company', 'ltd', 'plc', 'sa', 'ag', 'se', 'nv', 'class', 'and', 'de'}
        w = [x for x in w if x not in stop]
        if w: keys.add(w[0])
    return any(re.search(r'(?<![a-z0-9])' + re.escape(k) + r'(?![a-z0-9])', tl) for k in keys)
def tone(title):
    s, tags = 0.0, []
    tl = title.lower()
    for pat, (w, tag) in POS.items():
        if re.search(pat, tl): s += w; tags.append(tag)
    for pat, w in NEG.items():
        if re.search(pat, tl): s -= w
    return s, tags

def main():
    now = datetime.datetime.now(datetime.timezone.utc)
    try: rank = json.load(open(os.path.join(ROOT, 'data', 'rank.json'))); F = rank['f']; R = {k: dict(zip(F, v)) for k, v in rank['d'].items()}
    except Exception: R = {}
    NM = names_map(); items = {}
    for p in glob.glob(os.path.join(ROOT, 'data', 'p', '*.json')):
        b = os.path.basename(p)
        if not b.startswith('s_'): continue
        try: j = json.load(open(p))
        except Exception: continue
        y = str(j.get('y') or '')
        if y and ':' not in y and j.get('k'): items.setdefault(y, j['k'])
    res = []; seen_titles = set()
    for y, k in items.items():
        ns = news(y); time.sleep(.25)
        if not ns: continue
        sc, pos_n, neg_n, tags, heads = 0.0, 0, 0, {}, []
        nm = NM.get(k.split(':')[-1]) or NM.get(y)
        for t, l, d in ns:
            age = (now - d).total_seconds() / 3600
            if age > 120 or not relevant(t, y, nm): continue
            s, tg = tone(t); w = math.exp(-age / 48) * (.3 if GENERIC.search(t) else 1) * (.45 if len(set(re.findall(r'\b[A-Z]{2,5}\b', t))) >= 3 else 1)
            sc += s * w
            if s > 0: pos_n += 1
            if s < 0: neg_n += 1
            for g in tg: tags[g] = tags.get(g, 0) + w
            heads.append({'t': t[:160], 'l': l, 'd': d.strftime('%Y-%m-%dT%H:%MZ'), 's': round(s, 1)})
        if not heads: continue
        r = R.get(k, {}); m1 = r.get('r1m'); y1 = r.get('r1y')
        mom = 0 if m1 is None else max(-1.0, min(1.0, m1 / 15))
        hot = 0 if m1 is None else max(0, (m1 - 25) / 12)  # ya se ha disparado: menos margen
        final = sc + .6 * mom - hot
        if sc <= .8 or pos_n == 0: continue
        heads.sort(key=lambda h: (-(h['s'] > 0), h['d']), reverse=False)
        heads = sorted(heads, key=lambda h: (h['s'], h['d']), reverse=True)[:4]
        res.append({'k': k, 'y': y, 'score': round(final, 2), 'news': round(sc, 2), 'pos': pos_n, 'neg': neg_n, 'r1m': m1, 'r1y': y1,
                    'tags': [t for t, _ in sorted(tags.items(), key=lambda x: -x[1])][:3], 'h': heads})
    res.sort(key=lambda x: -x['score'])
    json.dump({'u': now.strftime('%Y-%m-%dT%H:%MZ'), 'n': len(items), 'd': res[:30]}, open(os.path.join(ROOT, 'data', 'watch.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print('watch', len(res), 'de', len(items))

if __name__ == '__main__': main()
