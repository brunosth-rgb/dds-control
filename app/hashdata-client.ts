import { currentUser } from './firebase-client';
import { textValue } from './hashdata-map';

export type HashdataBatch = {
  formId: string;
  records: Record<string, unknown>[];
  fetchedAt?: string;
};

function workerBase() {
  const url = String(import.meta.env.VITE_HASHDATA_WORKER_URL || '').trim().replace(/\/$/, '');
  if (!url) throw new Error('VITE_HASHDATA_WORKER_URL não configurado no GitHub.');
  return url;
}

export async function fetchHashdataRecords(): Promise<HashdataBatch> {
  const token = await currentUser().getIdToken();
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  const url = new URL(workerBase() + '/responses');
  url.searchParams.set('from', from.toISOString());
  url.searchParams.set('to', to.toISOString());

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(data.error || `Falha na integração Hashdata (HTTP ${response.status}).`);
  if (!Array.isArray(data.records)) throw new Error('Resposta inesperada da integração Hashdata.');
  if (data.records.length > 10000) throw new Error('Lote muito grande para esta versão da integração.');
  return data as HashdataBatch;
}

export function previewHashdata(records: Record<string, unknown>[], mapping: Record<string, string | undefined>) {
  const keys = [...new Set(records.flatMap((r) => Object.keys(r)))].sort();
  const samples = Object.fromEntries(keys.map((key) => {
    const row = records.find((r) => r[key] != null && textValue(r[key]) !== '');
    return [key, textValue(row?.[key]).slice(0, 200)];
  }));
  return { count: records.length, keys, samples, mapping };
}
