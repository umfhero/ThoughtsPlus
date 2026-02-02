/**
 * QR Chunker Utility
 * 
 * Compresses and chunks data for QR code generation.
 * Each QR code can hold ~2KB of data, so we split large exports into multiple codes.
 */

import pako from 'pako';

export interface QRChunk {
    /** Version of the chunk format */
    v: number;
    /** Current chunk index (1-based) */
    i: number;
    /** Total number of chunks */
    t: number;
    /** Short hash for validation (first 8 chars of base64) */
    h: string;
    /** Compressed and base64 encoded data */
    d: string;
}

// Target size per QR chunk (~1.2KB for 'H' error correction level)
// QR v40 with H correction holds ~1273 bytes, so 1200 is safe
const MAX_CHUNK_SIZE = 1200;

/**
 * Simple hash function for chunk validation
 */
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
}

/**
 * Compress and chunk data for QR code generation
 * @param data - The object to compress and chunk
 * @returns Array of QR chunk objects
 */
export function compressAndChunk(data: object): QRChunk[] {
    // Step 1: Stringify the data
    const jsonString = JSON.stringify(data);

    // Step 2: Compress using pako (gzip)
    const compressed = pako.gzip(jsonString);

    // Step 3: Convert to base64
    const base64 = btoa(
        String.fromCharCode.apply(null, Array.from(compressed))
    );

    // Step 4: Calculate hash for validation
    const fullHash = simpleHash(base64);

    // Step 5: Split into chunks
    const chunks: QRChunk[] = [];
    const totalChunks = Math.ceil(base64.length / MAX_CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * MAX_CHUNK_SIZE;
        const end = Math.min(start + MAX_CHUNK_SIZE, base64.length);
        const chunkData = base64.substring(start, end);

        chunks.push({
            v: 1,           // Version 1
            i: i + 1,       // 1-based index
            t: totalChunks, // Total chunks
            h: fullHash,    // Hash for validation
            d: chunkData    // Data chunk
        });
    }

    return chunks;
}

/**
 * Reassemble chunks back into the original data
 * @param chunks - Array of QR chunks (can be in any order)
 * @returns The decompressed original object, or null if validation fails
 */
export function reassembleChunks(chunks: QRChunk[]): object | null {
    if (chunks.length === 0) return null;

    // Validate all chunks have same hash and total
    const expectedHash = chunks[0].h;
    const expectedTotal = chunks[0].t;

    if (chunks.length !== expectedTotal) {
        console.error(`Missing chunks: got ${chunks.length}, expected ${expectedTotal}`);
        return null;
    }

    // Sort by index and validate
    const sorted = [...chunks].sort((a, b) => a.i - b.i);

    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].h !== expectedHash) {
            console.error(`Hash mismatch at chunk ${i + 1}`);
            return null;
        }
        if (sorted[i].i !== i + 1) {
            console.error(`Missing chunk ${i + 1}`);
            return null;
        }
    }

    // Reassemble base64 string
    const base64 = sorted.map(c => c.d).join('');

    // Validate hash
    if (simpleHash(base64) !== expectedHash) {
        console.error('Final hash validation failed');
        return null;
    }

    try {
        // Decode base64 to Uint8Array
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Decompress
        const decompressed = pako.ungzip(bytes, { to: 'string' });

        // Parse JSON
        return JSON.parse(decompressed);
    } catch (e) {
        console.error('Failed to decompress/parse data:', e);
        return null;
    }
}

/**
 * Generate QR code data string from a chunk
 * @param chunk - The QR chunk object
 * @returns JSON string ready for QR code generation
 */
export function generateQRData(chunk: QRChunk): string {
    return JSON.stringify(chunk);
}

/**
 * Parse QR code data back into a chunk
 * @param qrData - The scanned QR code data string
 * @returns Parsed QR chunk or null if invalid
 */
export function parseQRData(qrData: string): QRChunk | null {
    try {
        const parsed = JSON.parse(qrData);

        // Validate structure
        if (
            typeof parsed.v === 'number' &&
            typeof parsed.i === 'number' &&
            typeof parsed.t === 'number' &&
            typeof parsed.h === 'string' &&
            typeof parsed.d === 'string'
        ) {
            return parsed as QRChunk;
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Get human-readable size of the compressed data
 */
export function getCompressedSize(chunks: QRChunk[]): string {
    const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.d.length, 0);
    if (totalBytes < 1024) {
        return `${totalBytes} bytes`;
    }
    return `${(totalBytes / 1024).toFixed(1)} KB`;
}
