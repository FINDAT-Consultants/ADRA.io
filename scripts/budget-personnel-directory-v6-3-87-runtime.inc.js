  /* Assurance Regent v6.3.87 — unified budget personnel directory + safe template START */
  const BUDGET_PERSONNEL_SCHEMA87='6.3.87';

  downloadBudgetTemplate86=async function(button){
    budgetImportButtonBusy86(button,true,'Preparing…');
    budgetImportRefreshStatus86('Preparing Excel template…');
    try{
      if(!budgetImportBundle85)await loadBudgetImport85(true);
      const bundle=budgetImportBundle85||{},personnel=Array.isArray(bundle.personnelDirectory)?bundle.personnelDirectory:[];
      const XLSX=await ensureBudgetXlsx85(),wb=XLSX.utils.book_new(),currency=activeCurrency()||'USD',today=new Date().toISOString().slice(0,10);
      const directoryRows=[['Employee ID','Name','Position','System Role','Budget Category','Status'],...personnel.map(p=>[
        String(p?.employeeId||''),
        String(p?.name||''),
        String(p?.position||''),
        String(p?.systemRole||''),
        'EMPLOYEE',
        p?.active===false?'Inactive':'Active'
      ])];
      const sheets={
        'Instructions':[
          ['Assurance Regent Budget & Donor Import'],
          ['Use Employee ID values from the Personnel Directory sheet.'],
          ['Country Director, HR, Finance, managers, executives, supervisors and ordinary employees are budget personnel.'],
          ['The platform Developer account is excluded from budget personnel.'],
          ['Complete the Project Budget, Personnel Rates and Donor Rules sheets before uploading.'],
          ['Do not rename the required sheets or column headings.']
        ],
        'Metadata':[['Key','Value'],['Version Label',`Budget ${new Date().getUTCFullYear()}`],['Currency',currency],['Effective From',today],['Effective To','']],
        'Personnel Directory':directoryRows,
        'Project Budget':[['Project Code','Project Name','Donor','Currency','Personnel Budget','Effective From','Effective To']],
        'Personnel Rates':[['Employee ID','Project Code','Hourly Rate','Currency','Effective From','Effective To']],
        'Donor Rules':[['Donor','Project Code','Rule Key','Numeric Value','Text Value','Effective From','Effective To']]
      };
      for(const [name,rows] of Object.entries(sheets)){
        const sheet=XLSX.utils.aoa_to_sheet(rows);
        if(name==='Personnel Directory')sheet['!cols']=[{wch:18},{wch:28},{wch:28},{wch:20},{wch:18},{wch:12}];
        XLSX.utils.book_append_sheet(wb,sheet,name);
      }
      XLSX.writeFile(wb,'Assurance_Regent_Budget_Donor_Import_Template.xlsx');
      budgetImportRefreshStatus86(`Template downloaded · ${personnel.length} personnel ID${personnel.length===1?'':'s'} included.`);
    }catch(err){
      budgetImportRefreshStatus86('Template download failed.');
      toast(err?.message||String(err));
    }finally{
      budgetImportButtonBusy86(button,false);
    }
  };
  /* Assurance Regent v6.3.87 — unified budget personnel directory + safe template END */