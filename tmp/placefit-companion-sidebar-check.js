const contextEl=document.getElementById("context");
const resultEl=document.getElementById("result");
const statusEl=document.getElementById("status");
const authCard=document.getElementById("auth-card");
const authMessage=document.getElementById("auth-message");
const connectBtn=document.getElementById("connect");
const logoutBtn=document.getElementById("logout");
const lookupPhone=document.getElementById("lookup-phone");
const lookupBtn=document.getElementById("lookup-button");
const refreshChatBtn=document.getElementById("refresh-chat");
const orderOpenBtn=document.getElementById("order-open");
let currentRecord=null;
let lastLookupKey="";

function showAuth(connected,message){
  statusEl.textContent=connected?"CRM CONECTADO":"CRM DESCONECTADO";
  statusEl.classList.toggle("online",connected);
  authMessage.textContent=message;
  authCard.classList.toggle("hidden",connected);
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
    {chave:"novo",nome:"Novo contato"},
    {chave:"atendimento",nome:"Atendimento"},
    {chave:"orcamento",nome:"Orçamento"},
    {chave:"aguardando_resposta",nome:"Aguardando resposta"},
    {chave:"negociacao",nome:"Negociação"},
    {chave:"ganho",nome:"Venda ganha"},
    {chave:"perdido",nome:"Não convertido"}
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
  if(!data.stages?.length)form.append(node("p",{class:"muted"},"Não foi possível carregar as etapas configuradas do funil. Confira o acesso ao CRM."));
  addField(form,"Observações comerciais","observacoes",c.observacoes,{multiline:true});
  addField(form,"Pendência","pendencia",c.pendencia,{multiline:true,rows:2,maxlength:1000});

  const funnelHint=node("p",{class:"muted"},"O contato fica em uma única etapa do funil. Segmentos como Fabricante, Distribuidor e Transportador não são etapas comerciais.");
  form.append(funnelHint);

  if(customer){
    const customerDetails=node("details",{class:"contact-details"});
    customerDetails.append(node("summary",{},"Dados do contato · ver informações"));
    const customerFields=node("div",{class:"contact-fields"});
    customerFields.append(node("p",{class:"muted"},"Cadastro vinculado ao telefone do WhatsApp. Os dados completos ficam recolhidos para manter a tela limpa."));
    if(customer.idade!==undefined&&customer.idade!==null&&customer.idade!==""){
      customerFields.append(node("p",{class:"contact-age"},"Idade: "+customer.idade));
    }
    addField(customerFields,"Nome","customer_nome",customer.nome);
    addField(customerFields,"E-mail","customer_email",customer.email,{type:"email"});
    const phoneNote=node("p",{class:"contact-phone"}, "WhatsApp: "+(customer.telefone||c.telefone||"não informado")+" · identidade principal do contato");
    customerFields.append(phoneNote);
    const phoneHidden=node("input",{type:"hidden",name:"customer_telefone",value:customer.telefone||c.telefone||""});
    customerFields.append(phoneHidden);
    addField(customerFields,"CPF/CNPJ","customer_cpf_cnpj",customer.cpf_cnpj);
    addField(customerFields,"Endereço","customer_endereco",customer.endereco,{multiline:true,rows:2});
    addField(customerFields,"Cidade","customer_cidade",customer.cidade);
    addField(customerFields,"Estado","customer_estado",customer.estado,{maxlength:2});
    addField(customerFields,"CEP","customer_cep",customer.cep);
    addField(customerFields,"Observações do cliente","customer_observacoes",customer.observacoes,{multiline:true});
    customerDetails.append(customerFields);
    form.append(customerDetails);
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
      currentRecord.conversation=cr.data.conversation;
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
function renderCreateContact(phone){
  const section=node("section",{class:"create-contact"});
  section.append(node("h4",{},"Cadastrar contato no CRM"));
  section.append(node("p",{class:"muted"},phone?"Este telefone ainda não está cadastrado. Confirme o número e informe o nome para criar o contato.":"O WhatsApp não forneceu o telefone desta conversa. Informe manualmente o número com DDD e o nome do contato para cadastrá-lo no CRM."));
  const form=node("form",{class:"create-contact-form"});
  const nameInput=node("input",{type:"text",placeholder:"Nome do cliente",maxlength:200});
  nameInput.required=true;
  nameInput.autocomplete="name";
  const phoneInput=node("input",{type:"tel",value:phone||"",placeholder:"DDD + número do WhatsApp",maxlength:20});
  phoneInput.readOnly=Boolean(phone);
  phoneInput.required=true;
  phoneInput.setAttribute("aria-label","Telefone WhatsApp");
  const phoneLabel=node("label",{class:"edit-field"});
  phoneLabel.append(node("span",{},phone?"Telefone WhatsApp identificado":"Telefone WhatsApp · informe com DDD"));
  phoneLabel.append(phoneInput);
  const nameLabel=node("label",{class:"edit-field"});
  nameLabel.append(node("span",{},"Nome do contato"));
  nameLabel.append(nameInput);
  form.append(phoneLabel,nameLabel);
  const submit=node("button",{class:"primary",type:"submit"},"Cadastrar este contato");
  form.append(submit);
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const name=nameInput.value.trim();
    const enteredPhone=phoneInput.value.trim();
    const normalizedPhone=enteredPhone.replace(/\D/g,"");
    if(!name){nameInput.focus();return;}
    if(normalizedPhone.length<10||normalizedPhone.length>13){phoneInput.focus();statusLine("Informe um telefone válido com DDD e código do país, se necessário.",true);return;}
    submit.disabled=true;submit.textContent="Cadastrando...";
    try{
      const response=await api({action:"contact.create",phone:normalizedPhone,name});
      if(!response?.ok){
        const code=response?.data?.error||response?.error||"CREATE_FAILED";
        if(code==="CONVERSATION_ALREADY_EXISTS"){
          submit.textContent="Localizando cadastro...";
          const existing=await api({action:"contact.lookup",phone:normalizedPhone});
          if(existing?.ok&&existing.data?.status==="matched"){
            lastLookupKey="phone:"+normalizedPhone;
            await renderMatched(existing.data);
          }else if(existing?.ok&&existing.data?.status==="ambiguous"){
            statusLine("Há mais de uma conversa com este telefone. Não fizemos associação automática; é necessário resolver a duplicidade no CRM.",true);
          }else{
            statusLine("A conversa já existe no CRM, mas não foi possível carregar um cadastro correspondente por telefone. Atualize a conversa ou confira o cadastro no PlaceFit.",true);
          }
        }else if(code==="CUSTOMER_DUPLICATE"){
          statusLine("Há mais de um cadastro com este telefone. É necessário resolver a duplicidade antes de criar outro.",true);
        }else if(code==="FORBIDDEN"){
          statusLine("Seu perfil não tem permissão para cadastrar contatos. Peça ao responsável pelo CRM.",true);
        }else{
          statusLine("Não foi possível cadastrar o contato: "+code,true);
        }
        return;
      }
      resultEl.replaceChildren();
      statusLine("Contato cadastrado e conversa vinculada ao telefone do WhatsApp.");
      lastLookupKey="";
      await lookup(normalizedPhone,"created");
    }catch(error){
      statusLine(error?.message||"Falha ao cadastrar o contato.",true);
    }finally{
      submit.disabled=false;submit.textContent="Cadastrar este contato";
    }
  });
  section.append(form);
  resultEl.append(section);
}
function renderOrderComposer(){
  resultEl.replaceChildren();
  const c=currentRecord?.conversation||{};
  const customer=currentRecord?.customer||{};
  const section=node("section",{class:"order-composer"});
  section.append(node("h4",{},"Registrar pedido e montar orçamento"));
  section.append(node("p",{class:"muted"},"Escreva o pedido como recebeu do cliente. A IA organiza os itens e o PlaceFit consulta o catálogo e a tabela de frete. Nada será gravado até sua confirmação."));
  const form=node("form",{class:"order-composer-form"});
  const name=addField(form,"Nome do cliente / empresa","name",customer.nome||c.nome_contato||"",{maxlength:200});
  const phone=addField(form,"WhatsApp com DDD","phone",c.telefone||lookupPhone.value||"",{type:"tel",maxlength:20});
  const request=addField(form,"Pedido recebido","text","",{multiline:true,rows:6,maxlength:12000});
  request.placeholder="Ex.: Cliente quer 10 anilhas de 10 kg, 10 de 20 kg e um suporte para 20 pares. Entrega em Campinas/SP. Calcular frete pela tabela.";
  request.required=true;
  const submit=node("button",{class:"primary",type:"submit"},"Gerar prévia do orçamento");
  form.append(submit);
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const enteredPhone=phone.value.trim().replace(/\D/g,"");
    if(enteredPhone.length<10||enteredPhone.length>13){statusLine("Informe um telefone válido com DDD.",true);phone.focus();return;}
    if(!name.value.trim()){statusLine("Informe o nome do cliente.",true);name.focus();return;}
    if(!request.value.trim()){request.focus();return;}
    submit.disabled=true;submit.textContent="Interpretando pedido e consultando catálogo...";
    try{
      const response=await api({action:"order.preview",conversation_id:c.id||"",phone:enteredPhone,name:name.value.trim(),text:request.value.trim()});
      if(!response?.ok)throw new Error(response?.data?.message||response?.data?.error||response?.error||"Não foi possível montar a prévia.");
      renderOrderPreview(response.data,request.value.trim());
    }catch(error){statusLine(error.message||"Falha ao gerar orçamento.",true);}
    finally{submit.disabled=false;submit.textContent="Gerar prévia do orçamento";}
  });
  section.append(form);
  resultEl.append(section);
}
function renderOrderPreview(data,sourceText){
  resultEl.replaceChildren();
  const p=data.preview||{};
  const section=node("section",{class:"order-preview"});
  section.append(node("h4",{},"Prévia do orçamento"));
  section.append(node("p",{class:"muted"},(data.name||p.cliente?.nome||"Cliente") + " · WhatsApp " + (data.phone||"")));
  if(p.itens?.length){
    p.itens.forEach(item=>{
      const line=node("div",{class:"order-line"});
      const desc=node("div",{});
      desc.append(node("strong",{},(item.quantidade||0)+" × "+(item.nome||"Produto")));
      desc.append(node("small",{},(item.cod?"Código "+item.cod+" · ":"")+"Unitário "+money(item.preco_unitario)));
      line.append(desc,node("strong",{},money(item.subtotal)));
      section.append(line);
    });
  }else{
    section.append(node("p",{class:"muted"},"Nenhum produto foi associado ao catálogo."));
  }
  const totals=node("div",{class:"order-totals"});
  totals.append(node("span",{},"Subtotal: "+money(p.subtotal)));
  totals.append(node("span",{},p.frete===null?"Frete: pendente":"Frete ("+(p.frete_origem||"calculado") + "): "+money(p.frete)));
  totals.append(node("strong",{},p.pronto?"Total: "+money(p.total):"Total ainda não definido"));
  section.append(totals);
  const notes=[...(p.perguntas||[]).map(x=>"Pendente: "+x),...(p.nao_cotados||[]).map(x=>"Não cotado: "+x),...(p.suposicoes||[]),...(p.ressalvas||[])];
  if(notes.length){
    section.append(node("h4",{},"Conferências e pendências"));
    const ul=node("ul",{});
    notes.forEach(note=>ul.append(node("li",{},note)));
    section.append(ul);
  }
  if(p.composicoes?.length){
    section.append(node("p",{class:"muted"},"Composição: "+p.composicoes.join("; ")));
  }
  const actions=node("div",{class:"order-actions"});
  const back=node("button",{class:"secondary",type:"button"},"Voltar e editar pedido");
  back.addEventListener("click",renderOrderComposer);
  actions.append(back);
  if(p.pronto){
    const confirm=node("button",{class:"primary confirm-order",type:"button"},"Confirmar e gravar orçamento");
    confirm.addEventListener("click",async()=>{
      confirm.disabled=true;confirm.textContent="Gravando orçamento...";
      try{
        const saved=await api({action:"order.confirm",conversation_id:data.conversation_id||"",phone:data.phone,name:data.name,text:sourceText,pedido:p.pedido});
        if(!saved?.ok)throw new Error(saved?.data?.message||saved?.data?.error||saved?.error||"Não foi possível gravar o orçamento.");
        resultEl.replaceChildren();
        statusLine("Orçamento "+(saved.data.order?.numero_pedido||"") +" gravado como pendente. Nada foi enviado ao cliente.");
        const link=document.createElement("a");
        link.className="order-link";
        link.href="https://app.placefit.com.br/Orcamentos?abrir="+encodeURIComponent(saved.data.order?.id||"");
        link.target="_blank";link.rel="noopener noreferrer";
        link.textContent="Abrir orçamento completo no painel PlaceFit";
        resultEl.append(link);
        if(saved.data.divergencias?.length)statusLine("Atenção: confira o orçamento no painel. "+saved.data.divergencias.join("; "),true);
        if(saved.data.conversation_id)lookupPhone.value=data.phone||"";
      }catch(error){statusLine(error.message||"Falha ao gravar orçamento.",true);}
      finally{confirm.disabled=false;confirm.textContent="Confirmar e gravar orçamento";}
    });
    actions.append(confirm);
  }else{
    actions.append(node("p",{class:"notice"},"Ainda não é possível gravar. Complete as informações pendentes e gere uma nova prévia."));
  }
  section.append(actions);
  resultEl.append(section);
}
let lookupSequence=0;
async function lookup(identifier,source="manual"){
  const isObject=identifier&&typeof identifier==="object";
  const isLid=isObject&&Boolean(identifier.lid);
  const clean=String(isObject?(identifier.phone||identifier.lid||""):identifier||"").trim();
  if(!clean){resultEl.replaceChildren();statusLine("Informe um telefone com DDD para pesquisar.",true);return;}
  const key=(isLid?"lid:":"phone:")+clean.replace(/\D/g,"");
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
    statusLine("Não foi possível identificar este contato. Use a busca manual pelo telefone; não faremos associação por nome.");
    renderCreateContact(!isLid&&clean.replace(/\D/g,"").length>=10&&clean.replace(/\D/g,"").length<=11?clean:"");
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
    renderCreateContact("");
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
orderOpenBtn.addEventListener("click",async()=>{if(!(await checkAuth()))return;renderOrderComposer();});
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
      renderCreateContact("");
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
