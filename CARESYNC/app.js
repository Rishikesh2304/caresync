/* Client-only logic to simulate hospital flows using localStorage/sessionStorage.
   This file is shared across all pages. */

(function(){
  // Helpers
  function $(sel){ return document.querySelector(sel); }
  function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

  // LocalStorage helpers
  function load(key){ try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){ return null; } }
  function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

  // Seed some doctors if none exist
  function seedDoctors(){
    if(!load('doctors') || !Array.isArray(load('doctors')) || load('doctors').length===0){
      const seed = [
        { id: 'd1', name: 'Dr. A. Kumar', email: 'doc1@example.com', fee: 300, specialization: 'General', password: 'doc1pass' },
        { id: 'd2', name: 'Dr. S. Rao', email: 'doc2@example.com', fee: 500, specialization: 'Cardio', password: 'doc2pass' }
      ];
      save('doctors', seed);
    }
  }

  // Generic UI utilities
  function showMessage(el, text, type='success'){
    if(!el) return;
    el.innerHTML = `<div class="alert alert-${type} py-1">${text}</div>`;
    setTimeout(()=>{ el.innerHTML = ''; }, 3500);
  }

  // Authentication helpers (sessionStorage)
  function setCurrentUser(obj){ sessionStorage.setItem('currentUser', JSON.stringify(obj)); }
  function getCurrentUser(){ try { return JSON.parse(sessionStorage.getItem('currentUser')||'null'); } catch(e){ return null; } }
  function logout(){ sessionStorage.removeItem('currentUser'); location.href = 'index.html'; }

  // Page-specific initialization
  function initIndex(){
    seedDoctors();

    // Register patient
    const reg = $('#patientRegisterForm');
    if(reg){
      reg.addEventListener('submit', e=>{
        e.preventDefault();
        const f = Object.fromEntries(new FormData(reg).entries());
        const patients = load('patients') || [];
        if(patients.find(p=>p.email === f.email)){
          showMessage($('#registerMessage'), 'Email already registered', 'danger');
          return;
        }
        patients.push({
          email: f.email, password: f.password, firstName: f.firstName||'', lastName: f.lastName||'', contact: f.contact||'', gender: f.gender||''
        });
        save('patients', patients);
        showMessage($('#registerMessage'), 'Registered successfully. Please login.');
        reg.reset();
      });
    }

    // Patient login
    const pLogin = $('#patientLoginForm');
    if(pLogin){
      pLogin.addEventListener('submit', e=>{
        e.preventDefault();
        const f = Object.fromEntries(new FormData(pLogin).entries());
        const patients = load('patients') || [];
        const user = patients.find(p=>p.email === f.email && p.password === f.password);
        if(!user) return showMessage(document.getElementById('registerMessage') || document.body, 'Invalid patient credentials', 'danger');
        setCurrentUser({ role: 'patient', email: user.email, name: (user.firstName||'') });
        location.href = 'patient-dashboard.html';
      });
    }

    // Doctor login
    const dLogin = $('#doctorLoginForm');
    if(dLogin){
      dLogin.addEventListener('submit', e=>{
        e.preventDefault();
        const f = Object.fromEntries(new FormData(dLogin).entries());
        const doctors = load('doctors') || [];
        const doc = doctors.find(d=>d.email === f.email && d.password === f.password);
        if(!doc) return showMessage(document.getElementById('registerMessage') || document.body, 'Invalid doctor credentials', 'danger');
        setCurrentUser({ role: 'doctor', email: doc.email, name: doc.name });
        location.href = 'doctor-dashboard.html';
      });
    }

    // Admin login (hardcoded)
    const aLogin = $('#adminLoginForm');
    if(aLogin){
      aLogin.addEventListener('submit', e=>{
        e.preventDefault();
        const fd = new FormData(aLogin);
        const user = fd.get('username'), pass = fd.get('password');
        if(user === 'admin' && pass === 'admin123'){
          setCurrentUser({ role: 'admin', email: 'admin', name: 'Administrator' });
          location.href = 'admin-panel.html';
        } else {
          showMessage(document.getElementById('registerMessage') || document.body, 'Invalid admin credentials', 'danger');
        }
      });
    }
  }

  function initPatientDashboard(){
    // verify
    const cu = getCurrentUser();
    if(!cu || cu.role !== 'patient') { alert('Please login as patient'); location.href = 'index.html'; return; }

    const doctorSelect = $('#doctorSelect');
    const doctors = load('doctors') || [];
    doctorSelect.innerHTML = doctors.map(d=>`<option value="${d.email}" data-fee="${d.fee}">${d.name} — ${d.specialization} (₹${d.fee})</option>`).join('');

    // Show appointments
    function renderAppointments(){
      const appts = load('appointments') || [];
      const myAppts = appts.filter(a => a.patientEmail === cu.email);
      const el = $('#appointmentsList');
      if(!el) return;
      el.innerHTML = myAppts.length ? myAppts.map(a => `
        <div class="card"><div class="card-body">
          <strong>${a.doctorName}</strong> — ${a.date} ${a.time} <br>
          Fee: ₹${a.fee}
        </div></div>
      `).join('') : '<p>No appointments yet.</p>';
    }

    // book form
    const bf = $('#bookForm');
    if(bf){
      bf.addEventListener('submit', e=>{
        e.preventDefault();
        const doctorEmail = doctorSelect.value;
        const doctor = (load('doctors')||[]).find(d=>d.email===doctorEmail);
        if(!doctor) return showMessage($('#bookMsg'), 'Please select a valid doctor', 'danger');
        const date = $('#apptDate').value;
        const time = $('#apptTime').value;
        if(!date || !time) return showMessage($('#bookMsg'), 'Select date & time', 'danger');

        const appts = load('appointments') || [];
        appts.push({
          id: 'a'+Date.now(),
          patientEmail: cu.email,
          doctorEmail: doctor.email,
          doctorName: doctor.name,
          fee: Number(doctor.fee),
          date, time
        });
        save('appointments', appts);
        showMessage($('#bookMsg'), 'Appointment created');
        bf.reset();
        renderAppointments();
      });
    }

    // logout button
    const lb = $('#logoutBtn');
    if(lb) lb.addEventListener('click', logout);

    renderAppointments();
  }

  function initDoctorDashboard(){
    const cu = getCurrentUser();
    if(!cu || cu.role !== 'doctor') { alert('Please login as doctor'); location.href = 'index.html'; return; }
    const lb = $('#logoutBtn');
    if(lb) lb.addEventListener('click', logout);

    function render(){
      const appts = load('appointments') || [];
      const mine = appts.filter(a => a.doctorEmail === cu.email);
      const el = $('#docAppointments');
      if(!el) return;
      el.innerHTML = mine.length ? mine.map(a=>`
        <div class="card"><div class="card-body">
         <strong>${a.patientEmail}</strong> — ${a.date} ${a.time} <br> Fee: ₹${a.fee}
        </div></div>
      `).join('') : '<p>No appointments yet.</p>';
    }

    render();
  }

  function initAdminPanel(){
    const cu = getCurrentUser();
    if(!cu || cu.role !== 'admin') { alert('Please login as admin'); location.href = 'index.html'; return; }
    const lb = $('#logoutBtn'); if(lb) lb.addEventListener('click', logout);

    function renderLists(){
      const doctors = load('doctors') || [];
      const patients = load('patients') || [];
      const appts = load('appointments') || [];

      $('#doctorsList').innerHTML = doctors.length ? doctors.map(d=>`<div class="mb-1">${d.name} — ${d.email} — ₹${d.fee}</div>`).join('') : '<p>No doctors</p>';
      $('#patientsList').innerHTML = patients.length ? patients.map(p=>`<div class="mb-1">${p.firstName||''} ${p.lastName||''} — ${p.email}</div>`).join('') : '<p>No patients</p>';
      $('#allAppointments').innerHTML = appts.length ? appts.map(a=>`<div class="card"><div class="card-body">${a.patientEmail} → ${a.doctorName} — ${a.date} ${a.time} — ₹${a.fee}</div></div>`).join('') : '<p>No appointments</p>';
    }

    const addDocForm = $('#addDoctorForm');
    if(addDocForm){
      addDocForm.addEventListener('submit', e=>{
        e.preventDefault();
        const f = Object.fromEntries(new FormData(addDocForm).entries());
        const doctors = load('doctors') || [];
        if(doctors.find(d=>d.email === f.email)) return showMessage(document.getElementById('doctorsList'), 'Doctor email exists', 'danger');
        doctors.push({ id: 'd'+Date.now(), name: f.name, email: f.email, fee: Number(f.fee) || 0, specialization: f.specialization||'General', password: f.password });
        save('doctors', doctors);
        addDocForm.reset();
        renderLists();
      });
    }

    renderLists();
  }

  function initContact(){
    const cf = $('#contactForm');
    const ml = $('#messagesList');
    if(cf){
      cf.addEventListener('submit', e=>{
        e.preventDefault();
        const f = Object.fromEntries(new FormData(cf).entries());
        const messages = load('messages') || [];
        messages.push({ id: 'm'+Date.now(), name: f.name, email: f.email, message: f.message, created: new Date().toISOString() });
        save('messages', messages);
        showMessage($('#contactMsg'), 'Message saved locally');
        cf.reset();
        renderMessages();
      });
    }
    function renderMessages(){
      const messages = load('messages') || [];
      if(ml) ml.innerHTML = messages.length ? messages.map(m=>`<div class="card mb-1"><div class="card-body"><strong>${m.name}</strong> — ${m.email}<br>${m.message}</div></div>`).join('') : '<p>No messages</p>';
    }
    renderMessages();
  }

  // On load, route init by checking body or path
  document.addEventListener('DOMContentLoaded', function(){
    seedDoctors();
    const path = location.pathname.split('/').pop();

    if(path === '' || path === 'index.html') initIndex();
    if(path === 'patient-dashboard.html') initPatientDashboard();
    if(path === 'doctor-dashboard.html') initDoctorDashboard();
    if(path === 'admin-panel.html') initAdminPanel();
    if(path === 'contact.html') initContact();

    // generic logout buttons present on several pages
    $all('#logoutBtn').forEach(b => b.addEventListener('click', logout));
  });
})();
