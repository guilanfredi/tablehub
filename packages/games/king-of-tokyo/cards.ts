/** Catálogo das cartas de Poder (1ª edição PT-BR, 66 cartas). Ver RULES.md. */
export type CardKind = 'keep' | 'discard';

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  kind: CardKind;
  text: string;
  /** Cópias no baralho. */
  count?: number;
}

const D = (id: string, name: string, cost: number, text: string, count = 1): CardDef => ({ id, name, cost, kind: 'discard', text, count });
const C = (id: string, name: string, cost: number, text: string, count = 1): CardDef => ({ id, name, cost, kind: 'keep', text, count });

export const CARDS: CardDef[] = [
  D('lojinha-da-esquina', 'Lojinha da Esquina', 3, '+1 PV.'),
  D('trem-metropolitano', 'Trem Metropolitano', 4, '+2 PV.'),
  D('predio-residencial', 'Prédio Residencial', 5, '+3 PV.'),
  D('arranha-ceu', 'Arranha-céu', 6, '+4 PV.'),
  D('vindo-do-alto', 'Vindo do Alto', 5, '+2 PV e assume a Cidade de Tóquio, se ainda não estiver em Tóquio.'),
  D('energizar', 'Energizar', 8, '+9 energia.'),
  D('ordens-de-evacuacao', 'Ordens de Evacuação', 7, 'Todos os outros monstros perdem 5 PV.', 2),
  D('rajada-de-fogo', 'Rajada de Fogo', 3, 'Causa 2 de dano a todos os outros monstros.'),
  D('furor', 'Furor', 7, 'Jogue um turno extra logo depois deste.'),
  D('refinaria-de-gas', 'Refinaria de Gás', 6, '+2 PV e causa 3 de dano a todos os outros monstros.'),
  D('cura', 'Cura', 3, '+2 Vida.'),
  D('bombardeio-das-alturas', 'Bombardeio das Alturas', 4, 'Todos os monstros (inclusive você) sofrem 3 de dano.'),
  D('avioes-de-combate', 'Aviões de Combate', 5, '+5 PV e você sofre 4 de dano.'),
  D('guarda-nacional', 'Guarda Nacional', 3, '+2 PV e você sofre 2 de dano.'),
  D('usina-de-energia-nuclear', 'Usina de Energia Nuclear', 6, '+2 PV e +3 Vida.'),
  D('tanques', 'Tanques', 4, '+4 PV e você sofre 3 de dano.'),
  D('tempestade-gigante', 'Tempestade Gigante', 6, '+2 PV. Os outros monstros perdem 1 energia para cada 2 que tiverem.'),

  C('acumulador-de-energia', 'Acumulador de Energia', 3, 'No fim do seu turno, +1 PV para cada 6 energia que tiver.'),
  C('ainda-maior', 'Ainda Maior', 4, 'Vida máxima +2. Ao comprar, +2 Vida.'),
  C('alongado', 'Alongado', 3, 'Pague 2 energia para mudar um dado seu para qualquer face.'),
  C('amigo-das-criancas', 'Amigo das Crianças', 3, 'Sempre que ganhar energia, ganhe 1 extra.'),
  C('armadura-blindada', 'Armadura Blindada', 4, 'Ignore o dano quando ele for de apenas 1.'),
  C('asas', 'Asas', 6, 'Pague 2 energia para não sofrer dano até o fim do turno.'),
  C('ataque-de-acido', 'Ataque de Ácido', 6, 'Cause 1 de dano extra a cada turno (mesmo sem garras).'),
  C('bateria-de-monstros', 'Bateria de Monstros', 2, 'Ao comprar, coloque energia sua na carta; o banco põe o mesmo valor. No início de cada turno, pegue 2 de volta.'),
  C('cabeca-extra', 'Cabeça Extra', 7, 'Você rola 1 dado extra.', 2),
  C('camuflagem', 'Camuflagem', 3, 'Ao sofrer dano, role 1 dado por ponto de dano; cada coração anula 1 ponto.'),
  C('cauda-com-pontas', 'Cauda com Pontas', 5, 'Ao atacar, cause 1 de dano extra.'),
  C('cerdas-envenenadas', 'Cerdas Envenenadas', 3, 'Ao pontuar 2 2 2, cause também 2 de dano.'),
  C('cerebro-gigante', 'Cérebro Gigante', 5, '1 rolagem extra por turno.'),
  C('chefe-do-rebanho', 'Chefe do Rebanho', 3, 'Uma vez por turno, mude um dado seu para 1.'),
  C('congelar-o-tempo', 'Congelar o Tempo', 5, 'Ao pontuar 1 1 1, jogue um turno extra com 1 dado a menos.'),
  C('criado-no-laboratorio', 'Criado no Laboratório', 2, 'Na sua compra, veja o topo do baralho e compre-o se quiser.'),
  C('cura-rapida', 'Cura Rápida', 3, 'Pague 2 energia: +1 Vida.'),
  C('cuspe-envenenado', 'Cuspe Envenenado', 4, 'Ao causar dano, dê 1 ficha de Envenenado a cada monstro atingido.'),
  C('destruicao-total', 'Destruição Total', 3, 'Com 1 2 3, energia, garra e coração no resultado, +9 PV.'),
  C('devorador-de-mortos', 'Devorador de Mortos', 4, '+3 PV a cada vez que um monstro chega a 0 de Vida.'),
  C('ele-so-esta-ficando-mais-forte', 'Ele Só Está Ficando Mais Forte', 3, 'Ao perder 2 ou mais de Vida de uma vez, +1 energia.'),
  C('ele-tem-um-filho', 'Ele Tem um Filho!', 7, 'Ao chegar a 0 de Vida, descarte suas cartas, perca PV e energia e volte com 10 de Vida.'),
  C('equipe-exclusiva-de-jornalismo', 'Equipe Exclusiva de Jornalismo', 3, '+1 PV a cada carta que comprar.'),
  C('escavando', 'Escavando', 5, '+1 de dano em Tóquio. Ao ceder Tóquio, cause 1 de dano a quem entra no seu lugar.'),
  C('espreitador', 'Espreitador', 4, 'Você sempre pode rerrolar seus 3.'),
  C('energia-solar', 'Energia Solar', 2, 'No fim do seu turno, se não tiver energia, +1.'),
  C('gourmet', 'Gourmet', 4, 'Ao pontuar 1 1 1, +2 PV extras.'),
  C('halito-de-supernova', 'Hálito de Supernova', 7, 'Seus ataques atingem todos os outros monstros.'),
  C('herbivoro', 'Herbívoro', 5, '+1 PV no fim do seu turno se não causou dano a ninguém.'),
  C('imitador', 'Imitador', 8, 'Copie uma carta Constante de qualquer monstro. No início do seu turno, pague 1 energia para mudar a cópia.'),
  C('jatos', 'Jatos', 5, 'Você não sofre o dano das garras ao ceder Tóquio.'),
  C('metabolismo-alienigena', 'Metabolismo Alienígena', 3, 'Cartas custam 1 energia a menos.'),
  C('metamorfose', 'Metamorfose', 3, 'No fim do seu turno, descarte Constantes suas e receba o custo delas em energia.'),
  C('monstro-alfa', 'Monstro Alfa', 5, '+1 PV ao atacar.'),
  C('nuvem-de-fumaca', 'Nuvem de Fumaça', 4, '3 cargas; gaste 1 para ter uma rolagem extra.'),
  C('onivoro', 'Onívoro', 4, 'Uma vez por turno, 1 2 3 vale 2 PV.'),
  C('oportunista', 'Oportunista', 3, 'Quando uma carta nova é revelada, você pode comprá-la na hora.'),
  C('raio-de-cura', 'Raio de Cura', 4, 'Cure outros monstros com seus corações; eles pagam 2 energia por Vida.'),
  C('raio-de-encolhimento', 'Raio de Encolhimento', 6, 'Ao causar dano, dê 1 ficha de Encolhido a cada monstro atingido.'),
  C('regeneracao', 'Regeneração', 4, 'Ao se curar, cure 1 extra.'),
  C('reviravolta', 'Reviravolta', 3, 'Mude um dado seu para qualquer face; descarte esta carta.'),
  C('sonda-psiquica', 'Sonda Psíquica', 3, 'Uma vez por turno de outro monstro, rerrole 1 dado dele; se sair coração, descarte esta carta.'),
  C('sopro-de-fogo', 'Sopro de Fogo', 4, 'Ao causar dano, seus vizinhos sofrem 1 de dano extra.'),
  C('telepata', 'Telepata', 4, 'Pague 1 energia para ter uma rolagem extra.'),
  C('tentaculos-parasiticos', 'Tentáculos Parasíticos', 4, 'Compre Constantes de outros monstros pagando o custo a eles.'),
  C('torcendo-pelo-azarao', 'Torcendo pelo Azarão', 3, 'No fim de qualquer turno, se tiver menos PV que todos os outros, +1 PV.'),
  C('urbanivoro', 'Urbanívoro', 4, '+1 PV ao começar o turno em Tóquio; +1 de dano ao causar dano em Tóquio.'),
];

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export function fullDeck(): string[] {
  return CARDS.flatMap((c) => Array.from({ length: c.count ?? 1 }, () => c.id));
}
