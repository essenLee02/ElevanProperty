<template>
  <div>

    <!-- ── Hero Section ───────────────────────────────── -->
    <section class="hero-elevan">
      <div class="hero-bg"></div>
      <div class="container">
        <div class="hero-content">
          <div class="hero-label">
            <i class="fa-solid fa-star" style="font-size:.6rem;"></i>
            Platform Properti Premium Indonesia
          </div>

          <h1 class="hero-title">
            Temukan Properti<br>
            <em>Impian Anda</em>
          </h1>

          <p class="hero-subtitle">
            {{ home.heroSubtitle }}
          </p>

          <div class="hero-actions">
            <router-link to="/rumah123" class="btn btn-gold btn-lg">
              <i class="fa-solid fa-magnifying-glass"></i>
              Cari Properti
            </router-link>
            <router-link to="/contact" class="btn btn-outline-white btn-lg">
              Hubungi Kami
            </router-link>
          </div>

          <div class="hero-stats">
            <div class="hero-stat-item">
              <div class="hero-stat-value">7.9<span>K+</span></div>
              <div class="hero-stat-label">Listing Properti</div>
            </div>
            <div class="hero-stat-item">
              <div class="hero-stat-value">36<span>+</span></div>
              <div class="hero-stat-label">Provinsi</div>
            </div>
            <div class="hero-stat-item">
              <div class="hero-stat-value">5<span>★</span></div>
              <div class="hero-stat-label">Agent Tersertifikasi</div>
            </div>
            <div class="hero-stat-item">
              <div class="hero-stat-value">AI<span>24/7</span></div>
              <div class="hero-stat-label">Asisten Properti</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── About / Story Section ──────────────────────── -->
    <section class="section-pad" style="background: var(--white);">
      <div class="container">
        <div class="row align-items-center g-5">

          <div class="col-lg-5">
            <div class="about-image-wrapper">
              <img
                src="/assets/images/about/about-img1.jpg"
                alt="Elevan Property — Our Story"
                class="about-main-img"
                loading="lazy"
              />
              <div class="about-badge">
                <i class="fa-solid fa-shield-halved"></i>
                <span>Terpercaya sejak 2024</span>
              </div>
            </div>
          </div>

          <div class="col-lg-7">
            <div class="about-content">
              <div class="section-label">Tentang Kami</div>
              <h2 class="section-title">
                Asisten properti cerdas untuk<br>
                <span>keputusan terbaik Anda</span>
              </h2>
              <p>{{ home.story }}</p>

              <!-- Story / Vision / Mission tabs -->
              <div class="about-tabs">
                <div class="tab-nav">
                  <button
                    v-for="tab in tabs"
                    :key="tab.key"
                    class="tab-btn"
                    :class="{ active: activeTab === tab.key }"
                    @click="activeTab = tab.key"
                  >{{ tab.label }}</button>
                </div>
                <div class="tab-body">
                  <p>{{ home[activeTab] }}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- ── Benefits / Features Section ───────────────── -->
    <section class="section-pad" style="background: var(--cream);">
      <div class="container">
        <div class="text-center mb-5">
          <div class="section-label" style="justify-content:center;margin-bottom:var(--space-3);">
            Keunggulan
          </div>
          <h2 class="section-title mb-2">
            Mengapa Memilih <span>Elevan Property</span>?
          </h2>
          <p style="max-width:520px;margin:0 auto;font-size:.95rem;">
            Kami menggabungkan teknologi AI terkini dengan keahlian properti untuk memberikan pengalaman terbaik.
          </p>
        </div>

        <div class="row g-4">
          <div
            v-for="(benefit, index) in benefitCards"
            :key="index"
            class="col-lg-3 col-md-6"
          >
            <div class="feature-card h-100">
              <div class="feature-icon-wrap">
                <i :class="benefit.icon"></i>
              </div>
              <h5 class="feature-title">{{ benefit.title }}</h5>
              <p class="feature-desc">{{ benefit.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── CTA Section ────────────────────────────────── -->
    <section class="cta-section">
      <div class="container">
        <div class="cta-card">
          <div class="cta-content">
            <div class="section-label">Mulai Sekarang</div>
            <h2 class="section-title" style="color:var(--white);margin-bottom:12px;">
              Siap Temukan Properti Ideal?
            </h2>
            <p style="color:rgba(255,255,255,.7);margin-bottom:var(--space-5);">
              Gunakan AI chatbot kami 24/7 untuk mencari, membandingkan, dan menemukan properti yang sesuai.
            </p>
            <div class="hero-actions">
              <router-link to="/rumah123" class="btn btn-gold btn-lg">
                <i class="fa-solid fa-house-chimney"></i>
                Lihat Listing
              </router-link>
              <router-link to="/contact" class="btn btn-outline-white btn-lg">
                Tanya Agent
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api';

/* ── Static benefit cards (icon + fallback content) ─── */
const benefitCards = [
  {
    icon : 'fa-solid fa-robot',
    title: 'AI 24/7',
    desc : 'Asisten AI siap membantu kapan saja melalui WhatsApp maupun website.'
  },
  {
    icon : 'fa-solid fa-database',
    title: 'Data Lengkap',
    desc : '7.900+ listing dari 36 provinsi, diperbarui secara berkala dari Rumah123.'
  },
  {
    icon : 'fa-solid fa-user-tie',
    title: 'Agent Terlatih',
    desc : '5 agent profesional siap membantu proses sewa maupun pembelian properti.'
  },
  {
    icon : 'fa-solid fa-shield-halved',
    title: 'Terpercaya',
    desc : 'Proses transparan, data akurat, dan komunikasi yang cepat & responsif.'
  }
];

const tabs = [
  { key: 'vision',  label: 'Visi'   },
  { key: 'mission', label: 'Misi'   },
  { key: 'story',   label: 'Cerita' },
];

/* ── State ─────────────────────────────────────────────── */
const activeTab = ref('vision');

const fallbackHome = {
  heroTitle   : 'Temukan Properti Impian Anda',
  heroSubtitle: 'ElevanLabs membantu Anda membeli, menjual, dan menyewa rumah, villa, hotel, apartemen, dan kos dengan proses yang lebih transparan dan terarah.',
  vision  : 'Menjadi platform properti terpercaya yang mempermudah proses pencarian, sewa, beli, dan jual properti bagi semua orang.',
  mission : 'Menghubungkan pelanggan dengan pilihan properti yang tepat melalui data portofolio yang andal, bantuan profesional, dan percakapan bertenaga AI.',
  story   : 'ElevanLabs lahir dari kesulitan umum dalam menemukan informasi properti yang andal, membandingkan pilihan, dan berkomunikasi dengan agen secara efisien.',
};

const home = ref(fallbackHome);

/* ── Lifecycle ─────────────────────────────────────────── */
onMounted(async () => {
  try {
    const res = await api.get('/home');
    home.value = res.data?.data || fallbackHome;
  } catch {
    home.value = fallbackHome;
  }
});
</script>
