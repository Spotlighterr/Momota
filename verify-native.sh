#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
python3 tools/check-driver-state.py
mkdir -p reports/native
env -u RTX_FORCE -u RTX_REGISTRY_ID -u DYLD_INSERT_LIBRARIES \
  ./build/rtx-probe > reports/native/baseline.txt 2> reports/native/baseline.log
env -u RTX_REGISTRY_ID RTX_FORCE=1 DYLD_INSERT_LIBRARIES="$PWD/build/rtx_select.dylib" \
  ./build/rtx-probe > reports/native/forced.txt 2> reports/native/forced.log
env -u RTX_REGISTRY_ID RTX_FORCE=0 DYLD_INSERT_LIBRARIES="$PWD/build/rtx_select.dylib" \
  ./build/rtx-probe > reports/native/disabled.txt 2> reports/native/disabled.log
env RTX_FORCE=1 RTX_REGISTRY_ID=1 DYLD_INSERT_LIBRARIES="$PWD/build/rtx_select.dylib" \
  ./build/rtx-probe > reports/native/missing-target.txt 2> reports/native/missing-target.log
for value in invalid 0 -1 18446744073709551616 ''; do
  name="invalid-${value:-empty}"
  env RTX_FORCE=1 RTX_REGISTRY_ID="$value" DYLD_INSERT_LIBRARIES="$PWD/build/rtx_select.dylib" \
    ./build/rtx-probe > "reports/native/$name.txt" 2> "reports/native/$name.log"
done
/usr/bin/ruby -e '
  %w[baseline forced disabled missing-target invalid-invalid invalid-0 invalid--1 invalid-18446744073709551616 invalid-empty].each do |name|
    text = File.read("reports/native/#{name}.txt")
    expect = name == "forced" ? "NVIDIA" : "AMD"
    abort "Incorrect default for #{name}: #{text}" unless text.lines.first.include?(expect)
    entries = text.lines.select { |line| line.start_with?("enumerated=") }
    expected_count = name == "forced" ? 1 : 2
    abort "Wrong enumeration for #{name}" unless entries.size == expected_count
    abort "Wrong compute/render output for #{name}" unless text.include?("compute=PASS 256/256") && text.include?("render-readback=PASS 4096/4096")
    abort "Wrong observer enumeration for #{name}" unless text.include?("observer-enumeration=PASS")
    puts "#{name}: PASS default=#{expect}; compute 256/256; pixels 4096/4096"
  end
'
