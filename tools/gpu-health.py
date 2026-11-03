#!/usr/bin/env python3
"""Collect local GPU state and crash summaries without uploading anything."""
import argparse
import datetime
import json
import pathlib
import plistlib
import re
import subprocess


def command(*args):
    try:
        result = subprocess.run(args, capture_output=True, timeout=15)
        return result.stdout.decode(errors='replace') if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def collect():
    reports = []
    roots = [pathlib.Path('/Library/Logs/DiagnosticReports'), pathlib.Path.home() / 'Library/Logs/DiagnosticReports']
    for root in roots:
        if not root.is_dir():
            continue
        for path in root.iterdir():
            if path.suffix not in ('.gpuRestart', '.ips'):
                continue
            relevant = path.suffix == '.gpuRestart' or any(part in path.name for part in ('WindowServer', 'mediaanalysisd', 'Code-', 'rtx-probe'))
            if not relevant:
                continue
            try:
                item = {'name': path.name, 'modified': path.stat().st_mtime}
                if path.suffix == '.gpuRestart':
                    text = path.read_text(errors='replace')
                    for key, pattern in [('application', r'^Application:\s*(.*)'), ('gpu', r'^Graphics Hardware:\s*(.*)')]:
                        match = re.search(pattern, text, re.M)
                        item[key] = match.group(1) if match else None
                    item['shaders'] = sorted(set(re.findall(r'Hash:.*?\[(.*?)\]', text)))
                reports.append(item)
            except (OSError, ValueError):
                continue
    raw = command('ioreg', '-r', '-c', 'IOAccelerator', '-d', '1', '-a')
    accelerators = []
    if raw:
        try:
            for device in plistlib.loads(raw.encode()):
                stats = device.get('PerformanceStatistics', {})
                keys = ['recoveryCount', 'GPU Activity(%)', 'vramFreeBytes', 'inUseVidMemoryBytes', 'gartUsedBytes']
                accelerators.append({'name': device.get('IORegistryEntryName'), 'stats': {key: stats[key] for key in keys if key in stats}})
        except (ValueError, plistlib.InvalidFileException):
            pass
    return {'capturedAt': datetime.datetime.now().astimezone().isoformat(), 'accelerators': accelerators, 'reports': sorted(reports, key=lambda item: item['modified'], reverse=True)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=pathlib.Path, default=pathlib.Path('reports/health/current.json'))
    parser.add_argument('--compare', type=pathlib.Path)
    args = parser.parse_args()
    result = collect()
    if args.compare:
        previous = json.loads(args.compare.read_text())
        known = {item['name'] for item in previous['reports']}
        result['newReports'] = [item for item in result['reports'] if item['name'] not in known]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'accelerators': result['accelerators'], 'newReports': result.get('newReports', []), 'output': str(args.output)}, indent=2))


if __name__ == '__main__':
    main()
