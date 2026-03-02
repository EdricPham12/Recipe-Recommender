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
  const pantryText = document.getElementById('pantryText');

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

  function getApiBase(){
    const saved = (localStorage.getItem('smartcook_api_base') || '').trim();
    if(saved) return saved.replace(/\/$/, '');
    return 'http://127.0.0.1:9001';
  }

  function mapVisionResponse(json){
    const out = { nguyen_lieu: [], gia_vi: [], unknown: [], detections: [], meta: null };
    if(!json || typeof json !== 'object') return out;

    // New FastAPI format
    if(Array.isArray(json.nguyen_lieu) || Array.isArray(json.gia_vi)){
      out.nguyen_lieu = Array.isArray(json.nguyen_lieu) ? json.nguyen_lieu : [];
      out.gia_vi = Array.isArray(json.gia_vi) ? json.gia_vi : [];
      out.unknown = Array.isArray(json.unknown) ? json.unknown : [];
      out.detections = Array.isArray(json.detections) ? json.detections : [];
      out.meta = json.meta || null;
      return out;
    }

    // Legacy format
    if(Array.isArray(json.ingredients) || json.dish){
      const names = [];
      if(json.dish) names.push(String(json.dish));
      if(Array.isArray(json.ingredients)) json.ingredients.forEach(x => names.push(String(x)));
      out.nguyen_lieu = names.filter(Boolean).map(name => ({
        name,
        confidence: typeof json.confidence === 'number' ? json.confidence : null,
        views_supported: null,
        detections: null,
      }));
      return out;
    }

    return out;
  }

  function renderServerIngredients(res){
    if(!classifyResults || !res) return;
    const mapped = mapVisionResponse(res);

    const nl = mapped.nguyen_lieu
      .map(x => typeof x === 'string' ? { name: x, confidence: null } : x)
      .map(x => ({ ...x, name: filterIngredientName(x.name) }))
      .filter(x => !!x.name);

    const gv = mapped.gia_vi
      .map(x => typeof x === 'string' ? { name: x, confidence: null } : x)
      .map(x => ({ ...x, name: filterIngredientName(x.name) }))
      .filter(x => !!x.name);

    if(!nl.length && !gv.length) return;

    classifyResults.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '10px';

    function addSection(title, items, target){
      if(!items.length) return;
      const h = document.createElement('div');
      h.style.fontWeight = '700';
      h.textContent = title;
      wrap.appendChild(h);

      items.forEach(item => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';

        const left = document.createElement('div');
        const score = (typeof item.confidence === 'number') ? ` | ${(item.confidence * 100).toFixed(1)}%` : '';
        left.innerHTML = `<div style="font-weight:700">${escapeHtml(item.name)}</div><div style="opacity:0.8;font-size:12px">Server${score}</div>`;

        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.gap = '8px';
        right.style.alignItems = 'center';

        const chip = document.createElement('button');
        chip.className = 'btn btn-ghost';
        chip.type = 'button';
        chip.textContent = item.name;
        chip.title = 'Thêm vào danh sách';
        chip.addEventListener('click', ()=>{
          if(target === 'nguyen_lieu') appendIngredient(item.name);
          else appendPantry(item.name);
        });
        right.appendChild(chip);

        row.appendChild(left);
        row.appendChild(right);
        wrap.appendChild(row);
      });
    }

    addSection('Nguyên liệu', nl, 'nguyen_lieu');
    addSection('Gia vị', gv, 'gia_vi');
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

  function dataUrlToBlob(dataUrl){
    const [header, data] = String(dataUrl).split(',');
    const mime = (header.match(/data:([^;]+);base64/i) || [])[1] || 'image/jpeg';
    const bin = atob(data || '');
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for(let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  function buildMultiViewDataUrls(dataUrl, img){
    const out = [dataUrl];
    if(!img || !img.naturalWidth || !img.naturalHeight) return out;

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const cw = Math.max(1, Math.floor(w * 0.62));
    const xLeft = 0;
    const xRight = Math.max(0, w - cw);

    const c = document.createElement('canvas');
    c.width = cw;
    c.height = h;
    const ctx = c.getContext('2d');
    if(!ctx) return out;

    ctx.drawImage(img, xLeft, 0, cw, h, 0, 0, cw, h);
    out.push(c.toDataURL('image/jpeg', 0.92));

    ctx.clearRect(0, 0, cw, h);
    ctx.drawImage(img, xRight, 0, cw, h, 0, 0, cw, h);
    out.push(c.toDataURL('image/jpeg', 0.92));

    return out.slice(0, 3);
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

    img.onload = ()=>{
      previewWrap._loaded = true;
      if(revoke) URL.revokeObjectURL(src);
    };

    img.onerror = ()=>{
      previewWrap._loaded = false;
      if(placeholder) placeholder.style.display = 'block';
    };
  }

  async function classifyImage(img){
    await ensureModel();
    if(!model) return [];
    if(classifyResults) classifyResults.innerHTML = 'Đang phân loại AI local...';
    try{
      const raw = await model.classify(img, 12);
      const predictions = raw
        .map(p => {
          const matchedBasic = inferBasicIngredientFromClass(p.className);
          const ingredient = filterIngredientName(matchedBasic || mapClassToIngredient(p.className));
          const isNonFood = isLikelyNonFoodClassName(p.className);
          const isFood = !isNonFood && (Boolean(matchedBasic) || isLikelyFoodClassName(p.className));
          return { ...p, ingredient, isFood, matchedBasic: Boolean(matchedBasic) };
        })
        .filter(p => p.isFood && p.ingredient && (p.matchedBasic ? p.probability >= 0.03 : p.probability >= 0.08))
        .sort((a,b)=>b.probability-a.probability)
        .slice(0, 8);

      if(!predictions.length){
        if(classifyResults){
          classifyResults.innerHTML = '<div class="status">AI local: Không chắc đây là nguyên liệu trong bộ nhận diện (Unknown).</div>';
        }
        return [];
      }

      renderPredictions(predictions);
      return predictions;
    }catch(e){
      if(classifyResults) classifyResults.textContent = 'Lỗi phân loại AI local.';
      console.error(e);
      return [];
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

  const BASIC_CLASS_KEYWORDS = [
    [['egg','hen','quail egg'], 'trứng'],
    [['shrimp','prawn'], 'tôm'],
    [['squid','cuttlefish','octopus'], 'mực'],
    [['pork','pig','hog','ham','bacon','loin','tenderloin'], 'thịt heo'],
    [['chicken','rooster','hen'], 'thịt gà'],
    [['carrot'], 'cà rốt'],
    [['scallion','spring onion','green onion','chive','leek'], 'hành lá'],
    [['french loaf','baguette','bread loaf','loaf'], 'bánh mì'],
    [['saltshaker','salt'], 'muối'],
  ];

  const NON_FOOD_CLASS_HINTS = [
    'ball','soccer','basketball','tennis ball','golf ball',
    'plastic','pencil','pen','eraser','sharpener','hair','slide','clip',
    'parachute','packet','envelope','book','remote','keyboard','mouse',
  ];

  function inferBasicIngredientFromClass(className){
    const s = String(className || '').toLowerCase();
    if(!s) return null;
    for(const [keys, value] of BASIC_CLASS_KEYWORDS){
      if(keys.some(k => s.includes(k))) return value;
    }
    return null;
  }

  function isLikelyNonFoodClassName(className){
    const s = String(className || '').toLowerCase();
    if(!s) return false;
    return NON_FOOD_CLASS_HINTS.some(k => s.includes(k));
  }

  const FOOD_CLASS_HINTS = [
    'fish','salmon','carp','tilapia','trout','tuna','mackerel','anchovy',
    'shrimp','prawn','lobster','crab','oyster','clam','mussel','squid','octopus',
    'egg','chicken','duck','turkey','beef','pork','bacon','ham','sausage','meat',
    'banana','apple','orange','lemon','lime','grape','mango','watermelon',
    'tomato','potato','onion','shallot','garlic','carrot','cucumber','lettuce','cabbage','pepper','chili','mushroom',
    'rice','corn','bean','pea','tofu','cheese','milk','butter','salt','sugar','oil',
  ];

  function isLikelyFoodClassName(className){
    const s = String(className || '').toLowerCase();
    if(!s) return false;
    return FOOD_CLASS_HINTS.some(k => s.includes(k));
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

  function appendUnique(textareaEl, text){
    if(!textareaEl) return;
    const norm = filterIngredientName(text);
    if(!norm) return;
    const cur = textareaEl.value.trim();
    const lines = cur ? cur.split('\n').map(l=>l.trim()).filter(Boolean) : [];
    if(!lines.includes(norm)) lines.push(norm);
    textareaEl.value = lines.join('\n');
  }

  function appendIngredient(text){ appendUnique(ingredientsText, text); }
  function appendPantry(text){ appendUnique(pantryText, text); }

  function isPantryCandidate(text){
    const s = String(text || '').toLowerCase();
    return s.includes('muối') || s.includes('đường') || s.includes('tiêu') || s.includes('tỏi') || s.includes('hành khô');
  }

  function appendByBucket(text){
    if(isPantryCandidate(text)) appendPantry(text);
    else appendIngredient(text);
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
      const ingredient = p.ingredient || mapClassToIngredient(cls);
      const prob = (p.probability*100).toFixed(1)+'%';
      if(!ingredient || isBlockedIngredient(ingredient)) return;
      suggestions.push({cls, ingredient, prob, probability:p.probability});

      const row = document.createElement('div');
      row.style.display='flex';row.style.justifyContent='space-between';row.style.alignItems='center';
      const left = document.createElement('div');
      left.innerHTML = `<div style="font-weight:700">${escapeHtml(ingredient)}</div><div style="opacity:0.8;font-size:12px">${escapeHtml(cls)} · ${prob}</div>`;
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

    if(!suggestions.length){
      classifyResults.innerHTML = '<div class="status">AI local không đủ tự tin để kết luận (Unknown).</div>';
      return;
    }

    const actions = document.createElement('div');
    actions.style.display='flex'; actions.style.gap='8px'; actions.style.marginTop='8px';
    const addAll = document.createElement('button'); addAll.className='btn btn-primary'; addAll.type='button'; addAll.textContent='Thêm tất cả';
    addAll.addEventListener('click', ()=>{ suggestions.forEach(s=> appendIngredient(s.ingredient)); showSmall('Đã thêm tất cả'); });
    actions.appendChild(addAll);

    classifyResults.appendChild(list);
    classifyResults.appendChild(actions);
  }

  async function sendToServerForRecognition(dataUrl, img){
    const apiBase = getApiBase();
    const form = new FormData();
    const views = buildMultiViewDataUrls(dataUrl, img);
    views.forEach((viewUrl, idx)=> form.append('images', dataUrlToBlob(viewUrl), 'scan_' + (idx + 1) + '.jpg'));
    form.append('confidence_threshold', '0.66');
    form.append('fusion_mode', 'voting');
    form.append('return_annotated', 'false');
    form.append('reject_margin', '0.14');
    form.append('top_k_per_crop', '5');

    // Prefer new endpoint. If unavailable, fallback to legacy API.
    const newUrl = `${apiBase}/api/smartcook/recognize`;
    try{
      const resp = await fetch(newUrl, { method:'POST', body: form });
      if(resp.ok){
        return await resp.json();
      }
      if(resp.status !== 404){
        const txt = await resp.text();
        throw new Error(`SmartCook API error ${resp.status}: ${txt}`);
      }
    }catch(err){
      console.warn('smartcook recognize failed', err);
    }

    try{
      const legacyUrl = `${apiBase}/api/identify-food`;
      const resp = await fetch(legacyUrl, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ image: dataUrl }),
      });
      if(!resp.ok) throw new Error(`Legacy API error ${resp.status}`);
      return await resp.json();
    }catch(e){
      console.warn('legacy identify failed', e);
      return null;
    }
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
    const dataUrl = getPreviewDataUrl(img);
    showSmall('AI đang nhận diện...');

    // Use backend AI model for practical accuracy.
    const res = await sendToServerForRecognition(dataUrl, img);
    const mapped = mapVisionResponse(res);

    if(res && (mapped.nguyen_lieu.length || mapped.gia_vi.length)){
      mapped.nguyen_lieu.forEach(it => appendIngredient(typeof it === 'string' ? it : it.name));
      mapped.gia_vi.forEach(it => appendPantry(typeof it === 'string' ? it : it.name));
      showSmall(`AI: ${mapped.nguyen_lieu.length} nguyên liệu, ${mapped.gia_vi.length} gia vị`);
      renderServerIngredients(res);
      return;
    }

    // Fallback to local-only AI if backend is unavailable.
    const preds = await classifyImage(img);
    const top = (preds && preds[0]) || null;
    if(top && top.ingredient && top.probability >= 0.22){
      appendByBucket(top.ingredient);
      showSmall(`AI local fallback: ${top.ingredient} (${(top.probability*100).toFixed(1)}%)`);
    }else{
      showSmall('AI: Không đủ tự tin (Unknown).');
    }
  });

  btnIdentifyServer?.addEventListener('click', async ()=>{
    const img = previewWrap._img;
    if(!img) return alert('Vui lòng chụp hoặc tải ảnh trước');
    const dataUrl = getPreviewDataUrl(img);
    showSmall('Đang gửi server nhận diện...');
    const res = await sendToServerForRecognition(dataUrl, img);
    const mapped = mapVisionResponse(res);

    if(res && (mapped.nguyen_lieu.length || mapped.gia_vi.length)){
      mapped.nguyen_lieu.forEach(it => appendIngredient(typeof it === 'string' ? it : it.name));
      mapped.gia_vi.forEach(it => appendPantry(typeof it === 'string' ? it : it.name));
      showSmall(`Server: ${mapped.nguyen_lieu.length} nguyên liệu, ${mapped.gia_vi.length} gia vị`);
      renderServerIngredients(res);
    }else{
      showSmall('Server không trả về kết quả phù hợp');
    }
  });
})();









