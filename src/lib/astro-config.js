// Parámetros astrológicos. Van en un archivo aparte y no incrustados en el
// código porque el brief los marca como configuración explícita (regla 09:
// "Los orbes son configuración, no código. Se van a ajustar").

// Los diez cuerpos, en el orden en que se leen. El PESO es el del reparto
// ponderado de elementos y modalidades: luminarias 3, personales 2,
// sociales 1,5, transpersonales 1.
export const CUERPOS = [
  { clave: "sol",       nombre: "Sol",       glifo: "☉", peso: 3   },
  { clave: "luna",      nombre: "Luna",      glifo: "☽", peso: 3   },
  { clave: "mercurio",  nombre: "Mercurio",  glifo: "☿", peso: 2   },
  { clave: "venus",     nombre: "Venus",     glifo: "♀", peso: 2   },
  { clave: "marte",     nombre: "Marte",     glifo: "♂", peso: 2   },
  { clave: "jupiter",   nombre: "Júpiter",   glifo: "♃", peso: 1.5 },
  { clave: "saturno",   nombre: "Saturno",   glifo: "♄", peso: 1.5 },
  { clave: "urano",     nombre: "Urano",     glifo: "♅", peso: 1   },
  { clave: "neptuno",   nombre: "Neptuno",   glifo: "♆", peso: 1   },
  { clave: "pluton",    nombre: "Plutón",    glifo: "♇", peso: 1   },
];

export const SIGNOS = [
  { nombre: "Aries",       glifo: "♈", elemento: "fuego",  modalidad: "cardinal" },
  { nombre: "Tauro",       glifo: "♉", elemento: "tierra", modalidad: "fijo"     },
  { nombre: "Géminis",     glifo: "♊", elemento: "aire",   modalidad: "mutable"  },
  { nombre: "Cáncer",      glifo: "♋", elemento: "agua",   modalidad: "cardinal" },
  { nombre: "Leo",         glifo: "♌", elemento: "fuego",  modalidad: "fijo"     },
  { nombre: "Virgo",       glifo: "♍", elemento: "tierra", modalidad: "mutable"  },
  { nombre: "Libra",       glifo: "♎", elemento: "aire",   modalidad: "cardinal" },
  { nombre: "Escorpio",    glifo: "♏", elemento: "agua",   modalidad: "fijo"     },
  { nombre: "Sagitario",   glifo: "♐", elemento: "fuego",  modalidad: "mutable"  },
  { nombre: "Capricornio", glifo: "♑", elemento: "tierra", modalidad: "cardinal" },
  { nombre: "Acuario",     glifo: "♒", elemento: "aire",   modalidad: "fijo"     },
  { nombre: "Piscis",      glifo: "♓", elemento: "agua",   modalidad: "mutable"  },
];

// Aspectos y ORBES. La conjunción es neutra a propósito: no suma ni a duros ni
// a blandos, porque su carácter depende de qué dos planetas se juntan.
export const ASPECTOS = [
  { clave: "conjuncion", nombre: "conjunción", angulo: 0,   orbe: 8, tipo: "neutro" },
  { clave: "sextil",     nombre: "sextil",     angulo: 60,  orbe: 4, tipo: "blando" },
  { clave: "cuadratura", nombre: "cuadratura", angulo: 90,  orbe: 6, tipo: "duro"   },
  { clave: "trigono",    nombre: "trígono",    angulo: 120, orbe: 6, tipo: "blando" },
  { clave: "oposicion",  nombre: "oposición",  angulo: 180, orbe: 8, tipo: "duro"   },
];

// El lugar del cielo del día (portada): amanecer, ocaso y horas planetarias.
// Centro de la ciudad de Buenos Aires; longitud este positiva.
export const LUGAR_SITIO = { nombre: "Buenos Aires", latitud: -34.6037, longitud: -58.3816 };

// Los tramos de la lectura de tensión. Mismos cortes que el mockup del brief.
export const TRAMOS_TENSION = { trabado: 55, normal: 35 };

export const ORDEN_ELEMENTOS = ["fuego", "tierra", "aire", "agua"];
// OJO con el orden: cardinal y mutable empatan seguido, y el desempate lo
// resuelve el orden de esta lista (el sort es estable). Cambiarla cambia qué
// lectura sale en un día empatado.
export const ORDEN_MODALIDADES = ["cardinal", "fijo", "mutable"];
