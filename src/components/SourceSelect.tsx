import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface SourceOption {
  name: string;
  total: number;
  errors: number;
}

interface Props {
  value: string;
  options: SourceOption[];
  onChange: (value: string) => void;
}

export function SourceSelect({ value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const items = [{ name: '', total: options.reduce((n, o) => n + o.total, 0), errors: options.reduce((n, o) => n + o.errors, 0) }, ...options];
  const selectedIndex = Math.max(0, items.findIndex((o) => o.name === value));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId]);

  const show = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  const pick = (index: number) => {
    onChange(items[index].name);
    setOpen(false);
    button.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => (open ? setActive((i) => Math.min(items.length - 1, i + 1)) : show()),
      ArrowUp: () => (open ? setActive((i) => Math.max(0, i - 1)) : show()),
      Home: () => open && setActive(0),
      End: () => open && setActive(items.length - 1),
      Enter: () => (open ? pick(active) : show()),
      ' ': () => (open ? pick(active) : show()),
      Escape: () => setOpen(false),
      Tab: () => setOpen(false),
    };
    const handler = keys[e.key];
    if (!handler) return;
    if (e.key !== 'Tab') e.preventDefault();
    if (e.key === 'Escape' && open) e.stopPropagation();
    handler();
  };

  const label = value || 'Все источники';

  return (
    <div className={`dropdown${open ? ' is-open' : ''}`} ref={root}>
      <button
        ref={button}
        type="button"
        className={`dropdown__button${value ? ' has-value' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={`Источник: ${label}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className="dropdown__value" translate="no">
          {label}
        </span>
        <svg className="dropdown__chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="dropdown__menu" id={listId} role="listbox" aria-label="Источник">
          {items.map((o, i) => (
            <li
              key={o.name || '__all'}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === selectedIndex}
              className={`dropdown__option${i === active ? ' is-active' : ''}${i === selectedIndex ? ' is-selected' : ''}`}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(i)}
            >
              <span className="dropdown__name" translate="no">
                {o.name || 'Все источники'}
              </span>
              <span className="dropdown__meta">
                {o.errors > 0 && (
                  <span className="dropdown__errors" title={`С ошибкой: ${o.errors}`}>
                    {o.errors}
                  </span>
                )}
                <span className="dropdown__total">{o.total}</span>
              </span>
              <svg className="dropdown__check" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
