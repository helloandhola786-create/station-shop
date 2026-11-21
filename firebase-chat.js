
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInAnonymously, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, setDoc, updateDoc, addDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

let customerMessagesStop = null;
let adminConversationsStop = null;
let adminMessagesStop = null;
let selectedConversationId = null;

const $ = (id) => document.getElementById(id);
const getShopCustomer = () => {
  try {
    return JSON.parse(localStorage.getItem("ss_current_customer") || "null");
  } catch { return null; }
};
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[ch]));
const dateText = (stamp) => {
  try {
    const d = stamp?.toDate ? stamp.toDate() : null;
    return d ? d.toLocaleString() : "Sending…";
  } catch { return ""; }
};

function addChatStyles() {
  if ($("firebaseChatStyles")) return;
  const style = document.createElement("style");
  style.id = "firebaseChatStyles";
  style.textContent = `
    .fc-chat{border:1px solid var(--line);background:#fff;border-radius:13px;overflow:hidden}
    .fc-chat-head{padding:13px 15px;background:var(--soft);color:var(--forest);font-weight:800}
    .fc-messages{height:min(48vh,430px);min-height:230px;overflow:auto;padding:14px;background:#fbfdf9;display:flex;flex-direction:column;gap:9px}
    .fc-msg{max-width:84%;padding:9px 12px;border-radius:12px;background:#edf3e9;align-self:flex-start;overflow-wrap:anywhere}
    .fc-msg.mine{background:#e5f4d6;align-self:flex-end}
    .fc-msg small{display:block;color:#718071;font-size:10px;margin-top:5px}
    .fc-send{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line)}
    .fc-send input{flex:1;min-width:0;border:1px solid var(--line);border-radius:8px;padding:11px}
    .fc-send button{border-radius:8px;padding:10px 15px;background:var(--parrot);color:var(--deep);font-weight:800}
    .fc-admin-layout{display:grid;grid-template-columns:minmax(150px,.7fr) 1.3fr;gap:12px}
    .fc-conv-list{display:grid;gap:7px;align-content:start;max-height:440px;overflow:auto}
    .fc-conv{padding:10px;border:1px solid var(--line);border-radius:8px;background:#fff;text-align:left;color:var(--ink)}
    .fc-conv.active{border-color:var(--parrot);background:var(--soft)}
    .fc-conv small{display:block;color:var(--muted);margin-top:4px;overflow-wrap:anywhere}
    .fc-login{max-width:420px}
    @media(max-width:600px){.fc-admin-layout{grid-template-columns:1fr}.fc-conv-list{max-height:190px}.fc-msg{max-width:94%}}
  `;
  document.head.appendChild(style);
}

function stopCustomerListener() {
  if (customerMessagesStop) customerMessagesStop();
  customerMessagesStop = null;
}
function stopAdminListeners() {
  if (adminConversationsStop) adminConversationsStop();
  if (adminMessagesStop) adminMessagesStop();
  adminConversationsStop = null;
  adminMessagesStop = null;
}

function chatError(error) {
  console.error("Station Shop Live Chat:", error);
  const box = $("chatContent") || $("adminContent");
  if (box) {
    const old = box.querySelector(".fc-error");
    if (old) old.remove();
    const p = document.createElement("p");
    p.className = "note fc-error";
    p.style.marginTop = "10px";
    p.textContent = "Connection problem: " + (error?.message || "Please check Firebase settings and Firestore Rules.");
    box.appendChild(p);
  }
}

function renderMessageList(container, docs, myUid) {
  container.innerHTML = docs.map(item => {
    const m = item.data();
    const mine = m.senderUid === myUid;
    return `<div class="fc-msg ${mine ? "mine" : ""}">
      <div>${esc(m.text)}</div><small>${m.senderRole === "owner" ? "Store owner" : "Customer"} · ${esc(dateText(m.createdAt))}</small>
    </div>`;
  }).join("") || '<p class="muted">No messages yet. Send the first message.</p>';
  container.scrollTop = container.scrollHeight;
}

