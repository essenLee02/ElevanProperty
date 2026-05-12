<template>
  <Navbar />
  <main style="padding-top: 80px;">
    <router-view />
  </main>
  <FloatingChatbot />
</template>

<script setup>
  import Navbar from './components/Navbar.vue';
  import FloatingChatbot from './components/FloatingChatbot.vue';
</script>
