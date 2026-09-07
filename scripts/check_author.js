const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'NodeJS' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(d); }
      });
    }).on('error', reject);
  });
}

(async () => {
  const user = await fetchJson('https://api.github.com/users/G27XLEO');
  console.log('User:', user);
  const repos = await fetchJson('https://api.github.com/users/G27XLEO/repos');
  console.log('Repos:', repos);
})();
