export const EFFORTS = ['low','medium','high','xhigh','max'] as const;
export type Effort = typeof EFFORTS[number];
export type EffortPolicy = Effort | 'auto' | 'native';
export const isEffort = (value:unknown):value is Effort => typeof value==='string' && EFFORTS.includes(value as Effort);
export const withinCap = (value:Effort, cap:Effort):boolean => EFFORTS.indexOf(value)<=EFFORTS.indexOf(cap);
