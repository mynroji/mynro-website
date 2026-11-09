'use strict';

const currency = 'INR';

const services = [
  ['Instagram Reels / YouTube Shorts', 'Fast-moving vertical edits with captions and pacing built around the hook.'],
  ['YouTube Long Videos', 'Story structure, clean audio and pacing for longer videos.'],
  ['Cinematic Editing', 'Sequence building, sound design and rhythm for narrative footage.'],
  ['Brand & Commercial Ads', 'Campaign edits shaped around a brief, audience and delivery format.'],
  ['Color Grading', 'Shot matching and a cohesive look designed for the story.']
];

const stages = ['Briefing', 'Editing', 'Review', 'Delivered'];
const leadStages = ['New', 'Contacted', 'Quoted', 'Won', 'Lost'];
const tabNames = {dashboard:'Overview', leads:'Leads', projects:'Projects', quotes:'Quotes', finance:'Payments & expenses', settings:'Studio settings'};
const blank = {leads:[], projects:[], quotes:[], payments:[], expenses:[], editors:['Editor 1','Editor 2','Editor 3']};
const key = 'mynro-private-studio-v1';
const $ = (id) => document.getElementById(id);
let state = structuredClone(blank);
let storageIssue = false;
try {
  state = {...state, ...JSON.parse(localStorage.getItem(key) || '{}')};
} catch {
  storageIssue = true;
}
let tab = 'dashboard';
let period = 'Week';
let leadFilter = 'All';
let leadSearch = '';
let quoteDraft = null;
let quoteLines = [];
let toastTimer;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

function money(value) {
  return new Intl.NumberFormat('en-IN',{style:'currency',currency:currency,maximumFractionDigits:2}).format(value);
}

function dateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}

function dateLabel(value) {
  if (!value) return '—';
  return new Date(value + 'T12:00:00').toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'});
}

function id() {
  return globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function toast(message) {
  $('toast').textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').textContent = '', 4200);
}

function commit(next, message) {
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    toast('Could not save records in this browser.');
    return false;
  }
  state = next;
  if (message) toast(message);

  return true;
}

function upsert(collection, record) {
  const records = state[collection];
  return commit({...state,[collection]:records.some(r => r.id === record.id)
    ? records.map(r => r.id === record.id ? record : r)
    : [...records, record]}, 'Saved');
}

function amountSum(records) {
  return Math.round(records.reduce((sum, record) => sum + Number(record.amount), 0) * 100) / 100;
}

function paymentTotal(projectId) {
  return amountSum(state.payments.filter(p => p.project === projectId));
}

function balance(project) {
  return Math.max(0, Math.round((project.budget - paymentTotal(project.id))*100)/100);
}

function paymentStatus(project) {
  if (project.budget <= 0) return 'Unpriced';
  if (!balance(project)) return 'Paid';
  return paymentTotal(project.id) ? 'Part paid' : 'Unpaid';
}

const action = (label, name, value = '', primary = false) => '<button type="button" class="'+(primary?'solid':'outline')+'" data-action="'+name+'" data-id="'+esc(value)+'">'+esc(label)+'</button>';
const tag = (value) => '<span class="tag">'+esc(value)+'</span>';
const metric = (label,value) => '<div class="metric"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';
const empty = (message) => '<p class="empty">'+esc(message)+'</p>';
const input = (name,label,value='',type='text',extra='') => '<label class="field">'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const select = (name,label,value,options,extra='') => '<label class="field">'+esc(label)+'<select name="'+name+'" '+extra+'>'+options.map(option => {
  const [val, text] = Array.isArray(option) ? option : [option,option];
  return '<option value="'+esc(val)+'" '+(String(val) === String(value) ? 'selected':'')+'>'+esc(text)+'</option>';
}).join('')+'</select></label>';
const notes = (label,value) => '<label class="field">'+esc(label)+'<textarea name="notes">'+esc(value)+'</textarea></label>';
const head = (title, desc, controls='') => '<div class="panel-head"><div><div class="label"><i></i> MYNRO / OPERATIONS</div><h1>'+esc(title)+'</h1><p>'+esc(desc)+'</p></div><div class="actions">'+controls+'</div></div>';
const edit = (collection, record) => action('Edit','edit:'+collection,record.id);
const projectName = (projectId) => state.projects.find(p => p.id === projectId)?.name || 'Studio overhead';
const projectOptions = (allowBlank) => [...(allowBlank?[['','Studio overhead']]:[]),...state.projects.map(p => [p.id,p.name])];
const numeric = 'min="0" max="999999999" step="0.01" required';

