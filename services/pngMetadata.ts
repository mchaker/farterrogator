
export const embedPngMetadata = async (file: File, prompt: string): Promise<Blob> => {
  // Always process image to resize to ~1MP and strip original metadata
  const pngBlob = await processImage(file);

  const arrayBuffer = await pngBlob.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // Check for PNG signature
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  for (let i = 0; i < 8; i++) {
    if (data[i] !== signature[i]) {
      throw new Error('Failed to process PNG data');
    }
  }

  const chunks: Uint8Array[] = [];
  let offset = 8; // Skip signature

  // Helper to create a chunk
  const createChunk = (type: string, data: Uint8Array) => {
    const length = data.length;
    const buffer = new Uint8Array(4 + 4 + length + 4);
    const view = new DataView(buffer.buffer);

    view.setUint32(0, length, false);
    for (let i = 0; i < 4; i++) {
      buffer[4 + i] = type.charCodeAt(i);
    }
    buffer.set(data, 8);

    // CRC calculation
    const crc = crc32(buffer.subarray(4, 4 + 4 + length));
    view.setUint32(8 + length, crc, false);

    return buffer;
  };

  // CRC32 implementation
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    crcTable[n] = c;
  }

  const crc32 = (buf: Uint8Array) => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return crc ^ 0xffffffff;
  };

  // Create metadata chunks
  const textEncoder = new TextEncoder();
  
  const createTextChunk = (keyword: string, text: string) => {
    const keywordBytes = textEncoder.encode(keyword);
    const textBytes = textEncoder.encode(text);
    const data = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
    data.set(keywordBytes, 0);
    data[keywordBytes.length] = 0; // Null separator
    data.set(textBytes, keywordBytes.length + 1);
    return createChunk('tEXt', data);
  };

  // NAI Metadata - Minimal set
  const metadataChunks = [
    createTextChunk('Software', 'NovelAI'),
    createTextChunk('Source', 'NovelAI'),
    createTextChunk('Description', prompt),
    createTextChunk('Comment', JSON.stringify({
      prompt: prompt
    }))
  ];

  // Reconstruct file with new chunks inserted after IHDR
  chunks.push(data.slice(0, 8)); // Signature

  while (offset < data.length) {
    const view = new DataView(data.buffer);
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(
      data[offset + 4],
      data[offset + 5],
      data[offset + 6],
      data[offset + 7]
    );

    const chunkTotalLength = length + 12;
    const chunkData = data.slice(offset, offset + chunkTotalLength);
    
    chunks.push(chunkData);
    offset += chunkTotalLength;

    if (type === 'IHDR') {
      // Insert metadata after IHDR
      chunks.push(...metadataChunks);
    }
  }

  // Combine all chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const resultBuffer = new Uint8Array(totalLength);
  let resultOffset = 0;
  for (const chunk of chunks) {
    resultBuffer.set(chunk, resultOffset);
    resultOffset += chunk.length;
  }

  return new Blob([resultBuffer], { type: 'image/png' });
};

const processImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      // Calculate 1MP dimensions (approx 1,048,576 pixels)
      const targetPixels = 1024 * 1024;
      const currentPixels = width * height;
      
      // Scale to match ~1MP density
      const scale = Math.sqrt(targetPixels / currentPixels);
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // High quality scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas to Blob failed'));
        }
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};
