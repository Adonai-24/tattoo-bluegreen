const request = require('supertest')
const app = require('../app/app')

// Jest
describe('Pruebas básicas del servidor', () => {
  it('GET / debe responder con 200', async () => {
    const res = await request(app).get('/')
    expect(res.statusCode).toBe(200)
  })

  it('GET /disenos debe responder con 200', async () => {
    const res = await request(app).get('/disenos')
    expect(res.statusCode).toBe(200)
  })
})

// Supertest
describe('Pruebas de atributos necesarios', () => {
  it('GET / debe responder con 200', async () => {
    const res = await request(app).get('/')
    expect(res.statusCode).toBe(200)
    expect(res.text).toMatch(/Ambiente/)
  })

  it('GET /disenos debe responder con 200 y mostrar un diseño', async () => {
    const res = await request(app).get('/disenos')
    expect(res.statusCode).toBe(200)
    expect(res.text).toMatch(/Fénix Oscuro/)
  })

  it('GET /health debe responder con 200 y status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveProperty('status', 'ok')
    expect(res.body).toHaveProperty('env')
  })
})

describe('Pruebas de métricas', () => {
  it('GET /metricas debe responder con 200', async () => {
    const res = await request(app).get('/metricas')
    expect(res.statusCode).toBe(200)
  })
})

describe('Pruebas de rutas inexistentes', () => {
  it('GET /ruta-que-no-existe debe responder con 404', async () => {
    const res = await request(app).get('/ruta-que-no-existe')
    expect(res.statusCode).toBe(404)
  })
})

describe('Pruebas con DEPLOY_ENV', () => {
  it('GET /health debe incluir el env actual', async () => {
    process.env.DEPLOY_ENV = 'blue'
    const res = await request(app).get('/health')
    expect(res.body.env).toBe('blue')
  })
})
