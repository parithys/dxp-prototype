"""Generate UI_Component_Inventory_Reference.xlsx - one row per UNIQUE UI component in src/.

Regenerate with: python3 reference/scripts/build_ui_component_inventory.py

Everything is read from the source: component definitions (export function/const and file-local PascalCase components),
where each is used (<Name .../> in other files, grouped by area), variants and states (union-typed and boolean props), the
styling approach (share of its className attributes that use a semantic class from src/ui-components.css or index.css),
and near-duplicates (same name or file name in several places, or the same long className strings repeated across files).
Category is assigned by name/path rules (ordered, first match wins) - see CATEGORY_RULES.

Counts are CODE SITES, not rendered nodes. This is a descriptive audit, not a spec: it changes nothing.

Migration columns (the last nine of Component Inventory), computed from the file(s) that define the component, so components that share a file
share these values; each is a file-level measure, not a per-component one:
  ui_imports         the modules of components/ui imported by the file (button, card, ...).
  semantic_classes   classes in the file's className attributes (string, template and cn()/ternary string arguments) that are DEFINED in
                     src/ui-components.css; the class list is parsed from the stylesheet's selectors. Class-list constants outside a className are not seen.
  raw_elements       count and tag list of <button>, <input>, <select>, <textarea>, <table> in the file (comments ignored), minus the native elements
                     that stay native on purpose (native_elements in the YAML, per file and tag, each with a reason).
  hardcoded_values   hex / rgb() / hsl() literals, and Tailwind arbitrary values that are a colour literal or a numeric absolute spacing/size in px/rem/em/ch (p-[13px], w-[2rem]; proportions such as w-[30%] or max-h-[70vh] are layout, not flagged);
                     var(--token) values are tokens, not hardcoded. Comments are ignored.
  call_sites         number of files under src/ (.ts and .tsx) that import the component by name from an app module. Dynamic import() is not followed.
  duplicate_group    the Group ID (D001, ...) of each Near-Duplicates finding the component is part of.
  migration_bucket   C = in a duplicate group; A = its name or category is in reference/migration/shadcn-target-map.yaml; else blank.
  shadcn_target      the module from that YAML (filled whenever a rule matches, whatever the bucket).
  migration_status   Retained when the component is in protected_components in the YAML (Phase 5: specialised components that stay). Otherwise Done when it has
                     no raw input/select/textarea/table, no hardcoded value and every native button in its file is an acceptable one (rule v4 below); otherwise Pending. Semantic classes alone do NOT block Done: they are the
                     project's styling layer (docs: CLAUDE.md), shadcn/Radix owning behaviour and accessibility. What does block it is a semantic class that
                     HIDES a hardcoded value: hardcoded_values also lists, as `.class: value`, every hex/rgb/hsl literal or arbitrary spacing in the rule
                     (the @apply body) of a semantic class the component uses. A value inside var(...) is a token and is fine.
  button_role        what each native <button> in the file is: navigates | link-styled action | icon-only control | clickable card / list row |
                     disclosure / menu control | other.
                     Static triage (see classify_button); a button whose role cannot be read from its markup is "other", never guessed.
  button_conformance the v4 checks on those buttons: type (explicit attribute), name (visible text or aria-label / aria-labelledby), nested (no interactive
                     element inside), focus (no suppressed outline unless a token ring replaces it; no literal focus colour; the global :focus-visible
                     rule uses --focus-outline), class (carries a semantic class). "n/m pass" plus the failing checks.
Status rule v4: a native <button> with a semantic class is acceptable as it is when it is a clickable card / list row or a disclosure / menu control (both
decided to stay native) AND passes all five checks. The other
roles (navigates, link-styled, icon-only) and "other" must be converted or triaged first, so a component with such a button stays Pending. Retained and
the non-button checks (other raw elements, hardcoded values) are as in v3. The Button Triage sheet lists every button with its checks (the fix list).
The Migration Summary sheet totals these; History keeps one row per run so progress shows as a trend.
"""
import datetime
import json
import os
import re
from collections import Counter, defaultdict

import yaml
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'reference', 'outputs', 'UI_Component_Inventory_Reference.xlsx')

CLS = re.compile(r'className=(?:"([^"]*)"|\{`([^`]*)`\})')
EXPORTED = re.compile(r'^export (?:default )?(?:function|const) ([A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*)', re.M)
LOCAL = re.compile(r'^(?:function|const) ([A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*)\s*(?:=|\(|:)', re.M)
SKIP_FILES = ('src/next/routes.tsx', 'src/lib/routerLinks.tsx')   # lazy route wrappers, not UI components
UNION = re.compile(r"\b(variant|size|tone|kind|status|state|intent|align|mode|level|orientation|layout|appearance|type)\??:\s*((?:'[^']+'\s*\|?\s*){2,})")
BOOLS = ['disabled', 'loading', 'selected', 'checked', 'error', 'open', 'readOnly', 'compact', 'dense', 'collapsed', 'expanded', 'active',
         'required', 'invalid', 'pending', 'highlighted', 'recommended', 'popular', 'inline', 'bleed', 'plain', 'dark', 'primary', 'busy', 'locked']

def read(p):
    with open(p, encoding='utf8') as f:
        return f.read()

files = {}
for d, _, fs in os.walk(SRC):
    for f in fs:
        if f.endswith('.tsx'):
            p = os.path.join(d, f)
            files[os.path.relpath(p, ROOT).replace(os.sep, '/')] = read(p)

# ---- semantic vocabulary: classes defined in the component stylesheet plus the shared ones from index.css
sem = set(re.findall(r'^\s*\.([a-z][a-z0-9-]*)', read(os.path.join(SRC, 'ui-components.css')), re.M))
sem |= {'card', 'card-surface', 'btn', 'badge', 'login-field', 'no-print', 'agent-only', 'card-inherit-fill'}
sem.discard('flex')
extra = os.path.join(ROOT, 'reference', 'scripts', '_semantic_extra.txt')
if os.path.exists(extra):
    sem |= set(read(extra).split())

