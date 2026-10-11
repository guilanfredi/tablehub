import type { GameDefinition, OptionField, OptionValue } from '@tablehub/game-sdk';
import type { RoomView } from '@tablehub/shared';

interface Props {
  def: GameDefinition;
  room: RoomView;
  editable: boolean;
  changes: { keys: Set<string>; version: number };
  onChange(options: Record<string, OptionValue>): void;
}

function displayValue(f: OptionField, v: OptionValue | undefined): string {
  if (f.type === 'boolean') return v ? 'Sim' : 'Não';
  if (f.type === 'select') return f.choices.find((c) => c.value === v)?.label ?? String(v);
  return String(v);
}

/** Formulário de regras gerado a partir do `optionsSchema` do jogo. */
export function OptionsForm({ def, room, editable, changes, onChange }: Props) {
  const n = Math.max(room.players.length, def.minPlayers);
  const fields = def.optionsSchema.filter((f) => !f.visibleWhen || f.visibleWhen(room.options, n));
  if (fields.length === 0) return <p className="muted small">Este jogo não tem opções de regra.</p>;

  return (
    <div className="stack" style={{ gap: 4 }}>
      {fields.map((f) => {
        const value = room.options[f.key];
        const changed = changes.keys.has(f.key);
        const id = `opt-${f.key}`;
        return (
          <div key={`${f.key}-${changed ? changes.version : 0}`} className={`option-row ${changed && !editable ? 'changed' : ''}`}>
            {f.type === 'boolean' ? (
              <label className="switch" htmlFor={id}>
                <input id={id} type="checkbox" checked={Boolean(value)} disabled={!editable} onChange={(e) => onChange({ [f.key]: e.target.checked })} />
                <span className="grow">
                  <strong>{f.label}</strong>
                  {!editable && changed && <span className="badge badge-warn" style={{ marginLeft: 8 }}>alterado</span>}
                </span>
              </label>
            ) : (
              <>
                <label className="label" htmlFor={id} style={{ marginBottom: 0 }}>
                  {f.label}
                  {!editable && changed && <span className="badge badge-warn" style={{ marginLeft: 8 }}>alterado</span>}
                </label>
                {!editable ? (
                  <div>{displayValue(f, value)}</div>
                ) : f.type === 'select' ? (
                  <select
                    id={id}
                    className="select"
                    value={String(value)}
                    onChange={(e) => {
                      const choice = f.choices.find((c) => String(c.value) === e.target.value);
                      if (choice) onChange({ [f.key]: choice.value });
                    }}
                  >
                    {f.choices.map((c) => (
                      <option key={String(c.value)} value={String(c.value)}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={f.min}
                    max={f.max}
                    step={f.step ?? 1}
                    value={Number(value)}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) onChange({ [f.key]: v });
                    }}
                  />
                )}
              </>
            )}
            {f.description && <span className="muted small">{f.description}</span>}
          </div>
        );
      })}
    </div>
  );
}
