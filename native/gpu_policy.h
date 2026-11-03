#ifndef MOMOTA_GPU_POLICY_H
#define MOMOTA_GPU_POLICY_H

#include <stdbool.h>
#include <stdint.h>

struct momota_gpu_identity {
    uint32_t vendor_id;
    uint32_t device_id;
    uint64_t registry_id;
};

struct momota_registry_filter {
    bool specified;
    uint64_t registry_id;
};

/* NULL means no filter. Otherwise accept a nonzero decimal or 0x hexadecimal ID. */
bool momota_parse_registry_filter(const char *text, struct momota_registry_filter *out);
bool momota_gpu_matches(const struct momota_gpu_identity *gpu,
                       const struct momota_registry_filter *filter);

#endif
