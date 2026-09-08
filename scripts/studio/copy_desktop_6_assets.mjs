import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const artifactsDir = 'C:/Users/admin/.gemini/antigravity-ide/brain/abc2e3ed-de02-4abe-a8d9-9cb478603223';
const figmaDir = `${artifactsDir}/figma_exports`;

async function main() {
  fs.mkdirSync('public/game/backgrounds', { recursive: true });
  fs.mkdirSync('public/game/ui', { recursive: true });

  console.log('1. Converting composite background to slide-playground.webp & png...');
  const compBg = `${artifactsDir}/composite_background.png`;
  await sharp(compBg).webp({ quality: 92 }).toFile('public/game/backgrounds/slide-playground.webp');
  await sharp(compBg).png().toFile('public/game/backgrounds/slide-playground.png');

  console.log('2. Copying wardrobe cabinet...');
  const wardrobeBg = `${figmaDir}/72_220.png`;
  await sharp(wardrobeBg).png().toFile('public/game/ui/wardrobe-cabinet-glossy.png');
  await sharp(wardrobeBg).webp({ quality: 95 }).toFile('public/game/ui/wardrobe-cabinet-glossy.webp');

  console.log('3. Copying category wheel...');
  const wheel = `${figmaDir}/72_223.png`;
  await sharp(wheel).png().toFile('public/game/ui/category-wheel-pink.png');
  await sharp(wheel).webp({ quality: 95 }).toFile('public/game/ui/category-wheel-pink.webp');

  console.log('4. Copying back button...');
  const backBtn = `${figmaDir}/43_72.png`;
  await sharp(backBtn).png().toFile('public/game/ui/back-button-glossy.png');
  await sharp(backBtn).webp({ quality: 95 }).toFile('public/game/ui/back-button-glossy.webp');

  console.log('5. Copying pick an outfit header...');
  const header = `${figmaDir}/72_221.png`;
  await sharp(header).png().toFile('public/game/ui/pick-an-outfit-header.png');

  console.log('All assets processed successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
