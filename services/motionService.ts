
import { MotionPreset } from '../types';

// Spline helper for interpolation
const getSplinePoint = (p0: {x:number, y:number}, p1: {x:number, y:number}, p2: {x:number, y:number}, p3: {x:number, y:number}, t: number) => {
    const v0x = (p2.x - p0.x) * 0.5;
    const v0y = (p2.y - p0.y) * 0.5;
    const v1x = (p3.x - p1.x) * 0.5;
    const v1y = (p3.y - p1.y) * 0.5;
    const t2 = t * t;
    const t3 = t * t2;
    return {
        x: (2 * p1.x - 2 * p2.x + v0x + v1x) * t3 + (-3 * p1.x + 3 * p2.x - 2 * v0x - v1x) * t2 + v0x * t + p1.x,
        y: (2 * p1.y - 2 * p2.y + v0y + v1y) * t3 + (-3 * p1.y + 3 * p2.y - 2 * v0y - v1y) * t2 + v0y * t + p1.y
    };
};

const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

export const renderFrame = (
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement | HTMLVideoElement,
    progress: number, // 0 to 1
    preset: MotionPreset,
    canvasW: number,
    canvasH: number,
    travelTime: number,
    delayTime: number,
    totalDuration: number
) => {
    // 1. Calculate Camera Position (cx, cy) and Zoom
    let cx = 0.5;
    let cy = 0.5;
    let zoom = 1.0;

    const { params } = preset;

    if (params.path && params.path.length > 0) {
        // --- PATH LOGIC ---
        const points = params.path;
        const loop = params.pathLoop || false;
        
        // Calculate required zoom to reach all points without black borders
        let minX = 1, maxX = 0, minY = 1, maxY = 0;
        for (const p of points) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }
        
        const reqZoomMinX = minX > 0 ? 1 / (2 * minX) : 10;
        const reqZoomMaxX = maxX < 1 ? 1 / (2 * (1 - maxX)) : 10;
        const reqZoomMinY = minY > 0 ? 1 / (2 * minY) : 10;
        const reqZoomMaxY = maxY < 1 ? 1 / (2 * (1 - maxY)) : 10;
        
        const requiredZoom = Math.max(
            params.zoomStart,
            reqZoomMinX, reqZoomMaxX, reqZoomMinY, reqZoomMaxY
        );
        
        // Cap the zoom to a reasonable maximum to avoid extreme pixelation
        zoom = Math.min(requiredZoom, 4.0);
        
        // Handle single point
        if (points.length === 1) {
            cx = points[0].x;
            cy = points[0].y;
        } else {
            const numPoints = points.length;
            const segments = loop ? numPoints : numPoints - 1;
            
            let idx = 0;
            let t = 0;
            const elapsed = progress * totalDuration;
            
            // Map elapsed time to segments and pauses
            let currentElapsed = 0;
            for (let i = 0; i < numPoints; i++) {
                // Wait at point i
                if (elapsed < currentElapsed + delayTime) {
                    idx = i;
                    t = 0;
                    break;
                }
                currentElapsed += delayTime;
                
                // Travel to point i+1
                if (i < segments) {
                    if (elapsed < currentElapsed + travelTime) {
                        idx = i;
                        t = (elapsed - currentElapsed) / travelTime;
                        
                        // Apply easing for cinematic-tour and custom-path
                        if (preset.id === 'cinematic-tour' || preset.id === 'custom-path') {
                            t = t * t * (3 - 2 * t); // Smoothstep easing
                        }
                        break;
                    }
                    currentElapsed += travelTime;
                }
            }
            
            // If elapsed is beyond the calculated sequence
            if (elapsed >= currentElapsed) {
                idx = loop ? numPoints - 1 : numPoints - 1;
                t = loop ? 1 : 0;
            }
            
            // Get 4 points for spline
            const getPt = (i: number) => points[(i + points.length) % points.length];
            
            if (preset.id === 'custom-path') {
                // Linear
                const p1 = points[Math.min(idx, points.length - 1)];
                const p2 = points[Math.min(idx + 1, points.length - 1)]; // clamp for non-loop
                if (loop) {
                     const pp1 = getPt(idx);
                     const pp2 = getPt(idx + 1);
                     cx = lerp(pp1.x, pp2.x, t);
                     cy = lerp(pp1.y, pp2.y, t);
                } else {
                     cx = lerp(p1.x, p2.x, t);
                     cy = lerp(p1.y, p2.y, t);
                }
            } else {
                // Spline (cinematic-tour)
                const p0 = loop ? getPt(idx - 1) : points[Math.max(0, idx - 1)];
                const p1 = loop ? getPt(idx) : points[Math.min(idx, points.length - 1)];
                const p2 = loop ? getPt(idx + 1) : points[Math.min(idx + 1, points.length - 1)];
                const p3 = loop ? getPt(idx + 2) : points[Math.min(idx + 2, points.length - 1)];
                
                const pos = getSplinePoint(p0, p1, p2, p3, t);
                cx = pos.x;
                cy = pos.y;
            }
        }

        // Clamp absolute coordinates to prevent black borders
        const minCx = 1 / (2 * zoom);
        const maxCx = 1 - minCx;
        const minCy = 1 / (2 * zoom);
        const maxCy = 1 - minCy;
        
        if (zoom <= 1.0) {
            cx = 0.5;
            cy = 0.5;
        } else {
            cx = Math.max(minCx, Math.min(cx, maxCx));
            cy = Math.max(minCy, Math.min(cy, maxCy));
        }

    } else {
        // --- STANDARD PRESET LOGIC ---
        const relCx = lerp(params.panXStart, params.panXEnd, progress);
        const relCy = lerp(params.panYStart, params.panYEnd, progress);
        zoom = lerp(params.zoomStart, params.zoomEnd, progress);
        
        // Remap relative coordinates to valid bounds to prevent black borders
        const minCx = 1 / (2 * zoom);
        const maxCx = 1 - minCx;
        const minCy = 1 / (2 * zoom);
        const maxCy = 1 - minCy;
        
        if (zoom <= 1.0) {
            cx = 0.5;
            cy = 0.5;
        } else {
            cx = minCx + relCx * (maxCx - minCx);
            cy = minCy + relCy * (maxCy - minCy);
        }
    }

    // 2. Render Image
    // Fill BG
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const imgW = image instanceof HTMLVideoElement ? image.videoWidth : image.naturalWidth;
    const imgH = image instanceof HTMLVideoElement ? image.videoHeight : image.naturalHeight;
    const imgAR = imgW / imgH;
    const canvasAR = canvasW / canvasH;

    // Calculate "Cover" Scale (Scale required to just cover the canvas)
    let coverScale;
    if (imgAR > canvasAR) {
        // Image wider: limit is height
        coverScale = canvasH / imgH;
    } else {
        // Image taller: limit is width
        coverScale = canvasW / imgW;
    }

    // Apply Zoom factor
    const effectiveScale = coverScale * zoom;

    // Calculate source crop dimensions
    const srcCropW = canvasW / effectiveScale;
    const srcCropH = canvasH / effectiveScale;

    // Calculate source crop position (centered around cx, cy)
    // cx, cy are normalized 0-1 relative to image dimensions
    const srcX = (cx * imgW) - (srcCropW / 2);
    const srcY = (cy * imgH) - (srcCropH / 2);

    // Optional: Clamp logic could go here to prevent showing out-of-bounds
    // But for "Pan" presets where we go 0.2 to 0.8, we generally stay safe if zoom > 1.
    // If zoom=1 and we pan, we will see edges. 
    // Usually Camera Motion apps clamp or ensure zoom is sufficient.
    
    ctx.drawImage(
        image, 
        srcX, srcY, srcCropW, srcCropH, 
        0, 0, canvasW, canvasH
    );
};
