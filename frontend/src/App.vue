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
   Dimuat SEKALI di root App agar SEMUA menu/route otomatis dapat mengakses
   Bootstrap 5.3.8, jQuery 4.0.0, dan Font Awesome 7.2.0 — tanpa perlu
   meng-import ulang di tiap komponen/view. Helper di bawah idempotent
   (cek duplikat) sehingga aman dari pemuatan ganda saat hot-reload.
────────────────────────────────────────────────────────────────────────── */
const VENDOR_STYLES = [
  '/assets/bootstrap_5_3_8/css/bootstrap.min.css',
  '/assets/fontawesome_7_2_0_web/css/all.min.css',
];

const VENDOR_SCRIPTS = [
  '/assets/jquery-4.0.0/jquery-4.0.0.min.js',
  '/assets/bootstrap_5_3_8/js/bootstrap.bundle.min.js',
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

<style scoped>
.app-main {
  padding-top: 80px;
}
</style>
