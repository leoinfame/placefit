const contextEl=document.getElementById("context");
const resultEl=document.getElementById("result");
const statusEl=document.getElementById("status");
const authMessage=document.getElementById("auth-message");
const connectBtn=document.getElementById("connect");
const logoutBtn=document.getElementById("logout");
const lookupPhone=document.getElementById("lookup-phone");
const lookupBtn=document.getElementById("lookup-button");
const refreshChatBtn=document.getElementById("refresh-chat");
let currentRecord=null;
let lastLookupKey="";

function showAuth(connected,message){
  statusEl.textContent=connected?"CONECTADO":"DESCONECTADO";
  statusEl.classList.toggle("online",connected);
  authMessage.textContent=message;
  connectBtn.classList.toggle("hidden",connected);
  logoutBtn.classList.toggle("hidden",!connected);
}
async function api(payload){
  return chrome.runtime.sendMessage({type:"PLACEFIT_API_REQUEST",payload});
}
function node(tag,attrs={},text){
  const n=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)){
    if(k==="class") n.className=v;
    else if(k==="type"||k==="name"||k==="placeholder"||k==="maxlength"||k==="rows"||k==="value") n.setAttribute(k,String(v));
    else if(k==="disabled") n.disabled=Boolean(v);
  }
  if(text!==undefined)n.textContent=text;
  return n;
}
function addField(parent,labelText,name,value,options={}){
  const wrap=node("label",{class:"edit-field"});
  wrap.append(node("span",{},labelText));
  const input=options.multiline?node("textarea",{name,rows:options.rows||3, maxlength:options.maxlength||5000}):node("input",{name,type:options.type||"text",maxlength:options.maxlength||500});
  input.value=value||"";
  wrap.append(input);
  parent.append(wrap);
  return input;
}
function statusLine(text,isError=false){
  const p=node("p",{class:isError?"notice error":"notice"},text);
  resultEl.append(p);
}
async function renderMatched(data){
  currentRecord=data;
  resultEl.replaceChildren();
  const c=data.conversation, customer=data.customer;
  resultEl.append(node("h3",{},c.nome_contato||"Contato localizado"));
  resultEl.append(node("p",{class:"muted"},"Correspondência por "+(data.matched_by==="lid"?"identificador WhatsApp associado":"telefone")+" · etapa: "+(c.etapa||"novo")));

  const form=node("form",{class:"edit-form"});
  form.append(node("h4",{},"Dados da conversa"));
  addField(form,"Nome exibido","nome_contato",c.nome_contato,{maxlength:200});
  const stageWrap=node("label",{class:"edit-field"});
  stageWrap.append(node("span",{},"Etapa do funil"));
  const stageSelect=node("select",{name:"etapa"});
  const fallbackStages=[
    {chave:"novo",nome:"Novo"},
    {chave:"atendimento",nome:"Em atendimento"},
    {chave:"orcamento",nome:"Orçamento"},
    {chave:"aguardando_resposta",nome:"Aguardando resposta"},
    {chave:"negociacao",nome:"Negociação"},
    {chave:"ganho",nome:"Ganho"},
    {chave:"perdido",nome:"Perdido"}
  ];
  const stages=data.stages?.length?data.stages:fallbackStages;
  stages.forEach(stage=>{
    const option=node("option",{},stage.nome||stage.chave);
    option.value=stage.chave;
    stageSelect.append(option);
  });
  if(!stages.some(s=>s.chave===c.etapa)){
    const option=node("option",{},c.etapa||"Etapa atual");
    option.value=c.etapa||"novo";
    stageSelect.append(option);
  }
  stageSelect.value=c.etapa||"novo";
  stageWrap.append(stageSelect);form.append(stageWrap);
  if(!data.stages?.length)form.append(node("p",{class:"muted"},"Etapas padrão disponíveis. A lista personalizada do funil só é exibida para o perfil dono."));
  addField(form,"Observações comerciais","observacoes",c.observacoes,{multiline:true});
  addField(form,"Pendência","pendencia",c.pendencia,{multiline:true,rows:2,maxlength:1000});

  const listSection=node("div",{class:"list-editor"});
  listSection.append(node("h4",{},"Listas do CRM"));
  const listChecks=[];
  const lists=data.lists||[];
  if(lists.length){
    const currentLists=new Set(Array.isArray(c.listas)?c.listas:[]);
    lists.forEach(list=>{
      const label=node("label",{class:"list-option"});
      const check=node("input",{type:"checkbox",value:list.id});
      check.checked=currentLists.has(list.id);
      const name=node("span",{},list.nome+(list.tipo==="acao"?" · ação":" · segmento"));
      label.append(check,name);listSection.append(label);
      listChecks.push(check);
    });
  }else{
    listSection.append(node("p",{class:"muted"},"Nenhuma lista disponível para este usuário."));
  }
  form.append(listSection);

  if(customer){
    form.append(node("h4",{},"Cadastro do cliente"));
    addField(form,"Nome","customer_nome",customer.nome);
    addField(form,"E-mail","customer_email",customer.email,{type:"email"});
    addField(form,"Telefone","customer_telefone",customer.telefone);
    addField(form,"CPF/CNPJ","customer_cpf_cnpj",customer.cpf_cnpj);
    addField(form,"Endereço","customer_endereco",customer.endereco,{multiline:true,rows:2});
    addField(form,"Cidade","customer_cidade",customer.cidade);
    addField(form,"Estado","customer_estado",customer.estado,{maxlength:2});
    addField(form,"CEP","customer_cep",customer.cep);
    addField(form,"Observações do cliente","customer_observacoes",customer.observacoes,{multiline:true});
  }else{
    statusLine("O contato foi localizado, mas o cadastro de Cliente não está vinculado ou não está liberado pelas permissões atuais. A edição da conversa continua disponível.");
  }
  const save=node("button",{class:"primary",type:"submit"},"Salvar alterações");
  form.append(save);
  form.addEventListener("submit",async event=>{
    event.preventDefault();save.disabled=true;save.textContent="Salvando...";
    const values=Object.fromEntries(new FormData(form).entries());
    const conversationFields={
      nome_contato:values.nome_contato,
      etapa:values.etapa,
      observacoes:values.observacoes,
      pendencia:values.pendencia
    };
    try{
      const cr=await api({action:"conversation.update",conversation_id:c.id,fields:conversationFields});
      if(!cr?.ok)throw new Error(cr?.data?.error||cr?.error||"Falha ao salvar conversa.");
      if(customer){
        const customerFields={
          nome:values.customer_nome,email:values.customer_email,telefone:values.customer_telefone,
          cpf_cnpj:values.customer_cpf_cnpj,endereco:values.customer_endereco,cidade:values.customer_cidade,
          estado:values.customer_estado,cep:values.customer_cep,observacoes:values.customer_observacoes
        };
        const ur=await api({action:"customer.update",customer_id:customer.id,fields:customerFields});
        if(!ur?.ok)throw new Error(ur?.data?.error||ur?.error||"Conversa salva, mas o cadastro do cliente não foi atualizado.");
        currentRecord.customer=ur.data.customer;
      }
      const selectedListIds=listChecks.filter(check=>check.checked).map(check=>check.value);
      const lr=await api({action:"conversation.lists.update",conversation_id:c.id,list_ids:selectedListIds});
      if(!lr?.ok)throw new Error(lr?.data?.error||lr?.error||"Dados salvos, mas as listas não foram atualizadas.");
      currentRecord.conversation=cr.data.conversation;
      currentRecord.conversation.listas=selectedListIds;
      resultEl.replaceChildren();
      statusLine("Alterações salvas no CRM PlaceFit.");
      renderSaveSummary(currentRecord);
    }catch(err){statusLine(err.message||"Erro ao salvar.",true);}
    finally{save.disabled=false;save.textContent="Salvar alterações";}
  });
  resultEl.append(form);
  renderBudgets(data.budgets || []);

  const stepsSection=node("section",{class:"next-steps"});
  stepsSection.append(node("h4",{},"Próximos passos"));
  const steps=data.next_steps||[];
  if(steps.length){
    steps.forEach(step=>{
      const item=node("div",{class:"next-step-item"});
      item.append(node("strong",{},step.descricao));
      const meta=[step.em?new Date(step.em).toLocaleString("pt-BR"):"",step.por].filter(Boolean).join(" · ");
      if(meta)item.append(node("p",{class:"muted"},meta));
      stepsSection.append(item);
    });
  }else{
    stepsSection.append(node("p",{class:"muted"},data.can_manage_next_steps?"Nenhum próximo passo registrado.":"O histórico de próximos passos é restrito ao dono do CRM."));
  }
  if(data.can_manage_next_steps){
    const stepForm=node("form",{class:"next-step-form"});
    const stepInput=node("input",{type:"text",placeholder:"Ex.: retornar amanhã para confirmar o frete",maxlength:1000});
    stepInput.required=true;
    const stepButton=node("button",{class:"secondary",type:"submit"},"Registrar próximo passo");
    stepForm.append(stepInput,stepButton);
    stepForm.addEventListener("submit",async event=>{
      event.preventDefault();
      const description=stepInput.value.trim();if(!description)return;
      stepButton.disabled=true;stepButton.textContent="Registrando...";
      try{
        const response=await api({action:"nextstep.create",conversation_id:c.id,descricao:description});
        if(!response?.ok)throw new Error(response?.data?.error||response?.error||"Não foi possível registrar o próximo passo.");
        const row=response.data.next_step;
        const item=node("div",{class:"next-step-item"});
        item.append(node("strong",{},row.descricao));
        item.append(node("p",{class:"muted"},row.em?new Date(row.em).toLocaleString("pt-BR"):"Agora"));
        stepsSection.insertBefore(item,stepForm);
        stepInput.value="";
        statusLine("Próximo passo registrado no CRM.");
      }catch(error){statusLine(error.message||"Erro ao registrar próximo passo.",true);}
      finally{stepButton.disabled=false;stepButton.textContent="Registrar próximo passo";}
    });
    stepsSection.append(stepForm);
  }
  resultEl.append(stepsSection);
}
function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
function renderBudgets(budgets){
  const section=node("section",{class:"budget-section"});
  section.append(node("h4",{},"Orçamentos do cliente"));
  if(!budgets.length){
    section.append(node("p",{class:"muted"},"Nenhum orçamento vinculado a este cadastro."));
    resultEl.append(section);return;
  }
  budgets.forEach(b=>{
    const card=node("article",{class:"budget-card"});
    card.append(node("strong",{},"Orçamento "+(b.numero_pedido||"sem número")));
    card.append(node("p",{class:"muted"},[b.data_pedido,b.status].filter(Boolean).join(" · ")));
    (b.itens||[]).forEach(i=>{
      const line=node("div",{class:"budget-item"});
      line.append(node("span",{},(i.quantidade||0)+" × "+(i.nome||"Item")));
      line.append(node("span",{},money(i.subtotal)));
      card.append(line);
      if(i.preco_unitario)card.append(node("p",{class:"muted"},"Unitário: "+money(i.preco_unitario)+" · Código: "+(i.cod||"—")));
    });
    const totals=node("div",{class:"budget-totals"});
    totals.append(node("span",{},"Subtotal: "+money(b.subtotal)));
    totals.append(node("span",{},"Frete: "+money(b.frete)));
    totals.append(node("span",{},"Desconto: "+money(b.desconto)));
    totals.append(node("strong",{},"Total: "+money(b.total)));
    card.append(totals);
    if(b.observacoes)card.append(node("p",{class:"muted"},"Obs.: "+b.observacoes));
    const open=document.createElement("a");
    open.className="secondary budget-open";
    open.href="https://app.placefit.com.br/Orcamentos?abrir="+encodeURIComponent(b.id);
    open.target="_blank";open.rel="noopener noreferrer";
    open.textContent="Abrir orçamento completo no PlaceFit";
    card.append(open);
    section.append(card);
  });
  resultEl.append(section);
}
function renderSaveSummary(data){
  const c=data.conversation;
  resultEl.append(node("p",{},(c.nome_contato||"Contato")+" · etapa "+(c.etapa||"novo")));
  const edit=node("button",{class:"secondary"},"Editar novamente");
  edit.addEventListener("click",()=>renderMatched(data));
  resultEl.append(edit);
}
let lookupSequence=0;
async function lookup(identifier,source="manual"){
  const isObject=identifier&&typeof identifier==="object";
  const isLid=isObject&&Boolean(identifier.lid);
  const clean=String(isObject?(identifier.phone||identifier.lid||""):identifier||"").trim();
  if(!clean){resultEl.replaceChildren();statusLine("Informe um telefone com DDD para pesquisar.",true);return;}
  const key=(isLid?"lid:":"phone:")+clean.replace(/\\D/g,"");
  if(key===lastLookupKey&&currentRecord)return;
  lastLookupKey=key;currentRecord=null;
  const sequence=++lookupSequence;
  resultEl.replaceChildren();statusLine("Consultando CRM...");
  try{
    const response=await api({action:"contact.lookup",...(isLid?{lid:clean}:{phone:clean})});
    if(sequence!==lookupSequence)return;
    resultEl.replaceChildren();
    if(!response?.ok){statusLine(response?.data?.error||response?.error||"Não foi possível consultar o CRM.",true);return;}
    const data=response.data||{};
    if(data.status==="matched"){renderMatched(data);return;}
    if(data.status==="ambiguous"){statusLine("Encontramos mais de uma conversa com este identificador. Não fizemos associação automática.",true);return;}
    statusLine("Nenhuma conversa correspondente encontrada no CRM. Nenhum contato foi criado ou associado.");
  }catch(error){
    if(sequence!==lookupSequence)return;
    resultEl.replaceChildren();statusLine(error?.message||"Falha ao consultar o CRM.",true);
  }
}
async function checkAuth(){
  try{
    const r=await api({action:"me"});
    if(!r?.ok){
      const code=r?.data?.error||r?.error||"UNKNOWN_ERROR";
      const status=r?.status?("HTTP "+r.status+" · "):"";
      const messages={
        AUTH_REQUIRED:"A extensão não encontrou um token salvo. Faça login novamente.",
        CRM_ACCESS_NOT_CONFIGURED:"Login válido, mas falta configurar o vínculo deste usuário no CRM.",
        MULTIPLE_WORKSPACES:"Este usuário pertence a mais de um espaço CRM; precisamos selecionar um.",
        NOT_FOUND:"A API crm-companion não foi encontrada neste ambiente.",
        INTERNAL_ERROR:"A função do CRM retornou erro interno."
      };
      showAuth(false,status+(messages[code]||("Resposta da API: "+code)));
      return false;
    }
    const u=r.data?.user||{},w=r.data?.workspace||{};
    showAuth(true,"Conectado como "+(u.full_name||u.email||"usuário")+" · perfil "+(w.papel||"equipe")+".");
    return true;
  }catch(error){
    showAuth(false,"Falha ao validar a sessão: "+(error?.message||String(error))+". Confira se a extensão está ativa em chrome://extensions.");
    return false;
  }
}
async function refreshContext(){
  const {activeContext}=await chrome.storage.session.get("activeContext");
  // Invalida qualquer consulta pendente antes de trocar/limpar o contato.
  lookupSequence++;currentRecord=null;lastLookupKey="";
  resultEl.replaceChildren();
  if(!activeContext){
    lookupPhone.value="";
    contextEl.textContent="Abra uma conversa no WhatsApp Web ou informe o telefone abaixo.";
    statusLine("Aguardando uma conversa identificável.");
    return;
  }
  if(activeContext.chatHint||activeContext.lidHint){
    const identity=activeContext.chatHint?{phone:activeContext.chatHint}:{lid:activeContext.lidHint};
    contextEl.textContent=activeContext.chatHint?"Conversa ativa · telefone detectado: "+activeContext.chatHint+".":"Conversa ativa · identificador WhatsApp reconhecido (LID).";
    lookupPhone.value=activeContext.chatHint||"";
    statusLine("Carregando os dados da conversa ativa...");
    if(await checkAuth())await lookup(identity,"whatsapp");
  }else{
    lookupPhone.value="";
    contextEl.textContent="Conversa aberta, mas o WhatsApp não forneceu um identificador confiável. Use a busca manual; não faremos associação por nome.";
    statusLine("Identificação automática indisponível. Os dados da conversa anterior foram limpos.");
  }
}
connectBtn.addEventListener("click",async()=>{
  connectBtn.disabled=true;
  const oldLabel=connectBtn.textContent;
  connectBtn.textContent="Abrindo autenticação...";
  authMessage.textContent="Solicitando abertura da página segura do PlaceFit...";
  try{
    const result=await chrome.runtime.sendMessage({type:"PLACEFIT_OPEN_AUTH"});
    if(!result?.ok)throw new Error(result?.error||"Não foi possível abrir a página de autenticação.");
    authMessage.textContent="Página de autenticação aberta em uma nova aba. Faça login no PlaceFit.";
  }catch(error){
    authMessage.textContent="Falha ao abrir a autenticação: "+(error?.message||"erro de comunicação com a extensão")+". Recarregue a extensão em chrome://extensions e tente novamente.";
  }finally{
    connectBtn.disabled=false;
    connectBtn.textContent=oldLabel;
  }
});
logoutBtn.addEventListener("click",async()=>{
  await chrome.runtime.sendMessage({type:"PLACEFIT_LOGOUT"});
  currentRecord=null;lastLookupKey="";resultEl.replaceChildren();
  showAuth(false,"Sessão encerrada neste navegador.");
});
lookupBtn.addEventListener("click",async()=>{
  if(!(await checkAuth()))return;
  await lookup(lookupPhone.value);
});

