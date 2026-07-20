import fs from 'fs';
import path from 'path';

// Y4M fixture for Chromium's --use-file-for-fake-video-capture flag — lets
// video-feed-panel.spec.ts drive a REAL getUserMedia()/VideoEncoder encode
// on the "Electron source" page (see useVideoStream.ts's isElectronSource
// gate) without a physical camera. Format: a YUV4MPEG2 header line followed
// by one `FRAME\n` + raw I420 (4:2:0 planar) bytes per frame — see
// https://wiki.multimedia.cx/index.php/YUV4MPEG2.
const WIDTH = 64;
const HEIGHT = 64;
const FPS_NUM = 5;
const FPS_DEN = 1;
const FRAME_COUNT = 30;

export function ensureFakeVideoFixture(filePath: string): string {
  if (fs.existsSync(filePath)) return filePath;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const header = `YUV4MPEG2 W${WIDTH} H${HEIGHT} F${FPS_NUM}:${FPS_DEN} Ip A1:1 C420jpeg\n`;
  const ySize = WIDTH * HEIGHT;
  const cSize = (WIDTH / 2) * (HEIGHT / 2);
  const parts: Buffer[] = [Buffer.from(header, 'ascii')];

  // Luma cycles across frames so consecutive decoded frames are visibly
  // different — video-feed-panel.spec.ts fingerprints the receiver canvas
  // across two samples to prove real frames are decoding.
  for (let f = 0; f < FRAME_COUNT; f++) {
    const yValue = 40 + (f % 6) * 30; // 40..190
    parts.push(
      Buffer.from('FRAME\n', 'ascii'),
      Buffer.alloc(ySize, yValue),
      Buffer.alloc(cSize, 128),
      Buffer.alloc(cSize, 128),
    );
  }

  fs.writeFileSync(filePath, Buffer.concat(parts));
  return filePath;
}
