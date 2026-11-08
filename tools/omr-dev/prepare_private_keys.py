"""Extract local test keys to ignored CSVs. Never selects a key by achieved score."""
import argparse
import hashlib
import json
from pathlib import Path
import re


def parse_page(text):
    heading = re.search(r'^((?:Class\s+\d+|BS)[^\n]*?)\s*[•\ufffd–—-]\s*Answer Key\s*[•\ufffd–—-]\s*Paper\s+([ABCD])\s*$', text, re.M)
    if not heading:
        raise ValueError('Unrecognized class/group and paper-version heading')
    pairs = re.findall(r'^\s*(\d{1,3})\s*\n\s*([ABCD])\s*$', text, re.M)
    if len(pairs) != 100 or {int(number) for number, _ in pairs} != set(range(1, 101)):
        raise ValueError('Every key page must contain questions 1–100 exactly once')
    answers = dict((int(number), answer) for number, answer in pairs)
    return {'group': heading[1].strip(), 'paperVersion': heading[2], 'answers': [answers[number] for number in range(1, 101)]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf', type=Path)
    args = parser.parse_args()
    from pypdf import PdfReader
    root = Path(__file__).resolve().parents[2] / 'tmp/omr-reference/private-keys'
    pages = [parse_page(page.extract_text() or '') for page in PdfReader(args.pdf).pages]
    identities = [(page['group'], page['paperVersion']) for page in pages]
    if len(set(identities)) != len(identities):
        raise ValueError('Repeated class/group and paper version; refusing ambiguous keys')
    root.mkdir(parents=True, exist_ok=True)
    for index, page in enumerate(pages, 1):
        name = f'key-{index:02d}-{page["paperVersion"]}.csv'
        (root / name).write_text('Question,Answer\n' + ''.join(f'{number},{answer}\n' for number, answer in enumerate(page['answers'], 1)), encoding='utf-8')
        page['csv'] = name
    (root / 'manifest.json').write_text(json.dumps({'sourceSha256': hashlib.sha256(args.pdf.read_bytes()).hexdigest(), 'keys': pages, 'testingOnly': True, 'officialScoringAllowed': False}, indent=2), encoding='utf-8')
    print(f'Validated {len(pages)} unique keys, each with 100 answers. Private CSVs: tmp/omr-reference/private-keys')


if __name__ == '__main__':
    main()
