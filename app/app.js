require('dotenv').config()
const client = require('prom-client')
var express = require('express')
var path = require('path')
var cookieParser = require('cookie-parser')
var logger = require('morgan')

var indexRouter = require('./routes/index')
var itemsRouter = require('./routes/items')

var app = express()

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, '../public')))

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    env: process.env.DEPLOY_ENV || 'not-set'
  })
})
client.collectDefaultMetrics()
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType)
  res.end(await client.register.metrics())
})
app.use('/', indexRouter)
app.use('/disenos', itemsRouter)

module.exports = app