async function ensureCustomerConversation() {
  let user = auth.currentUser;
  if (user && !user.isAnonymous) {
    throw new Error("This browser is signed in to the owner account. Please open the customer site in another browser or sign out of the owner account first.");
  }
  if (!user) {
    const result = await signInAnonymously(auth);
    user = result.user;
  }
  const customer = getShopCustomer() || {};
  const conversationRef = doc(db, "conversations", user.uid);
  const snapshot = await getDoc(conversationRef);
  const details = {
    customerUid: user.uid,
    customerName: String(customer.name || "Station Shop customer").slice(0, 80),
    customerPhone: String(customer.phone || "").slice(0, 20),
    updatedAt: serverTimestamp()
  };
  if (!snapshot.exists()) {
    await setDoc(conversationRef, {
      ...details,
      createdAt: serverTimestamp(),
      lastMessage: "",
      lastMessageAt: serverTimestamp()
    });
  } else {
    await updateDoc(conversationRef, details);
  }
  return { user, conversationRef };
}
  if (!user) {
    const result = await signInAnonymously(auth);
    user = result.user;
  }
  const customer = getShopCustomer() || {};
  const conversationRef = doc(db, "conversations", user.uid);
  const snapshot = await getDoc(conversationRef);
  const details = {
    customerUid: user.uid,
    customerName: String(customer.name || "Station Shop customer").slice(0, 80),
    customerPhone: String(customer.phone || "").slice(0, 20),
    updatedAt: serverTimestamp()
  };
  if (!snapshot.exists()) {
    await setDoc(conversationRef, {
      ...details,
      createdAt: serverTimestamp(),
      lastMessage: "",
      lastMessageAt: serverTimestamp()
    });
  } else {
    await updateDoc(conversationRef, details);
  }
  return { user, conversationRef };
}

window.renderChat = async function renderChatFirebase() {
  addChatStyles();
  stopCustomerListener();
  const box = $("chatContent");
  if (!box) return;
  if (!getShopCustomer()) {
    box.innerHTML = `<div class="panel"><h3>Chat with Station Shop</h3>
      <p class="muted">Please sign in or create a customer account before starting a conversation.</p>
      <button class="btn primary" onclick="openAccount()">Sign in / Create account</button></div>`;
    return;
  }
  box.innerHTML = `<div class="panel"><h3>Connecting to the store…</h3><p class="muted">Please wait a moment.</p></div>`;
  try {
    const { user, conversationRef } = await ensureCustomerConversation();
    box.innerHTML = `<div class="fc-chat">
      <div class="fc-chat-head">Chat with the store owner</div>
      <div class="fc-messages" id="fcCustomerMessages"><p class="muted">Loading messages…</p></div>
      <form class="fc-send" id="fcCustomerForm">
        <input id="fcCustomerText" maxlength="1500" required placeholder="Write your message…" autocomplete="off">
        <button type="submit">Send</button>
      </form>
    </div><p class="muted" style="margin-top:9px">Messages are sent privately to the Station Shop owner.</p>`;
    const messagesBox = $("fcCustomerMessages");
    const messagesQuery = query(collection(conversationRef, "messages"), orderBy("createdAt", "asc"));
    customerMessagesStop = onSnapshot(messagesQuery, snap => renderMessageList(messagesBox, snap.docs, user.uid), chatError);
    $("fcCustomerForm").onsubmit = async (event) => {
      event.preventDefault();
      const input = $("fcCustomerText");
      const text = input.value.trim();
      if (!text) return;
      input.disabled = true;
      try {
        await addDoc(collection(conversationRef, "messages"), {
          senderUid: user.uid, senderRole: "customer", text,
          createdAt: serverTimestamp()
        });
        await updateDoc(conversationRef, {
          lastMessage: text.slice(0, 160),
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        input.value = "";
      } catch (error) { chatError(error); }
      finally { input.disabled = false; input.focus(); }
    };
  } catch (error) {
    box.innerHTML = `<div class="panel"><h3>Live Chat could not connect</h3><p class="muted">${esc(error.message)}</p><button class="btn light" onclick="renderChat()">Try again</button></div>`;
  }
};

function adminLoginMarkup(message = "") {
  const c = $("adminContent");
  c.innerHTML = `<div class="fc-login">
    <h3>Owner sign-in for Live Chat</h3>
    <p class="muted">Use the Firebase Email/Password account created for the store owner. This is separate from the demo passcode 2468.</p>
    ${message ? `<p class="note">${esc(message)}</p>` : ""}
    <form id="fcOwnerLogin">
      <div class="field"><label>Owner email</label><input id="fcOwnerEmail" type="email" required autocomplete="username"></div>
      <div class="field"><label>Owner password</label><input id="fcOwnerPassword" type="password" required autocomplete="current-password"></div>
      <button class="btn primary" type="submit">Sign in to Live Chats</button>
    </form>
  </div>`;
  $("fcOwnerLogin").onsubmit = async (event) => {
    event.preventDefault();
    const email = $("fcOwnerEmail").value.trim();
    const password = $("fcOwnerPassword").value;
    const button = event.submitter;
    button.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showOwnerInbox();
    } catch (error) {
      adminLoginMarkup("Sign-in failed. Check the owner email/password and make sure Email/Password is enabled in Firebase Authentication. (" + error.message + ")");
    }
  };
}

function showOwnerInbox() {
  addChatStyles();
  stopAdminListeners();
  const c = $("adminContent");
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    adminLoginMarkup();
    return;
  }
    const currentUid = auth.currentUser.uid;
  c.innerHTML = `<div class="fc-owner">
    <div class="fc-owner-head">
      <h3>Live Chats</h3>
      <button class="btn light" id="fcOwnerSignOut">Sign out</button>
    </div>
    <div class="fc-owner-layout">
      <div class="fc-chat-list" id="fcConversationList">
        <p class="muted">Loading conversations…</p>
      </div>
      <div class="fc-chat" id="fcOwnerChat">
        <p class="muted">Select a customer conversation to reply.</p>
      </div>
    </div>
  </div>`;

  $("fcOwnerSignOut").onclick = async () => {
    stopAdminListeners();
    await signOut(auth);
    adminLoginMarkup("You have signed out.");
  };

  const conversationsQuery = query(
    collection(db, "conversations"),
    orderBy("updatedAt", "desc")
  );

  adminConversationsStop = onSnapshot(conversationsQuery, snap => {
    const list = $("fcConversationList");
    if (!list) return;

    if (snap.empty) {
      list.innerHTML = `<p class="muted">No customer messages yet.</p>`;
      return;
    }

    list.innerHTML = snap.docs.map(item => {
      const data = item.data();
      return `<button class="fc-conversation" data-uid="${esc(item.id)}">
        <strong>${esc(data.customerName || "Customer")}</strong>
        <span>${esc(data.customerPhone || "")}</span>
        <small>${esc(data.lastMessage || "No messages yet")}</small>
      </button>`;
    }).join("");

    list.querySelectorAll("[data-uid]").forEach(button => {
      button.onclick = () => openOwnerConversation(button.dataset.uid);
    });
  }, chatError);
}

