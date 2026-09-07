/**
 * All narrative text in one place. The hermit who lived here before you is "L." until the last relic names her.
 */

export interface Beast {
  name: string;
  lore: string;
  /** What L. wrote about how to deal with it. */
  tip: string;
}

/** Index = concept-art sprite (enemy1..15.png). Last index = the Gate Guardian. */
export const BESTIARY: Beast[] = [
  { name: 'Tragón de Ruedas', lore: 'Una boca morada sobre dos ruedas. No se sabe qué come, pero siempre tiene hambre.', tip: '«Rueda rápido en llano; súbete a una cuesta y se cansa.»' },
  { name: 'Araña Sol', lore: 'Cabeza amarilla con orejas de gato y ocho patas negras. Sonríe siempre. Eso es lo peor.', tip: '«Los ojos rojos brillan de noche. Si los ves parpadear, ya te ha visto.»' },
  { name: 'Vigía Bicéfalo', lore: 'Dos cabezas sobre un cuerpo negro. Una vigila mientras la otra duerme.', tip: '«Nunca duerme del todo. Rodéalo por detrás.»' },
  { name: 'Nube Roja', lore: 'Una masa carmesí con cara de cartón y patas de hilo. Flota más que camina.', tip: '«Ligera. Un buen golpe la manda lejos.»' },
  { name: 'Mirón', lore: 'Pequeño y silencioso. Solo mira. Luego muerde.', tip: '«Es el más débil. Es también el que más se acerca.»' },
  { name: 'Cangrejo de Tierra', lore: 'Ancho y bajo. Camina de lado entre los helechos y no le importa el fuego.', tip: '«El fuego no le asusta. Los golpes sí.»' },
  { name: 'Triángulo Negro', lore: 'Un triángulo invertido con dos ojos de plato y una boca de rayas. Nadie lo ha visto de espaldas.', tip: '«Da la vuelta y no está. Vuelve a mirar y está más cerca.»' },
  { name: 'Ojo Lila', lore: 'Una esfera lavanda con una estrella roja por ojo y patas rojas como hilos. Se arrastra ceñuda entre los helechos.', tip: '«Lenta. Si la ves de lejos, ya la has esquivado.»' },
  { name: 'Mantis de Cristal', lore: 'Un cuerpo verde y afilado colgado entre dos antenas que tocan el suelo. Cuando se queda quieta parece una hoja.', tip: '«Se camufla en los claros. Camina por los bosques densos.»' },
  { name: 'Sombrero Ancho', lore: 'Un ala naranja sobre un cuerpo negro con dos patas de alambre. Nadie ha visto lo que hay bajo el ala.', tip: '«Da vueltas al fuego sin acercarse. Aguanta hasta el alba.»' },
  { name: 'Rayo', lore: 'Un relámpago amarillo con ojos saltones. Aparece donde no estaba y desaparece igual.', tip: '«El más rápido. No corras: golpea cuando llegue.»' },
  { name: 'Péndulo', lore: 'Una gota negra colgada de una barra con dos ojos rojos. Flota y deja burbujas en el aire.', tip: '«Muerde solo si está encima. Mírale los ojos y retrocede.»' },
  { name: 'Capucha', lore: 'Un cuerpo lila con capucha de tela y dos alas de hilo. Enseña dos dientes cuando te ve.', tip: '«Le gustan los cobertizos. Cierra la puerta.»' },
  { name: 'Estrella Enamorada', lore: 'Una estrella de trapo con corazones rotos por ojos. No parece enfadada. Lo está.', tip: '«Le atraen las reliquias. Cógelas y sigue andando.»' },
  { name: 'Espantapájaros Verde', lore: 'Un poste torcido en forma de cruz, verde como el musgo, con dos brazos finos que cuelgan sin fuerza. De lejos parece un árbol muerto. De cerca, te mira.', tip: '«No se mueve si no te mueves tú. Aparta la vista y rodéalo.»' },
  { name: 'Guardián de la Puerta', lore: 'El primero de todos, crecido hasta tapar el cielo. Lleva treinta años esperando a que alguien llegue a la Puerta.', tip: '«No huyas. Golpea, retrocede, golpea. El hacha lo acaba en la mitad de tiempo.»' },
];

export const HERMIT_NAME = 'Lía';

export const INTRO: string[] = [
  'Abres los ojos. Agujas de pino, luz verde, un silencio que no es silencio.',
  'No recuerdas tu nombre. Sí recuerdas que el frío mata y que el agua se busca cuesta abajo.',
  'A lo lejos, columnas de luz suben desde el bosque. Alguien las dejó para ti.',
];

/** Random lines at night, one every couple of minutes. Cheap atmosphere. */
export const NIGHT_WHISPERS: string[] = [
  'Algo se mueve entre los troncos. No es el viento.',
  'Crujido de ramas a tu izquierda. Luego nada.',
  'Un aullido lejano. Otro responde más cerca.',
  'Por un momento te parece ver ojos rojos. Parpadean.',
  'Sientes que te observan desde arriba, entre las copas.',
  'El lago refleja una luna que no está en el cielo.',
  'Hay una respiración que no es la tuya.',
];

/** Lines the compass whispers when you are within 30 m of an undiscovered place. */
export const NEARBY_HINTS: Record<string, string> = {
  rock: 'Las copas se abren. Algo grande y gris se alza delante.',
  cabin: 'Huele a madera vieja y ceniza fría.',
  circle: 'El aire se queda quieto. Aquí no cantan los pájaros.',
  tree: 'Las raíces bajo tus pies son más gruesas que tu brazo.',
  pier: 'Tablones sobre el agua. Alguien los clavó con cuidado.',
  cave: 'Una corriente de aire sale de la ladera. Es cálida.',
  exit: 'La luz blanca te llama. Y algo respira delante de ella.',
};

export interface Ending {
  title: string;
  text: string;
}

export function endingFor(relics: number, totalRelics: number, escaped: boolean): Ending {
  if (!escaped) return { title: 'El bosque te ha vencido', text: '' };
  if (relics >= totalRelics) {
    return {
      title: `Has salido del bosque. Y sabes quién era ${HERMIT_NAME}.`,
      text: `Cruzas la Puerta con las diez reliquias en el bolsillo. Detrás de ti, las columnas de luz se apagan una a una. Lo último que oyes es una voz de mujer, tranquila: «Gracias por contar lo que viste». ${HERMIT_NAME} no salió nunca. Tú sí.`,
    };
  }
  if (relics >= totalRelics / 2) {
    return {
      title: 'Has salido del bosque',
      text: `Cruzas la Puerta. Sabes que alguien vivió aquí treinta días y dejó pistas para ti, pero no todas. Te faltan ${totalRelics - relics} reliquias para conocer su nombre.`,
    };
  }
  return {
    title: 'Has salido del bosque',
    text: 'Cruzas la Puerta sin mirar atrás. Sobreviviste, pero el bosque guarda todavía casi toda su historia. Hay reliquias que no encontraste.',
  };
}