refreshChatBtn.addEventListener("click",async()=>{
  refreshChatBtn.disabled=true;
  const originalLabel=refreshChatBtn.textContent;
  refreshChatBtn.textContent="Lendo conversa...";
  try{
    const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if(!tab?.id||!tab.url?.startsWith("https://web.whatsapp.com/")){
      resultEl.replaceChildren();
      statusLine("Abra ou selecione a aba do WhatsApp Web e tente novamente.",true);
      return;
    }
    const response=await chrome.tabs.sendMessage(tab.id,{type:"PLACEFIT_FORCE_CONTEXT_REFRESH"});
    if(!response?.ok)throw new Error(response?.error||"Não foi possível ler a conversa ativa.");
    const identity=response.identity||null;
    lookupSequence++;currentRecord=null;lastLookupKey="";resultEl.replaceChildren();
    if(identity?.phone){
      lookupPhone.value=identity.phone;
      contextEl.textContent="Leitura manual da conversa · telefone detectado: "+identity.phone;
      if(await checkAuth())await lookup({phone:identity.phone},"manual-refresh");
    }else if(identity?.lid){
      lookupPhone.value="";
      contextEl.textContent="Leitura manual da conversa · identificador WhatsApp (LID) reconhecido.";
      if(await checkAuth())await lookup({lid:identity.lid},"manual-refresh");
    }else{
      lookupPhone.value="";
      contextEl.textContent="Conversa aberta, mas não foi encontrado telefone ou identificador confiável.";
      statusLine("Não foi possível identificar este contato. Use a busca manual pelo telefone; não faremos associação por nome.");
    }
  }catch(error){
    resultEl.replaceChildren();
    const message=error?.message||"Falha ao atualizar a conversa.";
    statusLine(message.includes("Receiving end does not exist")?"O WhatsApp ainda está com o script antigo. Feche a aba e abra o WhatsApp Web novamente.":message,true);
  }finally{
    refreshChatBtn.disabled=false;
    refreshChatBtn.textContent=originalLabel;
  }
});

lookupPhone.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();lookupBtn.click();}});
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=="session")return;
  if(changes.authToken)checkAuth();
  if(changes.activeContext)refreshContext();
});
checkAuth().then(refreshContext);