def area(path):
    parts = path.split('/')
    if parts[1] in ('modules', 'workspace', 'capabilities') and len(parts) > 3:
        return f'{parts[1]}/{parts[2]}'
    if parts[1] == 'components' and len(parts) > 3:
        return f'components/{parts[2]}'
    return parts[1] if len(parts) > 2 else parts[1]

def layer(path):
    p = path.split('/')
    if p[1] == 'components' and len(p) > 2:
        return {'primitives': 'Primitive', 'patterns': 'Pattern', 'domain': 'Domain component'}.get(p[2], 'Component')
    if p[1] == 'capabilities':
        return 'Capability'
    if p[1] == 'navigation' or p[1] == 'auth':
        return 'App shell'
    if p[1] == 'modules':
        return 'Journey / module'
    if p[1] == 'workspace':
        return 'Workspace'
    return 'App'

# ---- definitions
defs = defaultdict(list)
for path, s in files.items():
    if path in SKIP_FILES:
        continue
    seen = set()
    for m in EXPORTED.finditer(s):
        defs[m.group(1)].append((path, True)); seen.add(m.group(1))
    for m in LOCAL.finditer(s):
        if m.group(1) not in seen:
            defs[m.group(1)].append((path, False))

def tokens(c):
    return re.sub(r'\$\{[^}]*\}', ' ', c).split()

def class_strings(s):
    out = []
    for m in CLS.finditer(s):
        raw = m.group(1) if m.group(1) is not None else m.group(2)
        out.append(' '.join((raw or '').split()))
    return out

per_file = {}
for path, s in files.items():
    cs = class_strings(s)
    with_sem = sum(1 for c in cs if any(t in sem for t in tokens(c)))
    long_ = sum(1 for c in cs if len([t for t in tokens(c) if t not in sem]) >= 8)
    prim = bool(re.search(r"from '(\.\./)+components/primitives|from '\.\./primitives|from '\./primitives", s))
    per_file[path] = dict(n=len(cs), sem=with_sem, long=long_, prim=prim,
                          strings={' '.join(sorted(tokens(c))) for c in cs if len(tokens(c)) >= 5})

# ---- category rules (ordered; first match wins). Matched against the component name.
CATEGORY_RULES = [
    ('Pagination', r'Pager|Pagination'),
    ('Tabs', r'Tabs?$|TabStrip|SegmentedTabs|TabLevel|SubTab|TabBar|TabPanel|^Tab[A-Z]'),
    ('Modals, dialogs and drawers', r'Modal|Drawer|Dialog|Sheet$|OverlayPortal|Overlay'),
    ('Tooltips and popovers', r'Tooltip|Popover|Popup|Menu$|ActionsMenu|Dropdown'),
    ('Loading, empty, error and success states', r'Spinner|Loading|Skeleton|Empty|ErrorBoundary|ErrorBanner|NotYetBuilt|NotFound|Success|Complete|Confirmation|Outcome|Result(s)?Screen|Missing|Unavailable'),
    ('Alerts, notifications, badges and tags', r'Badge|Tag$|Tag[A-Z]|Chip|Pill|Alert|Banner|Notice|Notification|Toast|Status|Marker|Indicator|Callout|Warning|Flag|Reference|Counter|Count$'),
    ('Buttons and actions', r'Button|Btn|Cta|ActionBar|Actions$|ActionGroup|^Action|Link$|Close'),
    ('Forms and form controls', r'Input|Select$|Select[A-Z]|Checkbox|Radio|Textarea|Field|Picker|Search|Form|Upload|Signature|Scanner|Toggle|Switch|Slider|Capture|Otp|Combobox|Lookup|Dropzone|Checks?List|Waive|Qid|Msisdn|Phone|Calendar|Date|Reason|Notes?Editor|Composer'),
    ('Cards', r'Card|Tile|Offer|Plan(?!Search)|Discount|Bundle|Product(?!Line)|Addon|Add-?on|ChoiceCards|Selectable'),
    ('Navigation elements', r'Sidebar|Breadcrumb|Nav|Header|Persona|GlobalSearch|Stepper|Wizard(Step|Title|Nav|Progress)|Rail|Topbar|Logo|Mark$|Wordmark|Switcher|StartCards|Hub'),
    ('Tables and lists', r'Table|List$|List[A-Z]|Row(s)?$|Grid|Timeline|Feed|Queue|History|Log$|Ledger|Inbox|Directory|Index$|Rows'),
    ('Layout components', r'Layout|Shell|Page$|Workspace|Screen|Zone|Route|Provider|Boundary|Gate|Frame|Outlet|App$|Router'),
    ('Containers, panels and sections', r'Panel|Section|Summary|Group|Accordion|Collapsible|Container|Band|Block|Detail|Overview|Tab[A-Z]|Step$|Step[A-Z]|Review|Console|Board|Hero|Strip|Wrapper|Body|Content'),
]

OVERRIDES = {'PageHeader': 'Layout components', 'WizardTitleBand': 'Layout components', 'PersonaSwitcher': 'Navigation elements', 'StartCards': 'Cards',
             'ErrorBoundary': 'Loading, empty, error and success states', 'Icon': 'Other reusable UI elements', 'PanelIcon': 'Other reusable UI elements',
             'VodafoneMark': 'Other reusable UI elements', 'VodafoneWordmark': 'Other reusable UI elements', 'SignaturePad': 'Forms and form controls'}

def categorise(name, path):
    if name in OVERRIDES:
        return OVERRIDES[name]
    for cat, rx in CATEGORY_RULES:
        if re.search(rx, name):
            return cat
    if '/primitives/' in path:
        return 'Other reusable UI elements'
    if '/modules/' in path or '/workspace/' in path:
        return 'Layout components'
    return 'Other reusable UI elements'

ALIAS = re.compile(r"type (\w*(?:Variant|Size|Tone|Kind|Status|Intent|Mode|Level|Appearance|Placement|Align)\w*) = ((?:'[^']+'\s*\|?\s*)+)")

