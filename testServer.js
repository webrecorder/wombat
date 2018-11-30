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
  const docsPath = path.join(__dirname, 'docs');
  const sandboxPath = path.join(docsPath, sandbox);
  server.register(require('fastify-no-icon'));
  server.register(require('fastify-static'), {
    root: docsPath,
    etag: false
  });
  server.register(require('fastify-graceful-shutdown'));

  server.addHook('onRequest', (req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  server.get('/live/20180803160549mp_/https://tests.wombat.io/', (req, res) => {
    res.type('text/html').send(fs.createReadStream(sandboxPath, 'utf8'));
  });

  server.get('/live/20180803160549mp_/https://tests.wombat.io', (req, res) => {
    res.type('text/html').send(fs.createReadStream(sandboxPath, 'utf8'));
  });

  server.get('/live/20180803160549mp_/https://tests.wombat.io/test', (req, res) => {
    res.send({ headers: req.headers, url: req.raw.originalUrl });
  });

  let wasWorkerRequested = false;
  server.get('/live/20180803160549wkr_/https://tests.wombat.io/worker.js', (req, res) => {
    res.type('application/javascript; charset=UTF-8').send('console.log("hi")');
    wasWorkerRequested = true;
  });

  server.get('/wasWorkerRequest', (req, res) => {
    res.send({ requested: wasWorkerRequested ? 'yes' : 'no' });
    wasWorkerRequested = false;
  });

  server.get('/live/20180803160549sw_/https://tests.wombat.io/worker.js', (req, res) => {
    res
      .code(200)
      .type('application/javascript; charset=UTF-8')
      .header('Service-Worker-Allowed ', `${address}/live/20180803160549mp_/https://tests.wombat.io/`)
      .send('console.log("hi")');
  });

  const address = await server.listen(port, 'localhost');
  console.log(`server listening on ${address.replace('127.0.0.1', 'localhost')}`);
}

start().catch(error => console.error(error));
