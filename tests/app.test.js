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

  it('GET /metricas debe responder con métricas de Prometheus', async () => {
    const res = await request(app).get('/metricas')

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/plain/)
    expect(res.text).toContain('process_cpu_user_seconds_total')
  })
})

describe('Pruebas de ambientes', () => {
  it('GET /health con DEPLOY_ENV=green debe retornar env green', async () => {
    process.env.DEPLOY_ENV = 'green'
    const res = await request(app).get('/health')
    expect(res.statusCode).toBe(200)
    expect(res.body.env).toBe('green')
  })

  it('GET /health sin DEPLOY_ENV debe retornar not-set', async () => {
    delete process.env.DEPLOY_ENV
    const res = await request(app).get('/health')
    expect(res.statusCode).toBe(200)
    expect(res.body.env).toBe('not-set')
  })

  it('GET / en ambiente green debe contener success en la respuesta', async () => {
    process.env.DEPLOY_ENV = 'green'
    const res = await request(app).get('/')
    expect(res.statusCode).toBe(200)
    expect(res.text).toMatch(/success/)
  })

  it('GET / en ambiente blue debe contener primary en la respuesta', async () => {
    process.env.DEPLOY_ENV = 'blue'
    const res = await request(app).get('/')
    expect(res.statusCode).toBe(200)
    expect(res.text).toMatch(/primary/)
  })

  it('GET /disenos en ambiente green debe contener border-success', async () => {
    process.env.DEPLOY_ENV = 'green'
    const res = await request(app).get('/disenos')
    expect(res.statusCode).toBe(200)
    expect(res.text).toMatch(/success/)
  })

  it('GET /disenos en ambiente blue debe contener border-primary', async () => {
    process.env.DEPLOY_ENV = 'blue'
    const res = await request(app).get('/disenos')
    expect(res.statusCode).toBe(200)
    expect(res.text).toMatch(/primary/)
  })
})