def variants_states(s):
    out = []
    for m in ALIAS.finditer(s):
        out.append(f"{m.group(1)}: {' | '.join(re.findall(r"'([^']+)'", m.group(2)))}")
    for m in UNION.finditer(s):
        out.append(f"{m.group(1)}: {' | '.join(re.findall(r"'([^']+)'", m.group(2)))}")
    flags = [b for b in BOOLS if re.search(rf'\b{b}\??:\s*boolean|\b{b}\b\s*=\s*(false|true)|\b{b}\b[,}}]', s)]
    return '; '.join(out[:4]), ', '.join(flags[:8])

def users_of(name, own_paths):
    hits = {}
    pat = re.compile(r'<%s[\s/>]' % re.escape(name))
    for p, s in files.items():
        if p in own_paths:
            continue
        n = len(pat.findall(s))
        if n:
            hits[p] = n
    return hits

rows = []
for name, ds in sorted(defs.items()):
    paths = sorted({p for p, _ in ds})
    users = users_of(name, set(paths))
    own = sum(len(re.findall(r'<%s[\s/>]' % re.escape(name), files[p])) for p in paths)
    uses = sum(users.values()) + own
    exported = any(e for _, e in ds)
    cn = sum(per_file[p]['n'] for p in paths)
    if cn == 0 and uses == 0:
        continue                    # not a UI component (a helper that renders nothing and is never rendered)
    if not exported and uses == 0:
        continue
    sm = sum(per_file[p]['sem'] for p in paths)
    ln = sum(per_file[p]['long'] for p in paths)
    prim = any(per_file[p]['prim'] for p in paths)
    ar = Counter(area(p) for p in users)
    top = ', '.join(f'{a} ({n})' for a, n in ar.most_common(6))
    if len(ar) > 6:
        top += f' +{len(ar) - 6} more'
    lay = layer(paths[0])
    if lay in ('Primitive', 'Pattern', 'Domain component', 'Capability', 'App shell') or len(ar) >= 3:
        scope = 'Shared'
    elif users or exported and len(ar) >= 2:
        scope = 'Shared (limited)'
    else:
        scope = 'Page-specific'
    if cn == 0:
        style = 'Delegates (no className of its own)'
    else:
        r = sm / cn
        style = 'Semantic' if r >= 0.7 else 'Mixed' if r >= 0.25 else 'Utility-only' if cn >= 3 else 'Utility (few classes)'
        if prim and style.startswith('Utility'):
            style += ' + primitives'
    v, st = variants_states(files[paths[0]])
    rows.append(dict(name=name, cat=categorise(name, paths[0]), paths=paths, layer=lay, scope=scope, area=top or ('(file-local)' if not exported else '(unused)'),
                     files=len(users), uses=uses, variants=v, states=st, style=style, cn=cn, sem=sm, long=ln, exported=exported))

# ---- near-duplicates
dups = []
by_base = defaultdict(list)
for r in rows:
    for p in r['paths']:
        by_base[os.path.basename(p)].append((r['name'], p))
for b, lst in by_base.items():
    ps = sorted({p for _, p in lst})
    if len(ps) > 1 and b.endswith('.tsx'):
        dups.append(('Same file name in several folders', b, '; '.join(ps)))
dupnames = {n for n, ds in defs.items() if len({p for p, _ in ds}) > 1 and any(e for _, e in ds)}
for n in sorted(dupnames):
    dups.append(('Same component name defined in several files', n, '; '.join(sorted({p for p, _ in defs[n]}))))
fl = [p for p in per_file if per_file[p]['strings']]
pairs = []
for i, a in enumerate(fl):
    for b in fl[i + 1:]:
        if os.path.basename(a) == os.path.basename(b):
            continue
        common = per_file[a]['strings'] & per_file[b]['strings']
        if len(common) >= 2 or (common and any(len(c.split()) >= 9 for c in common)):
            pairs.append((a, b, common))
pairs.sort(key=lambda x: -len(x[2]))
for a, b, common in pairs[:80]:
    dups.append(('Same className strings repeated across files', f'{len(common)} shared', f'{a}  <->  {b}'))

# ---- hand-rolled native elements outside the primitives
raw_rows = []
for p, s in sorted(files.items()):
    if '/primitives/' in p:
        continue
    c = {t: len(re.findall(r'<%s[\s>]' % t, s)) for t in ('button', 'input', 'select', 'textarea', 'table')}
    if any(c.values()):
        raw_rows.append((p, c['button'], c['input'], c['select'], c['textarea'], c['table']))

# ---- migration metrics (added): semantic vocabulary from the stylesheet's selectors, never hardcoded
def stylesheet_classes():
    css = re.sub(r'/\*.*?\*/', '', read(os.path.join(SRC, 'ui-components.css')), flags=re.S)
    out = set()
    for m in re.finditer(r'([^{};]+)\{', css):
        prelude = m.group(1).strip()
        if not prelude.startswith('@'):
            out |= set(re.findall(r'\.([A-Za-z_][\w-]*)', prelude))
    return out

STYLESHEET = stylesheet_classes()
with open(os.path.join(ROOT, 'reference', 'migration', 'shadcn-target-map.yaml'), encoding='utf8') as fh:
    _MAP = yaml.safe_load(fh)
A_MAP = _MAP['a_mapping']
PROTECTED = {n for g in _MAP.get('protected_components', []) for n in g['names']}
NATIVE_OK = defaultdict(set)
for _e in _MAP.get('native_elements', []):
    NATIVE_OK[_e['file']] |= set(_e['tags'])

def target_for(name, cat):
    for rule in A_MAP:
        if any(re.fullmatch(n, name) for n in rule.get('names', [])) or cat in rule.get('categories', []):
            return rule['target']
    return ''

