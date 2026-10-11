/** Valor de um parâmetro de regra escolhido pelo dono da sala. */
export type OptionValue = string | number | boolean;
export type GameOptions = Record<string, OptionValue>;

interface OptionFieldBase {
  key: string;
  label: string;
  description?: string;
  /** Campo só é exibido/considerado quando a condição for verdadeira. */
  visibleWhen?: (options: GameOptions, playerCount: number) => boolean;
}

export interface SelectOptionField extends OptionFieldBase {
  type: 'select';
  default: string | number;
  choices: { value: string | number; label: string }[];
}

export interface NumberOptionField extends OptionFieldBase {
  type: 'number';
  default: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface BooleanOptionField extends OptionFieldBase {
  type: 'boolean';
  default: boolean;
}

export type OptionField = SelectOptionField | NumberOptionField | BooleanOptionField;

/** Jogador sentado à mesa. `seat` é a ordem de jogo (0..n-1). */
export interface PlayerSeat {
  id: string;
  name: string;
  seat: number;
}

export interface GameStatus {
  phase: 'playing' | 'finished';
  /** Jogadores que podem/devem agir agora. */
  currentPlayers: string[];
  winners?: string[];
  scores?: Record<string, number>;
  /** Mensagem curta para exibir (ex.: "Vez de Ana"). */
  message?: string;
}

export interface SetupContext<O extends GameOptions> {
  players: PlayerSeat[];
  options: O;
  seed: number;
}

export type ActionResult<S> = S | { error: string };

/**
 * Contrato que todo jogo implementa. Regras:
 * - O estado `S` precisa ser 100% serializável em JSON (é persistido entre ações).
 * - Toda aleatoriedade usa `Rng` com a semente guardada no próprio estado (determinismo).
 * - `applyAction` recebe uma cópia do estado e pode mutá-la livremente.
 * - `getPlayerView` nunca expõe informação oculta de outros jogadores.
 */
export interface GameDefinition<S = any, A = any, O extends GameOptions = GameOptions> {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  optionsSchema: OptionField[];
  rulesSummary(options: O, playerCount: number): string[];
  /** Rótulo opcional do assento no lobby (ex.: "Dupla A"), para jogos com times. */
  seatLabel?(seat: number, options: O, playerCount: number): string | null;
  validateConfig(options: O, playerCount: number): string | null;
  setup(ctx: SetupContext<O>): S;
  getPlayerView(state: S, playerId: string | null): unknown;
  getLegalActions(state: S, playerId: string): A[];
  applyAction(state: S, playerId: string, action: A): ActionResult<S>;
  getStatus(state: S): GameStatus;
}

export function isActionError<S>(r: ActionResult<S>): r is { error: string } {
  return typeof r === 'object' && r !== null && 'error' in r && typeof (r as any).error === 'string' && Object.keys(r as object).length === 1;
}
