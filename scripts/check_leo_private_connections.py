"""Check existing production connections; emit allowlisted status fields only."""
import datetime
import json
import math
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

ENDPOINT = 'https://boltech-group.pages.dev/api/leo-integrations'
PLATFORMS = ('upwork', 'freelancer', 'explee')
OUTPUT = Path('ops-output/leo-private-connections')
REASONS = {'EDGE_ACCESS_DENIED', 'API_KEY_REJECTED', 'ACCESS_DENIED_UNCLASSIFIED', 'IP_RESTRICTED', 'API_SCOPE_DENIED', 'RATE_LIMITED', 'ACCOUNT_SCHEMA_MISMATCH'}
ERRORS = {
    'DIAGNOSTIC_TOKEN_MISSING', 'OWNER_ACCESS_REQUIRED', 'OWNER_ACCESS_NOT_CONFIGURED',
    'ORIGIN_NOT_ALLOWED', 'PROVIDER_SECRET_MISSING', 'FREELANCER_API_DISABLED',
    'PROVIDER_REJECTED', 'PROVIDER_RESPONSE_INVALID', 'INTEGRATION_REQUEST_FAILED',
    'UPWORK_AUTHORIZATION_REQUIRED', 'UPWORK_REAUTHORIZATION_REQUIRED',
    'UPWORK_AUTH_STORAGE_MISSING', 'UPWORK_OWNER_KEY_MISSING',
    'UPWORK_CLIENT_REGISTRATION_REQUIRED', 'UPWORK_CLIENT_REGISTRATION_INVALID',
    'UPWORK_CONNECT_RESPONSE_INVALID', 'UPWORK_MCP_RESPONSE_INVALID',
    'UPWORK_MCP_REJECTED', 'UPWORK_MCP_PROTOCOL_UNSUPPORTED', 'UPWORK_TOOL_REJECTED',
    'UPWORK_TOOL_RESPONSE_INVALID', 'UPWORK_SEARCH_RESPONSE_INVALID', 'UPWORK_RESPONSE_TOO_LARGE',
    'PRIVATE_API_UNAVAILABLE', 'PRIVATE_API_RESPONSE_INVALID', 'PRIVATE_API_RESPONSE_TOO_LARGE',
}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def api_operation(operation, token):
    request = urllib.request.Request(ENDPOINT,
        data=json.dumps(operation).encode(),
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json',
                 'Accept': 'application/json', 'User-Agent': 'Boltech-Private-Connection-Check/1.0'},
        method='POST')
    opener = urllib.request.build_opener(NoRedirect())
    try:
        response = opener.open(request, timeout=35)
    except urllib.error.HTTPError as error:
        response = error
    except Exception:
        # Exception text can include request details. Never print or retain it.
        return 0, {'error': 'PRIVATE_API_UNAVAILABLE'}
    try:
        with response:
            raw = response.read(65537)
            if len(raw) > 65536:
                return response.status, {'error': 'PRIVATE_API_RESPONSE_TOO_LARGE'}
            try:
                data = json.loads(raw)
            except (ValueError, UnicodeError):
                data = {'error': 'PRIVATE_API_RESPONSE_INVALID'}
            return response.status, data
    except Exception:
        return 0, {'error': 'PRIVATE_API_UNAVAILABLE'}


def api_check(platform, token):
    return api_operation({'action': 'check', 'platform': platform}, token)


def probe_explee_free_search(token, requester=api_operation):
    # This fixed operation maps to page=1,page_size=10 on the Worker. No
    # enrichment, suppression lists, pagination, messages or paid result zone.
    result = {'status': 'FAILED', 'searchVerified': False, 'autonomyVerified': False,
              'scope': 'ONE_FIRST_PAGE_MAX_10', 'query': 'clinics in El Salvador'}
    if not isinstance(token, str) or len(token) < 24 or any(c in token for c in '\r\n'):
        return {**result, 'status': 'NOT_CHECKED', 'error': 'DIAGNOSTIC_TOKEN_MISSING'}
    try:
        status, data = requester({'action': 'search', 'platform': 'explee', 'query': result['query']}, token)
    except Exception:
        return {**result, 'error': 'PRIVATE_API_UNAVAILABLE'}
    result['httpStatus'] = status
    if not (200 <= status < 300 and isinstance(data, dict) and data.get('success') is True
            and data.get('platform') == 'explee' and data.get('mode') == 'READ_ONLY'):
        safe = safe_result('explee', status, data)
        return {**result, **{key: safe[key] for key in ('error', 'providerReason') if key in safe}}
    items = data.get('items')
    receipt = data.get('receiptId')
    if not isinstance(items, list) or len(items) > 10 or not isinstance(receipt, str) or not re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', receipt):
        return {**result, 'error': 'PRIVATE_API_RESPONSE_INVALID'}
    meta = data.get('meta')
    charged = meta.get('creditsCharged') if isinstance(meta, dict) else None
    if charged is not None and (type(charged) not in (int, float) or not math.isfinite(charged) or charged < 0):
        return {**result, 'error': 'PRIVATE_API_RESPONSE_INVALID'}
    if charged is not None and charged != 0:
        return {**result, 'error': 'UNEXPECTED_PROVIDER_CREDIT_CHARGE', 'providerChargeReported': True}
    return {**result, 'status': 'VERIFIED', 'searchVerified': True, 'itemsCount': len(items),
            'receiptRecorded': True, 'creditsCharged': charged}


