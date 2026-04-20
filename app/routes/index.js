const express = require('express')
const router = express.Router()

const ambientes = [
  {
    id: 'blue',
    nombre: 'Ambiente Blue',
    descripcion:
      'Ayuda a enviar el ambiente al entorno Blue. Presiona y revisa los cambios en la sección Diseños',
    img: '/assets/img/backgrounds/pexels-ron-lach-10532824.webp'
  },
  {
    id: 'green',
    nombre: 'Ambiente Green',
    descripcion:
      'Ayuda a enviar el ambiente al entorno Green. Presiona y revisa los cambios en la sección Diseños',
    img: '/assets/img/backgrounds/pexels-marina-m-8357144.webp'
  }
]

const estilos = [
  {
    nombre: 'Blackwork',
    descripcion: 'Tatuajes con tinta negra sólida.',
    img: '/assets/img/banners/Dobermann.webp'
  },
  {
    nombre: 'Realismo',
    descripcion: 'Diseños detallados y realistas.',
    img: '/assets/img/banners/tatuajes-realistas.webp'
  },
  {
    nombre: 'Minimalista',
    descripcion: 'Líneas simples y elegantes.',
    img: '/assets/img/banners/loto-tattoo-edited.webp'
  },
  {
    nombre: 'Tradicional',
    descripcion: 'Colores vivos y estilo clásico.',
    img: '/assets/img/banners/tatuaje-tradicional_mujer-y-calavera_tamy-love.webp'
  }
]

const artistas = [
  {
    nombre: 'Pedro Ramirez',
    detalle: 'Especialista en blackwork.',
    img: '/assets/img/avatars/Pedrito.webp'
  },
  {
    nombre: 'Javier Martinez',
    detalle: 'Especialista en realismo.',
    img: '/assets/img/avatars/Erwin.webp'
  },
  {
    nombre: 'Ricardo Medina',
    detalle: 'Especialista en minimalista.',
    img: '/assets/img/avatars/Rich.webp'
  }
]

const env = process.env.DEPLOY_ENV
const color = env === 'blue' ? 'primary' : 'success'

router.get('/', (req, res) => {
  res.render('index', { ambientes, estilos, artistas, color })
})

module.exports = router
