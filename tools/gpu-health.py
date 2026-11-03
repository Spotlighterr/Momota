#!/usr/bin/env python3
"""Collect local GPU state and crash summaries without uploading anything."""
import argparse
import datetime
import json
import pathlib
import plistlib
import re
import struct
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
            relevant = path.suffix == '.gpuRestart' or any(part in path.name for part in ('WindowServer', 'mediaanalysisd', 'Code-', 'Code Helper', 'rtx-probe'))
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
    # Chromium often records GPU hangs in Crashpad rather than macOS .ips files.
    # Read only stream metadata and the reporting thread name, never heap contents.
    crashpads = [pathlib.Path.home() / 'Library/Application Support/Code/Crashpad', pathlib.Path('code-profile/Crashpad')]
    for root in crashpads:
        if not root.is_dir():
            continue
        for path in root.rglob('*.dmp'):
            try:
                data = path.read_bytes()
                if data[:4] != b'MDMP':
                    continue
                count, directory = struct.unpack_from('<II', data, 8)
                if count > 128:
                    continue
                streams = {}
                for index in range(count):
                    kind, size, offset = struct.unpack_from('<III', data, directory + index * 12)
                    streams[kind] = (size, offset)
                if 6 not in streams:
                    continue
                exception = streams[6][1]
                thread_id = struct.unpack_from('<I', data, exception)[0]
                code = struct.unpack_from('<I', data, exception + 8)[0]
                name = None
                if 24 in streams:
                    size, offset = streams[24]
                    names = struct.unpack_from('<I', data, offset)[0]
                    if names > min(4096, (size - 4) // 12):
                        continue
                    for index in range(names):
                        thread, address = struct.unpack_from('<IQ', data, offset + 4 + index * 12)
                        if thread == thread_id:
                            length = struct.unpack_from('<I', data, address)[0]
                            if length <= 1024:
                                name = data[address + 4:address + 4 + length].decode('utf-16-le')
                if name and 'Gpu' in name:
                    reports.append({'name': path.name, 'modified': path.stat().st_mtime,
                        'application': 'Code' if root.is_absolute() else 'Code RTX',
                        'kind': 'chromium-gpu-diagnostic-dump', 'thread': name, 'exceptionCode': hex(code)})
            except (OSError, ValueError, struct.error, UnicodeError):
                continue
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
        cutoff = datetime.datetime.fromisoformat(previous['capturedAt']).timestamp()
        result['newReports'] = [item for item in result['reports'] if item['name'] not in known and item['modified'] >= cutoff]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'accelerators': result['accelerators'], 'newReports': result.get('newReports', []), 'output': str(args.output)}, indent=2))


if __name__ == '__main__':
    main()
