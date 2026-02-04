(function(){
  const btnOpenCam = document.getElementById('btnOpenCam');
  const btnCapture = document.getElementById('btnCapture');
  const btnIdentify = document.getElementById('btnIdentify');
  const btnIdentifyServer = document.getElementById('btnIdentifyServer');
  const video = document.getElementById('video');
  const canvas = document.getElementById('captureCanvas');
  const previewWrap = document.getElementById('previewWrap');
  const imageInput = document.getElementById('imageInput');
  const classifyResults = document.getElementById('classifyResults');
  const ingredientsText = document.getElementById('ingredientsText');

  let stream = null;
  let model = null;

  function escapeHtml(s){
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  }

  function showSmall(msg){
    if(!classifyResults) return;
    classifyResults.innerHTML = `<div class="status">${escapeHtml(msg)}</div>` + classifyResults.innerHTML;
    setTimeout(()=>{ const s = classifyResults.querySelector('.status'); if(s) s.remove(); },1500);
  }

  function renderServerIngredients(res){
    if(!classifyResults || !res) return;
    const items = [];
    if(res.dish) items.push(res.dish);
    if(Array.isArray(res.ingredients)) res.ingredients.forEach(it=> items.push(it));
    const filtered = items.map(filterIngredientName).filter(Boolean);
    if(!filtered.length) return;
    classifyResults.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '8px';
    filtered.forEach(name=>{
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      const left = document.createElement('div');
      left.innerHTML = `<div style="font-weight:700">${escapeHtml(name)}</div><div style="opacity:0.8;font-size:12px">Server</div>`;
      const right = document.createElement('div');
      right.style.display = 'flex';
      right.style.gap = '8px';
      right.style.alignItems = 'center';
      const chip = document.createElement('button');
      chip.className = 'btn btn-ghost';
      chip.type = 'button';
      chip.textContent = name;
      chip.title = 'Thêm vào danh sách nguyên liệu';
      chip.addEventListener('click', ()=> appendIngredient(name));
      right.appendChild(chip);
      row.appendChild(left);
      row.appendChild(right);
      wrap.appendChild(row);
    });
    classifyResults.appendChild(wrap);
  }

  async function ensureModel(){
    if(model) return model;
    if(classifyResults) classifyResults.textContent = 'Đang tải mô hình nhận diện...';
    try{
      model = await mobilenet.load();
      if(classifyResults) classifyResults.textContent = '';
      return model;
    }catch(e){
      if(classifyResults) classifyResults.textContent = 'Không tải được mô hình (kiểm tra kết nối).';
      console.error(e);
    }
  }

  function getPreviewDataUrl(img){
    let dataUrl = img.src;
    if(dataUrl.startsWith('blob:') || dataUrl.startsWith('object:')){
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img,0,0);
      dataUrl = c.toDataURL('image/jpeg',0.9);
    }
    return dataUrl;
  }

  function showPreview(src, revoke=false){
    const placeholder = document.getElementById('previewPlaceholder');
    previewWrap.innerHTML = '';
    if(placeholder){
      placeholder.style.display = 'none';
      previewWrap.appendChild(placeholder);
    }
    const img = document.createElement('img');
    img.src = src;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '8px';
    img.style.border = '1px solid var(--border)';
    previewWrap.appendChild(img);
    previewWrap._img = img;
    previewWrap._loaded = false;

    img.onload = async ()=>{
      previewWrap._loaded = true;
      if(revoke) URL.revokeObjectURL(src);
      try{
        if(btnIdentifyServer){
          const dataUrl = getPreviewDataUrl(img);
          showSmall('Đang gửi server nhận diện...');
          const res = await sendToServerForRecognition(dataUrl);
          if(res && (res.dish || (res.ingredients && res.ingredients.length))){
            if(res.dish) appendIngredient(res.dish);
            if(Array.isArray(res.ingredients)) res.ingredients.forEach(it=> appendIngredient(it));
            showSmall(`Server: ${res.dish || 'đã nhận nguyên liệu'} (${(res.confidence||0).toFixed(2)})`);
            renderServerIngredients(res);
          }else{
            showSmall('Server không trả về kết quả');
          }
        }
      }catch(e){ console.warn('auto server recognize failed', e); }
    };

    img.onerror = ()=>{
      previewWrap._loaded = false;
      if(placeholder) placeholder.style.display = 'block';
    };
  }

  async function classifyImage(img){
    await ensureModel();
    if(!model) return;
    if(classifyResults) classifyResults.innerHTML = 'Đang phân loại...';
    try{
      const raw = await model.classify(img, 10);
      const predictions = raw.filter(p=>p.probability >= 0.02).sort((a,b)=>b.probability-a.probability);
      renderPredictions(predictions);
      return predictions;
    }catch(e){
      if(classifyResults) classifyResults.textContent = 'Lỗi phân loại.';
      console.error(e);
    }
  }

  function mapClassToIngredient(className){
    const s = String(className||'').toLowerCase();
    const mapping = [
      ['fish','cá'],['salmon','cá hồi'],['tench','cá'],['carp','cá'],['crucian','cá'],['tilapia','cá'],['trout','cá'],
      ['crab','cua'],['lobster','tôm hùm'],['shrimp','tôm'],['prawn','tôm'],['squid','mực'],['octopus','bạch tuộc'],
      ['egg','trứng'],['chicken','gà'],['turkey','gà tây'],['duck','vịt'],['beef','bò'],['steak','bò'],['pork','heo'],['pig','heo'],['hog','heo'],['sus scrofa','heo'],['bacon','ba chỉ'],
      ['meatloaf','thịt băm'],['meat loaf','thịt băm'],['ground beef','thịt băm'],['minced beef','thịt băm'],['ground meat','thịt băm'],
      ['banana','chuối'],['apple','táo'],['orange','cam'],['lemon','chanh'],['potato','khoai tây'],['tomato','cà chua'],
      ['onion','hành'],['shallot','hành'],['garlic','tỏi'],['mushroom','nấm'],['rice','gạo'],['french loaf','bánh mì'],['baguette','bánh mì'],['loaf','bánh mì'],['bread','bánh mì'],['cheese','phô mai'],
      ['milk','sữa'],['carrot','cà rốt'],['lettuce','xà lách'],['cabbage','bắp cải'],['pepper','ớt'],['chili','ớt'],['sugar','đường'],
      ['salt','muối'],['butter','bơ'],['olive oil','dầu ô liu']
    ];
    for(const [k,v] of mapping){ if(s.includes(k)) return v; }
    const main = String(className||'').split(',')[0].split(' ')[0];
    return main.replace(/[_-]/g,' ');
  }

  function canonicalizeList(list){
    return list.map(s=>String(s||'').toLowerCase().trim()).map(x=>{
      if(!x) return '';
      const map = {
        meatloaf:'thịt băm','meat loaf':'thịt băm','ground beef':'thịt băm','minced beef':'thịt băm','ground meat':'thịt băm',
        baguette:'bánh mì', loaf:'bánh mì',
        fish:'cá', carp:'cá', tench:'cá', shrimp:'tôm', prawn:'tôm', crab:'cua', chicken:'gà', beef:'bò', pork:'heo', heo:'thịt', pig:'thịt', hog:'thịt', egg:'trứng',
        rice:'gạo', tomato:'cà chua', potato:'khoai tây', onion:'hành', garlic:'tỏi', mushroom:'nấm', sugar:'đường', salt:'muối', pepper:'tiêu'
      };
      for(const k in map) if(x.includes(k)) return map[k];
      return x;
    }).filter(Boolean);
  }

  const BLOCKLIST = new Set([
    'plate','dish','bowl','spoon','fork','knife','chopstick','cutlery','table','wood','board','platter',
    'glass','cup','mug','napkin','paper','tray','pan','pot','skillet',
    'đĩa','tô','bát','chén','ly','muỗng','thìa','dao','nĩa','đũa','bàn','gỗ','thớt','khăn'
  ]);
  function isBlockedIngredient(text){
    const t = String(text||'').toLowerCase();
    for(const w of BLOCKLIST){ if(t.includes(w)) return true; }
    return false;
  }

  function filterIngredientName(name){
    if(!name) return null;
    if(isBlockedIngredient(name)) return null;
    const norm = canonicalizeList([name])[0] || name;
    if(isBlockedIngredient(norm)) return null;
    return norm;
  }

  function appendIngredient(text){
    const norm = filterIngredientName(text);
    if(!norm) return;
    const cur = ingredientsText.value.trim();
    const lines = cur ? cur.split('\n').map(l=>l.trim()).filter(Boolean) : [];
    if(!lines.includes(norm)) lines.push(norm);
    ingredientsText.value = lines.join('\n');
  }

  function renderPredictions(preds){
    if(!classifyResults) return;
    if(!preds || !preds.length){ classifyResults.textContent = 'Không có kết quả'; return; }
    classifyResults.innerHTML = '';
    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';

    const suggestions = [];
    preds.forEach(p=>{
      const cls = p.className;
      const prob = (p.probability*100).toFixed(1)+'%';
      const ingredient = mapClassToIngredient(cls);
      if(isBlockedIngredient(ingredient)) return;
      suggestions.push({cls, ingredient, prob});

      const row = document.createElement('div');
      row.style.display='flex';row.style.justifyContent='space-between';row.style.alignItems='center';
      const left = document.createElement('div');
      left.innerHTML = `<div style="font-weight:700">${escapeHtml(cls)}</div><div style="opacity:0.8;font-size:12px">${prob}</div>`;
      const right = document.createElement('div');
      right.style.display='flex'; right.style.gap='8px'; right.style.alignItems='center';
      const chip = document.createElement('button');
      chip.className = 'btn btn-ghost';
      chip.type = 'button';
      chip.textContent = ingredient;
      chip.title = 'Thêm vào danh sách nguyên liệu';
      chip.addEventListener('click', ()=> appendIngredient(ingredient));
      right.appendChild(chip);
      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    });

    const actions = document.createElement('div');
    actions.style.display='flex'; actions.style.gap='8px'; actions.style.marginTop='8px';
    const addAll = document.createElement('button'); addAll.className='btn btn-primary'; addAll.type='button'; addAll.textContent='Thêm tất cả';
    addAll.addEventListener('click', ()=>{ suggestions.forEach(s=> appendIngredient(s.ingredient)); showSmall('Đã thêm tất cả'); });
    actions.appendChild(addAll);

    classifyResults.appendChild(list);
    classifyResults.appendChild(actions);
  }

  async function sendToServerForRecognition(dataUrl){
    try{
      const resp = await fetch('/api/identify-food', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ image: dataUrl }) });
      const json = await resp.json();
      return json;
    }catch(e){ console.warn('server identify failed', e); return null; }
  }

  btnOpenCam?.addEventListener('click', async ()=>{
    if(video.style.display === 'none'){
      try{
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio:false });
        video.srcObject = stream;
        video.style.display = 'block';
        btnCapture.disabled = false;
        btnOpenCam.textContent = 'Tắt camera';
      }catch(e){
        alert('Không thể mở camera: '+(e.message||e));
      }
    }else{
      if(stream){ stream.getTracks().forEach(t=>t.stop()); stream = null; }
      video.style.display = 'none';
      btnCapture.disabled = true;
      btnOpenCam.textContent = 'Mở camera';
    }
  });

  btnCapture?.addEventListener('click', ()=>{
    const w = video.videoWidth;
    const h = video.videoHeight;
    if(!w || !h) return alert('Không có khung hình từ camera');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    showPreview(dataUrl);
  });

  imageInput?.addEventListener('change', (ev)=>{
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    const url = URL.createObjectURL(f);
    showPreview(url, true);
  });

  btnIdentify?.addEventListener('click', async ()=>{
    const img = previewWrap._img;
    if(!img) return alert('Vui lòng chụp hoặc tải ảnh trước');
    const preds = await classifyImage(img);
    try{
      const top = (preds && preds[0]) || null;
      if(top && top.probability >= 0.40){
        const ing = mapClassToIngredient(top.className || '');
        if(ing){ appendIngredient(ing); showSmall(`Đã thêm: ${ing} (tự động)`); }
      }
    }catch(e){console.warn(e)}
  });

  btnIdentifyServer?.addEventListener('click', async ()=>{
    const img = previewWrap._img;
    if(!img) return alert('Vui lòng chụp hoặc tải ảnh trước');
    const dataUrl = getPreviewDataUrl(img);
    showSmall('Đang gửi server nhận diện...');
    const res = await sendToServerForRecognition(dataUrl);
    if(res && (res.dish || (res.ingredients && res.ingredients.length))){
      if(res.dish) appendIngredient(res.dish);
      if(Array.isArray(res.ingredients)) res.ingredients.forEach(it=> appendIngredient(it));
      showSmall(`Server: ${res.dish || 'đã nhận nguyên liệu'} (${(res.confidence||0).toFixed(2)})`);
      renderServerIngredients(res);
    }else{
      showSmall('Server không trả về kết quả');
    }
  });
})();
