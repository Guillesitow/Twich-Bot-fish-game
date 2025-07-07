require('dotenv').config();
const tmi = require('tmi.js');
const axios = require('axios');
const { canFish, pescar, getTopFishers, getMisPuntos, getFishCooldown, sumarPuntos, peces, items, pecesMitologicos, addCoins, getCoins } = require('./economia.js');
const duelosPendientes = new Map(); // key: retado, value: retador


// --- Configuración del cliente de Twitch ---
const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH
  },
  channels: ['netherviewer', 'tacosdeloff', 'kaloozbot', 'Kaloxzc', 'conterstine' ]

});



// Conecta a Twitch
client.connect();

const canalesMuteados = new Set();





client.on('message', (channel, tags, message, self) => {
  if (self) return;

  const username = tags['username'].toLowerCase();
  const canal = '#conterstine'; 

  if (canalesMuteados.has(canal)) {
    if (channel.toLowerCase() === canal && message.trim() === '!activar' && (tags.mod || username === 'conterstine')) {
      canalesMuteados.delete(canal);
      client.say(canal, `🔊 Bot reactivado en ${canal}`);
    }
    return;
  }

  if (
    username === 'streamelements' &&
    message.includes('Conterstine is now live!')
  ) {
    if (!canalesMuteados.has(canal)) {
      canalesMuteados.add(canal);
      client.say(canal, `🔇 Canal ${canal} está en vivo. Silenciando comandos.`);
      setTimeout(() => {
      client.say(canal, 'Bot pausado en vivo para evitar spam');
      }, 1000);
    }
    return;
  }


//Comando de pezca
 if (message.startsWith('!fish')) {
  const cooldown = getFishCooldown(username);

  if (!cooldown.canFish) {
    client.say(channel, `@${username}, te faltan ${cooldown.minutes}m ${cooldown.seconds}s para volver a pescar.`);
    return;
  }
  const { pez, evento } = pescar(username);
  const puntos = getMisPuntos(username);

  let resultado;

if (pecesMitologicos.some(p => p.tipo === pez.tipo)) {
  resultado = `🔱 @${username} pescó una criatura MITOLÓGICA: ${pez.tipo}, y recibió ${pez.puntos} puntos. wtfwtfwtf Tienes un total de ${puntos} puntos.`;
} else if (items.some(p => p.tipo === pez.tipo)) {
  if (pez.tipo.toLowerCase() === 'tesoro') {
    resultado = `🎁 @${username} pescó un TESORO y recibió ${pez.puntos} puntos. wtfwtfwtf Tienes un total de ${puntos} puntos.`;
  } else if (pez.tipo.toLowerCase() === 'basura') {
    resultado = `🗑️ @${username} pescó basura. y recibió ${pez.puntos} puntos. xd Tienes un total de ${puntos} puntos.`;
  } else if (pez.tipo.toLowerCase() === 'diente de megalodon') {
    resultado = `🦈 @${username} pescó DIENTE DE MEGALODON y recibió ${pez.puntos} puntos. waos Tienes un total de ${puntos} puntos.`;
  } else if (pez.tipo.toLowerCase() === 'diamante') {
    resultado = `💎 @${username} pescó un DIAMANTE y recibió ${pez.puntos} puntos. waos Tienes un total de ${puntos} puntos.`;
  }
} else {
  resultado = `🎣 @${username} pescó un pez ${pez.tipo} y recibió ${pez.puntos} puntos. Tienes un total de ${puntos} puntos.`;
  if (pez.tipo.toLowerCase() === 'anguila electrica') {
    resultado = `⚡️ @${username} pescó Anguila Electrica. y recibió ${pez.puntos} puntos. xd Tienes un total de ${puntos} puntos.`;
  }else if (pez.tipo.toLowerCase() === 'tóxico') {
    resultado = ` ☢️ @${username} pescó un pez Tóxico. y recibió ${pez.puntos} puntos. xd Tienes un total de ${puntos} puntos.`;
  }else if (pez.tipo.toLowerCase() === 'ballena') {
    resultado = ` 🐋 @${username} pescó una BALLENA y recibió ${pez.puntos} puntos. waos Tienes un total de ${puntos} puntos.`;
  }
  
}


  client.say(channel, resultado);

    if (evento) {
    setTimeout(() => {
      client.say(channel, evento);
    }, 1000); 
  }
  
}

//comando top fishers
if (message === '!topfishers') {
  const top = getTopFishers(5);
  if (top.length === 0) {
    client.say(channel, `No hay pescadores aún. waiting `);
    return;
  }

  const tabla = top.map((u, i) => `${i + 1}. ${u.username} (${u.points} pts)`).join(' | ');
  client.say(channel, `Top pescadores: ${tabla}`);
}
  //DUELOS
if (message.startsWith('!duelo ')) {
  const retador = username.toLowerCase();
  const partes = message.split(' ');
  const retado = partes[1]?.replace('@', '').toLowerCase();

  if (!retado || retado === retador) {
    client.say(channel, `@${username}, tenés que mencionar a otro usuario para desafiar.`);
    return;
  }

  if (duelosPendientes.has(retado)) {
    client.say(channel, `@${username}, ${retado} ya tiene un duelo pendiente.`);
    return;
  }

  duelosPendientes.set(retado, retador);
  client.say(channel, ` @${retado}, has sido desafiado por @${retador}. Usá !aceptar para pelear con la caña.`);
}
//ACEPTAR
if (message === '!aceptar') {
  const retado = username.toLowerCase();

  if (!duelosPendientes.has(retado)) {
    client.say(channel, `@${username}, no tenés ningún duelo pendiente.`);
    return;
  }

  const retador = duelosPendientes.get(retado);
  duelosPendientes.delete(retado);

  // Ejecutar pesca
  const { pez: pezRetador } = pescar(retador);
  const { pez: pezRetado } = pescar(retado);

  let resultado = ` DUELO: @${retador} sacó un pez ${pezRetador.tipo} (${pezRetador.puntos} pts) vs @${retado} sacó un pez ${pezRetado.tipo} (${pezRetado.puntos} pts). `;

  if (pezRetador.puntos === pezRetado.puntos) {
    resultado += `¡Empate! No se gana ni pierde puntos.`;
  } else {
    const ganador = pezRetador.puntos > pezRetado.puntos ? retador : retado;
    const perdedor = ganador === retador ? retado : retador;

    sumarPuntos(ganador, 50);
    sumarPuntos(perdedor, -200);

    resultado += `¡@${ganador} gana el duelo y recibe +50 puntos! @${perdedor} pierde 200 puntos.`;
  }

  client.say(channel, resultado);
}
//PROBABILIDADES
if (message === '!probabilidades') {
  const todos = [...peces, ...items, ...pecesMitologicos];
  const total = todos.reduce((acc, p) => acc + p.prob, 0);

  const resumen = todos.map(p => {
    const porcentaje = ((p.prob / total) * 100).toFixed(2);
    return `${p.tipo}: ${porcentaje}%`;
  }).join(' | ');

  client.say(channel, `Probabilidades totales: ${resumen}`);
}

if (message === '!puntos') {
  const coins = getCoins(username);
  const puntos = getMisPuntos(username);
  client.say(channel, `@${username}, tienes ${coins} monedas y ${puntos} puntos de pezca.`);
}







});


console.log('Bot iniciado y escuchando...');
