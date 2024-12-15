const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

class ImageGenerationError extends Error {
  constructor(message, code, recoverable = true) {
    super(message);
    this.name = 'ImageGenerationError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

async function generateTokenImage(token) {
  try {
    const svgBuffer = Buffer.from(`
      <svg width="800" height="400">
        <style>
          @font-face {
            font-family: 'Inter Display';
            src: url('${path.join(__dirname, '..', 'assets', 'InterDisplay-Bold.ttf')}');
            font-weight: bold;
          }
        </style>
        <text 
          x="100" 
          y="220" 
          font-family="'Inter Display'"
          font-weight="bold"
          font-size="68px" 
          fill="white"
          text-anchor="start"
          dominant-baseline="middle"
          letter-spacing="1px"
        >${token}</text>
      </svg>
    `);

    const bgPath = path.join(__dirname, '..', 'assets', 'authimage.png');
    console.log('Full image path:', bgPath);

    if (!fs.existsSync(bgPath)) {
      throw new ImageGenerationError(
        'Background image file not found',
        'FILE_NOT_FOUND',
        false
      );
    }

    // Create the image
    const buffer = await sharp(bgPath)
      .resize(800, 400, {
        fit: 'cover',
        position: 'center'
      })
      .composite([{
        input: svgBuffer,
        top: 0,
        left: 0
      }])
      .png()
      .toBuffer();

    return buffer;

  } catch (error) {
    console.error('Sharp error details:', error);
    throw new ImageGenerationError(
      'Failed to generate image',
      'GENERATION_FAILED',
      true
    );
  }
}

module.exports = {
  generateTokenImage,
  ImageGenerationError
}; 