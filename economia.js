const db = require('./db.js');

const efectosUsuario = new Map(); // username => { iman: true }
const cooldownsReducidos = new Map(); // username => timestamp

// ─── DB SETUP ─────────────────────────────
function ensureUser(username) {
  const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
  if (!exists) {
    db.prepare('INSERT INTO users (username) VALUES (?)').run(username);
  }

  const fisherExists = db.prepare('SELECT 1 FROM fishers WHERE username = ?').get(username);
  if (!fisherExists) {
    db.prepare('INSERT INTO fishers (username, points) VALUES (?, 0)').run(username);
  }
}

// ─── COOLDOWN ─────────────────────────────
function canFish(username) {
  const row = db.prepare('SELECT lastFish FROM cooldowns WHERE username = ?').get(username);
  const now = Date.now();

  const reducido = cooldownsReducidos.has(username) && cooldownsReducidos.get(username) > now;
  const cooldown = reducido ? 15 * 1000 : 5 * 60 * 1000;

  if (!row) return true;
  return now - row.lastFish >= cooldown;
}

function getFishCooldown(username) {
  const row = db.prepare('SELECT lastFish FROM cooldowns WHERE username = ?').get(username);
  const now = Date.now();

  const reducido = cooldownsReducidos.has(username) && cooldownsReducidos.get(username) > now;
  const cooldown = reducido ? 15 * 1000 : 5 * 60 * 1000;

  if (!row) return { canFish: true };

  const elapsed = now - row.lastFish;
  const remaining = cooldown - elapsed;

  if (remaining <= 0) return { canFish: true };

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return {
    canFish: false,
    remainingMs: remaining,
    minutes,
    seconds
  };
}

function updateFishTime(username) {
  db.prepare(`
    INSERT INTO cooldowns (username, lastFish)
    VALUES (?, ?)
    ON CONFLICT(username) DO UPDATE SET lastFish = excluded.lastFish
  `).run(username, Date.now());
}

// ─── ECONOMÍA BÁSICA ─────────────────────
function getCoins(username) {
  const row = db.prepare('SELECT coins FROM users WHERE username = ?').get(username);
  return row ? row.coins : 0;
}

function addCoins(username, amount) {
  ensureUser(username);
  db.prepare('UPDATE users SET coins = coins + ? WHERE username = ?').run(amount, username);
}

function removeCoins(username, amount) {
  ensureUser(username);
  db.prepare('UPDATE users SET coins = MAX(0, coins - ?) WHERE username = ?').run(amount, username);
}

// ─── SISTEMA DE PESCA ─────────────────────

const peces = [
  { tipo: 'salmon', puntos: 20, prob: 0.17 },
  { tipo: 'carpa', puntos: 30, prob: 0.16 },
  { tipo: 'gato', puntos: 50, prob: 0.15 },
  { tipo: 'payaso', puntos: 40, prob: 0.10 },
  { tipo: 'dorado', puntos: 100, prob: 0.08 },
  { tipo: 'tóxico', puntos: -50, prob: 0.07 },
  { tipo: 'ballena', puntos: 1000, prob: 0.01 },
  { tipo: 'anguila electrica', puntos: -100, prob: 0.05 }
];
const items = [
  { tipo: 'diamante', puntos: 500, prob: 0.03 },
  { tipo: 'tesoro', puntos: 1000, prob: 0.01 },
  { tipo: 'basura', puntos: -20, prob: 0.10 },
  { tipo: 'diente de megalodon', puntos: 300, prob: 0.04 }
];
const pecesMitologicos = [
  { tipo: 'Leviatán', puntos: 1000, prob: 0.005, descripcion: 'Gigantesca criatura marina de la mitología judía, símbolo de caos y poder.' },
  { tipo: 'Kraken', puntos: 1000, prob: 0.005, descripcion: 'Monstruo marino gigante, parecido a un pulpo, famoso en leyendas nórdicas.' },
  { tipo: 'Dragón Marino', puntos: 1000, prob: 0.005, descripcion: 'En muchas culturas, una enorme serpiente que habita en los océanos.' },
  { tipo: 'Caballo de Mar de Poseidón', puntos: 1000, prob: 0.005, descripcion: 'Criatura marina mítica relacionada con el dios griego Poseidón.' },
  { tipo: 'Megalodón', puntos: 1000, prob: 0.005, descripcion: 'Tiburón prehistórico gigante, casi mitológico por su tamaño.' },
  { tipo: 'Mounstruo del lago Ness', puntos: 1000, prob: 0.005, descripcion: 'Criatura que se cree que vive en el lago Ness de Escocia.' }
];