def safe_result(platform, status, data):
    row = {'platform': platform, 'checkedAt': now(), 'connected': False,
           'status': 'FAILED', 'httpStatus': status, 'scope': 'ACCOUNT_READ_ONLY',
           'searchVerified': False, 'autonomyVerified': False}
    if not isinstance(data, dict):
        data = {'error': 'PRIVATE_API_RESPONSE_INVALID'}
    if (200 <= status < 300 and data.get('success') is True
            and data.get('platform') == platform and data.get('status') == 'CONNECTED'
            and data.get('mode') == 'READ_ONLY'):
        row.update(connected=True, status='CONNECTED')
        if platform == 'explee' and data.get('accountCheck') == 'GET_ME':
            row['accountCheck'] = 'GET_ME'
            if isinstance(data.get('searchReadiness'), str) and data['searchReadiness'] in {'POSITIVE_BALANCE_NOT_SEARCH_VERIFIED', 'POSITIVE_BALANCE_REQUIRED', 'BALANCE_NOT_REPORTED'}:
                row['searchReadiness'] = data['searchReadiness']
        return row
    code = data.get('error')
    # Never put untrusted/provider text, tokens, account names or identifiers in logs.
    if not isinstance(code, str) or not (code in ERRORS or re.fullmatch(r'(PROVIDER|UPWORK_TOKEN|UPWORK_MCP)_HTTP_[1-5][0-9]{2}', code)):
        code = 'PRIVATE_API_HTTP_' + str(status) if status and not 200 <= status < 300 else 'PRIVATE_API_RESPONSE_INVALID'
    row['error'] = code
    if isinstance(data.get('providerReason'), str) and data['providerReason'] in REASONS:
        row['providerReason'] = data['providerReason']
    if platform == 'explee' and row.get('providerReason') == 'ACCOUNT_SCHEMA_MISMATCH':
        if type(data.get('providerHttpStatus')) is int and 100 <= data['providerHttpStatus'] <= 599:
            row['providerHttpStatus'] = data['providerHttpStatus']
        shape = data.get('accountShape')
        if isinstance(shape, dict):
            safe = {}
            for key in ('body', 'organization', 'organizationId', 'key', 'balance', 'balanceRemain', 'data', 'result', 'organization_id', 'org', 'org_id', 'api_key'):
                if isinstance(shape.get(key), str) and shape[key] in {'missing', 'null', 'object', 'array', 'string', 'number', 'boolean'}:
                    safe[key] = shape[key]
            if type(shape.get('jsonContentType')) is bool:
                safe['jsonContentType'] = shape['jsonContentType']
            row['accountShape'] = safe
    return row


def check_connections(token, requester=api_check):
    # No request is made when the Actions secret is absent or malformed.
    valid = isinstance(token, str) and len(token) >= 24 and not any(c in token for c in '\r\n')
    report = {'schemaVersion': 1, 'checkedAt': now(), 'tokenConfigured': bool(valid),
              'mode': 'PRIVATE_READ_ONLY', 'externalActions': [], 'results': []}
    for platform in PLATFORMS:
        if not valid:
            row = safe_result(platform, 0, {'error': 'DIAGNOSTIC_TOKEN_MISSING'})
            row['status'] = 'NOT_CHECKED'
        else:
            try:
                status, data = requester(platform, token)
                row = safe_result(platform, status, data)
            except Exception:
                row = safe_result(platform, 0, {'error': 'PRIVATE_API_UNAVAILABLE'})
        report['results'].append(row)
    report['allConnected'] = all(row['connected'] for row in report['results'])
    return report


def write_report(report, output=OUTPUT):
    output.mkdir(parents=True, exist_ok=True)
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    lines = ['## Leo: comprobación privada', '',
             '| Plataforma | Estado | HTTP | Error |', '|---|---|---:|---|']
    for row in report['results']:
        error = row.get('error', '')
        if row.get('providerReason'):
            error += ' / ' + row['providerReason']
        lines.append(f"| {row['platform']} | {row['status']} | {row['httpStatus']} | {error} |")
    lines += ['', 'Alcance: autenticación y consulta de cuenta; una prueba adicional de Explee se informa por separado si está habilitada. No certifica operación 24/7 ni ventas.',
              'Sin postulaciones, mensajes, campañas ni compra de créditos.', '']
    if report.get('expleeSearch'):
        search = report['expleeSearch']
        lines += ['### Explee: prueba única de búsqueda', '',
                  f"Estado: {search['status']}. Resultados: {search.get('itemsCount', 'N/D')}. Error: {search.get('error', '')}.",
                  'Solo primera página, hasta diez empresas; sin enriquecimiento ni paginación. No acredita autonomía 24/7.', '']
    (output / 'summary.md').write_text('\n'.join(lines))


if __name__ == '__main__':
    result = check_connections(os.environ.get('LEO_PLATFORM_TOKEN', ''))
    if '--explee-free-search' in sys.argv:
        account = next(row for row in result['results'] if row['platform'] == 'explee')
        if account['connected']:
            result['expleeSearch'] = probe_explee_free_search(os.environ.get('LEO_PLATFORM_TOKEN', ''))
            account['searchVerified'] = result['expleeSearch']['searchVerified']
        else:
            result['expleeSearch'] = {'status': 'NOT_CHECKED', 'searchVerified': False, 'error': 'ACCOUNT_CONNECTION_REQUIRED'}
    write_report(result)
    print(json.dumps(result))
    sys.exit(0 if result['allConnected'] and result.get('expleeSearch', {}).get('status', 'VERIFIED') == 'VERIFIED' else 1)