function table(headers, rows, message) {
  if (!rows.length) return '<div class="box">'+empty(message)+'</div>';
  return '<div class="table-wrap"><table><thead><tr>'+headers.map(h => '<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row => '<tr>'+row.map(cell => '<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}

function dashboard() {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);
  if (period === 'Week') {
    start.setDate(start.getDate()-(start.getDay()+6)%7);
    end.setTime(start.getTime());
    end.setDate(end.getDate()+7);
  } else {
    start.setDate(1);
    end.setDate(1);
    end.setMonth(end.getMonth()+1);
  }
  const inPeriod = (record) => record.date >= dateKey(start) && record.date < dateKey(end);
  const received = amountSum(state.payments.filter(inPeriod));
  const spent = amountSum(state.expenses.filter(inPeriod));
  const outstanding = state.projects.reduce((sum,p) => sum + balance(p), 0);
  const active = state.projects.filter(p => p.stage !== 'Delivered');
  const scale = Math.max(received,spent,1);
  end.setDate(end.getDate()-1);
  return head('Studio overview','Track your workload and cash flow.',action('New project','edit:projects','',true))
    + '<div class="tabs-inline">'+['Week','Month'].map(value => '<button type="button" class="outline '+(period===value?'active':'')+'" aria-pressed="'+(period===value)+'" data-action="period" data-id="'+value+'">This '+value.toLowerCase()+'</button>').join('')+'</div>'
    + '<p class="muted">'+dateLabel(dateKey(start))+' – '+dateLabel(dateKey(end))+' · Cash basis</p>'
    + '<div class="metrics">'+metric('Payments received',money(received))+metric('Expenses',money(spent))+metric('Net cash profit',money(received-spent))+metric('Outstanding · all time',money(outstanding))+'</div>'
    + '<div class="split"><div class="box"><h2>Cash flow</h2><div>Payments · '+money(received)+'</div><div class="meter"><i style="width:'+100*received/scale+'%"></i></div><div>Expenses · '+money(spent)+'</div><div class="meter alt"><i style="width:'+100*spent/scale+'%"></i></div></div>'
    + '<div class="box"><h2>Active work</h2><p>'+active.length+' active projects · '+state.leads.filter(l => !['Won','Lost'].includes(l.stage)).length+' open leads</p>'+state.editors.map((name,i) => name ? '<div>'+esc(name)+' · '+active.filter(p => p.editor===String(i)).length+' assigned</div>' : '').join('')+'</div></div>';
}

function leads() {
  return head('Client leads','Track inquiries from first contact through booking.',action('Add lead','edit:leads','',true))
    + '<div class="split">'+input('lead-search','Search leads',leadSearch,'search')+select('lead-filter','Filter by status',leadFilter,['All',...leadStages])+'</div><div id="lead-results"></div>';
}

function showLeadResults() {
  const query = leadSearch.toLowerCase().trim();
  const rows = state.leads.filter(l => (leadFilter === 'All' || l.stage === leadFilter) && [l.name,l.contact,l.service].join(' ').toLowerCase().includes(query));
  $('lead-results').innerHTML = table(['Client','Contact','Service','Status','Follow-up',''], rows.map(l => [
    esc(l.name),esc(l.contact || '—'),esc(l.service),tag(l.stage),dateLabel(l.followup),edit('leads',l)+(l.stage==='Won' && !state.projects.some(p=>p.lead===l.id) ? ' '+action('Create project','lead-project',l.id) : '')
  ]), 'No matching leads. Add an inquiry to get started.');
}

