import sharp from 'sharp';

async function main() {
  const skyPath = 'C:/Users/admin/.gemini/antigravity-ide/brain/abc2e3ed-de02-4abe-a8d9-9cb478603223/figma_exports/71_211.png';
  const slidePath = 'C:/Users/admin/.gemini/antigravity-ide/brain/abc2e3ed-de02-4abe-a8d9-9cb478603223/figma_exports/71_210.png';
  const outPath = 'C:/Users/admin/.gemini/antigravity-ide/brain/abc2e3ed-de02-4abe-a8d9-9cb478603223/composite_background.png';

  // composite slide onto sky at left: 0, top: 186
  await sharp(skyPath)
    .composite([
      {
        input: slidePath,
        left: 0,
        top: 186
      }
    ])
    .toFile(outPath);
  
  console.log('Created composite_background.png successfully!');
}

main().catch(console.error);
