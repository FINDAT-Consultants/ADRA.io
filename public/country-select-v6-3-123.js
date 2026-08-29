/* Assurance Regent v6.3.123 — unified image-backed country selectors */
(() => {
  'use strict';

  const SCHEMA = '6.3.123';
  const TARGET_IDS = new Set([
    'newCompanyCountry',
    'companyExecutiveCountry',
    'companyProfileCountry67',
    'settingsCurrencyCountry'
  ]);
  const TARGET_SELECTOR = '[data-company-registered-country]';
  const instances = new WeakMap();
  const FLAG_ALIASES = Object.freeze({ AC: 'sh', DG: 'io', EA: 'es', IC: 'es' });
  const PANEL_ID = 'arCountryPanel123';
  let panel = null;
  let active = null;
  let scanQueued = false;

  const text = (value) => String(value ?? '').trim();
  const upper = (value) => text(value).toUpperCase();
  const lower = (value) => text(value).toLowerCase();

  function catalogue() {
    return Array.isArray(window.ADRA_CURRENCIES) ? window.ADRA_CURRENCIES : [];
  }

  function cleanLabel(value) {
    const raw = text(value);
    const chars = Array.from(raw);
    const regional = (ch) => {
      const cp = ch?.codePointAt?.(0) || 0;
      return cp >= 0x1F1E6 && cp <= 0x1F1FF;
    };
    if (chars.length >= 2 && regional(chars[0]) && regional(chars[1])) {
      return chars.slice(2).join('').trim();
    }
    return raw.replace(/^🏳️\s*/u, '').trim();
  }

  function countryNameMap() {
    const map = new Map();
    for (const row of catalogue()) {
      const code = upper(row?.countryCode);
      const name = lower(row?.country);
      if (/^[A-Z]{2}$/.test(code) && name && !map.has(name)) map.set(name, code);
    }
    return map;
  }

  function currencyRowForOption(select, option) {
    if (!select || !option) return null;
    if (select.id === 'settingsCurrencyCountry' && /^\d+$/.test(text(option.value))) {
      return catalogue()[Number(option.value)] || null;
    }
    return null;
  }

  function codeForOption(select, option) {
    if (!option || !text(option.value)) return '';
    const currencyRow = currencyRowForOption(select, option);
    if (currencyRow) {
      const code = upper(currencyRow.countryCode);
      if (/^[A-Z]{2}$/.test(code)) return code;
    }
    const direct = upper(option.value);
    if (/^[A-Z]{2}$/.test(direct)) return direct;
    const label = cleanLabel(option.textContent);
    const country = text(label.split('—')[0]);
    return countryNameMap().get(lower(country)) || '';
  }

  function countryNameForOption(select, option) {
    const currencyRow = currencyRowForOption(select, option);
    if (currencyRow?.country) return text(currencyRow.country);
    return text(cleanLabel(option?.textContent || '').split('—')[0]) || 'Select country';
  }

  function displayLabelForOption(select, option) {
    if (!option || !text(option.value)) return cleanLabel(option?.textContent || '') || 'Select country';
    const currencyRow = currencyRowForOption(select, option);
    if (currencyRow) {
      return `${text(currencyRow.country)} — ${text(currencyRow.currency)} (${text(currencyRow.currencyName)})`;
    }
    return countryNameForOption(select, option);
  }

  function searchTextForOption(select, option) {
    const currencyRow = currencyRowForOption(select, option);
    return [
      displayLabelForOption(select, option),
      countryNameForOption(select, option),
      codeForOption(select, option),
      currencyRow?.currency,
      currencyRow?.currencyName
    ].filter(Boolean).join(' ');
  }

  function isCountrySelect(select) {
    if (!(select instanceof HTMLSelectElement)) return false;
    if (TARGET_IDS.has(select.id) || select.matches(TARGET_SELECTOR)) return true;
    const options = [...select.options].filter((option) => text(option.value));
    if (options.length < 8) return false;
    let hits = 0;
    const sample = options.slice(0, 100);
    for (const option of sample) if (codeForOption(select, option)) hits += 1;
    return hits >= Math.max(8, Math.ceil(sample.length * 0.75));
  }

  function flagUrl(code) {
    const iso = upper(code);
    const mapped = FLAG_ALIASES[iso] || lower(iso);
    return /^[a-z]{2}$/.test(mapped) ? `https://flagcdn.com/w40/${mapped}.png` : '';
  }

  function flagNode(code, className = 'ar-country-flag123') {
    const frame = document.createElement('span');
    frame.className = `${className}-frame`;
    frame.setAttribute('aria-hidden', 'true');
    const url = flagUrl(code);
    if (!url) {
      const blank = document.createElement('span');
      blank.className = `${className}-blank`;
      frame.append(blank);
      return frame;
    }
    const image = document.createElement('img');
    image.className = className;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.src = url;
    const fallback = document.createElement('span');
    fallback.className = `${className}-fallback`;
    fallback.textContent = upper(code) || '—';
    fallback.hidden = true;
    image.addEventListener('error', () => {
      image.hidden = true;
      fallback.hidden = false;
    }, { once: true });
    frame.append(image, fallback);
    return frame;
  }

  function ensurePanel() {
    if (panel?.isConnected) return panel;
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'ar-country-panel123';
    panel.hidden = true;
    panel.setAttribute('role', 'presentation');

    const searchWrap = document.createElement('div');
    searchWrap.className = 'ar-country-search-wrap123';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'ar-country-search123';
    search.placeholder = 'Search country';
    search.autocomplete = 'off';
    search.spellcheck = false;
    search.setAttribute('aria-label', 'Search countries');
    searchWrap.append(search);

    const list = document.createElement('div');
    list.className = 'ar-country-list123';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Countries');

    panel.append(searchWrap, list);
    document.body.append(panel);
    search.addEventListener('input', renderPanel);
    search.addEventListener('keydown', onSearchKeydown);
    return panel;
  }

  function positionPanel() {
    if (!active || !panel || panel.hidden) return;
    const rect = active.trigger.getBoundingClientRect();
    const margin = 8;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const below = viewportHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const openAbove = below < 250 && above > below;
    const height = Math.min(390, Math.max(180, (openAbove ? above : below) - 6));
    const width = Math.max(240, Math.min(Math.max(rect.width, 300), 620));
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));

    panel.style.width = `${width}px`;
    panel.style.maxWidth = `calc(100vw - ${margin * 2}px)`;
    panel.style.left = `${left}px`;
    panel.style.maxHeight = `${height}px`;
    if (openAbove) {
      panel.style.top = 'auto';
      panel.style.bottom = `${Math.max(margin, viewportHeight - rect.top + 2)}px`;
    } else {
      panel.style.bottom = 'auto';
      panel.style.top = `${Math.min(viewportHeight - margin, rect.bottom + 2)}px`;
    }
  }

  function closePanel({ focus = false } = {}) {
    if (!panel || panel.hidden) return;
    const previous = active;
    panel.hidden = true;
    active = null;
    if (previous?.trigger) {
      previous.trigger.setAttribute('aria-expanded', 'false');
      if (focus) previous.trigger.focus();
    }
  }

  function openPanel(instance) {
    ensurePanel();
    if (active && active !== instance) closePanel();
    active = instance;
    panel.hidden = false;
    instance.trigger.setAttribute('aria-expanded', 'true');
    const search = panel.querySelector('.ar-country-search123');
    search.value = '';
    renderPanel();
    positionPanel();
    requestAnimationFrame(() => search.focus());
  }

  function rowsFor(instance) {
    return [...instance.select.options]
      .filter((option) => text(option.value))
      .map((option) => ({
        option,
        value: option.value,
        code: codeForOption(instance.select, option),
        label: displayLabelForOption(instance.select, option),
        country: countryNameForOption(instance.select, option),
        search: searchTextForOption(instance.select, option),
        disabled: option.disabled
      }));
  }

  function renderPanel() {
    if (!active || !panel) return;
    const search = panel.querySelector('.ar-country-search123');
    const list = panel.querySelector('.ar-country-list123');
    const query = lower(search.value);
    const rows = rowsFor(active).filter((row) => !query || lower(row.search).includes(query));
    list.replaceChildren();

    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'ar-country-empty123';
      empty.textContent = 'No matching countries';
      list.append(empty);
      return;
    }

    for (const row of rows) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ar-country-option123';
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', row.value === active.select.value ? 'true' : 'false');
      button.dataset.value = row.value;
      button.disabled = row.disabled;

      const label = document.createElement('span');
      label.className = 'ar-country-option-label123';
      label.textContent = row.label;
      button.append(flagNode(row.code), label);

      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        chooseValue(active, row.value);
      });
      button.addEventListener('keydown', onOptionKeydown);
      list.append(button);
    }

    const selected = list.querySelector('[aria-selected="true"]');
    if (selected) requestAnimationFrame(() => selected.scrollIntoView({ block: 'nearest' }));
  }

  function chooseValue(instance, value) {
    if (!instance) return;
    const select = instance.select;
    if (select.value !== value) {
      select.value = value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    syncInstance(instance);
    closePanel({ focus: true });
  }

  function onSearchKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel({ focus: true });
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      panel?.querySelector('.ar-country-option123:not(:disabled)')?.focus();
    }
  }

  function onOptionKeydown(event) {
    const options = [...panel.querySelectorAll('.ar-country-option123:not(:disabled)')];
    const index = options.indexOf(event.currentTarget);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      options[Math.min(options.length - 1, index + 1)]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index <= 0) panel.querySelector('.ar-country-search123')?.focus();
      else options[index - 1]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      options[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      options.at(-1)?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closePanel({ focus: true });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.currentTarget.click();
    }
  }

  function syncInstance(instance) {
    if (!instance?.select?.isConnected || !instance.wrapper?.isConnected) return;
    const selected = instance.select.selectedOptions?.[0] || instance.select.options?.[instance.select.selectedIndex] || null;
    const hasValue = Boolean(selected && text(selected.value));
    const code = hasValue ? codeForOption(instance.select, selected) : '';
    const label = hasValue ? displayLabelForOption(instance.select, selected) : instance.placeholder;
    instance.label.textContent = label || 'Select country';
    instance.flag.replaceChildren(flagNode(code));
    instance.trigger.disabled = instance.select.disabled;
    instance.trigger.classList.toggle('is-placeholder', !hasValue);
    instance.wrapper.classList.toggle('is-disabled', instance.select.disabled);
    instance.wrapper.dataset.countryCode = code;
  }

  function createInstance(select) {
    const existing = instances.get(select);
    if (existing) {
      syncInstance(existing);
      return existing;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'ar-country-select123';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'ar-country-trigger123';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', PANEL_ID);

    const flag = document.createElement('span');
    flag.className = 'ar-country-trigger-flag123';
    const label = document.createElement('span');
    label.className = 'ar-country-trigger-label123';
    const chevron = document.createElement('span');
    chevron.className = 'ar-country-chevron123';
    chevron.textContent = '▾';
    chevron.setAttribute('aria-hidden', 'true');
    trigger.append(flag, label, chevron);
    wrapper.append(trigger);

    const placeholder = cleanLabel([...select.options].find((option) => !text(option.value))?.textContent || '') || 'Select country';
    const instance = { select, wrapper, trigger, flag, label, placeholder };
    instances.set(select, instance);

    select.classList.add('ar-country-native123');
    select.insertAdjacentElement('afterend', wrapper);

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (select.disabled) return;
      if (active === instance && panel && !panel.hidden) closePanel();
      else openPanel(instance);
    });
    trigger.addEventListener('keydown', (event) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openPanel(instance);
      } else if (event.key === 'Escape') {
        closePanel({ focus: true });
      }
    });
    select.addEventListener('input', () => syncInstance(instance));
    select.addEventListener('change', () => syncInstance(instance));

    const selectObserver = new MutationObserver(() => {
      syncInstance(instance);
      if (active === instance && panel && !panel.hidden) renderPanel();
    });
    selectObserver.observe(select, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'selected', 'value']
    });
    instance.selectObserver = selectObserver;
    syncInstance(instance);
    return instance;
  }

  function scan(root = document) {
    const candidates = [];
    if (root instanceof HTMLSelectElement) candidates.push(root);
    if (root?.querySelectorAll) candidates.push(...root.querySelectorAll('select'));
    let enhanced = 0;
    for (const select of candidates) {
      if (!isCountrySelect(select)) continue;
      createInstance(select);
      enhanced += 1;
    }
    return enhanced;
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    queueMicrotask(() => {
      scanQueued = false;
      scan(document);
    });
  }

  document.addEventListener('click', (event) => {
    if (!active || !panel || panel.hidden) return;
    if (panel.contains(event.target) || active.wrapper.contains(event.target)) return;
    closePanel();
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && active) closePanel({ focus: true });
  });
  window.addEventListener('resize', positionPanel, { passive: true });
  window.addEventListener('scroll', positionPanel, { passive: true, capture: true });

  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === 'childList' && record.addedNodes.length)) queueScan();
  });

  function start() {
    ensurePanel();
    scan(document);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => scan(document), 120);
    setTimeout(() => scan(document), 600);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.AssuranceRegentCountrySelect = Object.freeze({
    schema: SCHEMA,
    imageBacked: true,
    nativeSelectSynchronized: true,
    selectedFlagVisible: true,
    everyOptionFlagVisible: true,
    compactReferenceStyle: true,
    searchable: true,
    dynamicSelects: true,
    currencyLabelsPreserved: true,
    targetIds: [...TARGET_IDS],
    refresh: () => scan(document)
  });
})();
