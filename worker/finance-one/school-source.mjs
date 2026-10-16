/** Restrict the configured school binding to SELECT + first/all. No source writes. */
export function readOnlySchoolSource(binding){
 if(!binding||typeof binding.prepare!=='function')return null;
 return Object.freeze({prepare(query){
  if(typeof query!=='string'||!/^\s*SELECT\s/i.test(query)||/[;]|--|\/\*/.test(query)||
    !/\bFROM\s+(neo_portal_records|sqlite_master)\b/i.test(query))throw Error('Read-only school source query required');
  const statement=binding.prepare(query);
  const wrap=bound=>Object.freeze({first:()=>bound.first(),all:()=>bound.all()});
  return Object.freeze({...wrap(statement),bind:(...args)=>wrap(statement.bind(...args))});
 }});
}