CLASS_ATTR = re.compile(r'\b\w*[cC]lassName=')
STRING_LIT = re.compile(r"'([^']*)'|\"([^\"]*)\"|`([^`]*)`")
def class_chunks(s):
    out = []
    for m in CLASS_ATTR.finditer(s):
        i = m.end()
        if i >= len(s):
            continue
        if s[i] in '"\'':
            j = s.find(s[i], i + 1)
            out.append(s[i + 1:j] if j > 0 else '')
        elif s[i] == '{':
            depth, j = 0, i
            while j < len(s):
                depth += (s[j] == '{') - (s[j] == '}')
                if depth == 0:
                    break
                j += 1
            out.append(' '.join(a or b or c for a, b, c in STRING_LIT.findall(s[i + 1:j])))
    return out

def semantic_tokens(s):
    toks = []
    for chunk in class_chunks(s):
        for t in tokens(chunk):
            t = t.split(':')[-1].lstrip('!')
            if t in STYLESHEET:
                toks.append(t)
    return toks

UI_IMPORT = re.compile(r"from ['\"](?:@/|(?:\.{1,2}/)+)components/ui/([\w-]+)['\"]")
RAW_TAGS = ('button', 'input', 'select', 'textarea', 'table')
HEX = re.compile(r'(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b')
FUNC = re.compile(r'\b(?:rgba?|hsla?)\(\s*\d[^)]*\)')
ARB_TOKEN = re.compile(r'(?<![\w\[-])((?:[\w:!&>_*-]+:)*!?-?([a-z][a-z0-9]*(?:-[a-z0-9]+)*)-\[([^\]\s]+)\])')
SPACING = {'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me', 'gap', 'gap-x', 'gap-y', 'space-x', 'space-y',
           'w', 'h', 'size', 'min-w', 'max-w', 'min-h', 'max-h', 'top', 'right', 'bottom', 'left', 'inset', 'inset-x', 'inset-y', 'basis', 'indent', 'scroll-m', 'scroll-p'}
UNIT_NUM = re.compile(r'(?<![\w.])-?\d*\.?\d+(?:px|rem|em|ch)')   # absolute lengths; % / vh / vw are proportions, not spacing values

def stylesheet_hardcodes():
    """class -> hardcoded values in its rule body (colour literals, arbitrary spacing), parsed from src/ui-components.css."""
    css = re.sub(r'/\*.*?\*/', '', read(os.path.join(SRC, 'ui-components.css')), flags=re.S)
    out = defaultdict(list)
    for m in re.finditer(r'([^{};]+)\{([^{}]*)\}', css):
        prelude = m.group(1).strip()
        if prelude.startswith('@'):
            continue
        hits = hardcoded_in(m.group(2))
        if hits:
            for c in set(re.findall(r'\.([A-Za-z_][\w-]*)', prelude)):
                out[c] += hits
    return out

def strip_comments(s):
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    return re.sub(r'(?m)(?<![:\'"\w])//.*$', '', s)

def hardcoded_in(s):
    s = strip_comments(s)
    found = []
    for m in ARB_TOKEN.finditer(s):
        tok, prefix, val = m.group(1), m.group(2), m.group(3)
        if 'var(' in val:
            continue
        if HEX.search(val) or FUNC.search(val) or (prefix in SPACING and UNIT_NUM.search(val)):
            found.append(tok)
    rest = ARB_TOKEN.sub(' ', s)
    found += HEX.findall(rest) + FUNC.findall(rest)
    return found

STYLE_HARD = stylesheet_hardcodes()

ALL_SRC = dict(files)
for d, _, fs in os.walk(SRC):
    for f in fs:
        if f.endswith('.ts'):
            p = os.path.join(d, f)
            ALL_SRC[os.path.relpath(p, ROOT).replace(os.sep, '/')] = read(p)

file_metrics = {}
for p, s in files.items():
    code = strip_comments(s)
    raw = Counter(t for t in RAW_TAGS if t not in NATIVE_OK.get(p, ()) for _ in re.findall(r'<%s[\s/>]' % t, code))
    file_metrics[p] = dict(ui=set(UI_IMPORT.findall(s)), sem=Counter(semantic_tokens(s)), raw=raw, hard=hardcoded_in(s))


# ---- v4: triage and conformance of the native <button> elements -------------------------------------------------------------------------------------
_css_clean = re.sub(r'/\*.*?\*/', '', read(os.path.join(SRC, 'ui-components.css')), flags=re.S)
CLASS_APPLY = defaultdict(set)          # semantic class -> the utility tokens in its rule body (what @apply pulls in)
for _m in re.finditer(r'([^{};]+)\{([^{}]*)\}', _css_clean):
    _pre = _m.group(1).strip()
    if not _pre.startswith('@'):
        _body = set(re.sub(r'@apply', ' ', _m.group(2)).replace(';', ' ').split())
        for _c in set(re.findall(r'\.([A-Za-z_][\w-]*)', _pre)):
            CLASS_APPLY[_c] |= _body
GLOBAL_FOCUS_TOKEN = bool(re.search(r':focus-visible\s*\{[^}]*outline:[^;}]*var\(--focus-outline\)', read(os.path.join(SRC, 'index.css'))))

def jsx_tag_end(s, i):
    """Index just past the '>' that closes the tag opened at i, and whether it is self-closing. Skips strings, braces and comments."""
    depth, q, j = 0, None, i
    while j < len(s):
        c = s[j]
        if q:
            if c == '\\':
                j += 2
                continue
            if c == q:
                q = None
        elif s.startswith('/*', j):
            j = s.index('*/', j) + 2
            continue
        elif depth > 0 and s.startswith('//', j):
            j = s.index('\n', j)
            continue
        elif c in '"\'`':
            q = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        elif c == '>' and depth == 0:
            return j + 1, s[j - 1] == '/'
        j += 1
    return len(s), False