let adminConversationsStop = null;
let adminMessagesStop = null;

function stopAdminListeners() {
  if (adminConversationsStop) {
    adminConversationsStop();
    adminConversationsStop = null;
  }
  if (adminMessagesStop) {
    adminMessagesStop();
    adminMessagesStop = null;
  }
}

function openOwnerConversation(customerUid) {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    adminLoginMarkup("Please sign in as the store owner.");
    return;
  }

  if (adminMessagesStop) {
    adminMessagesStop();
    adminMessagesStop = null;
  }

  const conversationRef = doc(db, "conversations", customerUid);
  const chat = $("fcOwnerChat");
  if (!chat) return;

  chat.innerHTML = `<div class="fc-chat-head">Customer conversation</div>
    <div class="fc-messages" id="fcOwnerMessages">
      <p class="muted">Loading messages…</p>
    </div>
    <form class="fc-send" id="fcOwnerForm">
      <input id="fcOwnerText" maxlength="1500" required placeholder="Write a reply…" autocomplete="off">
      <button type="submit">Send</button>
    </form>`;

  const messagesBox = $("fcOwnerMessages");
  const messagesQuery = query(
    collection(conversationRef, "messages"),
    orderBy("createdAt", "asc")
  );

  adminMessagesStop = onSnapshot(messagesQuery, snap => {
    renderMessageList(messagesBox, snap.docs, auth.currentUser.uid);
  }, chatError);

  $("fcOwnerForm").onsubmit = async event => {
    event.preventDefault();
    const input = $("fcOwnerText");
    const text = input.value.trim();
    if (!text) return;

    input.disabled = true;
    try {
      await addDoc(collection(conversationRef, "messages"), {
        senderUid: auth.currentUser.uid,
        senderRole: "owner",
        text,
        createdAt: serverTimestamp()
      });

      await updateDoc(conversationRef, {
        lastMessage: text.slice(0, 160),
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      input.value = "";
    } catch (error) {
      chatError(error);
    } finally {
      input.disabled = false;
      input.focus();
    }
  };
}

window.showAdminChats = function showAdminChatsFirebase() {
  addChatStyles();

  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    stopAdminListeners();
    adminLoginMarkup();
    return;
  }

  showOwnerInbox();
};

window.addEventListener("beforeunload", () => {
  stopCustomerListener();
  stopAdminListeners();
});
