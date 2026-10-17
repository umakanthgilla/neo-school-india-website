"""Static deployment checks; does not replace browser or deployed-response QA."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit

root = Path(__file__).resolve().parents[1]
lines = (root / '_headers').read_text().splitlines()
assert max(map(len, lines)) <= 2000, 'Pages header line exceeds limit'
assert [x for x in lines if x and not x.startswith((' ', '#'))] == ['/*']
headers = {}
for line in lines:
    if line.startswith('  '):
        key, value = line.strip().split(':', 1)
        assert key.lower() not in headers, 'Duplicate header'
        headers[key.lower()] = value.strip()
assert headers['strict-transport-security'] == 'max-age=86400'
assert headers['x-content-type-options'] == 'nosniff'
assert headers['x-frame-options'] == 'SAMEORIGIN'
policy = headers['content-security-policy']
assert "frame-ancestors 'self'" in policy
assert "object-src 'none'" in policy
assert "base-uri 'self'" in policy
assert 'script-src' not in policy and 'default-src' not in policy
permissions = headers['permissions-policy']
for feature in ['camera', 'microphone', 'geolocation']:
    assert f'{feature}=(self)' in permissions
assert 'fullscreen' not in permissions and 'autoplay' not in permissions
candidate = headers['content-security-policy-report-only']

class Inspect(HTMLParser):
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        assert tag not in ['base', 'object', 'embed'], f'Compatibility review required: {current}'
        value = attrs.get('src' if tag in ['script', 'iframe'] else 'href', '')
        if tag in ['script', 'iframe'] and value.startswith('https://'):
            origin = 'https://' + urlsplit(value).netloc
            directive = 'script-src' if tag == 'script' else 'frame-src'
            allowed = next(x.strip() for x in candidate.split(';') if x.strip().startswith(directive + ' '))
            assert origin in allowed.split(), f'{current}: missing candidate origin {origin}'

for current in root.glob('*.html'):
    Inspect().feed(current.read_text())
assert not (root / '_worker.js').exists(), 'Worker responses need explicit headers'
assert not (root / 'functions').exists(), 'Functions responses need explicit headers'
print('PASS: Pages syntax/limits, rollout boundaries, device permissions, static script/frame origins and embedding compatibility.')