def strip_tags(content):
    """The text a button shows: its JSX content with every tag removed (icons, spans), expressions kept as a placeholder."""
    out, j = [], 0
    while j < len(content):
        m = re.compile(r'</?[A-Za-z]').search(content, j)
        if not m:
            out.append(content[j:])
            break
        out.append(content[j:m.start()])
        if content.startswith('</', m.start()):
            j = content.index('>', m.start()) + 1 if '>' in content[m.start():] else len(content)
        else:
            j, _ = jsx_tag_end(content, m.start())
    return ''.join(out)

def const_strings(s):
    """name -> the class strings of `const NAME = '...'` in the file, so a className that names a constant is still read."""
    out = {}
    for m in re.finditer(r"(?:const|let)\s+([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*(?:'([^']*)'|\"([^\"]*)\"|`([^`]*)`)", s):
        out[m.group(1)] = m.group(2) or m.group(3) or m.group(4) or ''
    return out

ICON_TAG = re.compile(r'<(?:svg|path|Icon|[A-Za-z]*Icon|CheckboxTick|SelectedTick)(?=[\s>/])')
OTHER_COMPONENT = re.compile(r'<[A-Z][A-Za-z0-9]*(?=[\s>/])')
WIDGET = re.compile(r'aria-expanded=|aria-haspopup=|role="(?:tab|menuitem|switch)"')   # a disclosure, menu or tab control; a selectable card (aria-pressed / radio) is still a card
NESTED_HANDLER = re.compile(r'onClick=|role="(?:button|link|checkbox|radio|switch|tab|menuitem)"|tabIndex=')
NESTED_TAGS = re.compile(r'<(?:a|button|input|select|textarea|Link|AppLink|AppNavLink|NavLink|Button|IconButton|Checkbox|Select|SearchField|Input|Textarea)(?=[\s>/])')
LINKISH = re.compile(r'(?<![\w-])(?:link|link-[a-z-]+|text-link|back-link[a-z-]*|breadcrumb-back|underline|link-action|link-inline|link-block|link-on-dark)(?![\w-])')
CARDISH = re.compile(r'(?<![\w-])(?:card|card-[a-z-]+|[a-z-]*-row|row|list-row[a-z-]*|block-row|row-button|card-button|option-cell|choice-tile|card-frame|tile[a-z-]*)(?![\w-])')

def navigating_names(s):
    """Names of functions in this file whose body navigates (calls navigate(), router.push(), assigns window.location)."""
    names = set()
    for m in re.finditer(r'\bnavigate\((?!\s*-1\s*\))|router\.(?:push|replace)\(|window\.location\.(?:href|assign)', s):
        # every function declared in the 300 characters before the call (the call may sit in a nested helper: run -> go -> navigate)
        for d in re.finditer(r'(?:const|function)\s+([A-Za-z_]\w*)', s[max(0, m.start() - 300):m.start()]):
            names.add(d.group(1))
    return names

def focus_verdict(tokens_):
    """Does a button's keyboard focus resolve to a token? Returns (ok, why)."""
    utils = set(tokens_)
    for t in list(tokens_):
        base = t.split(':')[-1]
        utils |= CLASS_APPLY.get(base, set())
    suppresses = any(re.fullmatch(r'(?:focus:|focus-visible:)?outline-(?:none|hidden)', t) for t in utils)
    gives = 'focus-ring' in tokens_ or any(re.match(r'(?:focus|focus-visible):(?:shadow|ring|outline|border)-.*var\(--', t) for t in utils)
    literal = [t for t in utils if re.match(r'(?:focus|focus-visible):', t) and (re.search(r'#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(', t) or re.search(r'(?:ring|outline|border|shadow)-\[(?!var\()', t))]
    if literal:
        return False, 'literal focus value'
    if suppresses and not gives:
        return False, 'outline removed, no token ring'
    if not suppresses and not GLOBAL_FOCUS_TOKEN and not gives:
        return False, 'no :focus-visible token rule'
    return True, ''

def button_elements(path, s):
    cm = [m.span() for m in re.finditer(r'/\*.*?\*/', s, re.S)] + [m.span() for m in re.finditer(r'(?m)(?<![:\'"\w])//.*$', s)]
    consts, navs, out = const_strings(s), navigating_names(s), []
    for m in re.finditer(r'<button(?=[\s>/])', s):
        if any(a <= m.start() < b for a, b in cm):
            continue
        end, selfc = jsx_tag_end(s, m.start())
        open_tag = s[m.start():end]
        close = s.find('</button>', end)
        content = '' if selfc or close < 0 else s[end:close]
        chunks = class_chunks(open_tag)
        for ident in set(re.findall(r'[A-Za-z_]\w*', open_tag)):
            if ident in consts:
                chunks.append(consts[ident])
        toks = [t.lstrip('!') for c in chunks for t in tokens(c)]
        sem_here = sorted({t.split(':')[-1] for t in toks if t.split(':')[-1] in STYLESHEET})
        shown = strip_tags(re.sub(r'<span[^>]*sr-only[^>]*>.*?</span>', ' ', content, flags=re.S))
        # A component that is not an icon (<Highlighted .../>) renders something we cannot see: unknown is not "icon-only".
        opaque = any(not ICON_TAG.match(c.group(0) + ' ') for c in OTHER_COMPONENT.finditer(content))
        has_text = bool(re.search(r'[A-Za-z0-9]', shown)) or opaque
        has_sr_text = 'sr-only' in content
        named = bool(re.search(r'aria-label(?:ledby)?=', open_tag)) or has_text or has_sr_text
        onclick = re.search(r'onClick=\{', open_tag)
        handler = open_tag[onclick.end():onclick.end() + 400] if onclick else ''
        calls = set(re.findall(r'\b([A-Za-z_]\w*)\(', handler))
        history_back = bool(re.search(r'\bnavigate\(\s*-1\s*\)|history\.back\(', handler))
        navigates = (bool(re.search(r'\bnavigate\((?!\s*-1\s*\))|router\.(?:push|replace)\(|window\.location\.(?:href|assign)', handler)) or bool(calls & navs)) and not history_back
        cls_text = ' '.join(toks)
        if WIDGET.search(open_tag):
            role, basis = 'disclosure / menu control', 'aria-expanded / haspopup, or a menu item, tab or switch (decided: stays native, icon or text)'
        elif not has_text and not has_sr_text:
            role, basis = 'icon-only control', 'no visible text'
        elif history_back:
            role, basis = 'other', 'history back (navigate(-1)): not a link'
        elif navigates:
            role, basis = 'navigates', 'its handler navigates'
        elif LINKISH.search(cls_text):
            role, basis = 'link-styled action', 'link class: ' + LINKISH.search(cls_text).group(0)
        elif CARDISH.search(cls_text):
            role, basis = 'clickable card / list row', 'card / row class: ' + CARDISH.search(cls_text).group(0)
        else:
            role, basis = 'other', 'no card, row or link class'
        ok_focus, why = focus_verdict(toks)
        checks = {'type': bool(re.search(r'\btype=', open_tag)), 'name': named, 'nested': not (NESTED_TAGS.search(content) or NESTED_HANDLER.search(content)),
                  'focus': ok_focus, 'class': bool(sem_here)}
        out.append(dict(path=path, line=s.count('\n', 0, m.start()) + 1, role=role, basis=basis, checks=checks, why=why, classes=sem_here))
    return out

