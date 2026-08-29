/* Assurance Regent v6.3.124 — resilient linked-PNG country flags */
(() => {
  'use strict';

  const SCHEMA='6.3.124';
  const INTERACTION_FIX='6.3.133';
  const TARGET_IDS=new Set(['newCompanyCountry','companyExecutiveCountry','companyProfileCountry67','settingsCurrencyCountry']);
  const TARGET_SELECTOR='[data-company-registered-country]';
  const FLAG_ALIASES=Object.freeze({AC:'SH',DG:'IO',EA:'ES'});
  const instances=new WeakMap();
  let panel=null,active=null,scanQueued=false;
  const supportsPopover=typeof HTMLElement!=='undefined'&&'showPopover' in HTMLElement.prototype;
  const text=v=>String(v??'').trim(), upper=v=>text(v).toUpperCase(), lower=v=>text(v).toLowerCase();

  function catalogue(){return Array.isArray(window.ADRA_CURRENCIES)?window.ADRA_CURRENCIES:[];}
  function cleanLabel(value){
    const raw=text(value), chars=Array.from(raw), regional=ch=>{const cp=ch?.codePointAt?.(0)||0;return cp>=0x1F1E6&&cp<=0x1F1FF;};
    if(chars.length>=2&&regional(chars[0])&&regional(chars[1]))return chars.slice(2).join('').trim();
    return raw.replace(/^🏳️\s*/u,'').trim();
  }
  function nameCodeMap(){const map=new Map();for(const row of catalogue()){const c=upper(row?.countryCode),n=lower(row?.country);if(/^[A-Z]{2}$/.test(c)&&n&&!map.has(n))map.set(n,c);}return map;}
  function currencyRow(select,option){return select?.id==='settingsCurrencyCountry'&&/^\d+$/.test(text(option?.value))?catalogue()[Number(option.value)]||null:null;}
  function codeFor(select,option){
    if(!option||!text(option.value))return'';
    const row=currencyRow(select,option),fromRow=upper(row?.countryCode);if(/^[A-Z]{2}$/.test(fromRow))return fromRow;
    const direct=upper(option.value);if(/^[A-Z]{2}$/.test(direct))return direct;
    return nameCodeMap().get(lower(text(cleanLabel(option.textContent).split('—')[0])))||'';
  }
  function labelFor(select,option){
    if(!option)return'Select country';
    if(!text(option.value))return cleanLabel(option.textContent)||'Select country';
    const row=currencyRow(select,option);
    if(row)return`${text(row.country)} — ${text(row.currency)} (${text(row.currencyName)})`;
    return text(cleanLabel(option.textContent).split('—')[0])||'Select country';
  }
  function searchFor(select,option){const row=currencyRow(select,option);return [labelFor(select,option),codeFor(select,option),row?.currency,row?.currencyName].filter(Boolean).join(' ');}
  function isCountrySelect(select){
    if(!(select instanceof HTMLSelectElement))return false;
    if(TARGET_IDS.has(select.id)||select.matches(TARGET_SELECTOR))return true;
    const opts=[...select.options].filter(o=>text(o.value));if(opts.length<8)return false;
    const sample=opts.slice(0,100);let hits=0;for(const o of sample)if(codeFor(select,o))hits++;return hits>=Math.max(8,Math.ceil(sample.length*.75));
  }

  function providerCode(code){const iso=upper(code);return FLAG_ALIASES[iso]||iso;}
  function flagSources(code){
    const iso=providerCode(code);if(!/^[A-Z]{2}$/.test(iso))return[];
    return [
      `https://flagcdn.com/w40/${iso.toLowerCase()}.png`,
      `https://flagsapi.com/${iso}/flat/24.png`
    ];
  }
  function flagNode(code){
    const frame=document.createElement('span');frame.className='ar-country-flag124-frame';frame.setAttribute('aria-hidden','true');
    const sources=flagSources(code);
    if(!sources.length){const blank=document.createElement('span');blank.className='ar-country-flag124-blank';frame.append(blank);return frame;}
    const img=document.createElement('img'),fallback=document.createElement('span');
    img.className='ar-country-flag124';img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.dataset.flagSourceIndex='0';img.src=sources[0];
    fallback.className='ar-country-flag124-fallback';fallback.textContent=upper(code)||'—';fallback.hidden=true;
    img.addEventListener('error',()=>{const next=Number(img.dataset.flagSourceIndex||0)+1;if(next<sources.length){img.dataset.flagSourceIndex=String(next);img.src=sources[next];return;}img.hidden=true;fallback.hidden=false;});
    frame.append(img,fallback);return frame;
  }

  function ensurePanel(){
    if(panel?.isConnected)return panel;
    panel=document.createElement('div');panel.id='arCountryPanel124';panel.className='ar-country-panel124';if(supportsPopover)panel.setAttribute('popover','manual');else panel.hidden=true;
    const searchWrap=document.createElement('div');searchWrap.className='ar-country-search-wrap124';
    const search=document.createElement('input');search.type='search';search.className='ar-country-search124';search.placeholder='Search country';search.autocomplete='off';search.spellcheck=false;search.setAttribute('aria-label','Search countries');
    const list=document.createElement('div');list.className='ar-country-list124';list.setAttribute('role','listbox');list.setAttribute('aria-label','Countries');list.tabIndex=0;
    searchWrap.append(search);panel.append(searchWrap,list);document.body.append(panel);
    search.addEventListener('input',renderPanel);search.addEventListener('keydown',onSearchKeydown);
    // v6.3.131 interaction override: make wheel/trackpad scrolling stay inside the country list.
    list.addEventListener('wheel',e=>{if(!panelIsOpen())return;const unit=e.deltaMode===1?18:e.deltaMode===2?Math.max(120,list.clientHeight):1;list.scrollTop+=e.deltaY*unit;e.preventDefault();e.stopPropagation();},{passive:false});
    list.addEventListener('click',e=>e.stopPropagation());
    return panel;
  }
  function panelIsOpen(){return Boolean(panel&&(supportsPopover?panel.matches(':popover-open'):!panel.hidden));}
  function positionPanel(){
    if(!active||!panel||!panelIsOpen())return;const r=active.trigger.getBoundingClientRect(),m=8,vh=window.innerHeight||document.documentElement.clientHeight,below=vh-r.bottom-m,above=r.top-m,up=below<250&&above>below,h=Math.min(390,Math.max(180,(up?above:below)-6)),w=Math.max(240,Math.min(Math.max(r.width,300),620)),left=Math.max(m,Math.min(r.left,window.innerWidth-w-m));
    panel.style.width=`${w}px`;panel.style.maxWidth=`calc(100vw - ${m*2}px)`;panel.style.left=`${left}px`;
    // A definite height is required so the list track shrinks and receives its own scrollbar.
    panel.style.height=`${h}px`;panel.style.maxHeight=`${h}px`;
    if(up){panel.style.top='auto';panel.style.bottom=`${Math.max(m,vh-r.top+2)}px`;}else{panel.style.bottom='auto';panel.style.top=`${Math.min(vh-m,r.bottom+2)}px`;}
  }
  function closePanel(focus=false){if(!panel||!panelIsOpen())return;const old=active;try{if(supportsPopover)panel.hidePopover();else panel.hidden=true;}catch{panel.hidden=true;}active=null;if(old?.trigger){old.trigger.setAttribute('aria-expanded','false');if(focus)old.trigger.focus();}}
  function openPanel(instance){ensurePanel();if(active&&active!==instance)closePanel();active=instance;try{if(supportsPopover)panel.showPopover();else{const host=instance.trigger.closest('dialog[open]')||document.body;if(panel.parentNode!==host)host.append(panel);panel.hidden=false;}}catch{const host=instance.trigger.closest('dialog[open]')||document.body;if(panel.parentNode!==host)host.append(panel);panel.hidden=false;}instance.trigger.setAttribute('aria-expanded','true');const s=panel.querySelector('.ar-country-search124');s.value='';renderPanel();positionPanel();requestAnimationFrame(()=>{panel?.querySelector('.ar-country-list124 [aria-selected="true"]')?.scrollIntoView({block:'nearest'});s.focus();});}
  function rowsFor(instance){return [...instance.select.options].filter(o=>text(o.value)).map(o=>({option:o,value:o.value,code:codeFor(instance.select,o),label:labelFor(instance.select,o),search:searchFor(instance.select,o),disabled:o.disabled}));}
  function renderPanel(){
    if(!active||!panel)return;const q=lower(panel.querySelector('.ar-country-search124').value),list=panel.querySelector('.ar-country-list124'),rows=rowsFor(active).filter(r=>!q||lower(r.search).includes(q));list.replaceChildren();
    if(!rows.length){const e=document.createElement('div');e.className='ar-country-empty124';e.textContent='No matching countries';list.append(e);return;}
    for(const row of rows){const b=document.createElement('button');b.type='button';b.className='ar-country-option124';b.setAttribute('role','option');b.setAttribute('aria-selected',row.value===active.select.value?'true':'false');b.disabled=row.disabled;const label=document.createElement('span');label.className='ar-country-option-label124';label.textContent=row.label;b.append(flagNode(row.code),label);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();choose(active,row.value);});b.addEventListener('keydown',onOptionKeydown);list.append(b);}
  }
  function choose(instance,value){if(!instance)return;const s=instance.select;if(s.value!==value){s.value=value;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));}sync(instance);closePanel(true);}
  function onSearchKeydown(e){if(e.key==='Escape'){e.preventDefault();closePanel(true);}else if(e.key==='ArrowDown'){e.preventDefault();panel?.querySelector('.ar-country-option124:not(:disabled)')?.focus();}}
  function onOptionKeydown(e){const opts=[...panel.querySelectorAll('.ar-country-option124:not(:disabled)')],i=opts.indexOf(e.currentTarget);if(e.key==='ArrowDown'){e.preventDefault();opts[Math.min(opts.length-1,i+1)]?.focus();}else if(e.key==='ArrowUp'){e.preventDefault();if(i<=0)panel.querySelector('.ar-country-search124')?.focus();else opts[i-1]?.focus();}else if(e.key==='Home'){e.preventDefault();opts[0]?.focus();}else if(e.key==='End'){e.preventDefault();opts.at(-1)?.focus();}else if(e.key==='Escape'){e.preventDefault();closePanel(true);}else if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click();}}
  function suppressLegacyPicker(select,replacement){
    if(!(select instanceof HTMLSelectElement))return;
    const legacyNext=select.nextElementSibling?.matches?.('[data-country-flag-picker113]')?select.nextElementSibling:null;
    const legacyStored=select._countryFlagWrapper113?.matches?.('[data-country-flag-picker113]')?select._countryFlagWrapper113:null;
    for(const legacy of new Set([legacyNext,legacyStored].filter(Boolean)))legacy.remove();
    if(replacement?.isConnected)select._countryFlagWrapper113=replacement;
    select.dataset.countryFlagEnhanced120='true';
    select.dataset.countryPickerAuthority124='true';
  }
  function sync(instance){
    if(!instance?.select?.isConnected||!instance.wrapper?.isConnected)return;suppressLegacyPicker(instance.select,instance.wrapper);const selected=instance.select.selectedOptions?.[0]||instance.select.options?.[instance.select.selectedIndex]||null,has=Boolean(selected&&text(selected.value)),code=has?codeFor(instance.select,selected):'',label=has?labelFor(instance.select,selected):instance.placeholder;
    const nextLabel=label||'Select country';if(instance.label.textContent!==nextLabel)instance.label.textContent=nextLabel;if(instance.flag.dataset.countryCode!==code){instance.flag.dataset.countryCode=code;instance.flag.replaceChildren(flagNode(code));}instance.trigger.disabled=instance.select.disabled;instance.trigger.classList.toggle('is-placeholder',!has);instance.wrapper.classList.toggle('is-disabled',instance.select.disabled);instance.wrapper.dataset.countryCode=code;
  }
  function removeCountryEnhancements133(select){
    const legacyNext=select.nextElementSibling?.matches?.('[data-country-flag-picker113]')?select.nextElementSibling:null;
    const legacyStored=select._countryFlagWrapper113?.matches?.('[data-country-flag-picker113]')?select._countryFlagWrapper113:null;
    for(const legacy of new Set([legacyNext,legacyStored].filter(Boolean)))legacy.remove();
    const enhancedNext=select.nextElementSibling?.matches?.('.ar-country-select124')?select.nextElementSibling:null;
    if(enhancedNext)enhancedNext.remove();
    try{select._countryFlagWrapper113=null;}catch{}
  }
  function announceSettingsCountrySelection133(select){
    if(!(select instanceof HTMLSelectElement)||select.id!=='settingsCurrencyCountry')return;
    const option=select.selectedOptions?.[0]||select.options?.[select.selectedIndex]||null,row=currencyRow(select,option);
    const current=document.getElementById('currencyCurrent');
    if(current){
      current.dataset.pendingCountryCurrency133='true';
      current.textContent=row?`Selected: ${text(row.country)} · ${text(row.currency)} (${text(row.currencyName)}). Click Save settings to apply.`:'Choose a country and currency, then click Save settings.';
    }
    const form=document.getElementById('controlSettingsForm'),save=form?.querySelector('.control-form-actions button[type="submit"]');
    if(form)form.classList.add('country-save-pending133');
    if(save&&!select.disabled){save.disabled=false;save.classList.add('country-save-pending133');save.textContent='Save settings';}
  }
  function activateNativeReliableSelect133(select){
    if(!(select instanceof HTMLSelectElement)||!['companyProfileCountry67','settingsCurrencyCountry'].includes(select.id))return false;
    // These two save-critical fields use the browser-native select so clicking an option
    // always commits the underlying value before the application's save handler reads it.
    removeCountryEnhancements133(select);
    select.dataset.countryFlagEnhanced120='true';
    select.dataset.countryPickerAuthority124=select.id==='settingsCurrencyCountry'?'native-settings-133':'native-profile-132';
    select.classList.remove('ar-country-native124');
    if(select.id==='companyProfileCountry67'){
      select.dataset.nativeCountryProfile132='true';
      select.classList.add('ar-country-native-profile132');
    }else{
      select.dataset.nativeCountrySettings133='true';
      select.classList.add('ar-country-native-settings133');
      if(select.dataset.nativeCountrySettingsBound133!=='true'){
        select.dataset.nativeCountrySettingsBound133='true';
        select.addEventListener('change',()=>{announceSettingsCountrySelection133(select);requestAnimationFrame(()=>{const save=document.querySelector('#controlSettingsForm .control-form-actions button[type="submit"]');save?.scrollIntoView?.({block:'nearest',behavior:'smooth'});});});
      }
    }
    // Undo inline hiding applied by older country-picker layers.
    for(const prop of ['position','width','height','padding','margin','border','opacity','pointerEvents','overflow','clip','clipPath','whiteSpace'])select.style[prop]='';
    select.removeAttribute('aria-hidden');
    if(select.tabIndex<0)select.tabIndex=0;
    return true;
  }
  function createInstance(select){
    if(activateNativeReliableSelect133(select))return {select,nativeReliable:true};
    const existing=instances.get(select);if(existing){sync(existing);return existing;}
    const wrapper=document.createElement('div'),trigger=document.createElement('button'),flag=document.createElement('span'),label=document.createElement('span'),chev=document.createElement('span');
    wrapper.className='ar-country-select124';trigger.type='button';trigger.className='ar-country-trigger124';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','arCountryPanel124');flag.className='ar-country-trigger-flag124';label.className='ar-country-trigger-label124';chev.className='ar-country-chevron124';chev.textContent='▾';chev.setAttribute('aria-hidden','true');trigger.append(flag,label,chev);wrapper.append(trigger);
    suppressLegacyPicker(select);const instance={select,wrapper,trigger,flag,label,placeholder:cleanLabel([...select.options].find(o=>!text(o.value))?.textContent||'')||'Select country'};instances.set(select,instance);select.classList.add('ar-country-native124');select.insertAdjacentElement('afterend',wrapper);suppressLegacyPicker(select,wrapper);
    trigger.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(select.disabled)return;if(active===instance&&panelIsOpen())closePanel();else openPanel(instance);});trigger.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();openPanel(instance);}else if(e.key==='Escape')closePanel(true);});select.addEventListener('input',()=>sync(instance));select.addEventListener('change',()=>sync(instance));
    const observer=new MutationObserver(()=>{sync(instance);if(active===instance&&panelIsOpen())renderPanel();});observer.observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected','value']});instance.observer=observer;sync(instance);return instance;
  }
  function scan(root=document){const candidates=[];if(root instanceof HTMLSelectElement)candidates.push(root);if(root?.querySelectorAll)candidates.push(...root.querySelectorAll('select'));let count=0;for(const select of candidates){if(isCountrySelect(select)){createInstance(select);count++;}}return count;}
  function queueScan(){if(scanQueued)return;scanQueued=true;queueMicrotask(()=>{scanQueued=false;scan(document);});}
  document.addEventListener('click',e=>{if(active&&panelIsOpen()&&!panel.contains(e.target)&&!active.wrapper.contains(e.target))closePanel();},true);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active)closePanel(true);});window.addEventListener('resize',positionPanel,{passive:true});window.addEventListener('scroll',positionPanel,{passive:true,capture:true});
  const domObserver=new MutationObserver(records=>{if(records.some(r=>r.type==='childList'&&r.addedNodes.length))queueScan();});
  function start(){ensurePanel();scan(document);domObserver.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>scan(document),120);setTimeout(()=>scan(document),700);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  window.AssuranceRegentCountrySelect={schema:SCHEMA,interactionFix:INTERACTION_FIX,wheelScrollable:true,clickSelectable:true,nativeProfileCountryControl:true,nativeProfileScrollAndSelection:true,nativeSettingsCountryControl:true,nativeSettingsSelectionCommits:true,saveSettingsPrompt:true,imageBacked:true,linkedPngFlags:true,primaryFlagSource:'flagcdn.com',secondaryFlagSource:'flagsapi.com',providerFailover:true,selectedFlagVisible:true,everyOptionFlagVisible:true,nativeSelectSynchronized:true,searchable:true,compactReferenceStyle:true,singleVisibleControl:true,legacyPickerSuppressed:true,modalTopLayerDropdown:supportsPopover,refresh:()=>scan(document)};
})();