// Lista combinada (solo para la pesca)
const tablaPesca = [...peces, ...items, ...pecesMitologicos];



function obtenerPez(username) {
  const efecto = efectosUsuario.get(username);
  let lista = tablaPesca;

   if (efecto?.superIman) {
    lista = pecesMitologicos;
    efectosUsuario.delete(username); 
  } else if (efecto?.iman) {
    lista = [...peces, ...pecesMitologicos, ...items].filter(p => p.puntos >= 50);
    efectosUsuario.delete(username); 
  } else {
    lista = [...peces, ...pecesMitologicos, ...items];
  }

  // Normalizar probabilidades
const totalProb = lista.reduce((acc, p) => acc + p.prob, 0);
const normalizada = lista.map(p => ({ ...p, prob: p.prob / totalProb }));

const rand = Math.random();
let acumulado = 0;

for (const pez of normalizada) {
  acumulado += pez.prob;
  if (rand <= acumulado) return { ...pez };
}

return normalizada[0]; 

}



function sumarPuntos(username, puntos) {
  ensureUser(username);
  db.prepare(`
    INSERT INTO fishers (username, points)
    VALUES (?, ?)
    ON CONFLICT(username) DO UPDATE SET points = points + excluded.points
  `).run(username, puntos);
}

// ─── EVENTOS ALEATORIOS ─────────────────────
function ejecutarEventoAleatorio(username, pez) {
  const eventos = [
    {
      prob: 0.06, 
      ejecutar: () => {
        efectosUsuario.set(username, { ...efectosUsuario.get(username), iman: true });
        return { mensaje: `🧲 ¡@${username} obtuvo un IMÁN DE PECES! Tu proximo pez será de buena calidad`, skipCooldown: false };
      }
    },
    {
      prob: 0.06, 
      ejecutar: () => {
        return { mensaje: `⌛ ¡@${username}, el tiempo se rebobinó! Podés pescar de nuevo ahora mismo.`, skipCooldown: true };
      }
    },
    {
      prob: 0.05,  
      ejecutar: () => {
        sumarPuntos(username, -50);
        return { mensaje: `🦈 ¡@${username}, un tiburón te robó la caña! Perdiste 50 puntos. WAJAJA`, skipCooldown: false };
      }
    },
    {
      prob: 0.008,  
      ejecutar: () => {
        sumarPuntos(username, -1000);
        return { mensaje: `🧜‍ ¡@${username}, una sirena te enamoró y te robó 1000 puntos. WAJAJA`, skipCooldown: false };
      }
    },
    {
  prob: 0.03, 
  ejecutar: () => {
    pez.tipo = pez.tipo + ' mutante';
    pez.puntos *= 2;
    return { 
      mensaje: `☢️ ¡@${username} pescó un ${pez.tipo}! Sus puntos se multiplicaron a ${pez.puntos}.`, 
      skipCooldown: false 
    };
  }
},
    {
  prob: 0.04,
  ejecutar: () => {
    const puntosOriginal = pez.puntos;
    pez.tipo = `Anti-${pez.tipo}`;
    pez.puntos *= -1;
    return { 
      mensaje: `⚡ ¡@${username} entró en Estado Antimateria! ${pez.tipo}: ${pez.puntos} puntos.`,
      skipCooldown: false
    };
  }
},

    {
      prob: 0.03,  
      ejecutar: () => {
        sumarPuntos(username, -100);
        return { mensaje: `¡@${username}, Caiste al agua! Perdiste 100 puntos. WAJAJA`, skipCooldown: false };
      }
    },
    {
      prob: 0.04, 
      ejecutar: () => {
        sumarPuntos(username, 150);
        return { mensaje: `🏅 ¡@${username}, tu pesca recibió un SELLO DE CALIDAD! Se suman 150 puntos extra.`, skipCooldown: false };
      }
    },
    {
      prob: 0.01, 
      ejecutar: () => {
        sumarPuntos(username, -500);
        return { mensaje: `🔱 ¡@${username}, Tu pezca molestó a Poseidón! -500 puntos `, skipCooldown: false };
      }
    },
    {
      prob: 0.01, 
      ejecutar: () => {
        efectosUsuario.set(username, { ...efectosUsuario.get(username), superIman: true });
        return {
          mensaje: `🧲✨ ¡@${username} obtuvo un SÚPER IMÁN MITOLÓGICO! Su próxima pesca será una criatura legendaria...`,
          skipCooldown: false
        };
      }
    },
    {
      prob: 0.01, 
      ejecutar: () => {
        pez.tipo = `${pez.tipo} SHINY DORADO `; 
        pez.puntos *= 10; 
        return { 
          mensaje: `✨ ¡@${username} pescó un ${pez.tipo}! Sus puntos se multiplicaron a ${pez.puntos}.`, 
          skipCooldown: false 
        };
      }
    }
  ];

  
const rand = Math.random() ;
  
 let acumulado = 0;
for (const evento of eventos) {
  acumulado += evento.prob;
  if (rand <= acumulado) {
    return evento.ejecutar();
  }
}
return null; // No ocurre ningún evento

}

