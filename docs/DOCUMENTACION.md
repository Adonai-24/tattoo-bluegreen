# Tattoo BlueGreen — Documentación Técnica

---

## Índice

1. [Fase 1 — Infraestructura en GCP](#fase-1--infraestructura-en-gcp)
2. [Fase 2 — Proyecto Node.js](#fase-2--proyecto-nodejs)
3. [Fase 3 — Contenerización con Docker](#fase-3--contenerización-con-docker)
4. [Fase 4 — Configuración SSH y acceso a VMs](#fase-4--configuración-ssh-y-acceso-a-vms)
5. [Fase 5 — Pruebas automatizadas](#fase-5--pruebas-automatizadas)
6. [Fase 6 — Pipeline CI/CD con GitHub Actions](#fase-6--pipeline-cicd-con-github-actions)
7. [Fase 7 — Blue-Green Deployment con Nginx](#fase-7--blue-green-deployment-con-nginx)
8. [Fase 8 — Monitoreo con Prometheus y Grafana](#fase-8--monitoreo-con-prometheus-y-grafana)
9. [Fase 9 — SonarQube](#fase-9--sonarqube)
10. [Estado final del sistema](#estado-final-del-sistema)

---

## Fase 1 — Infraestructura en GCP

### 1.1 Red (VPC)

Se creó una VPC personalizada con dos subredes: una pública para las VMs con acceso externo y una privada para el host de contenedores.

```bash
gcloud compute networks create vpc-tatto --subnet-mode=custom
```

```bash
gcloud compute networks subnets create tattoo-public \
  --network=vpc-tatto --range=10.0.1.0/24 --region=northamerica-south1
```

```bash
gcloud compute networks subnets create tattoo-private \
  --network=vpc-tatto --range=10.0.2.0/24 --region=northamerica-south1
```

### 1.2 Cloud NAT

Para que la VM privada (sin IP pública) pueda acceder a internet (descargar paquetes, clonar repos, etc.) se configuró Cloud NAT.

```bash
gcloud compute routers create router-tattoo \
  --network=vpc-tatto --region=northamerica-south1
```

```bash
gcloud compute routers nats create nat-config-tattoo \
  --router=router-tattoo --region=northamerica-south1 \
  --nat-all-subnet-ip-ranges --auto-allocate-nat-external-ips
```

### 1.3 Máquinas Virtuales

| VM | Subred | IP | Rol |
|---|---|---|---|
| bastion-tattoo-vm | Pública | 10.0.1.x (con IP pública) | Único punto de entrada SSH |
| nginx-tattoo-vm | Pública | 10.0.1.3 (con IP pública) | Reverse proxy + Blue-Green switch |
| docker-tattoo-vm | Privada | 10.0.2.2 (sin IP pública) | Host de contenedores Docker |

```bash
# Bastion
gcloud compute instances create bastion-tattoo-vm \
  --zone=northamerica-south1-a --machine-type=e2-medium \
  --subnet=tattoo-public --network=vpc-tatto \
  --tags=bastion --image-family=debian-12 --image-project=debian-cloud

# Nginx
gcloud compute instances create nginx-tattoo-vm \
  --zone=northamerica-south1-a --machine-type=e2-medium \
  --subnet=tattoo-public --network=vpc-tatto \
  --tags=nginx --image-family=debian-12 --image-project=debian-cloud

# Docker (sin IP pública)
gcloud compute instances create docker-tattoo-vm \
  --zone=northamerica-south1-a --machine-type=e2-medium \
  --subnet=tattoo-private --network=vpc-tatto \
  --no-address --tags=docker --image-family=debian-12 --image-project=debian-cloud
```

### 1.4 Reglas de Firewall

```bash
# Tráfico HTTP/HTTPS solo hacia nginx-vm
gcloud compute firewall-rules create tattoo-allow-http-nginx \
  --network=vpc-tatto --allow=tcp:80,tcp:443 --target-tags=nginx

# SSH solo hacia bastion-vm
gcloud compute firewall-rules create tattoo-allow-ssh-bastion \
  --network=vpc-tatto --allow=tcp:22 --target-tags=bastion

# Tráfico interno entre todas las subredes
gcloud compute firewall-rules create tattoo-allow-internal \
  --network=vpc-tatto --allow=tcp,udp,icmp --source-ranges=10.0.0.0/16
```

---

## Fase 2 — Proyecto Node.js

### 2.1 Inicialización

```bash
mkdir tattoo-bluegreen && cd tattoo-bluegreen
npm init -y
npm install express ejs dotenv cookie-parser morgan prom-client
npm install --save-dev jest supertest eslint prettier
```

### 2.2 Estructura del proyecto

```
tattoo-bluegreen/
├── app/
│   ├── app.js              # Express app, rutas, métricas
│   ├── routes/
│   │   ├── index.js        # GET / — vista principal
│   │   └── items.js        # GET /disenos — catálogo
│   └── views/
│       ├── index.ejs       # Vista principal con carousel y ambientes
│       └── items.ejs       # Catálogo de diseños con tarjetas Bootstrap
├── tests/
│   └── app.test.js         # Jest + SuperTest
├── k6/
│   └── loadtest.js         # Prueba de carga
├── bin/
│   └── www                 # Entry point del servidor
├── Dockerfile
├── docker-compose.yaml
├── docker-compose.prom.yml
├── prometheus.yml
└── .github/
    └── workflows/
        └── ci-cd.yaml
```

### 2.3 app.js

Servidor Express con middleware estándar, ruta de healthcheck, rutas de la app y endpoint de métricas Prometheus.

```js
require('dotenv').config()
const client = require('prom-client')
var express = require('express')
var path = require('path')
var cookieParser = require('cookie-parser')
var logger = require('morgan')

const indexRouter = require('./routes/index')
const itemsRouter = require('./routes/items')

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

app.use('/', indexRouter)
app.use('/disenos', itemsRouter)

client.collectDefaultMetrics()
app.get('/metricas', async (req, res) => {
  res.set('Content-Type', client.register.contentType)
  res.end(await client.register.metrics())
})

module.exports = app
```

### 2.4 Rutas expuestas

| Ruta | Descripción |
|---|---|
| `GET /` | Página principal — EJS con ambientes, estilos y artistas |
| `GET /disenos` | Catálogo de diseños con precios |
| `GET /health` | Healthcheck JSON — `{ status: "ok", env: "blue\|green" }` |
| `GET /metricas` | Métricas Prometheus en formato text/plain |

### 2.5 Variable de entorno clave

La variable `DEPLOY_ENV` controla el color del tema Bootstrap en tiempo de ejecución:

| Valor | Color Bootstrap | Efecto visual |
|---|---|---|
| `blue` | `primary` (azul) | Tarjetas `border-primary` |
| `green` | `success` (verde) | Tarjetas `border-success` |

---

## Fase 3 — Contenerización con Docker

### 3.1 Dockerfile

Imagen basada en `node:20-alpine` para minimizar el tamaño. Solo instala dependencias de producción.

```dockerfile
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### 3.2 docker-compose.yaml (Aplicación)

Levanta dos instancias con distinto `DEPLOY_ENV` y distintos puertos, representando los ambientes Blue y Green.

```yaml
version: '3.9'
services:
  app_blue:
    image: ghcr.io/adonai-24/tattoo-bluegreen:main
    environment:
      - DEPLOY_ENV=blue
    ports:
      - '3001:3000'

  app_green:
    image: ghcr.io/adonai-24/tattoo-bluegreen:main
    environment:
      - DEPLOY_ENV=green
    ports:
      - '3002:3000'
```

### 3.3 Primer levantamiento de contenedores

Se clonó el repositorio en docker-vm y se levantaron los contenedores por primera vez:

```bash
# En docker-tattoo-vm
cd /home
sudo git clone https://github.com/Adonai-24/tattoo-bluegreen.git
cd tattoo-bluegreen
docker-compose up -d
```

```
Creating tattoo-bluegreen_app_green_1 ... done
Creating tattoo-bluegreen_app_blue_1  ... done
```

---

## Fase 4 — Configuración SSH y acceso a VMs

### 4.1 Problema inicial

Al intentar conectarse desde bastion-vm a las VMs privadas, la clave SSH de GCP no estaba disponible en el bastion:

```
g2022371095@10.0.1.3: Permission denied (publickey).
```

### 4.2 Solución — Copiar clave SSH al bastion

```bash
# Desde Cloud Shell
gcloud compute scp ~/.ssh/google_compute_engine bastion-tattoo-vm:~ \
  --zone=northamerica-south1-a

# Dentro de bastion-vm
mv google_compute_engine ~/.ssh/
chmod 600 ~/.ssh/google_compute_engine

# Verificar conexión a docker-vm
ssh -i ~/.ssh/google_compute_engine 10.0.2.2
```

### 4.3 Instalar Docker en docker-vm

```bash
sudo apt update && sudo apt install docker.io docker-compose -y
```

### 4.4 SSH Jump en el pipeline

El pipeline CI/CD usa `appleboy/ssh-action` con proxy para conectarse a las VMs privadas a través del bastion en un solo paso:

```yaml
host: ${{ secrets.DOCKER_TATTOO_HOST }}
proxy_host: ${{ secrets.BASTION_TATTOO_HOST }}
proxy_username: ${{ secrets.TATTOO_USER }}
proxy_key: ${{ secrets.SSH_PRIVATE_KEY }}
proxy_passphrase: ${{ secrets.SSH_PASSPHRASE }}
```

---

## Fase 5 — Pruebas automatizadas

### 5.1 Jest + SuperTest

El archivo `tests/app.test.js` contiene cinco suites de prueba:

```js
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
```

Ejecutar localmente:

```bash
npm test
```

### 5.2 k6 — Prueba de carga

El script `k6/loadtest.js` simula carga real con ramp-up, fase sostenida y ramp-down:

```js
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const rootDuration = new Trend('root_duration')
const disenosDuration = new Trend('disenos_duration')
const errorRate = new Rate('error_rate')

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp-up: 0 → 10 usuarios
    { duration: '1m',  target: 10 },  // Sostenido: 10 usuarios por 1 minuto
    { duration: '20s', target: 0  },  // Ramp-down: 10 → 0 usuarios
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% de requests < 500ms
    error_rate: ['rate<0.1'],         // menos del 10% de errores
  },
}

const BASE_URL = 'http://localhost:3000'

export default function () {
  const rootRes = http.get(`${BASE_URL}/`)
  rootDuration.add(rootRes.timings.duration)
  const rootOk = check(rootRes, {
    'root: status 200': (r) => r.status === 200,
    'root: contiene Ambiente': (r) => r.body.includes('Ambiente'),
  })
  errorRate.add(!rootOk)
  sleep(1)

  const disenosRes = http.get(`${BASE_URL}/disenos`)
  disenosDuration.add(disenosRes.timings.duration)
  const disenosOk = check(disenosRes, {
    'disenos: status 200': (r) => r.status === 200,
    'disenos: contiene Fénix Oscuro': (r) => r.body.includes('Fénix Oscuro'),
  })
  errorRate.add(!disenosOk)
  sleep(1)
}
```

La prueba se ejecuta desde el pipeline con salida a Grafana Cloud k6.

### 5.3 SonarQube

SonarQube Community corre en docker-vm en el puerto 9000, accesible vía Nginx en `/sonarqube`. El análisis está configurado en el pipeline con los siguientes parámetros:

| Parámetro | Valor |
|---|---|
| `sonar.projectKey` | `tattoo-bluegreen` |
| `sonar.sources` | `app` |
| `sonar.tests` | `tests` |
| `sonar.javascript.lcov.reportPaths` | `coverage/lcov.info` |
| `sonar.qualitygate.wait` | `true` |

Instalación del contenedor:

```bash
docker run -d --name sonarqube \
  -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
  -e SONAR_WEB_CONTEXT=/sonarqube \
  -p 9000:9000 sonarqube:community
```

---

## Fase 6 — Pipeline CI/CD con GitHub Actions

El archivo `.github/workflows/ci-cd.yaml` define el pipeline completo que se dispara en `push` o `pull_request` a `main`.

### 6.1 Jobs y dependencias

```
test ──────────────────────────────────────────────────┐
  └── load-test ────────────────────────────────────────┤
build-and-push ──────────────────────────────────────────┤
                                                         └── deploy
```

| Job | Depende de | Descripción |
|---|---|---|
| `test` | — | `npm install` + `npm test` (Jest/SuperTest con coverage) |
| `load-test` | `test` | Levanta servidor, instala k6, ejecuta prueba en Grafana Cloud |
| `build-and-push` | `test`, `load-test`, `sonar-analysis` | Construye imagen Docker y la sube a GHCR con tag `:main` |
| `deploy` | `build-and-push` | Orquesta el despliegue Blue-Green completo |

### 6.2 Pasos del job deploy

1. **Update repo on docker-vm** — `git fetch` + `git reset --hard origin/main` en docker-vm vía SSH con proxy bastion.
2. **Detect current environment** — Hace curl al endpoint health/ de la app y lee la env actual para saber si el upstream activo es `app_blue` o `app_green`. Escribe `NEXT_ENV` y `CURRENT_ENV` y las manda como variables de Github Actions
3. **Deploy new container** — En docker-vm: `docker pull` de la nueva imagen, detiene y elimina el contenedor NEXT, lo recrea con `docker-compose up --no-deps`.
4. **Switch Nginx** — Modifica el `proxy_pass` con `sed`, recarga Nginx, espera 7 segundos y valida con `curl /health`. Si falla, revierte el `sed` y recarga Nginx (rollback automático).
5. **Deploy monitoring stack** — Levanta Prometheus + Grafana con `docker-compose -f docker-compose.prom.yml up -d`.

### 6.3 GitHub Secrets utilizados

| Secret | Propósito |
|---|---|
| `DOCKER_TATTOO_HOST` | IP interna de docker-vm |
| `NGINX_TATTOO_HOST` | IP interna de nginx-vm |
| `BASTION_TATTOO_HOST` | IP pública de bastion-vm |
| `TATTOO_USER` | Usuario SSH en las VMs |
| `SSH_PRIVATE_KEY` | Clave privada SSH (google_compute_engine) |
| `SSH_PASSPHRASE` | Frase de paso de la clave SSH |
| `GITHUB_TOKEN` | Auto-generado — login a GHCR |
| `K6_CLOUD_TOKEN_TATTOO` | Token de Grafana Cloud k6 |
| `K6_PROJECT_ID_TATTOO` | ID del proyecto en k6 Cloud |
| `SONAR_TOKEN_TATTOO` | Token de autenticación SonarQube |
| `SONAR_HOST_URL_TATTOO` | URL del servidor SonarQube |

---

## Fase 7 — Blue-Green Deployment con Nginx

### 7.1 Concepto

Se mantienen dos ambientes idénticos en código corriendo simultáneamente. Solo uno recibe tráfico en un momento dado. El switch es instantáneo a nivel de Nginx y el rollback es automático si falla el healthcheck.

```
Estado inicial:  Blue = ACTIVO (tráfico)    Green = STANDBY (código anterior)
                       ↓
Deploy:          Green se actualiza  →  Nginx switchea  →  healthcheck
                       ↓
Estado final:    Blue = STANDBY (rollback disponible)   Green = ACTIVO
```

### 7.2 Configuración de Nginx

Archivo `/etc/nginx/sites-available/default` en nginx-tattoo-vm:

```nginx
upstream app_blue {
    server 10.0.2.2:3001;
}

upstream app_green {
    server 10.0.2.2:3002;
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://app_green;  # ← se cambia con sed en cada deploy
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /sonarqube {
        proxy_pass http://10.0.2.2:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /prometheus/ {
        proxy_pass http://10.0.2.2:9090/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /grafana {
        proxy_pass http://10.0.2.2:3003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 7.3 Lógica de switcheo en el pipeline

```bash
# Detectar ambiente activo
RESPONSE=$(curl -s http://34.51.83.32/health | jq -r '.env')
CURRENT_ENV=$RESPONSE
if [ "$CURRENT_ENV" = "blue" ]; then
  NEXT_ENV="green"
else
  NEXT_ENV="blue"
fi

# Aplicar switch
sudo sed -i "s|proxy_pass http://app_${CURRENT_ENV};|proxy_pass http://app_${NEXT_ENV};|" \
  /etc/nginx/sites-available/default
sudo systemctl reload nginx

# Healthcheck + rollback automático
sleep 7
if ! curl -f http://34.51.83.32/health; then
  echo "Healthcheck falló, rollback a $CURRENT_ENV..."
  sudo sed -i "s|proxy_pass http://app_${NEXT_ENV};|proxy_pass http://app_${CURRENT_ENV};|" \
    /etc/nginx/sites-available/default
  sudo systemctl reload nginx
  exit 1
fi
```

### 7.4 Identificación visual del ambiente

La app cambia el color del tema Bootstrap según `DEPLOY_ENV`, lo que permite identificar visualmente qué ambiente está activo en cualquier momento sin necesidad de revisar logs o configuraciones.

---

## Fase 8 — Monitoreo con Prometheus y Grafana

### 8.1 Métricas en la app con prom-client

```js
const client = require('prom-client')
client.collectDefaultMetrics()

app.get('/metricas', async (req, res) => {
  res.set('Content-Type', client.register.contentType)
  res.end(await client.register.metrics())
})
```

Métricas recolectadas automáticamente: CPU, memoria residente, heap V8, event loop lag, garbage collector, file descriptors.

### 8.2 prometheus.yml

Prometheus scrapea ambos ambientes directamente por IP interna cada 5 segundos:

```yaml
global:
  scrape_interval: 5s

scrape_configs:
  - job_name: 'tattoo-app'
    metrics_path: '/metricas'
    static_configs:
      - targets: ['10.0.2.2:3001', '10.0.2.2:3002']
```

### 8.3 docker-compose.prom.yml

Stack de observabilidad con volumen persistente para Grafana (evita perder datasources y dashboards entre reinicios) y Prometheus configurado con sub-path para servirse detrás de Nginx:

```yaml
version: '3.9'
services:
  prometheus:
    image: prom/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--web.external-url=/prometheus'
      - '--web.route-prefix=/'
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - '9090:9090'
    networks:
      - monitoring

  grafana:
    image: grafana/grafana
    ports:
      - '3003:3000'
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_SERVER_ROOT_URL=http://34.51.83.32/grafana
      - GF_SERVER_SERVE_FROM_SUB_PATH=true
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge

volumes:
  grafana_data:
```

> **Nota:** El volumen `grafana_data` es clave para persistir la configuración. Sin él, cada `docker-compose up -d` recrea el contenedor y pierde los datasources y dashboards configurados.

### 8.4 Configuración del datasource en Grafana

En Grafana: **Connections → Data sources → Add → Prometheus**

- **URL:** `http://prometheus:9090` *(nombre del servicio Docker, no la IP)*
- Guardar con "Save & test" — debe aparecer confirmación verde.

### 8.5 Dashboard

Dashboard creado manualmente con las siguientes métricas, mostrando datos de ambas instancias (`:3001` blue y `:3002` green) en tiempo real:

| Panel | Query Prometheus |
|---|---|
| Heap Used | `nodejs_heap_size_used_bytes` |
| Event Loop Lag | `nodejs_eventloop_lag_seconds` |
| Memory Usage | `process_resident_memory_bytes` |
| Active Async Resources | `nodejs_active_resources_total` |

### 8.6 URLs de acceso a los servicios

| Servicio | URL |
|---|---|
| App (ambiente activo) | `http://34.51.83.32/` |
| Healthcheck | `http://34.51.83.32/health` |
| Métricas raw | `http://34.51.83.32/metricas` |
| Prometheus | `http://34.51.83.32/prometheus/` |
| Grafana | `http://34.51.83.32/grafana` |
| SonarQube | `http://34.51.83.32/sonarqube` |

---

## Fase 9 — SonarQube

SonarQube se instaló como contenedor independiente en docker-vm y se expone a través de Nginx en `/sonarqube`. El análisis de calidad de código se integra en el pipeline CI/CD.

```bash
docker run -d --name sonarqube \
  -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
  -e SONAR_WEB_CONTEXT=/sonarqube \
  -p 9000:9000 sonarqube:community
```

El job `sonarqube-analysis` en el pipeline ejecuta los tests con coverage y luego manda el reporte a SonarQube con Quality Gate activo (`sonar.qualitygate.wait=true`), lo que bloquea el deploy si la cobertura no alcanza el umbral mínimo configurado (≥ 80%).

---

## Estado final del sistema

### Contenedores en docker-vm

```
CONTAINER       IMAGE                      PORTS                NOMBRE
app_green       tattoo-bluegreen_app_green 0.0.0.0:3002->3000  app_green_1  ← ACTIVO
app_blue        tattoo-bluegreen_app_blue  0.0.0.0:3001->3000  app_blue_1   ← STANDBY
grafana         grafana/grafana            0.0.0.0:3003->3000  grafana_1
prometheus      prom/prometheus            0.0.0.0:9090->9090  prometheus_1
sonarqube       sonarqube:community        0.0.0.0:9000->9000  sonarqube
```

### Checklist de requisitos

| Requisito | Estado |
|---|---|
| Jest + SuperTest | 5 suites, coverage con lcov |
| k6 prueba de carga | Integrado en pipeline con Grafana Cloud |
| SonarQube | Contenedor corriendo, análisis configurado en CI |
| Docker + Nginx | Dos contenedores, proxy inverso funcional |
| Blue-Green Deployment | Switch automático con sed + rollback por healthcheck |
| Infraestructura Nginx real | 3 VMs en GCP, configuración manual real |
| Prometheus | 2/2 targets UP, scraping cada 5s |
| Dashboard Grafana funcional | 4 paneles con datos reales de ambos ambientes |
