"""Render the repository's small Markdown user manual without dependencies or scripts."""
import html
from pathlib import Path
import re


def render_manual(source):
    def inline(value):
        value = html.escape(value)
        value = re.sub(r'`([^`]+)`', r'<code>\1</code>', value)
        value = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', value)
        return value
    pieces = []
    listing = None
    for line in source.splitlines():
        bullet = re.match(r'^- (.+)$', line)
        numbered = re.match(r'^\d+\. (.+)$', line)
        kind = 'ul' if bullet else 'ol' if numbered else None
        if kind != listing:
            if listing:
                pieces.append('</' + listing + '>')
            if kind:
                pieces.append('<' + kind + '>')
            listing = kind
        if kind:
            pieces.append('<li>' + inline((bullet or numbered).group(1)) + '</li>')
        elif line.startswith('#'):
            match = re.match(r'^(#{1,6}) (.+)$', line)
            if match:
                level = len(match.group(1))
                pieces.append(f'<h{level}>' + inline(match.group(2)) + f'</h{level}>')
            else:
                pieces.append('<p>' + inline(line) + '</p>')
        elif line.strip():
            pieces.append('<p>' + inline(line) + '</p>')
    if listing:
        pieces.append('</' + listing + '>')
    body = '\n'.join(pieces)
    return '''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'"><title>Manual de usuario · Boltech Group</title><style>body{font:17px/1.7 system-ui,sans-serif;background:#0b1119;color:#e8edf3;margin:0}main{max-width:850px;margin:auto;padding:35px 22px 80px}h1{font-size:34px;line-height:1.2}h2{margin-top:42px;color:#dbbc79}h3{font-size:20px}a{color:#dbbc79}li{margin:10px 0}code{background:#243348;padding:2px 5px;border-radius:4px;word-break:break-word}p{overflow-wrap:anywhere}nav{display:flex;gap:24px;flex-wrap:wrap}footer{margin-top:45px;color:#a6b6c7}@media print{body{background:white;color:black}h2{color:black}nav{display:none}}</style></head><body><main><nav><a href="/customer-setup">← Ficha del agente</a><a href="/sales-agent">Hablar con Leo</a></nav>''' + body + '<footer>Boltech Group · Manual de uso de la ficha de configuración.</footer></main></body></html>'


if __name__ == '__main__':
    root = Path(__file__).resolve().parent.parent
    print(render_manual((root / 'docs/Manual_de_usuario.md').read_text()))
