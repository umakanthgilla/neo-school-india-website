from pathlib import Path
import re

updates = {
    'schools.html': ('learning-admin.js', '20261001-rhythm1', '20261001-v2exp1'),
    'teachers.html': ('learning-family.js', '20261001-daywise2', '20261001-v2exp1'),
}

for name, (asset, old_version, target_version) in updates.items():
    p = Path(name)
    s = p.read_text()
    old = f'/{asset}?v={old_version}'
    new = f'/{asset}?v={target_version}'

    if new in s:
        print(f'{name}: cache target already applied.')
        continue

    if old in s:
        p.write_text(s.replace(old, new, 1))
        print(f'Updated {name}')
        continue

    match = re.search(r'/' + re.escape(asset) + r'\?v=([^"\']+)', s)
    if match:
        print(f'{name}: keeping existing newer/different cache version {match.group(1)}.')
        continue

    raise SystemExit(f'{name}: missing {asset} script reference')
