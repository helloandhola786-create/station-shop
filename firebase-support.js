
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDocs, query, where, orderBy, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAChZX1d3x3HEzwNsnQIFJKuHiSUkwJUxc",
  authDomain: "station-shop-1.firebaseapp.com",
  projectId: "station-shop-1",
  storageBucket: "station-shop-1.firebasestorage.app",
  messagingSenderId: "594867843968",
  appId: "1:594867843968:web:be74ec279070e61deb8765",
  measurementId: "G-DPXLS6KGXM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));

const money = value => "৳" + Number(value || 0).toLocaleString("en-BD");

const currentCustomer = () => {
  try {
    return JSON.parse(localStorage.getItem("ss_current_customer") || "null");
  } catch {
    return null;
  }
};

function report(error) {
  console.error("Station Shop support:", error);
  if (typeof window.toast === "function") {
    window.toast("Firebase error: " + (error.message || error));
  } else {
    alert("Firebase error: " + (error.message || error));
  }
}

async function customerUid() {
  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    await signOut(auth);
  }
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
  return auth.currentUser.uid;
}

function ownerSignedIn() {
  return !!auth.currentUser && !auth.currentUser.isAnonymous;
}

function ownerLogin() {
  const box = $("adminContent");

  box.innerHTML = `
    <div class="panel" style="max-width:440px">
      <h3>Owner verification</h3>
      <p class="muted">Use the Firebase owner email and password already created for this project.</p>
      <form id="supportOwnerForm">
        <div class="field">
          <label>Owner email</label>
          <input name="email" type="email" required>
        </div>
        <div class="field">
          <label>Owner password</label>
          <input name="password" type="password" required>
        </div>
        <button class="btn primary">Sign in</button>
      </form>
    </div>`;

  $("supportOwnerForm").onsubmit = async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const button = e.currentTarget.querySelector("button");
    button.disabled = true;

    try {
      await signInWithEmailAndPassword(auth, data.email.trim(), data.password);
      window.showAdminOrders();
    } catch (error) {
      report(error);
      button.disabled = false;
    }
  };
}

function requireOwner() {
  if (!ownerSignedIn()) {
    ownerLogin();
    return false;
  }
  return true;
}

async function saveCloudOrder(order) {
  const uid = await customerUid();

  await setDoc(doc(db, "orders", order.id), {
    ...order,
    customerUid: uid,
    createdAt: serverTimestamp(),
    statusUpdatedAt: serverTimestamp()
  });
}

const originalConfirmation = window.showConfirmation;

if (typeof originalConfirmation === "function") {
  window.showConfirmation = async function(order) {
    try {
      await saveCloudOrder(order);
    } catch (error) {
      report(error);
    }
    return originalConfirmation(order);
  };
}

window.renderChat = function renderHelpDesk() {
  const box = $("chatContent");
  if (!box) return;

  if (!currentCustomer()) {
    box.innerHTML = `
      <div class="panel">
        <h3>Help Desk</h3>
        <p class="muted">Please create an account or sign in before sending a help request.</p>
        <button class="btn primary" onclick="openAccount()">Sign in / Create account</button>
      </div>`;
    return;
  }

  box.innerHTML = `
    <div class="panel">
      <h3>Need help?</h3>
      <p class="muted">Send a request to the store owner. The reply will appear below.</p>
      <form id="helpRequestForm">
        <div class="field">
          <label>Topic</label>
          <select name="topic">
            <option>Order issue</option>
            <option>Product question</option>
            <option>Account issue</option>
            <option>Other</option>
          </select>
        </div>
        <div class="field">
          <label>Message</label>
          <textarea name="message" required maxlength="1200" placeholder="Write your question..."></textarea>
        </div>
        <button class="btn primary">Submit request</button>
      </form>
    </div>
    <div class="panel">
      <h3>My help requests</h3>
      <div id="myHelpRequests">Loading…</div>
    </div>`;

  loadMyTickets().catch(report);

  $("helpRequestForm").onsubmit = async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    if (!data.message.trim()) return;

    const button = form.querySelector("button");
    button.disabled = true;

    try {
      const uid = await customerUid();
      const person = currentCustomer();

      await setDoc(doc(collection(db, "helpTickets")), {
        customerUid: uid,
        customerName: person.name || "Customer",
        customerPhone: person.phone || "",
        topic: data.topic,
        message: data.message.trim(),
        reply: "",
        status: "Open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      form.reset();
      await loadMyTickets();
      window.toast?.("Help request sent");
    } catch (error) {
      report(error);
    } finally {
      button.disabled = false;
    }
  };
};

window.openChat = function() {
  window.setView("chat");
  window.renderChat();
};

async function loadMyTickets() {
  const target = $("myHelpRequests");
  if (!target) return;

  const uid = await customerUid();

  const snap = await getDocs(query(
    collection(db, "helpTickets"),
    where("customerUid", "==", uid)
  ));

  const items = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  })).sort((a, b) =>
    (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
  );

  target.innerHTML = items.length
    ? items.map(t => `
      <div class="history-order">
        <strong>${esc(t.topic)} · ${esc(t.status)}</strong>
        <p>${esc(t.message)}</p>
        ${t.reply
          ? `<div class="answer"><strong>Store reply:</strong><br>${esc(t.reply)}</div>`
          : `<small class="muted">Waiting for reply</small>`}
      </div>`).join("")
    : `<p class="muted">No requests yet.</p>`;
}

