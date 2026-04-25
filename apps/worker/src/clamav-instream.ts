import { createConnection } from 'node:net';

/** ClamAV INSTREAM (TCP) — küçük dosyalar için tek buffer */
export async function scanBufferWithClamd(
  host: string,
  port: number,
  data: Buffer,
  timeoutMs: number,
): Promise<{ clean: true } | { clean: false; signature: string }> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port }, () => {
      socket.write('nINSTREAM\n');
      let offset = 0;
      const writeNext = (): void => {
        if (offset >= data.length) {
          const z = Buffer.alloc(4);
          z.writeUInt32BE(0, 0);
          socket.write(z);
          return;
        }
        const chunkSize = Math.min(2048, data.length - offset);
        const hdr = Buffer.alloc(4);
        hdr.writeUInt32BE(chunkSize, 0);
        socket.write(hdr);
        socket.write(data.subarray(offset, offset + chunkSize));
        offset += chunkSize;
        writeNext();
      };
      writeNext();
    });

    let response = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('ClamAV scan timeout'));
    }, timeoutMs);

    socket.on('data', (chunk) => {
      response += chunk.toString('utf8');
    });
    socket.on('end', () => {
      clearTimeout(timer);
      if (response.includes('FOUND')) {
        const m = response.match(/: (.+) FOUND/);
        resolve({ clean: false, signature: m?.[1]?.trim() ?? 'UNKNOWN' });
      } else if (response.includes('OK') || response.includes('stream: OK')) {
        resolve({ clean: true });
      } else {
        reject(new Error(`ClamAV beklenmeyen yanıt: ${response.slice(0, 200)}`));
      }
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
