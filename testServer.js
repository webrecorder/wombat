const path = require('path')
const http = require('http')
const express = require('express')
const serveStatic = require('serve-static')

const app = express()

app.enable('trust proxy')
app.set('etag', false)
app.use(serveStatic(__dirname))
const server = http.createServer(app)

server.listen(3030)

function die () {
  console.log('got kill signal')
  server.close(() => {
    console.log('Closed out remaining connections.')
    process.exit()
  })

  setTimeout(() => {
    console.error(
      'Could not close connections in time, forcefully shutting down')
    process.exit()
  }, 10 * 1000)
}

process.on('SIGTERM', die)

process.on('SIGINT', die)