function pescar(username) {
  const pez = obtenerPez(username);

  const evento = ejecutarEventoAleatorio(username, pez);

  sumarPuntos(username, pez.puntos); 

  const skipCooldown = evento?.skipCooldown === true;
  if (!skipCooldown) updateFishTime(username);

  return { pez, evento: evento?.mensaje || null, puntosFinal: pez.puntos };
}

// ─── TOP FISHERS ─────────────────────
function getTopFishers(limit = 5) {
  return db.prepare(`
    SELECT username, points FROM fishers
    ORDER BY points DESC
    LIMIT ?
  `).all(limit);
}

// ─── MIS PUNTOS ─────────────────────
function getMisPuntos(username) {
  const row = db.prepare('SELECT points FROM fishers WHERE username = ?').get(username);
  return row ? row.points : 0;
}


function mostrarProbabilidadesEventos() {
  const eventos = [
    { nombre: 'Rebobinar tiempo', prob: 0.06 },
    { nombre: 'Imán de peces', prob: 0.06 },
    { nombre: 'Tiburón roba caña', prob: 0.05 },
    { nombre: 'Pez mutante', prob: 0.03 },
    { nombre: 'Antimateria', prob: 0.03 },
    { nombre: 'Caer al agua', prob: 0.03 },
    { nombre: 'Sello de calidad', prob: 0.04 },
    { nombre: 'Molestar a Poseidón', prob: 0.01 },
    { nombre: 'Súper Imán', prob: 0.01 },
    { nombre: 'Pez shiny dorado', prob: 0.005 }
  ];

  const totalProb = eventos.reduce((acc, e) => acc + e.prob, 0);
  const noEventoProb = 1 - totalProb;
  
  console.log('🎲 PROBABILIDADES DE EVENTOS ACTUALIZADAS 🎲');
  console.log('='.repeat(60));
  console.log('| Evento                 | Probabilidad | Porcentaje |');
  console.log('|'.padEnd(25, '-') + '|'.padEnd(14, '-') + '|'.padEnd(12, '-') + '|');
  
  // Agregar "No evento" a la lista
  const todosEventos = [
    ...eventos,
    { nombre: 'NO EVENTO', prob: noEventoProb }
  ];
  
  todosEventos.forEach(e => {
    const nombre = e.nombre.padEnd(23);
    const probabilidad = e.prob.toString().padEnd(12);
    const porcentaje = (e.prob * 100).toFixed(2) + '%';
    console.log(`| ${nombre} | ${probabilidad} | ${porcentaje.padStart(8)} |`);
  });

  console.log('='.repeat(60));
  console.log(`PROBABILIDAD TOTAL EVENTOS: ${(totalProb * 100).toFixed(2)}%`);
  console.log(`PROBABILIDAD SIN EVENTOS: ${(noEventoProb * 100).toFixed(2)}%`);
  console.log('='.repeat(60));
}

// Ejecutar para verificar
mostrarProbabilidadesEventos();
// ─── EXPORTS ─────────────────────────────
module.exports = {
  getCoins,
  addCoins,
  removeCoins,
  canFish,
  getFishCooldown,
  pescar,
  getTopFishers,
  getMisPuntos,
  sumarPuntos,
  peces, 
  pecesMitologicos,
  items
};
