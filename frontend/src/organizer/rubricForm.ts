import type { RealRubricCreateInput } from './realT2Data';
export function rubricFormInput(form: FormData, count: number): RealRubricCreateInput {
  const text = (key: string) => String(form.get(key) ?? '').trim();
  const title = text('title');
  if (!title || title.length > 160) throw Error('Enter a rubric title of 1–160 characters.');
  if (count < 1 || count > 50) throw Error('Provide 1–50 criteria.');
  const criteria = Array.from({ length: count }, (_, position) => ({ name: text(`name-${position}`), description: text(`description-${position}`), weight: text(`weight-${position}`), max_score: text(`max-${position}`), position }));
  let weightUnits = 0;
  const names = new Set<string>();
  for (const c of criteria) {
    const name = c.name.toLowerCase();
    if (!name || c.name.length > 120 || names.has(name)) throw Error('Criterion names must be nonblank and unique (ignoring case), up to 120 characters.');
    names.add(name);
    if (c.description.length > 4000) throw Error('Descriptions must be at most 4000 characters.');
    if (!/^\d+(?:\.\d{1,4})?$/.test(c.weight) || Number(c.weight) <= 0 || Number(c.weight) > 100) throw Error('Weights must be positive, with up to four decimal places.');
    const [whole, fraction = ''] = c.weight.split('.');
    weightUnits += Number(whole) * 10000 + Number(fraction.padEnd(4, '0'));
    if (!/^\d+(?:\.\d{1,3})?$/.test(c.max_score) || Number(c.max_score) <= 0 || Number(c.max_score) >= 100000) throw Error('Maximum scores must be positive, below 100000, with up to three decimal places.');
  }
  if (weightUnits !== 1000000) throw Error('Rubric weights must total exactly 100%.');
  return { title, criteria };
}
