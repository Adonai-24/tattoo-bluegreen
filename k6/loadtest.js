import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const rootDuration = new Trend('root_duration')
const disenosDuration = new Trend('disenos_duration')
const errorRate = new Rate('error_rate')

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp-up: 0 → 10 usuarios
    { duration: '1m', target: 10 }, // Sostenido: 10 usuarios por 1 minuto
    { duration: '20s', target: 0 } // Ramp-down: 10 → 0 usuarios
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% de requests < 500ms
    error_rate: ['rate<0.1'] // Dejo menos del 10% de errores
  }
}

const BASE_URL = 'http://localhost:3000'

export default function () {
  const rootRes = http.get(`${BASE_URL}/`)
  rootDuration.add(rootRes.timings.duration)

  const rootOk = check(rootRes, {
    'root: status 200': (r) => r.status === 200,
    'root: contiene Ambiente': (r) => r.body.includes('Ambiente')
  })
  errorRate.add(!rootOk)
  sleep(1)


  const disenosRes = http.get(`${BASE_URL}/disenos`)
  disenosDuration.add(disenosRes.timings.duration)

  const disenosOk = check(disenosRes, {
    'disenos: status 200': (r) => r.status === 200,
    'disenos: contiene Fénix Oscuro': (r) => r.body.includes('Fénix Oscuro')
  })
  errorRate.add(!disenosOk)
  sleep(1)
}
