import json, sys, collections
rows = [json.loads(l) for l in open(sys.argv[1], encoding='utf-8')]
c = collections.Counter(); ex = {}
for r in rows:
    k = (r['s'], r['f'][:20], r['b'])
    c[k] += 1
    ex.setdefault(k, []).append(r['t'][:50]) if len(ex.get(k, [])) < 4 else None
for k, v in c.most_common(30):
    print(v, k, ex[k])
