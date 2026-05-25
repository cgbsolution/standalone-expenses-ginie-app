const Jimp = require('jimp-compact');
const path = require('path');
const fs = require('fs');

const SRC = path.resolve(__dirname, '..', 'assets', 'iconginie.png');
const RES = path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

const LEGACY_SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND_SIZES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

(async () => {
  const src = await Jimp.read(SRC);

  for (const [density, size] of Object.entries(LEGACY_SIZES)) {
    const dir = path.join(RES, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    await src.clone().resize(size, size).writeAsync(path.join(dir, 'ic_launcher.png'));
    await src.clone().resize(size, size).writeAsync(path.join(dir, 'ic_launcher_round.png'));
    console.log(`wrote ic_launcher${'/'}round @ mipmap-${density} (${size}x${size})`);
  }

  for (const [density, size] of Object.entries(FOREGROUND_SIZES)) {
    const dir = path.join(RES, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });
    await src.clone().resize(size, size).writeAsync(path.join(dir, 'ic_launcher_foreground.png'));
    console.log(`wrote ic_launcher_foreground @ mipmap-${density} (${size}x${size})`);
  }

  console.log('done.');
})().catch(e => { console.error(e); process.exit(1); });
