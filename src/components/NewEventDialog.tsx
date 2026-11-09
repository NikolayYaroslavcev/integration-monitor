import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { FieldError, IntegrationEvent } from '../../shared/types';
import { ApiRequestError, createEvent } from '../api';

interface Props {
  open: boolean;
  sources: string[];
  onClose: () => void;
  onCreated: (event: IntegrationEvent) => void;
}

interface FormState {
  source: string;
  type: string;
  status: '' | 'success' | 'error';
  message: string;
  details: string;
}

const EMPTY: FormState = { source: '', type: '', status: '', message: '', details: '' };

const PRESETS: { label: string; form: FormState }[] = [
  {
    label: 'Успешное',
    form: {
      source: 'amoCRM',
      type: 'lead.created',
      status: 'success',
      message: 'Заявка успешно передана',
      details: '{\n  "http_status": 200,\n  "duration_ms": 140\n}',
    },
  },
  {
    label: 'С ошибкой',
    form: {
      source: 'Bitrix24',
      type: 'deal.updated',
      status: 'error',
      message: 'CRM вернула 429 Too Many Requests: превышен лимит запросов',
      details: '{\n  "http_status": 429,\n  "error_code": "RATE_LIMIT",\n  "attempt": 1,\n  "hint": "Снизьте частоту запросов или включите очередь"\n}',
    },
  },
  {
    label: 'Невалидное',
    form: { source: 'Tilda', type: '', status: '', message: '', details: '' },
  },
];

const RAW_EXAMPLE = '{\n  "source": "amoCRM",\n  "staus": "success"\n}';

export function NewEventDialog({ open, sources, onClose, onCreated }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [raw, setRaw] = useState(RAW_EXAMPLE);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setErrors([]);
      setSummary(null);
      dialog.showModal();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  const set = (key: keyof FormState) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((errs) => errs.filter((x) => x.field !== key && !x.field.startsWith(`${key}.`)));
  };

  const fieldError = (key: string) =>
    errors.filter((e) => e.field === key || e.field.startsWith(`${key}.`)).map((e) => e.message).join('. ');

  const buildBody = (): unknown => {
    if (mode === 'json') return JSON.parse(raw);
    const body: Record<string, unknown> = {};
    if (form.source) body.source = form.source;
    if (form.type) body.type = form.type;
    if (form.status) body.status = form.status;
    if (form.message) body.message = form.message;
    if (form.details.trim()) body.details = JSON.parse(form.details);
    return body;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setSummary(null);
    let body: unknown;
    try {
      body = buildBody();
    } catch {
      const field = mode === 'json' ? 'raw' : 'details';
      setErrors([{ field, message: 'Невалидный JSON — проверьте кавычки и запятые' }]);
      requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setPending(true);
    try {
      onCreated(await createEvent(body));
      setForm(EMPTY);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setSummary(`${err.status} · ${err.message}`);
        setErrors(err.fields);
        requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      } else setSummary('Сервер недоступен. Проверьте, что API запущен.');
    } finally {
      setPending(false);
    }
  };

  const formFields = new Set(['source', 'type', 'status', 'message', 'details']);
  const otherErrors = mode === 'form' ? errors.filter((e) => !formFields.has(e.field.split('.')[0])) : errors;

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="new-event-title">
      <form className="dialog__form" onSubmit={submit} noValidate>
        <header className="dialog__head">
          <div>
            <h2 id="new-event-title">Тестовое событие</h2>
            <p className="dialog__sub">
              Отправляется как <code>POST /api/events</code>. Проверка полей выполняется на сервере.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="dialog__tabs" role="tablist">
          {(['form', 'json'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`dialog__tab${mode === m ? ' is-active' : ''}`}
              onClick={() => {
                setMode(m);
                setErrors([]);
                setSummary(null);
              }}
            >
              {m === 'form' ? 'Форма' : 'Сырой JSON'}
            </button>
          ))}
        </div>

        <div className="dialog__body">
          {summary && (
            <div className="form-alert" role="alert">
              <strong>{summary}</strong>
              {otherErrors.length > 0 && (
                <ul>
                  {otherErrors.map((e) => (
                    <li key={e.field + e.message}>
                      <code>{e.field}</code> — {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {mode === 'form' ? (
            <>
              <div className="presets">
                <span>Заполнить:</span>
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setForm(p.form);
                      setErrors([]);
                      setSummary(null);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="grid-2">
                <Field label="Источник" name="source" error={fieldError('source')}>
                  <input value={form.source} onChange={set('source')} aria-invalid={!!fieldError('source')} placeholder="например, amoCRM" autoComplete="off" />
                </Field>
                <Field label="Тип события" name="type" error={fieldError('type')}>
                  <input value={form.type} onChange={set('type')} aria-invalid={!!fieldError('type')} placeholder="например, lead.created" autoComplete="off" spellCheck={false} />
                </Field>
              </div>

              {sources.length > 0 && (
                <div className="presets" role="group" aria-label="Источники из ленты">
                  <span>Источник из ленты:</span>
                  {sources.slice(0, 8).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`chip chip--small${form.source === s ? ' is-active' : ''}`}
                      aria-pressed={form.source === s}
                      translate="no"
                      onClick={() => set('source')({ target: { value: s } })}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <fieldset className={`field${fieldError('status') ? ' has-error' : ''}`}>
                <legend className="field__label">Статус</legend>
                <div className="radio-row">
                  {(['success', 'error'] as const).map((s) => (
                    <label key={s} className={`radio radio--${s}`}>
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={form.status === s}
                        onChange={set('status')}
                        aria-invalid={!!fieldError('status')}
                      />
                      {s === 'success' ? 'Успешно' : 'Ошибка'}
                    </label>
                  ))}
                </div>
                {fieldError('status') && <p className="field__error">{fieldError('status')}</p>}
              </fieldset>

              <Field
                label="Описание"
                name="message"
                error={fieldError('message')}
                hint={form.status === 'error' ? 'Для ошибки опишите причину: что пошло не так и где' : undefined}
              >
                <textarea value={form.message} onChange={set('message')} aria-invalid={!!fieldError('message')} rows={2} placeholder="Что произошло; для ошибки — причина" />
              </Field>

              <Field label="Детали (JSON, необязательно)" name="details" error={fieldError('details')}>
                <textarea
                  className="mono"
                  value={form.details}
                  onChange={set('details')}
                  aria-invalid={!!fieldError('details')}
                  rows={4}
                  spellCheck={false}
                  placeholder='{ "http_status": 200 }'
                />
              </Field>
            </>
          ) : (
            <Field
              label="Тело запроса"
              name="raw"
              error={fieldError('raw')}
              hint="Отправляется как есть: удобно проверить опечатки в полях, лишние ключи и неверные типы"
            >
              <textarea
                className="mono"
                value={raw}
                aria-invalid={!!fieldError('raw')}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setErrors([]);
                }}
                rows={10}
                spellCheck={false}
              />
            </Field>
          )}
        </div>

        <footer className="dialog__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn--primary" disabled={pending}>
            {pending ? 'Отправка…' : 'Отправить'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={`field${error ? ' has-error' : ''}`} data-field={name}>
      <span className="field__label">{label}</span>
      {children}
      {error ? <span className="field__error">{error}</span> : hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}