function projects() {
  return head('Project pipeline','Open a card to change its stage, assign an editor or update the due date.',action('Add project','edit:projects','',true))
    + '<div class="boards">'+stages.map(stage => {
      const items = state.projects.filter(p => p.stage === stage);
      return '<div class="lane"><h3>'+stage+' <span class="tag">'+items.length+'</span></h3>'+ (items.length ? items.map(p => '<button type="button" class="job" data-action="edit:projects" data-id="'+esc(p.id)+'"><strong>'+esc(p.name)+'</strong><small>'+esc(p.client)+'</small><small>'+esc(state.editors[p.editor] || 'Unassigned')+' · '+dateLabel(p.due)+'</small></button>').join('') : empty('No projects'))+'</div>';
    }).join('')+'</div>';
}

function finance() {
  return head('Payments & expenses','Track incoming payments, balances due and studio costs.', action('Log expense','edit:expenses')+action('Log payment','edit:payments','',true))
    + '<div class="stack"><div><h2>Project balances</h2>'+table(['Project','Quoted','Received','Balance','Status'],state.projects.map(p=>[esc(p.name),money(p.budget),money(paymentTotal(p.id)),money(balance(p)),tag(paymentStatus(p))]),'Add a project to track its balance.')+'</div>'
    + '<div><h2>Payments received</h2>'+table(['Date','Project','Amount','Reference',''],[...state.payments].reverse().map(p=>[dateLabel(p.date),esc(projectName(p.project)),money(p.amount),esc(p.label || '—'),edit('payments',p)]),'No payments recorded.')+'</div>'
    + '<div><h2>Expenses</h2>'+table(['Date','Expense','Project','Amount',''],[...state.expenses].reverse().map(e=>[dateLabel(e.date),esc(e.label),esc(projectName(e.project)),money(e.amount),edit('expenses',e)]),'No expenses recorded.')+'</div></div>';
}

function quoteTotal(lines) {
  return lines.reduce((sum,line) => sum + Math.round(Number(line.qty)*Number(line.rate)*100),0)/100;
}

function quotes() {
  return head('Custom quotes','Price each deliverable against the scope of the project.',action('New quote','quote-new','',true))
    + '<div id="quote-builder"></div><h2>Saved quotes</h2>'+table(['Project','Client','Total',''],[...state.quotes].reverse().map(q=>[
      esc(q.name),esc(q.client),money(quoteTotal(q.lines)), action('Open','quote-open',q.id)+' '+action('Copy','quote-copy',q.id)+' '+action(state.projects.some(p=>p.quote===q.id) ? 'Update project' : 'Create project','quote-project',q.id)
    ]),'No saved quotes.');
}

function renderQuote() {
  if (!quoteDraft) return;
  $('quote-builder').innerHTML = '<form id="quote-form" class="box"><h2>'+ (quoteDraft.id?'Edit quote':'New quote')+'</h2><div class="split">'
    + input('name','Project name',quoteDraft.name,'text','required')+input('client','Client',quoteDraft.client,'text','required')+'</div>'
    + '<div id="quote-lines"></div>'+action('Add line','quote-line')+notes('Scope, turnaround and terms',quoteDraft.notes)
    + '<div class="panel-head"><strong>Total <span id="quote-total"></span></strong><div class="actions"><button class="solid" type="submit">Save quote</button>'+action('Close','quote-close')+'</div></div></form>';
  renderLines();
}

function renderLines() {
  $('quote-lines').innerHTML = quoteLines.map((line,i) => '<div class="line-item">'
    + input('line','Deliverable',line.label,'text','required')
    + input('qty','Qty',line.qty,'number','min="1" max="999999" step="1" required')
    + input('rate','Rate ('+currency+')',line.rate,'number',numeric)
    + '<button type="button" class="icon" aria-label="Remove line '+(i+1)+'" data-action="quote-remove" data-id="'+i+'" '+(quoteLines.length===1?'disabled':'')+'>×</button></div>').join('');
  $('quote-total').textContent = money(quoteTotal(quoteLines));
}

