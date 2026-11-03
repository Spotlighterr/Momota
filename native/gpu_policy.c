#include "gpu_policy.h"

bool momota_parse_registry_filter(const char *text, struct momota_registry_filter *out) {
    if (!out) return false;
    out->specified = false;
    out->registry_id = 0;
    if (!text) return true;
    unsigned base = 10;
    if (text[0] == '0' && (text[1] == 'x' || text[1] == 'X')) {
        base = 16;
        text += 2;
    }
    if (!*text) return false;
    uint64_t value = 0;
    for (; *text; ++text) {
        unsigned digit;
        if (*text >= '0' && *text <= '9') digit = (unsigned)(*text - '0');
        else if (*text >= 'a' && *text <= 'f') digit = (unsigned)(*text - 'a' + 10);
        else if (*text >= 'A' && *text <= 'F') digit = (unsigned)(*text - 'A' + 10);
        else return false;
        if (digit >= base || value > (UINT64_MAX - digit) / base) return false;
        value = value * base + digit;
    }
    if (!value) return false;
    out->specified = true;
    out->registry_id = value;
    return true;
}

bool momota_gpu_matches(const struct momota_gpu_identity *gpu,
                       const struct momota_registry_filter *filter) {
    return gpu && gpu->vendor_id == 0x10de && gpu->device_id == 0x25a2 &&
        (!filter || !filter->specified || filter->registry_id == gpu->registry_id);
}
