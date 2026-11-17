(() => {
  const $ = (id) => document.getElementById(id);
  const state = { user: null, business: null, invoices: [], customers: [], page: "overview", authMode: "login" };
  const money = (amount, currency = "MYR") => new Intl.NumberFormat("en-MY", { style: "currency", currency }).format(Number(amount || 0));
  const today = () => new Date().toISOString().slice(0, 10);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const toast = (msg) => { $("toast").textContent = msg; $("toast").classList.add("show"); setTimeout(() => $("toast").classList.remove("show"), 2800); };
  const configured = () => window.eonixSupabaseReady && window.db;
  const client = () => window.db;
  const businessId = () => state.business?.id;

  function showAuth(message = "") {
    $("authScreen").classList.remove("hidden"); $("appShell").classList.add("hidden"); $("authMessage").textContent = message;
  }
  function showApp() { $("authScreen").classList.add("hidden"); $("appShell").classList.remove("hidden"); $("userAvatar").textContent = (state.user?.email || "E").slice(0,1).toUpperCase(); }
  function setPage(page) {
    state.page = page;
    document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === `page-${page}`));
    document.querySelectorAll(".nav-link[data-page]").forEach(b => b.classList.toggle("active", b.dataset.page === page));
    $("pageTitle").textContent = ({overview:"Overview", invoices:"Invoices", customers:"Customers", reports:"Reports", settings:"Settings"})[page];
    $("sidebar").classList.remove("open");
    if (page === "reports") renderReports();
  }
  async function loadBusiness() {
    const { data, error } = await client().from("invoice_businesses").select("*").limit(1).maybeSingle();
    if (error) throw error;
    if (data) state.business = data;
    else {
      const { data: created, error: createError } = await client().from("invoice_businesses").insert({ owner_id: state.user.id, name: "My Business", currency: "MYR" }).select().single();
      if (createError) throw createError;
      state.business = created;
    }
    fillBusinessForm();
  }
  async function loadData() {
    const [inv, cus] = await Promise.all([
      client().from("invoice_documents").select("*, invoice_customers(name,email)").eq("business_id", businessId()).order("created_at", { ascending: false }),
      client().from("invoice_customers").select("*").eq("business_id", businessId()).order("name")
    ]);
    if (inv.error) throw inv.error; if (cus.error) throw cus.error;
    state.invoices = inv.data || []; state.customers = cus.data || [];
    renderAll();
  }
  function renderAll() { renderOverview(); renderInvoices(); renderCustomers(); renderReports(); }
  function statusPill(s) { return `<span class="status ${esc(s)}">${esc(s)}</span>`; }
  function renderOverview() {
    const total = state.invoices.filter(x => x.status !== "cancelled").reduce((a,x) => a + Number(x.total || 0), 0);
    const paid = state.invoices.filter(x => x.status === "paid").reduce((a,x) => a + Number(x.total || 0), 0);
    $("statTotal").textContent = money(total, state.business?.currency || "MYR");
    $("statPaid").textContent = money(paid, state.business?.currency || "MYR");
    $("statOutstanding").textContent = money(total-paid, state.business?.currency || "MYR");
    $("statCustomers").textContent = state.customers.length;
    $("recentRows").innerHTML = state.invoices.slice(0,6).map(x => `<tr><td><b>${esc(x.invoice_number)}</b></td><td>${esc(x.invoice_customers?.name || "—")}</td><td>${esc(x.issue_date)}</td><td>${money(x.total,x.currency)}</td><td>${statusPill(x.status)}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">No invoices yet. Create your first invoice.</td></tr>`;
  }
  function renderInvoices() {
    const q = ($("invoiceSearch").value || "").toLowerCase(), f = $("statusFilter").value;
    const rows = state.invoices.filter(x => (f==="all" || x.status===f) && (`${x.invoice_number} ${x.invoice_customers?.name || ""}`).toLowerCase().includes(q));
    $("invoiceRows").innerHTML = rows.map(x => `<tr><td><b>${esc(x.invoice_number)}</b></td><td>${esc(x.invoice_customers?.name || "—")}</td><td>${esc(x.issue_date)}</td><td>${esc(x.due_date)}</td><td>${money(x.total,x.currency)}</td><td>${statusPill(x.status)}</td><td class="row-actions"><button class="mini-btn" data-edit-invoice="${x.id}">Edit</button><button class="mini-btn danger-text" data-delete-invoice="${x.id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="7" class="empty">No matching invoices.</td></tr>`;
  }
  function renderCustomers() {
    const q = ($("customerSearch").value || "").toLowerCase();
    const rows = state.customers.filter(x => `${x.name} ${x.email || ""} ${x.phone || ""}`.toLowerCase().includes(q));
    $("customerRows").innerHTML = rows.map(x => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.email || "—")}</td><td>${esc(x.phone || "—")}</td><td>${new Date(x.created_at).toLocaleDateString()}</td><td class="row-actions"><button class="mini-btn" data-edit-customer="${x.id}">Edit</button><button class="mini-btn danger-text" data-delete-customer="${x.id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="5" class="empty">No customers found.</td></tr>`;
    $("invoiceCustomer").innerHTML = `<option value="">Select customer</option>` + state.customers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  }
  function renderReports() {
    const valid = state.invoices.filter(x => x.status !== "cancelled"), paid = valid.filter(x => x.status === "paid"), unpaid = valid.filter(x => x.status !== "paid");
    const sum = a => a.reduce((n,x)=>n+Number(x.total||0),0);
    $("reportPaidCount").textContent = paid.length; $("reportUnpaidCount").textContent = unpaid.length;
    $("reportAverage").textContent = money(valid.length ? sum(valid)/valid.length : 0, state.business?.currency || "MYR");
    $("reportRate").textContent = `${sum(valid) ? Math.round(sum(paid)/sum(valid)*100) : 0}%`;
    const statuses = ["draft","sent","paid","overdue","cancelled"];
    $("reportBreakdown").innerHTML = statuses.map(s => { const arr=state.invoices.filter(x=>x.status===s); return `<div class="break-row"><span>${statusPill(s)}</span><b>${arr.length} invoice${arr.length===1?"":"s"}</b><strong>${money(sum(arr),state.business?.currency||"MYR")}</strong></div>`; }).join("");
  }
  function fillBusinessForm() {
    const b=state.business||{}; $("businessName").value=b.name||""; $("businessEmail").value=b.email||""; $("businessPhone").value=b.phone||""; $("businessAddress").value=b.address||""; $("businessCurrency").value=b.currency||"MYR";
  }
  function addItemRow(item={description:"",quantity:1,unit_price:0}) {
    const row=document.createElement("div"); row.className="item-row";
    row.innerHTML=`<input class="item-desc" placeholder="Description" value="${esc(item.description)}" required><input class="item-qty" type="number" min="1" step="1" value="${Number(item.quantity)||1}" aria-label="Quantity"><input class="item-price" type="number" min="0" step="0.01" value="${Number(item.unit_price)||0}" aria-label="Unit price"><button type="button" class="remove-item" aria-label="Remove item">×</button>`;
    $("invoiceItems").appendChild(row); row.querySelectorAll("input").forEach(i=>i.addEventListener("input",updateTotal)); row.querySelector(".remove-item").onclick=()=>{row.remove();updateTotal();};
    updateTotal();
  }
  function getItems() { return [...$("invoiceItems").querySelectorAll(".item-row")].map(r=>({description:r.querySelector(".item-desc").value.trim(),quantity:Number(r.querySelector(".item-qty").value),unit_price:Number(r.querySelector(".item-price").value)})).filter(x=>x.description); }
  function updateTotal() { const total=getItems().reduce((n,x)=>n+x.quantity*x.unit_price,0); $("invoiceTotal").textContent=money(total,$("invoiceCurrency").value||"MYR"); }
  function openInvoice(inv=null) {
    $("invoiceForm").reset(); $("invoiceItems").innerHTML=""; $("invoiceId").value=inv?.id||"";
    $("invoiceModalTitle").textContent=inv?"Edit invoice":"Create invoice";
    $("invoiceNumber").value=inv?.invoice_number||`EON-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    $("issueDate").value=inv?.issue_date||today(); $("dueDate").value=inv?.due_date||today(); $("invoiceStatus").value=inv?.status||"draft";
    $("invoiceCurrency").value=inv?.currency||state.business?.currency||"MYR"; $("invoiceCustomer").value=inv?.customer_id||""; $("invoiceNotes").value=inv?.notes||"";
    (inv?.items?.length?inv.items:[{description:"",quantity:1,unit_price:0}]).forEach(addItemRow);
    $("invoiceDialog").showModal();
  }
  async function saveInvoice(e) {
    e.preventDefault(); const items=getItems(); if(!items.length) return toast("Add at least one invoice item.");
    const total=items.reduce((n,x)=>n+x.quantity*x.unit_price,0), id=$("invoiceId").value;
    const payload={business_id:businessId(),customer_id:$("invoiceCustomer").value,invoice_number:$("invoiceNumber").value.trim(),issue_date:$("issueDate").value,due_date:$("dueDate").value,status:$("invoiceStatus").value,currency:$("invoiceCurrency").value,notes:$("invoiceNotes").value,total};
    if(!payload.customer_id) return toast("Please select a customer.");
    let result;
    if(id) result=await client().from("invoice_documents").update(payload).eq("id",id).eq("business_id",businessId()).select().single();
    else result=await client().from("invoice_documents").insert(payload).select().single();
    if(result.error) return toast(result.error.message);
    const invoiceId=result.data.id;
    const del=await client().from("invoice_items").delete().eq("invoice_id",invoiceId);
    if(del.error) return toast(del.error.message);
    const itemRows=items.map(x=>({...x,invoice_id:invoiceId,business_id:businessId(),line_total:x.quantity*x.unit_price}));
    const ins=await client().from("invoice_items").insert(itemRows);
    if(ins.error) return toast(ins.error.message);
    $("invoiceDialog").close(); await loadData(); toast("Invoice saved.");
  }
  async function editInvoice(id) {
    const {data,error}=await client().from("invoice_documents").select("*,items:invoice_items(*)").eq("id",id).eq("business_id",businessId()).single();
    if(error) return toast(error.message); openInvoice(data);
  }
  async function deleteInvoice(id) {
    if(!confirm("Delete this invoice? This cannot be undone.")) return;
    const {error}=await client().from("invoice_documents").delete().eq("id",id).eq("business_id",businessId());
    if(error) return toast(error.message); await loadData(); toast("Invoice deleted.");
  }
  function openCustomer(c=null) {
    $("customerForm").reset(); $("customerId").value=c?.id||""; $("customerModalTitle").textContent=c?"Edit customer":"Add customer";
    $("customerName").value=c?.name||""; $("customerEmail").value=c?.email||""; $("customerPhone").value=c?.phone||""; $("customerAddress").value=c?.address||"";
    $("customerDialog").showModal();
  }
  async function saveCustomer(e) {
    e.preventDefault(); const id=$("customerId").value, payload={business_id:businessId(),name:$("customerName").value.trim(),email:$("customerEmail").value.trim()||null,phone:$("customerPhone").value.trim()||null,address:$("customerAddress").value.trim()||null};
    const res=id?await client().from("invoice_customers").update(payload).eq("id",id).eq("business_id",businessId()):await client().from("invoice_customers").insert(payload);
    if(res.error) return toast(res.error.message); $("customerDialog").close(); await loadData(); toast("Customer saved.");
  }
  async function deleteCustomer(id) {
    if(!confirm("Delete this customer? Customers linked to invoices cannot be deleted.")) return;
    const {error}=await client().from("invoice_customers").delete().eq("id",id).eq("business_id",businessId());
    if(error) return toast(error.message); await loadData(); toast("Customer deleted.");
  }
  async function saveBusiness(e) {
    e.preventDefault(); const payload={name:$("businessName").value.trim(),email:$("businessEmail").value.trim()||null,phone:$("businessPhone").value.trim()||null,address:$("businessAddress").value.trim()||null,currency:$("businessCurrency").value};
    const {data,error}=await client().from("invoice_businesses").update(payload).eq("id",businessId()).select().single();
    if(error) return toast(error.message); state.business=data; await loadData(); toast("Business profile updated.");
  }
  function exportCsv() {
    const rows=[["Invoice","Customer","Issue date","Due date","Currency","Total","Status"],...state.invoices.map(x=>[x.invoice_number,x.invoice_customers?.name||"",x.issue_date,x.due_date,x.currency,x.total,x.status])];
    const csv=rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="eonix-invoices.csv"; a.click(); URL.revokeObjectURL(a.href);
  }
  async function boot() {
    if(!configured()) { showAuth("Setup required: add your Supabase URL and anon key in assets/js/config.js."); return; }
    const {data:{session}}=await client().auth.getSession();
    if(session) { state.user=session.user; try { await loadBusiness(); await loadData(); showApp(); } catch(e) { showAuth(e.message); } }
    else showAuth();
    client().auth.onAuthStateChange(async(_event,session)=>{ if(!session){state.user=null;state.business=null;showAuth();} else if(!state.user){state.user=session.user;try{await loadBusiness();await loadData();showApp();}catch(e){showAuth(e.message);}} });
  }
  document.querySelectorAll("[data-auth-tab]").forEach(b=>b.onclick=()=>{state.authMode=b.dataset.authTab;document.querySelectorAll("[data-auth-tab]").forEach(x=>x.classList.toggle("active",x===b));$("authSubmit").textContent=state.authMode==="login"?"Sign in":"Create account";$("authMessage").textContent="";});
  $("authForm").onsubmit=async e=>{e.preventDefault();if(!configured())return showAuth("Add your Supabase URL and anon key in assets/js/config.js first.");const email=$("authEmail").value,password=$("authPassword").value;const res=state.authMode==="login"?await client().auth.signInWithPassword({email,password}):await client().auth.signUp({email,password});if(res.error)$("authMessage").textContent=res.error.message;else if(state.authMode==="signup"&&!res.data.session)$("authMessage").textContent="Account created. Check your email to confirm, then sign in.";else toast("Signed in.");};
  $("signOutBtn").onclick=()=>client().auth.signOut();
  document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>setPage(b.dataset.page));
  document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>setPage(b.dataset.goto));
  $("newInvoiceBtn").onclick=$("newInvoiceTop").onclick=$("quickCreate").onclick=()=>{if(!state.customers.length){toast("Add a customer first.");setPage("customers");return;}openInvoice();};
  $("addCustomerBtn").onclick=()=>openCustomer(); $("addItemBtn").onclick=()=>addItemRow();
  $("invoiceForm").onsubmit=saveInvoice; $("customerForm").onsubmit=saveCustomer; $("businessForm").onsubmit=saveBusiness;
  $("invoiceSearch").oninput=renderInvoices; $("statusFilter").onchange=renderInvoices; $("customerSearch").oninput=renderCustomers;
  $("invoiceCurrency").onchange=updateTotal; $("exportCsvBtn").onclick=exportCsv;
  $("themeBtn").onclick=()=>{const next=document.documentElement.dataset.theme==="dark"?"light":"dark";document.documentElement.dataset.theme=next;localStorage.setItem("eonix-theme",next);};
  const savedTheme=localStorage.getItem("eonix-theme");if(savedTheme)document.documentElement.dataset.theme=savedTheme;
  $("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  document.addEventListener("click",e=>{const t=e.target.closest("[data-edit-invoice]");if(t)editInvoice(t.dataset.editInvoice);const d=e.target.closest("[data-delete-invoice]");if(d)deleteInvoice(d.dataset.deleteInvoice);const c=e.target.closest("[data-edit-customer]");if(c)openCustomer(state.customers.find(x=>x.id===c.dataset.editCustomer));const dc=e.target.closest("[data-delete-customer]");if(dc)deleteCustomer(dc.dataset.deleteCustomer);});
  boot();
})();