const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'cz-leads-api',
      cwd: path.join(__dirname, 'backend'),
      script: 'src/server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
  ],
};
