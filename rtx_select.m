// Per-process Metal device selection for GA401QC / NullMoth.
// Independent implementation; inspired by sid-ravikumar/macos-discrete-gpu (MIT).
// Explicit PCI identity is essential: NootedRed and NVMTL both report lowPower=NO.
#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#import <CoreGraphics/CoreGraphics.h>
#import <IOKit/IOKitLib.h>
#include <dispatch/dispatch.h>
#include <dlfcn.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>

#define INTERPOSE(replacement, original) \
  __attribute__((used)) static struct { const void *newfn; const void *oldfn; } \
  interpose_##original __attribute__((section("__DATA,__interpose"))) = \
  { (const void *)&replacement, (const void *)&original };

static id<MTLDevice> chosen;
static dispatch_once_t selectionOnce;

static uint32_t pciValue(io_registry_entry_t entry, CFStringRef key) {
    CFTypeRef value = IORegistryEntryCreateCFProperty(entry, key, kCFAllocatorDefault, 0);
    uint32_t result = 0;
    if (value && CFGetTypeID(value) == CFDataGetTypeID() && CFDataGetLength(value) >= 4)
        memcpy(&result, CFDataGetBytePtr(value), 4);
    if (value) CFRelease(value);
    return result;
}

static BOOL enabled(void) {
    const char *flag = getenv("RTX_FORCE");
    const char *process = getprogname();
    return flag && !strcmp(flag, "1") && process && strcmp(process, "WindowServer");
}

static id<MTLDevice> selectedDevice(void) {
    if (!enabled()) return nil;
    dispatch_once(&selectionOnce, ^{
        // dyld excludes the image that defines an interpose tuple from that tuple.
        // Direct calls here reach Metal. dlsym(RTLD_NEXT) can return the replacement
        // on this dyld version and recursively enter selectionOnce.
        NSArray<id<MTLDevice>> *devices = MTLCopyAllDevices();
        const char *requested = getenv("RTX_REGISTRY_ID");
        uint64_t exact = requested ? strtoull(requested, NULL, 0) : 0;
        NSUInteger matches = 0;
        for (id<MTLDevice> device in devices) {
            io_registry_entry_t entry = IOServiceGetMatchingService(kIOMainPortDefault,
                IORegistryEntryIDMatching(device.registryID));
            if (!entry) continue;
            // Metal registryID identifies the accelerator service, not its PCI parent.
            while (entry && !IOObjectConformsTo(entry, "IOPCIDevice")) {
                io_registry_entry_t parent = IO_OBJECT_NULL;
                kern_return_t kr = IORegistryEntryGetParentEntry(entry, kIOServicePlane, &parent);
                IOObjectRelease(entry);
                entry = kr == KERN_SUCCESS ? parent : IO_OBJECT_NULL;
            }
            if (!entry) continue;
            BOOL match = pciValue(entry, CFSTR("vendor-id")) == 0x10de &&
                         pciValue(entry, CFSTR("device-id")) == 0x25a2 &&
                         (!exact || exact == device.registryID);
            IOObjectRelease(entry);
            if (match) {
                matches++;
                if (!chosen) chosen = [device retain];
            }
        }
        // Fail back to normal selection rather than guessing on an ambiguous system.
        if (matches != 1) { [chosen release]; chosen = nil; }
        if (chosen)
            fprintf(stderr, "[rtx-select] %s: %s registry=%llu\n", getprogname(),
                chosen.name.UTF8String, (unsigned long long)chosen.registryID);
        else
            fprintf(stderr, "[rtx-select] %s: target unavailable/ambiguous; normal selection\n", getprogname());
        [devices release];
    });
    return chosen;
}

static id<MTLDevice> rtxDefaultDevice(void) {
    id<MTLDevice> target = selectedDevice();
    if (target) return [target retain];
    return MTLCreateSystemDefaultDevice();
}

static NSArray<id<MTLDevice>> *rtxAllDevices(void) {
    id<MTLDevice> target = selectedDevice();
    if (target) return [[NSArray alloc] initWithObjects:target, nil];
    return MTLCopyAllDevices();
}

static NSArray<id<MTLDevice>> *rtxDevicesWithObserver(id<NSObject> *observer,
        MTLDeviceNotificationHandler handler) {
    NSArray<id<MTLDevice>> *all = MTLCopyAllDevicesWithObserver(observer, handler);
    id<MTLDevice> target = selectedDevice();
    if (target) { [all release]; return [[NSArray alloc] initWithObjects:target, nil]; }
    return all;
}

static id<MTLDevice> rtxDisplayDevice(CGDirectDisplayID display) {
    id<MTLDevice> target = selectedDevice();
    if (target) return [target retain];
    return CGDirectDisplayCopyCurrentMetalDevice(display);
}

INTERPOSE(rtxDefaultDevice, MTLCreateSystemDefaultDevice)
INTERPOSE(rtxAllDevices, MTLCopyAllDevices)
INTERPOSE(rtxDevicesWithObserver, MTLCopyAllDevicesWithObserver)
INTERPOSE(rtxDisplayDevice, CGDirectDisplayCopyCurrentMetalDevice)