BUTTONS = {p: button_elements(p, s) for p, s in files.items()}

KEEP_NATIVE = ('clickable card / list row', 'disclosure / menu control')    # decided: these stay native when they pass the checks

def acceptable_native(b):
    return b['role'] in KEEP_NATIVE and all(b['checks'].values())

IMPORT_STMT = re.compile(r"^import\s+(?:type\s+)?([^;]*?)\s+from\s+['\"]([^'\"]+)['\"]", re.M)
def imported_names(clause):
    names = set()
    m = re.match(r'([A-Za-z_]\w*)\s*(?:,|$)', clause.strip())
    if m:
        names.add(m.group(1))
    for part in re.findall(r'\{([^}]*)\}', clause):
        for item in part.split(','):
            item = re.sub(r'^\s*type\s+', '', item.strip())
            if item:
                names.add(item.split(' as ')[0].strip())
    return names

importers = defaultdict(lambda: defaultdict(set))   # component name -> importing file -> the module it came from
for p, s in ALL_SRC.items():
    for clause, spec in IMPORT_STMT.findall(s):
        if not (spec.startswith('@/') or spec.startswith('.')):
            continue
        base = os.path.normpath(os.path.join(SRC, spec[2:])) if spec.startswith('@/') else os.path.normpath(os.path.join(os.path.dirname(os.path.join(ROOT, p)), spec))
        base = os.path.relpath(base, ROOT).replace(os.sep, '/')
        for n in imported_names(clause):
            if n in defs:
                importers[n][p].add(base)

def call_sites_of(name, own):
    defining = {p for p, _ in defs[name]}
    count = 0
    for f, mods in importers[name].items():
        if f in own:
            continue
        if len(defining) > 1 and not any(m in {d[:-4] for d in defining if d.endswith('.tsx')} | defining for m in mods):
            continue        # the name is defined in several files: count only an import that resolves to one of them
        count += 1
    return count

dup_ids = ['D%03d' % (i + 1) for i in range(len(dups))]
groups_of = defaultdict(list)
for gid, (kind, key, detail) in zip(dup_ids, dups):
    for r in rows:
        if r['name'] == key or any(p in detail for p in r['paths']):
            groups_of[r['name']].append(gid)

def raw_by_path(paths):
    c = Counter()
    for p in paths:
        c += file_metrics[p]['raw']
    return c

def tag_list(counter):
    return ', '.join(f'{t} x{n}' if n > 1 else t for t, n in sorted(counter.items()))

for r in rows:
    fm = [file_metrics[p] for p in r['paths']]
    r['ui_imports'] = sorted(set().union(*[m['ui'] for m in fm]))
    sem_c = Counter(); raw_c = Counter(); hard = []
    for m in fm:
        sem_c += m['sem']; raw_c += m['raw']; hard += m['hard']
    r['sem_classes'] = sorted(sem_c)
    r['sem_refs'] = sum(sem_c.values())
    r['raw_count'] = sum(raw_c.values())
    r['raw_text'] = f"{sum(raw_c.values())} ({tag_list(raw_c)})" if raw_c else ''
    hidden = [f'.{c}: {v}' for c in r['sem_classes'] for v in sorted(set(STYLE_HARD.get(c, [])))]   # a semantic class hiding a literal
    hard = hard + hidden
    uniq = sorted(set(hard))
    r['hard_count'] = len(hard)
    r['hard_text'] = (f"{len(hard)}: " + ', '.join(uniq[:12]) + (f' +{len(uniq) - 12} more' if len(uniq) > 12 else '')) if hard else ''
    r['call_sites'] = call_sites_of(r['name'], set(r['paths']))
    r['dup_group'] = ', '.join(sorted(set(groups_of.get(r['name'], []))))
    r['target'] = target_for(r['name'], r['cat'])
    r['bucket'] = 'C' if r['dup_group'] else 'A' if r['target'] else ''
    bt = [b for p in r['paths'] for b in BUTTONS[p]]
    roles = Counter(b['role'] for b in bt)
    r['button_role'] = ', '.join(f'{k} x{n}' for k, n in sorted(roles.items()))
    if bt:
        failing = Counter(k for b in bt for k, v in b['checks'].items() if not v)
        passing = sum(all(b['checks'].values()) for b in bt)
        r['button_conf'] = f"{passing}/{len(bt)} pass" + (' - fail: ' + ', '.join(f'{k} x{n}' for k, n in sorted(failing.items())) if failing else '')
    else:
        r['button_conf'] = ''
    non_button_raw = sum(n for t, n in raw_by_path(r['paths']).items() if t != 'button')
    r['status'] = 'Retained' if r['name'] in PROTECTED else \
        'Done' if not (non_button_raw or r['hard_count']) and all(acceptable_native(b) for b in bt) else 'Pending'

