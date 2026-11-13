#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
compiler="${IASL:-$PWD/build/acpi-tools/iasl}"
if [[ ! -x "$compiler" ]]; then
  echo 'Set IASL to an executable ACPICA iASL compiler.' >&2
  exit 1
fi
mkdir -p build/acpi
"$compiler" -we -p build/acpi/SSDT-Momota-DGPU-Audit acpi/SSDT-Momota-DGPU.dsl
"$compiler" -we -D MOMOTA_ENABLE_DGPU -p build/acpi/SSDT-Momota-DGPU-Enable acpi/SSDT-Momota-DGPU.dsl
echo 'Experimental AML built. No EFI files or boot settings were changed.'
