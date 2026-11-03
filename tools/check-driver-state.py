#!/usr/bin/env python3
"""Refuse GPU tests while installed and running NullMoth versions differ."""
import json
import pathlib
import plistlib
import re
import subprocess
import sys

try:
    result = subprocess.run(['kmutil', 'showloaded'], capture_output=True, text=True, timeout=15)
    if result.returncode:
        raise RuntimeError('Cannot inspect loaded GPU drivers')
    states = []
    for name in ['NVRM', 'NVAccel', 'NVRMFB', 'NVRMAGDC']:
        path = pathlib.Path('/Library/Extensions') / (name + '.kext') / 'Contents/Info.plist'
        with path.open('rb') as stream:
            installed = plistlib.load(stream).get('CFBundleVersion')
        match = re.search(r'com\.nullmoth\.' + name + r'\s+\(([^)]+)\)', result.stdout)
        loaded = match.group(1) if match else None
        states.append({'driver': name, 'installed': installed, 'loaded': loaded})
    if any(not item['installed'] or not item['loaded'] or item['installed'] != item['loaded'] for item in states):
        print(json.dumps(states, indent=2), file=sys.stderr)
        print('GPU driver update pending or driver unavailable. Restart the Mac before running Momota GPU tests.', file=sys.stderr)
        sys.exit(2)
    print('GPU drivers ready: ' + ', '.join(item['driver'] + ' ' + item['loaded'] for item in states))
except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
    print('GPU driver state check failed: ' + str(error), file=sys.stderr)
    sys.exit(3)
