import fs from 'fs';
import path from 'path';

const TOKEN = process.env.FIGMA_TOKEN || '';
const FILE_KEY = 'hLVRPSJEL0OmM0cndPOUe7';
const NODE_ID = '60:60';

async function main() {
  console.log('1. Fetching node details for 60:60...');
  const nodeRes = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(NODE_ID)}`, {
    headers: { 'X-Figma-Token': TOKEN }
  });
  const nodeData = await nodeRes.json();
  fs.writeFileSync('C:/Users/admin/.gemini/antigravity-ide/brain/abc2e3ed-de02-4abe-a8d9-9cb478603223/desktop_6_nodes.json', JSON.stringify(nodeData, null, 2));
  console.log('Saved desktop_6_nodes.json');

  console.log('2. Requesting rendered image for 60:60...');
  const imgRes = await fetch(`https://api.figma.com/v1/images/${FILE_KEY}?ids=${encodeURIComponent(NODE_ID)}&format=png&scale=1`, {
    headers: { 'X-Figma-Token': TOKEN }
  });
  const imgData = await imgRes.json();
  console.log('Image API response:', imgData);
  const imgUrl = imgData.images?.[NODE_ID];
  if (imgUrl) {
    console.log('3. Downloading rendered image from:', imgUrl);
    const downloadRes = await fetch(imgUrl);
    const buffer = Buffer.from(await downloadRes.arrayBuffer());
    const outPath = 'C:/Users/admin/.gemini/antigravity-ide/brain/abc2e3ed-de02-4abe-a8d9-9cb478603223/desktop_6.png';
    fs.writeFileSync(outPath, buffer);
    console.log('Saved rendered image to:', outPath);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
