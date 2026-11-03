#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#import <AppKit/AppKit.h>
#import <QuartzCore/CAMetalLayer.h>

int main(void) { @autoreleasepool {
    id<MTLDevice> device = MTLCreateSystemDefaultDevice();
    if (!device) { fprintf(stderr, "No Metal device\n"); return 1; }
    printf("default=%s registry=%llu\n", device.name.UTF8String, (unsigned long long)device.registryID);
    NSArray<id<MTLDevice>> *all = MTLCopyAllDevices();
    for (id<MTLDevice> item in all) printf("enumerated=%s\n", item.name.UTF8String);
    NSError *error = nil;
    NSString *source = @"#include <metal_stdlib>\nusing namespace metal;\n"
        "kernel void test(device uint *out [[buffer(0)]],uint i [[thread_position_in_grid]]){out[i]=i*3+7;}\n"
        "struct V { float4 p [[position]]; };\n"
        "vertex V vs(uint i [[vertex_id]]){float2 p[3]={float2(-1,-1),float2(3,-1),float2(-1,3)};return {float4(p[i],0,1)};}\n"
        "fragment float4 fs(){return float4(0.125,0.75,0.25,1);}";
    id<MTLLibrary> library = [device newLibraryWithSource:source options:nil error:&error];
    if (!library) { fprintf(stderr, "compile: %s\n", error.description.UTF8String); return 2; }
    id<MTLFunction> function = [library newFunctionWithName:@"test"];
    id<MTLComputePipelineState> compute = [device newComputePipelineStateWithFunction:function error:&error];
    id<MTLBuffer> output = [device newBufferWithLength:1024 options:MTLResourceStorageModeShared];
    if (!compute || !output) { fprintf(stderr, "compute setup: %s\n", error.description.UTF8String); return 3; }
    id<MTLCommandQueue> queue = [device newCommandQueue];
    id<MTLCommandBuffer> command = [queue commandBuffer];
    id<MTLComputeCommandEncoder> encoder = [command computeCommandEncoder];
    [encoder setComputePipelineState:compute];
    [encoder setBuffer:output offset:0 atIndex:0];
    [encoder dispatchThreadgroups:MTLSizeMake(4,1,1) threadsPerThreadgroup:MTLSizeMake(64,1,1)];
    [encoder endEncoding]; [command commit]; [command waitUntilCompleted];
    if (command.status != MTLCommandBufferStatusCompleted) {
        fprintf(stderr, "compute failed: %s\n", command.error.description.UTF8String); return 4;
    }
    uint32_t *values = output.contents;
    for (NSUInteger i=0;i<256;i++) if (values[i] != i*3+7) {
        fprintf(stderr, "wrong compute output at %lu\n",(unsigned long)i); return 5;
    }
    puts("compute=PASS 256/256");
    MTLRenderPipelineDescriptor *pd = [MTLRenderPipelineDescriptor new];
    pd.vertexFunction = [library newFunctionWithName:@"vs"];
    pd.fragmentFunction = [library newFunctionWithName:@"fs"];
    pd.colorAttachments[0].pixelFormat = MTLPixelFormatBGRA8Unorm;
    id<MTLRenderPipelineState> render = [device newRenderPipelineStateWithDescriptor:pd error:&error];
    MTLTextureDescriptor *td = [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatBGRA8Unorm
        width:64 height:64 mipmapped:NO];
    td.usage = MTLTextureUsageRenderTarget;
    td.storageMode = MTLStorageModePrivate;
    id<MTLTexture> texture = [device newTextureWithDescriptor:td];
    if (!render || !texture) { fprintf(stderr,"render setup: %s\n",error.description.UTF8String); return 6; }
    id<MTLBuffer> readback = [device newBufferWithLength:64*64*4 options:MTLResourceStorageModeShared];
    command = [queue commandBuffer];
    MTLRenderPassDescriptor *pass = [MTLRenderPassDescriptor renderPassDescriptor];
    pass.colorAttachments[0].texture = texture;
    pass.colorAttachments[0].loadAction = MTLLoadActionClear;
    pass.colorAttachments[0].storeAction = MTLStoreActionStore;
    id<MTLRenderCommandEncoder> re = [command renderCommandEncoderWithDescriptor:pass];
    [re setRenderPipelineState:render];
    [re drawPrimitives:MTLPrimitiveTypeTriangle vertexStart:0 vertexCount:3];
    [re endEncoding];
    id<MTLBlitCommandEncoder> blit = [command blitCommandEncoder];
    [blit copyFromTexture:texture sourceSlice:0 sourceLevel:0 sourceOrigin:MTLOriginMake(0,0,0)
        sourceSize:MTLSizeMake(64,64,1) toBuffer:readback destinationOffset:0
        destinationBytesPerRow:256 destinationBytesPerImage:16384];
    [blit endEncoding]; [command commit]; [command waitUntilCompleted];
    if (command.status != MTLCommandBufferStatusCompleted) { fprintf(stderr,"render failed\n"); return 7; }
    uint8_t *pixels = readback.contents;
    for (NSUInteger i=0;i<4096;i++) {
        if (abs((int)pixels[i*4]-64)>1 || abs((int)pixels[i*4+1]-191)>1 ||
            abs((int)pixels[i*4+2]-32)>1 || pixels[i*4+3]!=255) {
            fprintf(stderr,"wrong pixel at %lu: %u %u %u %u\n",(unsigned long)i,
                pixels[i*4],pixels[i*4+1],pixels[i*4+2],pixels[i*4+3]); return 8;
        }
    }
    puts("render-readback=PASS 4096/4096");
    [all release]; [device release];
    return 0;
} }
