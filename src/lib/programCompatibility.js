export function canonicalProgramCode(code){
  const value=String(code||'').toUpperCase();
  if(value==='EOCGP')return 'EOC';
  if(value==='NE-NSGP'||value==='NSGP-NSS')return 'NSGP';
  return value;
}
export const SPARS_PROGRAM_CODES=['EOCGP','NE-NSGP','NSGP-NSS'];
