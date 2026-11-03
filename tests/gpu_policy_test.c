#include "gpu_policy.h"
#include <assert.h>
#include <stdio.h>

int main(void) {
    struct momota_registry_filter filter;
    const char *invalid[] = {"", "0", "-1", "+1", " 1", "1 ", "1x", "invalid", "0x",
        "0x0", "0xG", "18446744073709551616", "0x10000000000000000"};
    for (unsigned i = 0; i < sizeof(invalid) / sizeof(invalid[0]); ++i) {
        assert(!momota_parse_registry_filter(invalid[i], &filter));
        assert(!filter.specified && filter.registry_id == 0);
    }
    assert(momota_parse_registry_filter(NULL, &filter) && !filter.specified);
    assert(!momota_parse_registry_filter("1", NULL));
    assert(momota_parse_registry_filter("18446744073709551615", &filter));
    assert(filter.registry_id == UINT64_MAX);
    assert(momota_parse_registry_filter("0xffffffffffffffff", &filter));
    assert(filter.registry_id == UINT64_MAX);
    assert(momota_parse_registry_filter("00042", &filter) && filter.registry_id == 42);
    assert(momota_parse_registry_filter("0X2A", &filter) && filter.registry_id == 42);
    struct momota_gpu_identity nvidia = {0x10de, 0x25a2, 42};
    struct momota_gpu_identity amd = {0x1002, 0x1638, 42};
    struct momota_gpu_identity other_nvidia = {0x10de, 0x25a2, 43};
    assert(momota_gpu_matches(&nvidia, &filter));
    assert(!momota_gpu_matches(&amd, &filter));
    assert(!momota_gpu_matches(&other_nvidia, &filter));
    assert(!momota_gpu_matches(NULL, &filter));
    assert(momota_parse_registry_filter(NULL, &filter));
    assert(momota_gpu_matches(&other_nvidia, &filter));
    assert(momota_gpu_matches(&nvidia, NULL));
    puts("C GPU policy: PASS (input boundaries and PCI identity selection)");
    return 0;
}
