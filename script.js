const form = document.querySelector('#booking-form');
const steps = [...document.querySelectorAll('.form-step')];
const indicators = [...document.querySelectorAll('[data-step-indicator]')];
const seatCounts = new Map([...document.querySelectorAll('[name="date"]')].map((date) => [date.value, Number(date.dataset.seats) || 0]));
let currentStep = 1;

function showStep(number) {
  currentStep = number;
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
  const step = document.querySelector(`[data-step="${stepNumber}"]`);
  const requiredFields = [...step.querySelectorAll('[required]')];
  const invalid = requiredFields.find((field) => !field.checkValidity());
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
    date.disabled = seats <= 0;
  });
  document.querySelectorAll('[data-status-date]').forEach((button) => {
    const dateValue = button.dataset.statusDate;
    const seats = seatCounts.get(dateValue) || 0;
    const seatLabel = button.querySelector('[data-status-seat]');
    if (seatLabel) seatLabel.textContent = `残り${seats}名`;
    button.classList.toggle('full', seats <= 0);
    button.classList.toggle('active', rawFormValue('date') === dateValue);
    button.disabled = seats <= 0;
  });
}

function buildSummary(completed = false) {
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
    ['参加費', `${total.toLocaleString()}円（税込）`],
    ['質問・ご要望', formValue('message')]
  ];
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

document.querySelectorAll('[name="date"]').forEach((date) => {
  date.addEventListener('change', updateSeatLabels);
});

document.querySelectorAll('[data-status-date]').forEach((button) => {
  button.addEventListener('click', () => {
    const date = [...document.querySelectorAll('[name="date"]')].find((option) => option.value === button.dataset.statusDate);
    if (!date || date.disabled) return;
    date.checked = true;
    updateSeatLabels();
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

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!validateStep(3)) return;
  const selectedDate = formValue('date');
  const people = selectedPeopleCount();
  seatCounts.set(selectedDate, Math.max((seatCounts.get(selectedDate) || 0) - people, 0));
  updateSeatLabels();
  buildSummary(true);
  showStep(4);
});

document.querySelector('#restart-button').addEventListener('click', () => {
  form.reset();
  showStep(1);
});

updateSeatLabels();
