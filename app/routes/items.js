const express = require('express')
const router = express.Router()

const diseños = [
  {
    nombre: 'Fénix Oscuro',
    precio: 1500,
    imagen:
      '/assets/img/banners/360_F_497492132_2HxobzE4NcPLLpryg0TbnYtRNxEi7Q8X.webp',
    descripcion: 'Ave mítica que simboliza renacimiento.',
    detalles:
      'Diseño estilizado en silueta negra con alas extendidas y detalles ornamentales.'
  },
  {
    nombre: 'Espada con Serpiente',
    precio: 1200,
    imagen: '/assets/img/banners/8136386_1409.webp',
    descripcion: 'Símbolos de poder y transformación.',
    detalles:
      'Ilustración detallada de una serpiente enroscada alrededor de una espada clásica.'
  },
  {
    nombre: 'Pavorreal Geométrico',
    precio: 800,
    imagen:
      '/assets/img/banners/86320101-decorative-swan-on-white-background-tattoo-design.webp',
    descripcion: 'Diseño ornamental y simétrico.',
    detalles:
      'Ave estilizada con patrones geométricos y curvas elegantes en alas y cola.'
  },
  {
    nombre: 'Busqueda',
    precio: 500,
    imagen: '/assets/img/banners/Tatuaje-Murcielago.webp',
    descripcion: 'Contraste entre luz y oscuridad.',
    detalles:
      'Dos alas: una de ave cisne y otra de murcielago, representando fuerzas opuestas.'
  },
  {
    nombre: 'Rosa con Ojo',
    precio: 700,
    imagen:
      '/assets/img/banners/black-chaplet-rose-flower-eye-pattern-geometric-shapes-white-background-tattoo-design-mystic-symbol-black-chaplet-101260273.webp',
    descripcion: 'Símbolo místico y surrealista.',
    detalles:
      'Rosa central con ojo en su interior, rodeada de formas geométricas y elementos colgantes.'
  },
  {
    nombre: 'Águila con Rostro',
    precio: 1500,
    imagen: '/assets/img/banners/images.webp',
    descripcion: 'Fusión de fuerza y humanidad.',
    detalles:
      'Diseño artístico que combina un águila con un rostro humano integrado en su cuerpo.'
  },
  {
    nombre: 'Alas Dualidad',
    precio: 3000,
    imagen: '/assets/img/banners/il_fullxfull.5729857879_6t5j.webp',
    descripcion: 'Contraste entre luz y oscuridad.',
    detalles:
      'Dos alas: una angelical y otra demoníaca, representando fuerzas opuestas.'
  }
  // {
  //   nombre: 'Rosa con Ojo',
  //   precio: 700,
  //   imagen: '/assets/img/banners/black-chaplet-rose-flower-eye-pattern-geometric-shapes-white-background-tattoo-design-mystic-symbol-black-chaplet-101260273.webp',
  //   descripcion: 'Símbolo místico y surrealista.',
  //   detalles: 'Rosa central con ojo en su interior, rodeada de formas geométricas y elementos colgantes.'
  // },
  // {
  //   nombre: 'Águila con Rostro',
  //   precio: 1500,
  //   imagen: '/assets/img/banners/images.webp',
  //   descripcion: 'Fusión de fuerza y humanidad.',
  //   detalles: 'Diseño artístico que combina un águila con un rostro humano integrado en su cuerpo.'
  // },
  // {
  //   nombre: 'Alas Dualidad',
  //   precio: 3000,
  //   imagen: '/assets/img/banners/il_fullxfull.5729857879_6t5j.webp',
  //   descripcion: 'Contraste entre luz y oscuridad.',
  //   detalles: 'Dos alas: una angelical y otra demoníaca, representando fuerzas opuestas.'
  // }
]

const env = process.env.DEPLOY_ENV
const color = env === 'blue' ? 'primary' : 'success';

router.get('/', (req, res) => {
  res.render('items', { diseños, color })
})

module.exports = router
