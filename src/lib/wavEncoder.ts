// Encoder PCM Float32 -> WAV 16-bit mono 16kHz
export function encodeWav(chunks: Float32Array[], inputSampleRate: number, targetSampleRate = 16000): Blob {
  // Concat
  let length = 0;
  for (const c of chunks) length += c.length;
  const merged = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  // Downsample para 16kHz
  const downsampled = downsample(merged, inputSampleRate, targetSampleRate);

  // PCM 16-bit
  const buffer = new ArrayBuffer(44 + downsampled.length * 2);
  const view = new DataView(buffer);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + downsampled.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, downsampled.length * 2, true);

  let pos = 44;
  for (let i = 0; i < downsampled.length; i++) {
    const s = Math.max(-1, Math.min(1, downsampled[i]));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    pos += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function downsample(buffer: Float32Array, inputRate: number, targetRate: number): Float32Array {
  if (targetRate === inputRate) return buffer;
  const ratio = inputRate / targetRate;
  const newLen = Math.floor(buffer.length / ratio);
  const out = new Float32Array(newLen);
  let i = 0;
  let pos = 0;
  while (i < newLen) {
    const next = Math.floor((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = pos; j < next && j < buffer.length; j++) {
      sum += buffer[j];
      count++;
    }
    out[i] = count > 0 ? sum / count : 0;
    i++;
    pos = next;
  }
  return out;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // remove data:...;base64,
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
