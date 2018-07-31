const path = require('path');
const fastify = require('fastify')({
  logger: true
});

fastify.register(require('fastify-no-icon'));
fastify.register(require('fastify-graceful-shutdown'));
fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'docs')
});

// Run the server!
fastify.listen(3000, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`server listening on ${address}`);
});
