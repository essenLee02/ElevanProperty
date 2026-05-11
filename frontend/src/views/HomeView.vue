<template>
  <div>
    <section id="hero-area" class="header-area header-eight">
      <div class="container">
        <div class="row align-items-center">
          <div class="col-lg-6 col-md-12 col-12">
            <div class="header-content">
              <h1>{{ home.heroTitle }}</h1>
              <p>{{ home.heroSubtitle }}</p>
              <div class="button">
                <router-link to="/about" class="btn primary-btn">View Portfolio</router-link>
                <router-link to="/contact" class="btn primary-btn-outline ms-2">Contact Us</router-link>
              </div>
            </div>
          </div>
          <div class="col-lg-6 col-md-12 col-12">
            <div class="header-image">
              <img src="/assets/images/header/hero-image.jpg" alt="Real estate hero" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="about-area about-five">
      <div class="container">
        <div class="row align-items-center">
          <div class="col-lg-6 col-12">
            <div class="about-image-five">
              <img src="/assets/images/about/about-img1.jpg" alt="about" />
            </div>
          </div>
          <div class="col-lg-6 col-12">
            <div class="about-five-content">
              <h6 class="small-title text-lg">OUR STORY</h6>
              <h2 class="main-title fw-bold">Smart property assistance for better decisions</h2>
              <div class="about-five-tab">
                <nav>
                  <div class="nav nav-tabs" id="nav-tab" role="tablist">
                    <button class="nav-link active" id="nav-story-tab" data-bs-toggle="tab" data-bs-target="#nav-story" type="button" role="tab">Story</button>
                    <button class="nav-link" id="nav-vision-tab" data-bs-toggle="tab" data-bs-target="#nav-vision" type="button" role="tab">Vision</button>
                    <button class="nav-link" id="nav-mission-tab" data-bs-toggle="tab" data-bs-target="#nav-mission" type="button" role="tab">Mission</button>
                  </div>
                </nav>
                <div class="tab-content" id="nav-tabContent">
                  <div class="tab-pane fade show active" id="nav-story" role="tabpanel"><p>{{ home.story }}</p></div>
                  <div class="tab-pane fade" id="nav-vision" role="tabpanel"><p>{{ home.vision }}</p></div>
                  <div class="tab-pane fade" id="nav-mission" role="tabpanel"><p>{{ home.mission }}</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="services-area services-eight">
      <div class="section-title-five">
        <div class="container">
          <div class="row"><div class="col-12"><div class="content"><h6>Benefits</h6><h2 class="fw-bold">Why Customers Use ElevanLabs</h2></div></div></div>
        </div>
      </div>
      <div class="container">
        <div class="row">
          <div v-for="benefit in home.benefits" :key="benefit" class="col-lg-4 col-md-6 mb-3">
            <div class="single-services h-100">
              <div class="service-icon"><i class="lni lni-checkmark-circle"></i></div>
              <div class="service-content"><h4>{{ benefit }}</h4><p>Designed to make the property search and follow-up process faster and more reliable.</p></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import api from '../services/api';

const fallbackHome = {
  heroTitle: 'Find the Right Property with Smart Assistance',
  heroSubtitle: 'ElevanLabs helps customers buy, sell, and rent houses, villas, hotels, apartments, and boarding houses with a more transparent and guided process.',
  vision: 'To become a trusted and customer-focused property platform that makes property search, rental, buying, and selling easier for everyone.',
  mission: 'To connect customers with suitable property options through reliable portfolio data, professional assistance, and AI-powered conversations.',
  story: 'ElevanLabs was built from the common difficulty of finding reliable property information, comparing options, and communicating with agents quickly.',
  benefits: ['Clear property information', 'Faster customer response', 'Assisted property discovery', 'AI-powered customer service']
};

const home = ref(fallbackHome);

onMounted(async () => {
  try {
    const response = await api.get('/home');
    home.value = response.data?.data || fallbackHome;
  } catch (error) {
    home.value = fallbackHome;
  }
});
</script>
