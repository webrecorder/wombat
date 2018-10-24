#!/usr/bin/env node
const path = require('path');
const fs = require('fs-extra');
const fastify = require('fastify');

const keyCert = {
  key: path.join(__dirname, 'certs', 'key.pem'),
  cert: path.join(__dirname, 'certs', 'certificate.pem')
};

async function start () {
  let useHTTPS = process.argv.indexOf('--noTLS') === -1;

  if (useHTTPS) {
    const [keyE, certE] = await Promise.all([
      fs.pathExists(keyCert.key),
      fs.pathExists(keyCert.cert)
    ]);

    if (!(keyE && certE)) {
      const { keygen } = require('tls-keygen');
      console.log('generating tls keys');
      try {
        await keygen(keyCert);
      } catch (e) {
        useHTTPS = false;
      }
    }
  }

  const serverOpts = { logger: false };
  const port = useHTTPS ? 8443 : 3000;
  const sandbox = `wombatSandbox${useHTTPS ? '2' : ''}.html`;

  if (useHTTPS) {
    serverOpts.http2 = true;
    serverOpts.https = {
      allowHTTP1: true,
      key: await fs.readFile(keyCert.key),
      cert: await fs.readFile(keyCert.cert)
    };
  }

  const server = fastify(serverOpts);
  server.register(require('fastify-no-icon'));
  server.register(require('fastify-static'), {
    root: path.join(__dirname, 'docs'),
    etag: false
  });
  server.register(require('fastify-graceful-shutdown'));

  server.addHook('onRequest', (req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  server.get('/20180803160549mp_/https://tests.wombat.io', (req, res) => {
    res.sendFile(sandbox);
  });

  const address = await server.listen(port, 'localhost');
  console.log(`server listening on ${address}`);
}

start().catch(error => console.error(error));
