import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {basename,join,resolve} from 'node:path';
import vm from 'node:vm';

const root=process.cwd(),publicDir=resolve(root,'public'),currencyFile=resolve(root,'currencies.js');
if(!existsSync(currencyFile))throw new Error('currencies.js is required for the registered-country catalogue.');
const sandbox={window:{}};vm.runInNewContext(readFileSync(currencyFile,'utf8'),sandbox,{filename:'currencies.js'});
const rows=Array.isArray(sandbox.window.ADRA_CURRENCIES)?sandbox.window.ADRA_CURRENCIES:[],countries=new Map();for(const row of rows){const code=String(row?.countryCode||'').trim().toUpperCase(),name=String(row?.country||'').trim();if(/^[A-Z]{2}$/u.test(code)&&name&&!countries.has(code))countries.set(code,name);}
if(countries.size<195)throw new Error(`Registered-country catalogue is incomplete: found ${countries.size}, expected at least 195.`);
for(const [code,name] of [['ZM','Zambia'],['ZW','Zimbabwe'],['ZA','South Africa'],['GB','United Kingdom'],['US','United States'],['IN','India'],['BR','Brazil'],['JP','Japan'],['AU','Australia'],['CA','Canada']])if(!countries.has(code))throw new Error(`Registered-country catalogue is missing ${name} (${code}).`);
const targets=[resolve(root,'app.js')];if(existsSync(publicDir))for(const name of readdirSync(publicDir))if(/^app(?:\.|-).*\.js$/iu.test(name))targets.push(join(publicDir,name));
for(const file of targets.filter(existsSync)){
  const source=readFileSync(file,'utf8');
  for(const token of ['COMPANY_PROFILE_COUNTRY_DROPDOWN_SCHEMA112','companyProfileCountrySelect112','document.createElement(\'select\')','current.replaceWith(select)','select.removeAttribute(\'list\')','Select registered country','data-country-help112','minimumCountries:195','filteredDatalist:false'])if(!source.includes(token))throw new Error(`Country dropdown verifier missing ${token} in ${basename(file)}.`);
}
console.log(`[verify-developer-company-country-dropdown-v6-3-112] OK apps=${targets.filter(existsSync).length} countries=${countries.size} control=select complete-list=1`);
