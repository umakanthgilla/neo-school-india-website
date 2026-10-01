from pathlib import Path

updates = {
    'schools.html': [('/learning-admin.js?v=20261001-rhythm1','/learning-admin.js?v=20261001-v2exp1')],
    'teachers.html': [('/learning-family.js?v=20261001-daywise2','/learning-family.js?v=20261001-v2exp1')],
}

for name, pairs in updates.items():
    p = Path(name)
    s = p.read_text()
    changed = False
    for old, new in pairs:
        if new in s:
            continue
        if old not in s:
            raise SystemExit(f'{name}: missing cache target {old}')
        s = s.replace(old, new, 1)
        changed = True
    if changed:
        p.write_text(s)
        print(f'Updated {name}')
