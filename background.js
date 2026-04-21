"use strict";

/**
 * Thunderbird exposes WebExtension experiment *functions* on `messenger`
 * (see webext-examples: messenger.Restart.execute()).
 */
function iranianDateApi() {
  return messenger.IranianDateColumn || browser.IranianDateColumn;
}

const DEFAULT_OPTIONS = {
  monthStyle: "2-digit",
  weekDayStyle: "hidden",
  numbersStyle: "arabext",
};

async function readOptions() {
  const stored = await browser.storage.local.get(DEFAULT_OPTIONS);
  return { ...DEFAULT_OPTIONS, ...stored };
}

async function startupOnce() {
  const api = iranianDateApi();
  if (!api || typeof api.register != "function") {
    return false;
  }
  const opts = await readOptions();
  await api.register(opts);
  return true;
}

async function startupWithRetries() {
  for (let i = 0; i < 40; i++) {
    try {
      if (await startupOnce()) {
        return;
      }
    } catch (e) {
      console.error("IranianDateColumn startup attempt", i, e);
    }
    await new Promise(r => setTimeout(r, 150));
  }
  console.error(
    "IranianDateColumn: API never became available (messenger.IranianDateColumn missing)."
  );
}

browser.runtime.onInstalled.addListener(() => {
  startupWithRetries();
});
browser.runtime.onStartup.addListener(() => {
  startupWithRetries();
});
// First load (temporary add-on / normal install)
startupWithRetries();
