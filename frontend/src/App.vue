<template>
  <Navbar />
  <main class="app-main">
    <router-view />
  </main>
  <FloatingChatbot />
</template>

<script setup>
import Navbar from './components/Navbar.vue';
import FloatingChatbot from './components/FloatingChatbot.vue';

/* ──────────────────────────────────────────────────────────────────────────
   Global vendor assets (disajikan dari /public/assets)
   Bootstrap 5.3.8 (CSS+JS) & Font Awesome 7.2.0 kini dimuat STATIS di
   index.html. Di sini hanya tersisa jQuery 4.0.0 + Function_Path (helper
   global window.tableModal/loadModalPagination/dll) yang dimuat SEKALI saat
   root App mount. Helper di bawah idempotent (cek duplikat) sehingga aman
   dari pemuatan ganda saat hot-reload.
────────────────────────────────────────────────────────────────────────── */
const VENDOR_STYLES = [];

const VENDOR_SCRIPTS = [
  '/assets/jquery-4.0.0/jquery-4.0.0.min.js',
  // Function_Path — helper global (tableModal, loadModalPagination, sendMessageBox,
  // ajaxHit, dll). Sekali dimuat di sini → bisa dipanggil dari SEMUA komponen Vue
  // lewat window.tableModal(...) tanpa import berulang.
  '/assets/Function_Path/function_work.js',
  '/assets/Function_Path/function_form.js',
];

function loadStylesheet(href) {
  if (document.querySelector(`link[data-vendor="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute('data-vendor', href);
  document.head.appendChild(link);
}

function loadScript(src) {
  if (document.querySelector(`script[data-vendor="${src}"]`)) return;
  const script = document.createElement('script');
  script.src = src;
  script.setAttribute('data-vendor', src);
  document.head.appendChild(script);
}

VENDOR_STYLES.forEach(loadStylesheet);
VENDOR_SCRIPTS.forEach(loadScript);
</script>
