const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3333,
  path: '/api/trpc/auth.logout',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, data));
});

req.on('error', console.error);
req.end(JSON.stringify({}));
