#!/usr/bin/env python3
"""Liste les textes français passés à t("...") ou aux props label=/confirm= pour vérifier la couverture de lib/i18n-en.ts"""
import re,glob,json,sys
files=[f for f in glob.glob('**/*.ts*',recursive=True) if not f.startswith(('node_modules','.next','scripts'))]
keys=set()
for f in files:
    s=open(f).read()
    for m in re.finditer(r'\bt\(\s*"((?:[^"\\]|\\.)*)"',s): keys.add(json.loads('"'+m.group(1)+'"'))
    for m in re.finditer(r"\bt\(\s*'((?:[^'\\]|\\.)*)'",s): keys.add(m.group(1).replace("\\'","'"))
    for m in re.finditer(r'\b(?:label|confirm)="((?:[^"\\]|\\.)*)"',s): keys.add(m.group(1))
    for m in re.finditer(r'\bkicker=\{t\(',s): pass
print(json.dumps(sorted(keys),ensure_ascii=False,indent=0))