window.showAdminChats = async function showHelpDeskInbox() {
  if (!requireOwner()) return;

  const box = $("adminContent");
  box.innerHTML = `<h3>Help Desk requests</h3><p class="muted">Loading…</p>`;

  try {
    const snap = await getDocs(query(
      collection(db, "helpTickets"),
      orderBy("createdAt", "desc")
    ));

    const tickets = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    box.innerHTML = `
      <h3>Help Desk requests (${tickets.length})</h3>
      ${tickets.length
        ? `<div class="admin-list">${tickets.map(t => `
          <div class="admin-row">
            <span>
              <strong>${esc(t.topic)} · ${esc(t.status)}</strong><br>
              <small>${esc(t.customerName)} · ${esc(t.customerPhone)}<br>${esc(t.message)}</small>
            </span>
            <div class="row-actions">
              <button data-ticket="${esc(t.id)}">Reply</button>
            </div>
          </div>`).join("")}</div>`
        : `<div class="empty">No help requests yet.</div>`}`;

    box.querySelectorAll("[data-ticket]").forEach(b => {
      b.onclick = () => showTicket(tickets.find(t => t.id === b.dataset.ticket));
    });
  } catch (error) {
    report(error);
  }
};

function showTicket(ticket) {
  const box = $("adminContent");

  box.innerHTML = `
    <button class="text-link" id="backTickets">← Back</button>
    <h3>${esc(ticket.topic)}</h3>
    <div class="panel">
      <p><strong>${esc(ticket.customerName)}</strong> · ${esc(ticket.customerPhone)}</p>
      <p>${esc(ticket.message)}</p>
      <div class="field">
        <label>Reply</label>
        <textarea id="ticketReply">${esc(ticket.reply || "")}</textarea>
      </div>
      <div class="field">
        <label>Status</label>
        <select id="ticketStatus">
          ${["Open", "In progress", "Resolved"].map(s =>
            `<option ${ticket.status === s ? "selected" : ""}>${s}</option>`
          ).join("")}
        </select>
      </div>
      <button class="btn primary" id="saveTicketReply">Save reply</button>
    </div>`;

  $("backTickets").onclick = () => window.showAdminChats();

  $("saveTicketReply").onclick = async () => {
    try {
      await updateDoc(doc(db, "helpTickets", ticket.id), {
        reply: $("ticketReply").value.trim(),
        status: $("ticketStatus").value,
        updatedAt: serverTimestamp()
      });

      window.showAdminChats();
      window.toast?.("Reply saved");
    } catch (error) {
      report(error);
    }
  };
}

window.showAdminOrders = async function showSharedOrders() {
  if (!requireOwner()) return;

  const box = $("adminContent");
  box.innerHTML = `<h3>Customer orders</h3><p class="muted">Loading…</p>`;

  try {
    const snap = await getDocs(query(
      collection(db, "orders"),
      orderBy("createdAt", "desc")
    ));

    const items = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    box.innerHTML = `
      <h3>Customer orders (${items.length})</h3>
      ${items.length
        ? `<div class="admin-list">${items.map(o => `
          <div class="admin-row">
            <span>
              <strong>${esc(o.id)}</strong><br>
              <small>${esc(o.customer?.name)} · ${esc(o.customer?.phone)}<br>
              ${o.items?.length || 0} item(s) · ${money(o.total)} · ${esc(o.status)}</small>
            </span>
            <div class="row-actions">
              <button data-order="${esc(o.id)}">Details / update</button>
            </div>
          </div>`).join("")}</div>`
        : `<div class="empty">No shared orders yet.</div>`}`;

    box.querySelectorAll("[data-order]").forEach(b => {
      b.onclick = () => showCloudOrder(items.find(o => o.id === b.dataset.order));
    });
  } catch (error) {
    report(error);
  }
};

