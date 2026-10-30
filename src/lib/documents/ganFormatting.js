import {moneyCents} from '../forms/valueValidation.js';
export function ganCents(value) {const cents=moneyCents(value);return cents===null?null:BigInt(cents);}
export function ganMoney(value) {const cents=ganCents(value);return cents===null?undefined:formatGanCents(cents);}
export function formatGanCents(cents) {return '$'+(cents/100n).toLocaleString('en-US')+'.'+String(cents%100n).padStart(2,'0');}
export function ganDate(value) {
  const text=value instanceof Date?value.toISOString().slice(0,10):String(value||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||Number.isNaN(Date.parse(text))||new Date(text).toISOString().slice(0,10)!==text)return undefined;
  return new Date(text+'T00:00:00Z').toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
}
export function ganDueDate(awardDate,days=30) {
  if(!ganDate(awardDate))return undefined;
  const iso=awardDate instanceof Date?awardDate.toISOString().slice(0,10):String(awardDate).slice(0,10);
  const date=new Date(iso+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);
}
export const POETE_CATEGORIES=['Planning','Organization','Equipment','Training','Exercises','Management & Administration'];
const aliases={'m&a':'Management & Administration','management and administration':'Management & Administration'};
export function normalizePoete(value) {const text=String(value||'').trim().toLowerCase();return aliases[text]||POETE_CATEGORIES.find(category=>category.toLowerCase()===text)||null;}
