/* Read accelerator counters directly through IOKit; never submit GPU work. */
#include <CoreFoundation/CoreFoundation.h>
#include <IOKit/IOKitLib.h>
#include <inttypes.h>
#include <stdio.h>

static void json_string(const char *text) {
    putchar('"');
    for (const unsigned char *p = (const unsigned char *)text; *p; p++) {
        if (*p == '"' || *p == '\\') printf("\\%c", *p);
        else if (*p < 0x20) printf("\\u%04x", *p);
        else putchar(*p);
    }
    putchar('"');
}

int main(void) {
    io_iterator_t iterator = IO_OBJECT_NULL;
    kern_return_t status = IOServiceGetMatchingServices(kIOMainPortDefault,
        IOServiceMatching("IOAccelerator"), &iterator);
    if (status != KERN_SUCCESS) {
        fprintf(stderr, "Cannot enumerate accelerators: %d\n", status);
        return 1;
    }
    const char *keys[] = {"recoveryCount", "GPU Activity(%)", "vramFreeBytes",
        "inUseVidMemoryBytes", "gartUsedBytes"};
    int first = 1;
    putchar('[');
    io_service_t service;
    while ((service = IOIteratorNext(iterator))) {
        io_name_t name = {0};
        uint64_t registry_id = 0;
        IORegistryEntryGetName(service, name);
        IORegistryEntryGetRegistryEntryID(service, &registry_id);
        if (!first) putchar(',');
        first = 0;
        printf("{\"name\":"); json_string(name);
        /* Decimal strings preserve the full 64-bit registry identity in JS. */
        printf(",\"registryID\":\"%" PRIu64 "\",\"stats\":{", registry_id);
        CFTypeRef stats = IORegistryEntryCreateCFProperty(service,
            CFSTR("PerformanceStatistics"), kCFAllocatorDefault, 0);
        int first_key = 1;
        if (stats && CFGetTypeID(stats) == CFDictionaryGetTypeID()) {
            for (size_t i = 0; i < sizeof(keys) / sizeof(keys[0]); i++) {
                CFStringRef key = CFStringCreateWithCString(kCFAllocatorDefault, keys[i], kCFStringEncodingUTF8);
                CFTypeRef value = CFDictionaryGetValue((CFDictionaryRef)stats, key);
                int64_t number;
                if (value && CFGetTypeID(value) == CFNumberGetTypeID() &&
                    CFNumberGetValue((CFNumberRef)value, kCFNumberSInt64Type, &number)) {
                    if (!first_key) putchar(',');
                    first_key = 0;
                    json_string(keys[i]); printf(":%" PRId64, number);
                }
                CFRelease(key);
            }
        }
        if (stats) CFRelease(stats);
        printf("}}");
        IOObjectRelease(service);
    }
    printf("]\n");
    IOObjectRelease(iterator);
    return 0;
}
