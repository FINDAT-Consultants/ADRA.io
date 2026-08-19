  /* Assurance Regent v6.3.107 — force visible Recruiting Selections tab START */
  const RECRUITMENT_SELECTIONS_VISIBLE_SCHEMA107='6.3.107';

  function ensureRecruitSelectionsVisible107(){
    const tabs=$('recruitTabs');
    if(!tabs)return false;
    const analytics=tabs.querySelector('[data-recruit-tab="analytics"]');
    let button=tabs.querySelector('[data-recruit-tab="selections"]');
    if(!button){button=document.createElement('button');button.type='button';button.dataset.recruitTab='selections';}
    const countValue=String($('recruitSelectionCount')?.textContent||selectionRows105().filter(selectionActive105).length||0);
    button.hidden=false;button.removeAttribute('hidden');button.removeAttribute('aria-hidden');button.style.display='inline-flex';button.style.visibility='visible';button.style.opacity='1';button.style.pointerEvents='auto';button.style.minWidth='96px';button.style.alignItems='center';button.style.justifyContent='center';button.style.gap='4px';
    if(!button.textContent?.trim().toLowerCase().startsWith('selections')){
      button.replaceChildren(document.createTextNode('Selections '));const count=document.createElement('span');count.id='recruitSelectionCount';count.textContent=countValue;button.appendChild(count);
    }else{
      const count=button.querySelector('#recruitSelectionCount');if(count&&count.textContent!==countValue)count.textContent=countValue;
    }
    if(analytics&&button.nextElementSibling!==analytics)tabs.insertBefore(button,analytics);else if(!button.parentNode)tabs.appendChild(button);

    let panel=$('recruitPanelSelections');
    const analyticsPanel=$('recruitPanelAnalytics');
    if(!panel){
      panel=document.createElement('div');panel.className='recruit-tab-panel';panel.id='recruitPanelSelections';panel.innerHTML='<section class="panel recruit-selection-panel"><div class="panel-head"><div><span class="section-kicker">Human Resources decision</span><h3>Selections</h3><p>Review applicant performance and advisory scores, tick the candidates HR selects, then communicate or transfer them to Onboarding. Scores never select a candidate automatically.</p></div><div class="recruit-selection-actions"><button class="btn small secondary" id="recruitSelectionsEmail" type="button">✉ Send email</button><button class="btn small secondary" id="recruitSelectionsWhatsApp" type="button">◉ Send WhatsApp</button><button class="btn small primary" id="recruitSelectionsOnboarding" type="button">↗ Send to Onboarding</button></div></div><div class="recruit-selection-summary"><span id="recruitSelectionSummary">0 selected · HR makes the final selection decision</span><b>Job-related evidence only</b></div><div class="recruit-selection-delivery" id="recruitSelectionDelivery" hidden></div><div class="table-wrap tall"><table id="recruitSelectionsTable"></table></div></section>';
      if(analyticsPanel?.parentNode)analyticsPanel.parentNode.insertBefore(panel,analyticsPanel);
    }else if(analyticsPanel&&panel.nextElementSibling!==analyticsPanel){analyticsPanel.parentNode?.insertBefore(panel,analyticsPanel);}
    return true;
  }

  const renderRecruitingBeforeVisible107=renderRecruiting;
  renderRecruiting=function(){ensureRecruitSelectionsVisible107();renderRecruitingBeforeVisible107();ensureRecruitSelectionsVisible107();if(state.recruitTab==='selections')renderRecruitSelections105();};
  const installSelectionsVisible107=()=>{if(!ensureRecruitSelectionsVisible107())return;const tabs=$('recruitTabs');if(tabs&&!tabs.dataset.selectionsVisibleObserver107){tabs.dataset.selectionsVisibleObserver107='1';let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;ensureRecruitSelectionsVisible107();});}).observe(tabs,{childList:true,subtree:true,characterData:true});}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installSelectionsVisible107,{once:true});else installSelectionsVisible107();
  setTimeout(installSelectionsVisible107,250);setTimeout(installSelectionsVisible107,1200);
  window.AssuranceRegentRecruitmentSelectionsVisible={schema:RECRUITMENT_SELECTIONS_VISIBLE_SCHEMA107,forceVisible:true,placement:'before-analytics',runtimeRecovery:true};
  /* Assurance Regent v6.3.107 — force visible Recruiting Selections tab END */