# previous History rows survive a regeneration (the workbook is rebuilt from scratch each run)
history_prev = []
if os.path.exists(OUT):
    try:
        old = load_workbook(OUT, read_only=True)
        if 'History' in old.sheetnames:
            history_prev = [tuple(r) for r in old['History'].iter_rows(min_row=2, values_only=True) if r and r[0]]
            # rows written before the Retained and Status-rule columns existed (9 columns) are kept, labelled as a superseded rule
            history_prev = [r[:4] + (None,) + r[4:] + ('superseded',) if len(r) == 9 else r for r in history_prev]
    except Exception as e:                                  # a corrupt or locked old file must not stop the run
        print('warning: could not read the previous History:', e)

# ---- workbook
wb = Workbook()
HEAD = PatternFill('solid', fgColor='E60000')
def sheet(ws, headers, data, widths):
    ws.append(headers)
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF'); c.fill = HEAD; c.alignment = Alignment(wrap_text=True, vertical='top')
    for r in data:
        ws.append(list(r))
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical='top')
    ws.freeze_panes = 'B2'
    ws.auto_filter.ref = ws.dimensions

dupe_by_name = defaultdict(list)
for kind, key, detail in dups:
    for r in rows:
        if r['name'] == key or any(p in detail for p in r['paths']):
            dupe_by_name[r['name']].append(kind)
ws = wb.active; ws.title = 'Component Inventory'
data = []
for r in sorted(rows, key=lambda r: (r['cat'], r['name'])):
    d = sorted(set(dupe_by_name.get(r['name'], [])))
    data.append((r['name'], r['cat'], '\n'.join(r['paths']), r['layer'], r['scope'], r['area'], r['files'], r['uses'], r['variants'], r['states'],
                 'Yes: ' + '; '.join(d) if d else 'No', r['style'], f"{r['sem']}/{r['cn']}", r['long'],
                 ', '.join(r['ui_imports']), ', '.join(r['sem_classes']), r['raw_text'], r['hard_text'], r['call_sites'], r['dup_group'],
                 r['bucket'], r['target'], r['status'], r['button_role'], r['button_conf']))
sheet(ws, ['Component', 'Category', 'Source file(s)', 'Layer', 'Shared / page-specific', 'Used in (area, sites)', 'Files using it', 'Code sites', 'Variants (union props)',
           'States (boolean props)', 'Duplicate / similar implementation', 'Styling approach', 'className attrs with a semantic class', 'className attrs with 8+ utilities',
           'ui_imports', 'semantic_classes', 'raw_elements', 'hardcoded_values', 'call_sites', 'duplicate_group', 'migration_bucket', 'shadcn_target', 'migration_status', 'button_role', 'button_conformance'],
      data, [28, 30, 56, 16, 16, 48, 9, 9, 40, 30, 44, 26, 14, 12, 18, 50, 22, 36, 10, 16, 10, 14, 12, 40, 40])

ws2 = wb.create_sheet('Near-Duplicates')
sheet(ws2, ['Kind', 'Subject', 'Files', 'Group ID'], [(k, a, b, g) for g, (k, a, b) in zip(dup_ids, dups)], [44, 34, 120, 10])
ws3 = wb.create_sheet('Hand-rolled Elements')
sheet(ws3, ['File', '<button>', '<input>', '<select>', '<textarea>', '<table>'], raw_rows, [80, 10, 10, 10, 10, 10])

ws4 = wb.create_sheet('Summary')
cats = Counter(r['cat'] for r in rows)
sty = Counter(r['style'].split(' +')[0] for r in rows)
scp = Counter(r['scope'] for r in rows)
summary = [('Unique components', len(rows)), ('', '')] + [(f'Category: {k}', v) for k, v in sorted(cats.items())] + [('', '')] + \
          [(f'Scope: {k}', v) for k, v in sorted(scp.items())] + [('', '')] + [(f'Styling: {k}', v) for k, v in sorted(sty.items())] + [('', '')] + \
          [('Near-duplicate findings', len(dups)), ('Files with raw <button>/<input>/<select>/<textarea>/<table> outside primitives', len(raw_rows))]
sheet(ws4, ['Measure', 'Count'], summary, [90, 12])

# ---- semantic class usage: how many files / sites use each class from the component stylesheet
css_classes = sorted(set(re.findall(r'^\s*\.([a-z][a-z0-9-]*)', read(os.path.join(SRC, 'ui-components.css')), re.M)))
usage = []
for c in css_classes:
    pat = re.compile(r'(?<![\w-])%s(?![\w-])' % re.escape(c))
    fs_ = {p: len(pat.findall(' '.join(class_strings(s)))) for p, s in files.items()}
    fs_ = {p: n for p, n in fs_.items() if n}
    usage.append((c, len(fs_), sum(fs_.values()), '; '.join(sorted(fs_)[:4]) + (' ...' if len(fs_) > 4 else '')))
usage.sort(key=lambda r: (-r[1], r[0]))
ws5 = wb.create_sheet('Semantic Class Usage')
sheet(ws5, ['Semantic class (src/ui-components.css)', 'Files using it', 'className sites', 'Examples'], usage, [40, 12, 12, 110])

# ---- generic local helper names defined more than once (the same idea re-implemented per file)
GENERIC = defaultdict(list)
for n, ds in defs.items():
    ps = sorted({p for p, e in ds if not e and p not in SKIP_FILES})
    if len(ps) >= 2:
        GENERIC[n] = ps
ws6 = wb.create_sheet('Repeated Local Helpers')
sheet(ws6, ['Helper name', 'Defined in (files)', 'Copies'], [(n, '\n'.join(ps), len(ps)) for n, ps in sorted(GENERIC.items(), key=lambda x: -len(x[1]))], [28, 110, 8])

wb.move_sheet('Summary', offset=-wb.sheetnames.index('Summary'))

# ---- Migration Summary and History
def counts(sub):
    return (sum(r['status'] == 'Done' for r in sub), sum(r['status'] == 'Pending' for r in sub), sum(r['status'] == 'Retained' for r in sub), len(sub))
