import { HorarioDto } from './dto/horario.dto';
import { TarifasDto } from './dto/tarifas.dto';

export type DpiEstado = 'pendiente' | 'aprobado' | 'rechazado';

export type DpiMeta = {
  estado: DpiEstado;
  numero_enmascarado: string | null;
  numero_hash: string | null;
  frente_path: string | null;
  reverso_path: string | null;
  enviado_en: string | null;
  revisado_en: string | null;
  motivo_rechazo: string | null;
};

type Extras = {
  bio: string;
  tarifas: TarifasDto | null;
  horarios: HorarioDto[];
  reputacion: number | null;
  total_resenas: number | null;
  dpi: DpiMeta | null;
};

export function parseProfileExtras(descripcion: string | null | undefined): Extras {
  const raw = (descripcion || '').trim();
  if (!raw) {
    return { bio: '', tarifas: null, horarios: [], reputacion: null, total_resenas: null, dpi: null };
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 1 && typeof parsed === 'object') {
      return {
        bio: typeof parsed.bio === 'string' ? parsed.bio : '',
        tarifas: parsed.tarifas && typeof parsed.tarifas === 'object' ? parsed.tarifas : null,
        horarios: Array.isArray(parsed.horarios) ? parsed.horarios : [],
        reputacion: typeof parsed.reputacion === 'number' ? parsed.reputacion : null,
        total_resenas: typeof parsed.total_resenas === 'number' ? parsed.total_resenas : null,
        dpi: parsed.dpi && typeof parsed.dpi === 'object' ? (parsed.dpi as DpiMeta) : null,
      };
    }
  } catch {
    // texto libre previo
  }

  return { bio: raw, tarifas: null, horarios: [], reputacion: null, total_resenas: null, dpi: null };
}

export function serializeProfileExtras(input: {
  bio: string;
  tarifas?: TarifasDto | null;
  horarios?: HorarioDto[];
  reputacion?: number | null;
  total_resenas?: number | null;
  dpi?: DpiMeta | null;
}) {
  return JSON.stringify({
    v: 1,
    bio: input.bio || '',
    tarifas: input.tarifas || null,
    horarios: input.horarios || [],
    reputacion: input.reputacion ?? null,
    total_resenas: input.total_resenas ?? null,
    dpi: input.dpi || null,
  });
}

export function normalizeDisponibilidad(value?: string | null) {
  return value === 'Ocupado' ? 'Ocupado' : 'Disponible';
}

export function toggleDisponibilidad(value?: string | null) {
  return normalizeDisponibilidad(value) === 'Disponible' ? 'Ocupado' : 'Disponible';
}
