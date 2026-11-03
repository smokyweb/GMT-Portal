function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
function nullableNumber(value,label){
  if(value===''||value===undefined)return null;
  if(value===null)return null;
  const number=Number(value);
  if(!Number.isFinite(number)||number<0)fail(label+' must be a non-negative number.');
  return number;
}
function nullableDate(value,label){
  if(value===''||value===undefined)return null;
  if(value===null)return null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))fail(label+' must be a valid date.');
  return value;
}
export function normalizeNofoInput(input={}, {isCreate=false}={}) {
  const data={...input};
  const fiscal=data.fiscal_year;
  if(Object.hasOwn(data,'fiscal_year')){
    if(fiscal===''||fiscal===null||fiscal===undefined){
      if(isCreate)fail('Fiscal Year is required for new NOFOs.');
      data.fiscal_year=null;
    } else {
      const year=Number(fiscal);
      if(!Number.isInteger(year)||year<1000||year>9999)fail('Fiscal Year must be a 4-digit year.');
      data.fiscal_year=year;
    }
  } else if(isCreate) fail('Fiscal Year is required for new NOFOs.');
  for(const [key,label] of [['local_share_amount','Local Share (Pass-Through)'],['state_share_amount','State Share (Retained)'],['mou_amount','MOU Amount']])if(Object.hasOwn(data,key))data[key]=nullableNumber(data[key],label);
  delete data.local_share_pct;
  delete data.state_share_pct;
  if(data.legacy_grant_id==='')data.legacy_grant_id=null;
  return data;
}
