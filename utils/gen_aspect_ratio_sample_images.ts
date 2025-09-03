#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

// Define resolution mappings with device info
const RESOLUTION_MAP: { [key: string]: { width: number; height: number; device: string } } = {
  '1:1': { width: 1024, height: 1024, device: 'instagram_square' },
  '16:9': { width: 1920, height: 1080, device: 'macbook_fullhd' },
  '9:16': { width: 1080, height: 1920, device: 'iphone_vertical' },
  '4:3': { width: 1600, height: 1200, device: 'ipad_landscape' },
  '3:4': { width: 1200, height: 1600, device: 'ipad_portrait' },
  '3:2': { width: 1500, height: 1000, device: 'dslr_landscape' },
  '2:3': { width: 1000, height: 1500, device: 'dslr_portrait' },
  '21:9': { width: 2560, height: 1097, device: 'ultrawide_monitor' },
  '5:4': { width: 1280, height: 1024, device: 'classic_monitor' },
  '4:5': { width: 1080, height: 1350, device: 'instagram_portrait' },
};

// Parse command line arguments
const aspectRatio = process.argv[2];

if (!aspectRatio) {
  console.error('Usage: bunx tsx utils/gen_aspect_ratio_sample_images.ts <aspect_ratio>');
  console.error('Example: bunx tsx utils/gen_aspect_ratio_sample_images.ts 9:16');
  console.error('\nSupported aspect ratios with optimized resolutions:');
  Object.entries(RESOLUTION_MAP).forEach(([ratio, info]) => {
    console.error(`  ${ratio} → ${info.width}×${info.height} (${info.device})`);
  });
  process.exit(1);
}

// Parse aspect ratio
const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);

if (!widthRatio || !heightRatio) {
  console.error('Invalid aspect ratio format. Please use format like "9:16" or "16:9"');
  process.exit(1);
}

// Get resolution from map or calculate based on aspect ratio
let width: number;
let height: number;
let deviceInfo: string;

if (RESOLUTION_MAP[aspectRatio]) {
  // Use predefined resolution
  const mapped = RESOLUTION_MAP[aspectRatio];
  width = mapped.width;
  height = mapped.height;
  deviceInfo = mapped.device;
} else {
  // Calculate resolution for custom aspect ratios
  const BASE_SIZE = 1200; // Higher base size for better quality
  if (widthRatio > heightRatio) {
    width = BASE_SIZE;
    height = Math.round((BASE_SIZE * heightRatio) / widthRatio);
  } else {
    height = BASE_SIZE;
    width = Math.round((BASE_SIZE * widthRatio) / heightRatio);
  }
  deviceInfo = 'custom';
}

// Create SVG content with better text spacing
const fontSize = Math.min(width, height) / 15; // Dynamic font size
const lineHeight = fontSize * 1.5; // Better line spacing

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#D3D3D3"/>
  <text x="${width/2}" y="${height/2 - lineHeight}" text-anchor="middle" fill="white" font-size="${fontSize}" font-weight="bold" font-family="Arial, sans-serif">
    REPLACE THIS IMAGE
  </text>
  <text x="${width/2}" y="${height/2}" text-anchor="middle" fill="white" font-size="${fontSize}" font-weight="bold" font-family="Arial, sans-serif">
    ENTIRELY WITH
  </text>
  <text x="${width/2}" y="${height/2 + lineHeight}" text-anchor="middle" fill="white" font-size="${fontSize}" font-weight="bold" font-family="Arial, sans-serif">
    THE NEW ONE
  </text>
  <!-- Add aspect ratio and resolution info -->
  <text x="${width/2}" y="${height - 40}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="${fontSize * 0.5}" font-family="Arial, sans-serif">
    ${aspectRatio} • ${width}×${height} • ${deviceInfo.replace(/_/g, ' ')}
  </text>
</svg>`;

// Create output directory if it doesn't exist
const outputDir = path.join(process.cwd(), 'inputs', 'aspect_ratio_sample_images');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate filename with device info (replace : with 'by' for Windows compatibility)
const safeAspectRatio = aspectRatio.replace(':', 'by');
const filename = `${safeAspectRatio}_${deviceInfo}_${width}x${height}`;
const svgPath = path.join(outputDir, `${filename}.svg`);

// Save the SVG file
fs.writeFileSync(svgPath, svg);

console.log(`✅ Generated sample image: ${svgPath}`);
console.log(`   Dimensions: ${width}×${height}`);
console.log(`   Aspect ratio: ${aspectRatio}`);
console.log(`   Device type: ${deviceInfo.replace(/_/g, ' ')}`);

// Try to convert to PNG using sharp if available
async function convertToPng() {
  try {
    const sharp = await import('sharp');
    const pngPath = path.join(outputDir, `${filename}.png`);
    
    await sharp.default(Buffer.from(svg))
      .png()
      .toFile(pngPath);
    
    // Remove SVG file if PNG was created successfully
    fs.unlinkSync(svgPath);
    
    console.log(`✅ Converted to PNG: ${pngPath}`);
  } catch (e) {
    console.log('ℹ️  Note: To generate PNG files, install sharp: npm install sharp');
    console.log('   SVG file has been created instead.');
  }
}

convertToPng();