function readQuote() {
  const form = $('quote-form');
  if (!form) return;
  const data = new FormData(form);
  for (const field of ['name','client','notes']) quoteDraft[field] = String(data.get(field)).trim();
  quoteLines = data.getAll('line').map((label,i) => ({label:label.trim(),qty:data.getAll('qty')[i],rate:data.getAll('rate')[i]}));
  $('quote-total').textContent = money(quoteTotal(quoteLines));
}

function settings() {
  return head('Studio settings','Name the editors you assign to projects.')
    + '<form id="settings-form" class="box"><h2>Editor roster</h2><p class="muted">Set two or three editor names. Assignments follow the roster slot.</p><div class="split">'
    + state.editors.map((editor,i)=>input('editor'+i,'Editor '+(i+1),editor,'text',i<2?'required':'')).join('')
    + '</div><button class="solid" type="submit">Save settings</button></form>';
}

function renderStudio() {
  $('tabs').innerHTML = Object.entries(tabNames).map(([value,label]) => '<button type="button" data-action="tab" data-id="'+value+'" class="'+(value===tab?'active':'')+'" '+(value===tab?'aria-current="page"':'')+'>'+label+'</button>').join('');
  $('panel').innerHTML = ({dashboard,leads,projects,quotes,finance,settings})[tab]();
  if (tab==='leads') showLeadResults();
  if (tab==='quotes') renderQuote();
}

function route() {
  const next = location.hash.slice(1).split('/')[1];
  tab = Object.hasOwn(tabNames,next) ? next : 'dashboard';
  renderStudio();
  window.scrollTo(0,0);
}

let editing;
function openRecord(collection, recordId, preset = {}) {
  const old = state[collection].find(r=>r.id===recordId);
  const record = old || preset;
  const labels = {leads:'lead',projects:'project',payments:'payment',expenses:'expense'};
  if (collection==='payments' && !state.projects.length) {
    toast('Add a project before logging a payment.');
    return;
  }
  editing = {collection, old, preset};
  $('dialog-title').textContent = (old?'Edit ':'Add ')+labels[collection];
  let fields;
  if (collection==='leads') {
    fields = input('name','Client name',record.name,'text','required')+input('contact','Email or phone',record.contact)
      + select('service','Service',record.service,services.map(s=>s[0]))+select('stage','Status',record.stage,leadStages)
      + input('followup','Follow-up date',record.followup,'date')+notes('Notes',record.notes);
  } else if (collection==='projects') {
    fields = input('name','Project name',record.name,'text','required')+input('client','Client',record.client,'text','required')
      + select('stage','Stage',record.stage,stages)+select('editor','Editor',record.editor,[['','Unassigned'],...state.editors.flatMap((name,i)=>name?[[String(i),name]]:[])])
      + input('due','Due date',record.due,'date')+input('budget','Project total ('+currency+')',record.budget ?? 0,'number',numeric)+notes('Scope / notes',record.notes);
  } else {
    const payment = collection==='payments';
    fields = input('label',payment?'Payment reference':'Expense description',record.label,'text',payment?'':'required')
      + select('project','Project',record.project,projectOptions(!payment),payment?'required':'')
      + input('amount','Amount ('+currency+')',record.amount,'number','min="0.01" max="999999999" step="0.01" required')
      + input('date','Date',record.date || dateKey(),'date','required');
  }
  $('fields').innerHTML = fields + (old?'<p>'+action('Delete record','record-delete')+'</p>':'');
  $('dialog').showModal();
}

function deleteRecord() {
  const {collection,old} = editing;
  if (collection==='projects' && [...state.payments,...state.expenses].some(r=>r.project===old.id)) {
    toast('Remove or reassign the linked payments and expenses first.');
    return;
  }
  if (!confirm('Delete this record?')) return;
  if (commit({...state,[collection]:state[collection].filter(r=>r.id!==old.id)},'Record deleted')) {
    $('dialog').close();
    renderStudio();
  }
}