ms = [('All components',) + counts(rows), ('', '', '', '', '')]
for label, key in (('Category', 'cat'), ('Scope', 'scope'), ('Bucket', 'bucket')):
    for v in sorted({r[key] for r in rows}):
        sub = [r for r in rows if r[key] == v]
        ms.append((f"{label}: {v or '(blank)'}",) + counts(sub))
    ms.append(('', '', '', '', ''))
sem_refs_total = sum(sum(Counter(semantic_tokens(s)).values()) for s in files.values())
raw_files_all = sum(1 for p in files if sum(file_metrics[p]['raw'].values()))
raw_files_outside = sum(1 for p in files if '/primitives/' not in p and sum(file_metrics[p]['raw'].values()))
hard_comps = sum(1 for r in rows if r['hard_count'])
ms += [('Semantic-class references (className sites in src/ naming a class from ui-components.css)', '', '', '', sem_refs_total),
       ('Files with a raw <button>/<input>/<select>/<textarea>/<table> element (comments ignored; documented native elements excluded)', '', '', '', raw_files_all),
       ('... of which outside primitives', '', '', '', raw_files_outside),
       ('Components with a hardcoded colour / arbitrary spacing value (own or via a semantic class)', '', '', '', hard_comps)]
protected_paths = {p for r in rows for p in r['paths'] if r['name'] in PROTECTED}
all_btn = [b for p in sorted(BUTTONS) for b in BUTTONS[p]]
live_btn = [b for b in all_btn if b['path'] not in protected_paths]
ms.append(('', '', '', '', ''))
ms.append((f'Native buttons outside the protected components, by role ({len(live_btn)} in total; {len(all_btn) - len(live_btn)} more are inside protected components)', '', '', '', ''))
ROLES = ['navigates', 'link-styled action', 'icon-only control', 'clickable card / list row', 'disclosure / menu control', 'other']
for role in ROLES:
    sub = [b for b in live_btn if b['role'] == role]
    ms.append((f'Button role: {role}', sum(acceptable_native(b) for b in sub), sum(not acceptable_native(b) for b in sub), '', len(sub)))
for chk in ('type', 'name', 'nested', 'focus', 'class'):
    ms.append((f'Buttons failing the {chk} check (all roles)', '', '', '', sum(not b['checks'][chk] for b in live_btn)))
wsms = wb.create_sheet('Migration Summary', 1)
sheet(wsms, ['Measure', 'Done', 'Pending', 'Retained', 'Total'], ms, [90, 10, 10, 10, 10])
ACTION = {'navigates': 'convert to <a> / router Link (not a Button)', 'link-styled action': 'Button variant="link", keep the semantic class via className',
          'icon-only control': 'Button variant="ghost" size="icon" with a required aria-label', 'clickable card / list row': 'keep native; must pass the v4 checks', 'disclosure / menu control': 'keep native (decided); must pass the v4 checks',
          'other': 'needs a decision (not one of the four roles)'}
tri = []
for b in all_btn:
    c = b['checks']
    fail = [k for k, v in c.items() if not v]
    action = 'retained (protected component)' if b['path'] in protected_paths else ACTION[b['role']]
    fixlist = 'FIX LIST: ' + ', '.join(fail) if b['role'] in KEEP_NATIVE and fail and b['path'] not in protected_paths else ''
    tri.append((b['path'], b['line'], b['role'], 'pass' if c['type'] else 'FAIL', 'pass' if c['name'] else 'FAIL', 'pass' if c['nested'] else 'FAIL',
                'pass' if c['focus'] else 'FAIL: ' + b['why'], 'pass' if c['class'] else 'FAIL', ', '.join(b['classes']), b['basis'], action, fixlist))
wst = wb.create_sheet('Button Triage', 3)
sheet(wst, ['File', 'Line', 'button_role', 'type', 'name', 'nested', 'focus', 'semantic class', 'Semantic classes', 'Role basis', 'Planned action', 'Fix list'], tri,
      [60, 7, 26, 8, 8, 8, 34, 12, 40, 40, 56, 30])
wsh = wb.create_sheet('History', 2)
now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
RULE = 'v4'   # bump when the Done rule changes: trends compare within one rule
this_run = (now, len(rows), ms[0][1], ms[0][2], ms[0][3], sem_refs_total, raw_files_all, hard_comps,
            sum(r['bucket'] == 'A' for r in rows), sum(r['bucket'] == 'C' for r in rows), RULE)
sheet(wsh, ['Run (local time)', 'Components', 'Done', 'Pending', 'Retained', 'Semantic-class references', 'Files with raw elements', 'Components with hardcoded values',
            'Bucket A', 'Bucket C', 'Status rule'], history_prev + [this_run], [22, 12, 8, 10, 10, 16, 16, 18, 10, 10, 60])
wsm = wb.create_sheet('Method')
for line in __doc__.strip().split('\n'):
    wsm.append([line])
wsm.column_dimensions['A'].width = 140
wb.save(OUT)

# The same rows for the app: the UI Components Library's Component Catalogue reads this, so every inventory component is listed there.
import json
CATALOGUE = os.path.join(ROOT, 'src', 'workspace', 'administration', 'componentCatalogue.generated.json')
with open(CATALOGUE, 'w') as fh:
    json.dump([dict(name=r['name'], category=r['cat'], layer=r['layer'], scope=r['scope'], paths=r['paths'], area=r['area'], files=r['files'])
               for r in sorted(rows, key=lambda r: (r['cat'], r['name']))], fh, indent=1)
    fh.write('\n')
print('wrote', CATALOGUE)
print('wrote', OUT, '-', len(rows), 'components,', len(dups), 'duplicate findings')
print('migration:', this_run[2], 'Done,', this_run[3], 'Pending,', this_run[4], 'Retained;', sem_refs_total, 'semantic-class references;', raw_files_all, 'files with raw elements;', 'history rows:', len(history_prev) + 1)
