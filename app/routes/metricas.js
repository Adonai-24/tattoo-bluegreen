const express = require('express')
const client = require('prom-client')

const router = express.Router()

client.collectDefaultMetrics()

router.get('/', async (req, res) => {
  res.set('Content-Type', client.register.contentType)
  const metricas = await client.register.metrics()
  res.render('metricas', { metricas })
})

router.get('/raw', async (req, res) => {
  res.set('Content-Type', client.register.contentType)
  res.end(await client.register.metrics())
})

module.exports = router
