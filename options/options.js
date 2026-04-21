"use strict";

function iranianDateApi() {
  return messenger.IranianDateColumn || browser.IranianDateColumn;
}

const DEFAULTS = {
  monthStyle: "2-digit",
  weekDayStyle: "hidden",
  numbersStyle: "arabext",
};

async function load() {
  const v = await browser.storage.local.get(DEFAULTS);
  for (const key of Object.keys(DEFAULTS)) {
    const el = document.getElementById(key);
    if (el) {
      el.value = v[key];
    }
  }
}

async function saveFromForm() {
  const values = {
    monthStyle: document.getElementById("monthStyle").value,
    weekDayStyle: document.getElementById("weekDayStyle").value,
    numbersStyle: document.getElementById("numbersStyle").value,
  };
  await browser.storage.local.set(values);
  const api = iranianDateApi();
  if (api && typeof api.setOptions == "function") {
    await api.setOptions(values);
  }
}

document.getElementById("opts").addEventListener("change", () => {
  saveFromForm();
});

void (async () => {
  await load();
})();