async function copyQuote(quoteId) {
  const q = state.quotes.find(r=>r.id===quoteId);
  const summary = ['MYNRO — Project quote',q.name+' / '+q.client,...q.lines.map(line=>line.label+' × '+line.qty+' — '+money(quoteTotal([line]))),'Total '+money(quoteTotal(q.lines)),q.notes].filter(Boolean).join('\n');
  try {
    await navigator.clipboard.writeText(summary);
    toast('Quote copied');
  } catch {
    const field = document.createElement('textarea');
    field.value = summary;
    field.setAttribute('aria-label','Quote text');
    $('quote-builder').append(field);
    field.select();
    toast('Select and copy the quote text.');
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const {action:name,id:value} = button.dataset;
  if (name.startsWith('edit:')) {
    openRecord(name.split(':')[1],value);
    return;
  }
  switch (name) {
    case 'tab': location.hash = 'studio/'+value; break;
    case 'period': period = value; renderStudio(); break;
    case 'record-delete': deleteRecord(); break;
    case 'lead-project': {
      const lead = state.leads.find(l=>l.id===value);
      openRecord('projects','',{name:lead.service,client:lead.name,lead:lead.id,notes:lead.notes});
      break;
    }
    case 'quote-new':
    case 'quote-open': {
      const existing = state.quotes.find(q=>q.id===value);
      quoteDraft = existing ? {...existing} : {};
      quoteLines = existing ? structuredClone(existing.lines) : [{label:'',qty:1,rate:''}];
      renderQuote();
      $('quote-form').scrollIntoView({block:'start'});
      break;
    }
    case 'quote-close': quoteDraft = null; $('quote-builder').replaceChildren(); break;
    case 'quote-line':
      readQuote(); quoteLines.push({label:'',qty:1,rate:''}); renderLines(); break;
    case 'quote-remove':
      readQuote(); quoteLines.splice(Number(value),1); renderLines(); break;
    case 'quote-copy': copyQuote(value); break;
    case 'quote-project': {
      const q = state.quotes.find(r=>r.id===value);
      const p = state.projects.find(r=>r.quote===q.id);
      openRecord('projects',p?.id,{quote:q.id,name:q.name,client:q.client,budget:quoteTotal(q.lines),notes:q.notes});
      if (p) $('form').elements.budget.value = quoteTotal(q.lines);
      break;
    }
  }
});

document.addEventListener('input',(event) => {
  if (event.target.name==='lead-search') {
    leadSearch = event.target.value;
    showLeadResults();
  }
  if (event.target.form?.id==='quote-form') readQuote();
});
document.addEventListener('change',(event) => {
  if (event.target.name==='lead-filter') {
    leadFilter = event.target.value;
    showLeadResults();
  }
});

const getData = (form) => Object.fromEntries([...new FormData(form)].map(([field,value])=>[field,value.trim()]));
document.addEventListener('submit',(event) => {
  event.preventDefault();
  const form = event.target;
  if (form.id==='form') {
    const {collection,old,preset} = editing;
    const record = {...(old || preset),...getData(form),id:old?.id || id()};
    if (collection==='projects') record.budget = Number(record.budget);
    if (['payments','expenses'].includes(collection)) record.amount = Number(record.amount);
    if (upsert(collection,record)) {
      $('dialog').close();
      renderStudio();
    }
  }
  if (form.id==='quote-form') {
    readQuote();
    if (!quoteDraft.name || !quoteDraft.client || quoteLines.some(l=>!l.label)) {
      toast('Add a project, client and name for each deliverable.');
      return;
    }
    if (upsert('quotes',{...quoteDraft,id:quoteDraft.id || id(),lines:quoteLines})) {
      quoteDraft = null;
      renderStudio();
    }
  }
  if (form.id==='settings-form') {
    const d = getData(form);
    if (!d.editor0 || !d.editor1) {
      toast('Enter names for the first two editor slots.');
      return;
    }
    if (!d.editor2 && state.projects.some(p=>p.editor==='2')) {
      toast('Reassign projects in the third slot before removing that editor.');
      return;
    }
    if (commit({...state,editors:[d.editor0,d.editor1,d.editor2]},'Settings saved')) renderStudio();
  }
});

for (const name of ['close','cancel']) $(name).addEventListener('click',()=>$('dialog').close());
window.addEventListener('hashchange',route);

route();
if (storageIssue) toast('Saved records could not be loaded.');