function showCloudOrder(order) {
  const box = $("adminContent");

  box.innerHTML = `
    <button class="text-link" id="backCloudOrders">← Back to orders</button>
    <h3>Order ${esc(order.id)}</h3>
    <div class="panel">
      <strong>Customer</strong>
      <p class="muted">
        ${esc(order.customer?.name)} · ${esc(order.customer?.phone)}<br>
        ${esc(order.customer?.address)}, ${esc(order.customer?.area)},
        ${esc(order.customer?.district)}, ${esc(order.customer?.division)}
      </p>
      <strong>Items</strong>
      <p class="muted">
        ${(order.items || []).map(i =>
          `${esc(i.name)} × ${i.qty} — ${money(i.price * i.qty)}`
        ).join("<br>")}
      </p>
      <div class="summary-line">
        <span>Total</span><strong>${money(order.total)}</strong>
      </div>
      <div class="field">
        <label>Status</label>
        <select id="cloudOrderStatus">
          ${["Pending", "Confirmed", "Processing", "Shipped", "Completed", "Cancelled"].map(s =>
            `<option ${order.status === s ? "selected" : ""}>${s}</option>`
          ).join("")}
        </select>
      </div>
      <button class="btn primary" id="saveCloudStatus">Save status</button>
    </div>`;

  $("backCloudOrders").onclick = () => window.showAdminOrders();

  $("saveCloudStatus").onclick = async () => {
    try {
      const status = $("cloudOrderStatus").value;

      await updateDoc(doc(db, "orders", order.id), {
        status,
        statusUpdatedAt: serverTimestamp()
      });

      const local = JSON.parse(localStorage.getItem("ss_orders") || "[]");
      const match = local.find(o => o.id === order.id);

      if (match) {
        match.status = status;
        localStorage.setItem("ss_orders", JSON.stringify(local));
      }

      window.toast?.("Order status updated");
      window.showAdminOrders();
    } catch (error) {
      report(error);
    }
  };
}

const originalRenderAccount = window.renderAccount;

if (typeof originalRenderAccount === "function") {
  window.renderAccount = function() {
    originalRenderAccount();

    if (!currentCustomer() || !$("accountContent")) return;

    const old = $("sharedOrderUpdates");
    if (old) old.remove();

    const section = document.createElement("div");
    section.id = "sharedOrderUpdates";
    section.className = "account-card";
    section.innerHTML = `<h3>Order updates</h3><p class="muted">Loading shared order updates…</p>`;

    $("accountContent").appendChild(section);

    customerUid()
      .then(uid => getDocs(query(
        collection(db, "orders"),
        where("customerUid", "==", uid)
      )))
      .then(snap => {
        const items = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        })).sort((a, b) =>
          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );

        section.innerHTML = `
          <h3>Order updates (${items.length})</h3>
          ${items.length
            ? items.map(o => `
              <div class="history-order">
                <strong>${esc(o.id)}</strong> · <strong>${esc(o.status)}</strong>
                <p class="muted">${o.items?.length || 0} item(s) · ${money(o.total)}</p>
              </div>`).join("")
            : `<p class="muted">No shared orders yet.</p>`}`;
      })
      .catch(error => {
        section.innerHTML = `<p class="muted">Order updates unavailable: ${esc(error.message)}</p>`;
      });
  };
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#mainNav button").forEach(b => {
    if (b.textContent.trim() === "LIVE CHAT") b.textContent = "HELP DESK";
  });

  document.querySelectorAll(".admin-tabs button").forEach(b => {
    if (b.textContent.toLowerCase().includes("live chat")) b.textContent = "Help Desk";
  });

  const float = document.querySelector(".chat-float");
  if (float) {
    float.innerHTML = "❔ <span>Help Desk</span>";
    float.setAttribute("aria-label", "Open Help Desk");
  }

  const heading = document.querySelector("#chatView h2");
  if (heading) heading.textContent = "Help Desk";
});
