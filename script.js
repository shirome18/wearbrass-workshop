const form = document.querySelector('#booking-form');
const BOOKING_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzKOnBMleXcrxjNGZUrbZaNn1BojUQL851g0q5ilMUBZp6hBPAkJH0k0hxfSBJFIs1C-Q/exec';
const schedulePreview = ['127.0.0.1', 'localhost'].includes(location.hostname) && new URLSearchParams(location.search).has('schedulepreview');
const liveBooking = Boolean(BOOKING_ENDPOINT) && !schedulePreview;
let seatsReady = !liveBooking;
let submitting = false;
let lastSubmission = null;
const videos = [...document.querySelectorAll('video')];
document.querySelectorAll('.video-cover').forEach((cover) => {
  const video = cover.parentElement.querySelector('video');
  cover.addEventListener('click', async () => {
    cover.hidden = true;
    try { await video.play(); } catch { cover.hidden = false; }
  });
  video.addEventListener('play', () => { cover.hidden = true; });
  video.addEventListener('ended', () => { cover.hidden = false; });
});
videos.forEach((video) => {
  video.addEventListener('play', () => {
    videos.forEach((other) => {
      if (other !== video) other.pause();
    });
  });
});
const steps = [...document.querySelectorAll('.form-step')];
const indicators = [...document.querySelectorAll('[data-step-indicator]')];
const seatCounts = new Map([...document.querySelectorAll('[name="date"]')].map((date) => [date.value, Number(date.dataset.seats) || 0]));
let currentStep = 1;

