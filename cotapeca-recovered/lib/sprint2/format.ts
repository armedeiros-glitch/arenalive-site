export const CONDITION_LABELS: Record<string,string> = {
  new_original: 'Nova original',
  new_aftermarket: 'Nova paralela',
  used_original: 'Usada original',
  reconditioned: 'Recondicionada',
};

export function kmLabel(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return 'Distância não disponível';
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

export function relativeTime(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `há ${hours}h`;
}
