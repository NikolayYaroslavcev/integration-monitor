import { z } from 'zod';
import { EVENT_STATUSES } from '../shared/types.js';

const requiredText = (label: string, max: number) =>
  z
    .string({
      error: (issue) =>
        issue.input === undefined ? `Поле «${label}» обязательно` : `Поле «${label}» должно быть строкой`,
    })
    .trim()
    .min(1, `Поле «${label}» не может быть пустым`)
    .max(max, `Поле «${label}» длиннее ${max} символов`);

// id and created_at are optional: the server fills them in. Unknown keys are rejected so a typo like "staus" fails loudly.
export const createEventSchema = z
  .object({
    id: z
      .string({ error: 'Поле «id» должно быть строкой' })
      .trim()
      .regex(/^[A-Za-z0-9._-]{1,64}$/, 'Поле «id»: 1–64 символа, только латиница, цифры, «.», «_», «-»')
      .optional(),
    source: requiredText('source', 64),
    type: requiredText('type', 64),
    status: z.enum(EVENT_STATUSES, {
      error: (issue) =>
        issue.input === undefined
          ? 'Поле «status» обязательно'
          : 'Поле «status» должно быть «success» или «error»',
    }),
    created_at: z
      .iso.datetime({ offset: true, error: 'Поле «created_at» должно быть датой ISO 8601, например 2026-11-02T12:15:00Z' })
      .refine((v) => {
        const t = Date.parse(v);
        return t >= Date.UTC(2000, 0, 1) && t <= Date.now() + 86_400_000;
      }, 'Поле «created_at»: дата не раньше 2000 года и не позже чем через сутки от текущего времени')
      .optional(),
    message: requiredText('message', 500),
    details: z
      .record(z.string(), z.unknown(), { error: 'Поле «details» должно быть объектом' })
      .optional(),
  })
  .strict();

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const listQuerySchema = z.object({
  status: z.enum(EVENT_STATUSES).optional(),
  source: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});