function showStep(number) {
  currentStep = number;
  const selectedDate = form.querySelector('[name="date"]:checked');
  document.querySelector('[data-selected-booking-date]').textContent = selectedDate?.value || '日時を選んでください';
  steps.forEach((step) => step.classList.toggle('active', Number(step.dataset.step) === number));
  indicators.forEach((indicator) => {
    indicator.classList.toggle('active', Number(indicator.dataset.stepIndicator) <= number);
  });
  document.querySelector('#reserve').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function errorFor(step, message) {
  step.querySelector('.form-error').textContent = message;
}

function validateStep(stepNumber) {
  if (liveBooking && !seatsReady) {
    errorFor(document.querySelector(`[data-step="${stepNumber}"]`), '予約状況を確認できません。少し待ってから再読み込みしてください。');
    return false;
  }
  const step = document.querySelector(`[data-step="${stepNumber}"]`);
  const fields = [...step.querySelectorAll('input, select, textarea')];
  const invalid = fields.find((field) => !field.disabled && !field.checkValidity());
  if (invalid) {
    const message = stepNumber === 1
      ? '参加する日を選んでください。'
      : '必須項目を入力・選択してください。';
    errorFor(step, message);
    invalid.focus({ preventScroll: true });
    return false;
  }
  if (stepNumber === 2 && !rawFormValue('email') && !rawFormValue('instagram')) {
    errorFor(step, 'メールアドレスかInstagramアカウントのどちらかをご入力ください。');
    step.querySelector('[name="email"]').focus({ preventScroll: true });
    return false;
  }
  if (stepNumber === 2) {
    const selectedDate = rawFormValue('date');
    const people = selectedPeopleCount();
    const seats = seatCounts.get(selectedDate) || 0;
    if (people > seats) {
      errorFor(step, `選択した日程は残り${seats}名です。人数を変更するか、別の日程をお選びください。`);
      step.querySelector('[name="people"]').focus({ preventScroll: true });
      return false;
    }
    const selectedItems = formValues('item');
    if (!selectedItems.length) {
      errorFor(step, '作りたいものを選ぶか、当日相談を選択してください。');
      step.querySelector('[name="item"]').focus({ preventScroll: true });
      return false;
    }
    if (!selectedItems.includes('当日相談') && selectedItems.length !== 2) {
      errorFor(step, 'ピアス・イヤリング・バングル・ネックレスから2つ選んでください。');
      step.querySelector('[name="item"]').focus({ preventScroll: true });
      return false;
    }
  }
  errorFor(step, '');
  return true;
}

function formValue(name) {
  return rawFormValue(name) || '未入力';
}

function rawFormValue(name) {
  return new FormData(form).get(name) || '';
}

function formValues(name) {
  return new FormData(form).getAll(name).filter(Boolean);
}

function selectedPeopleCount() {
  return Number.parseInt(rawFormValue('people'), 10) || 1;
}

function remainingSeatsText(dateValue, people = 0) {
  const seats = Math.max((seatCounts.get(dateValue) || 0) - people, 0);
  return `残り${seats}名`;
}

function updateSeatLabels() {
  document.querySelectorAll('[name="date"]').forEach((date) => {
    const seats = seatCounts.get(date.value) || 0;
    const label = date.closest('.available');
    const seatLabel = label?.querySelector('[data-seat-label]');
    if (seatLabel) seatLabel.textContent = `残り${seats}名`;
    label?.classList.toggle('full', seats <= 0);
    date.disabled = !seatsReady || seats <= 0;
  });
  document.querySelectorAll('[data-status-date]').forEach((button) => {
    const dateValue = button.dataset.statusDate;
    const seats = seatCounts.get(dateValue) || 0;
    const seatLabel = button.querySelector('[data-status-seat]');
    if (seatLabel) seatLabel.textContent = `残り${seats}名`;
    button.classList.toggle('full', seats <= 0);
    button.classList.toggle('active', rawFormValue('date') === dateValue);
    button.disabled = !seatsReady || seats <= 0;
  });
}

function buildSummary(completed = false, receipt = null) {
  const people = Number.parseInt(formValue('people'), 10) || 1;
  const addon = formValue('addon');
  const addonPrice = addon.includes('2,500') ? 2500 : 0;
  const total = people * 6500 + addonPrice;
  const rows = [
    ['開催日時', formValue('date')],
    ['お名前', formValue('name')],
    ['メールアドレス', formValue('email')],
    ['Instagram', formValue('instagram')],
    ['参加人数', formValue('people')],
    ['予約後の残席', remainingSeatsText(formValue('date'), completed ? 0 : people)],
    ['作りたいもの', formValues('item').join('、') || '未入力'],
    ['追加制作', addon],
    ['参加費', `${(receipt?.total ?? total).toLocaleString()}円（税込）`],
    ['質問・ご要望', formValue('message')]
  ];
  if (receipt) rows.unshift(['受付番号', receipt.bookingId]);
  const summaryHtml = rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(String(value))}</dd></div>`)
    .join('');
  document.querySelector('#booking-summary').innerHTML = summaryHtml;
  const completionSummary = document.querySelector('#completion-summary');
  if (completionSummary) completionSummary.innerHTML = summaryHtml;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

document.querySelectorAll('.next-button').forEach((button) => {
  button.addEventListener('click', () => {
    if (!validateStep(currentStep)) return;
    if (currentStep === 2) buildSummary();
    showStep(currentStep + 1);
  });
});

document.querySelectorAll('.back-button').forEach((button) => {
  button.addEventListener('click', () => showStep(currentStep - 1));
});

function continueWithSelectedDate() {
  updateSeatLabels();
  if (currentStep === 1 && validateStep(1)) showStep(2);
}

document.querySelectorAll('[name="date"]').forEach((date) => {
  date.addEventListener('click', continueWithSelectedDate);
});

document.querySelectorAll('[data-status-date]').forEach((button) => {
  button.addEventListener('click', () => {
    const date = [...document.querySelectorAll('[name="date"]')].find((option) => option.value === button.dataset.statusDate);
    if (!date || date.disabled) return;
    date.checked = true;
    continueWithSelectedDate();
  });
});

document.querySelectorAll('[name="item"]').forEach((checkbox) => {
  checkbox.addEventListener('change', () => {
    const itemCheckboxes = [...document.querySelectorAll('[name="item"]')];
    const consultation = itemCheckboxes.find((item) => item.value === '当日相談');
    if (checkbox === consultation && checkbox.checked) {
      itemCheckboxes.forEach((item) => {
        if (item !== consultation) item.checked = false;
      });
      return;
    }
    if (checkbox.checked && consultation) consultation.checked = false;
    const selected = itemCheckboxes.filter((item) => item.checked && item.value !== '当日相談');
    if (selected.length > 2) checkbox.checked = false;
  });
});

function applyAvailability(result) {
  if (!result.ok || !Array.isArray(result.sessions)) throw new Error('予約状況を確認できません。');
  const incoming = new Map(result.sessions.map((session) => [session.date, session.remaining]));
  seatCounts.forEach((_, date) => {
    const seats = incoming.get(date);
    seatCounts.set(date, Number.isInteger(seats) && seats >= 0 ? seats : 0);
  });
  seatsReady = true;
}

function readAvailability() {
  return new Promise((resolve, reject) => {
    const callback = `wearbrass_${crypto.randomUUID().replaceAll('-', '')}`;
    const script = document.createElement('script');
    let timeout;
    const cleanUp = () => {
      clearTimeout(timeout);
      script.remove();
      delete window[callback];
    };
    window[callback] = (result) => { cleanUp(); resolve(result); };
    script.onerror = () => { cleanUp(); reject(new Error('予約状況に接続できません。')); };
    timeout = setTimeout(() => { cleanUp(); reject(new Error('予約状況の確認に時間がかかっています。')); }, 30000);
    script.src = `${BOOKING_ENDPOINT}?callback=${callback}&t=${Date.now()}`;
    document.head.append(script);
  });
}

async function refreshAvailability() {
  try {
    applyAvailability(await readAvailability());
    errorFor(document.querySelector('[data-step="1"]'), '');
  } catch (error) {
    seatsReady = false;
    errorFor(document.querySelector('[data-step="1"]'), '予約状況を確認できません。再読み込みするか、InstagramのDMへご連絡ください。');
  }
  updateSeatLabels();
}

function bookingPayload() {
  return {
    date: rawFormValue('date'), name: rawFormValue('name').trim(), people: selectedPeopleCount(),
    email: rawFormValue('email').trim(), instagram: rawFormValue('instagram').trim(),
    items: formValues('item'), addon: rawFormValue('addon').includes('2,500'),
    message: rawFormValue('message').trim(), agreement: Boolean(rawFormValue('agreement')), website: ''
  };
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitting || !validateStep(3)) return;
  const selectedDate = formValue('date');
  const people = selectedPeopleCount();
  if (!liveBooking) {
    seatCounts.set(selectedDate, Math.max((seatCounts.get(selectedDate) || 0) - people, 0));
    buildSummary(true);
    showStep(4);
    updateSeatLabels();
    return;
  }
  const step = document.querySelector('[data-step="3"]');
  const button = form.querySelector('[type="submit"]');
  const payload = bookingPayload();
  const fingerprint = JSON.stringify(payload);
  if (lastSubmission && lastSubmission.fingerprint !== fingerprint) {
    errorFor(step, '前の送信結果が確認できていません。確認メールまたはInstagramのDMで予約状況をご確認ください。');
    return;
  }
  const retryingSubmission = Boolean(lastSubmission);
  lastSubmission ||= {fingerprint, requestId: crypto.randomUUID()};
  submitting = true;
  button.disabled = true;
  button.textContent = '予約を送信しています…';
  step.querySelector('.back-button').disabled = true;
  const controller = new AbortController();
  let timeout;
  let posted = false;
  try {
    const availability = await readAvailability();
    applyAvailability(availability);
    if (!availability.token) throw new Error('受付の準備を確認できません。');
    if (!retryingSubmission && (seatCounts.get(selectedDate) || 0) < people) {
      lastSubmission = null;
      updateSeatLabels();
      errorFor(step, '残席が変わりました。戻って日時と人数を選び直してください。');
      return;
    }
    timeout = setTimeout(() => controller.abort(), 45000);
    posted = true;
    const response = await fetch(BOOKING_ENDPOINT, {
      method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({...payload, requestId: lastSubmission.requestId, token: availability.token}),
      signal: controller.signal, credentials: 'omit', redirect: 'follow'
    });
    if (!response.ok) throw new Error('受付結果を確認できません。');
    const result = await response.json();
    if (!result.ok) {
      if (Array.isArray(result.sessions)) applyAvailability({ok: true, sessions: result.sessions});
      lastSubmission = null;
      updateSeatLabels();
      errorFor(step, result.message || '予約を受け付けられませんでした。');
      return;
    }
    if (!result.bookingId || !Number.isInteger(result.total)) throw new Error('受付結果を確認できません。');
    applyAvailability(result);
    buildSummary(true, result);
    const note = document.querySelector('[data-completion-contact]');
    note.textContent = !payload.email
      ? 'ご予約を保存しました。メール未入力のため、確認メールは送信されません。お問い合わせはInstagramのDMからお願いします。'
      : result.emailStatus === '送信済み'
        ? 'ご予約を保存し、確認メールを送信しました。届かない場合は迷惑メールフォルダもご確認ください。'
        : 'ご予約は保存されました。確認メールは送信待ちです。この画面を保存し、届かない場合はInstagramのDMへご連絡ください。';
    showStep(4);
    updateSeatLabels();
    lastSubmission = null;
  } catch (error) {
    if (!posted) lastSubmission = null;
    errorFor(step, posted
      ? '通信が途切れ、受付結果を確認できません。予約が保存されている可能性があります。同じ内容で再送するか、確認メール・InstagramのDMでご確認ください。'
      : '受付に接続できませんでした。しばらくしてからもう一度お試しください。');
  } finally {
    clearTimeout(timeout);
    submitting = false;
    button.disabled = false;
    button.textContent = 'この内容で予約する';
    step.querySelector('.back-button').disabled = Boolean(lastSubmission);
  }
});

document.querySelector('#restart-button').addEventListener('click', () => {
  form.reset();
  lastSubmission = null;
  showStep(1);
  if (liveBooking) refreshAvailability();
});

if (liveBooking) {
  document.querySelector('.preview-note').hidden = true;
  document.querySelector('.demo-reminder').hidden = true;
  document.querySelector('[data-step="1"] .form-error').textContent = '予約状況を確認しています…';
  refreshAvailability();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentStep === 1 && !submitting) refreshAvailability();
  });
}
updateSeatLabels();
