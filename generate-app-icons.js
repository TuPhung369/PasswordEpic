const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, 'logo.png');

// Function to add rounded corners using SVG overlay
async function roundCorners(input, size, borderRadius = 0.2) {
  const radius = Math.round(size * borderRadius);

  // Create rounded rectangle SVG mask
  const svgMask = Buffer.from(`
    <svg width="${size}" height="${size}">
      <defs>
        <mask id="rounded">
          <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
        </mask>
      </defs>
      <rect x="0" y="0" width="${size}" height="${size}" fill="black" mask="url(#rounded)"/>
    </svg>
  `);

  const image = await sharp(input)
    .resize(size, size, { fit: 'cover' })
    .toBuffer();

  const mask = await sharp(svgMask).resize(size, size).greyscale().toBuffer();

  return sharp(image)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png();
}

// Android icon sizes
const androidSizes = [
  {
    path: 'android/app/src/main/res/mipmap-mdpi',
    size: 48,
    name: 'ic_launcher.png',
  },
  {
    path: 'android/app/src/main/res/mipmap-hdpi',
    size: 72,
    name: 'ic_launcher.png',
  },
  {
    path: 'android/app/src/main/res/mipmap-xhdpi',
    size: 96,
    name: 'ic_launcher.png',
  },
  {
    path: 'android/app/src/main/res/mipmap-xxhdpi',
    size: 144,
    name: 'ic_launcher.png',
  },
  {
    path: 'android/app/src/main/res/mipmap-xxxhdpi',
    size: 192,
    name: 'ic_launcher.png',
  },
  {
    path: 'android/app/src/main/res/mipmap-mdpi',
    size: 48,
    name: 'ic_launcher_round.png',
  },
  {
    path: 'android/app/src/main/res/mipmap-hdpi',
    size: 72,
    name: 'ic_launcher_round.png',
  },
  {
    path: 'android/app/src/main/res/mipmap-xhdpi',
    size: 96,
    name: 'ic_launcher_round.png',
  },
  {
    path: 'android/app/src/main/res/mipmap-xxhdpi',
    size: 144,
    name: 'ic_launcher_round.png',
  },
  {
    path: 'android/app/src/main/res/mipmap-xxxhdpi',
    size: 192,
    name: 'ic_launcher_round.png',
  },
];

// iOS sizes
const iosSizes = [
  { size: 120, scale: '2x' },
  { size: 180, scale: '3x' },
  { size: 60, scale: '1x' },
];

async function generateIcons() {
  try {
    console.log('🚀 Starting icon generation from logo.png...\n');

    // Generate Android icons
    console.log('📱 Generating Android icons...');
    for (const icon of androidSizes) {
      const dir = path.join(__dirname, icon.path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const outputPath = path.join(dir, icon.name);
      const pipeline = await roundCorners(logoPath, icon.size);
      await pipeline.toFile(outputPath);

      console.log(
        `   ✅ ${icon.name} (${icon.size}x${icon.size}) with rounded corners → ${icon.path}`,
      );
    }

    console.log('\n✨ All icons generated successfully!');
    console.log('📤 Changes will appear after rebuilding the app.\n');
    console.log('Run: npm run android  (or npm run ios)');
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
