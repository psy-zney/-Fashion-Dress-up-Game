import fs from 'fs';

const TOKEN = process.env.FIGMA_TOKEN || '';
const FILE_KEY = 'hLVRPSJEL0OmM0cndPOUe7';

async function main() {
  const ids = [
    '71:211', // sky 1
    '71:210', // slide 1
    '72:223', // Wheel
    '43:72',  // Frame 2 (Back button)
    '72:220', // Rectangle 26 (Wardrobe bg)
    '72:221', // Frame 18 (PICK AN OUTFIT)
  ];
  
  console.log('Requesting image exports from Figma API...');
  const res = await fetch(`https://api.figma.com/v1/images/${FILE_KEY}?ids=${ids.join(',')}&format=png&scale=2`, {
    headers: { 'X-Figma-Token': TOKEN }
  });
  const data = await res.json();
  console.log('Export URLs:', data);

  const outDir = 'C:/Users/admin/.gemini/antigravity-ide/brain/abc2e3ed-de02-4abe-a8d9-9cb478603223/figma_exports';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const [id, url] of Object.entries(data.images || {})) {
    if (!url) continue;
    console.log(`Downloading ${id}...`);
    const imgRes = await fetch(url);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const safeName = id.replace(':', '_');
    fs.writeFileSync(`${outDir}/${safeName}.png`, buf);
    console.log(`Saved ${safeName}.png`);
  }
}

main().catch(console.error);
