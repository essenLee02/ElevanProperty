<template>
  <div>
    <section id="services" class="services-area services-eight">
      <div class="section-title-five">
        <div class="container">
          <div class="row"><div class="col-12"><div class="content"><h6>About Us</h6><h2 class="fw-bold">{{ company.title }}</h2><p>{{ company.profile }}</p></div></div></div>
        </div>
      </div>
      <div class="container">
        <div class="row">
          <div class="col-lg-4 col-md-6 mb-3"><div class="single-services h-100"><div class="service-icon"><i class="lni lni-home"></i></div><div class="service-content"><h4>Rental Services</h4><p>{{ company.rentalServices }}</p></div></div></div>
          <div class="col-lg-4 col-md-6 mb-3"><div class="single-services h-100"><div class="service-icon"><i class="lni lni-investment"></i></div><div class="service-content"><h4>Buying Services</h4><p>{{ company.buyingServices }}</p></div></div></div>
          <div class="col-lg-4 col-md-6 mb-3"><div class="single-services h-100"><div class="service-icon"><i class="lni lni-offer"></i></div><div class="service-content"><h4>Selling Services</h4><p>{{ company.sellingServices }}</p></div></div></div>
        </div>
      </div>
    </section>

    <section id="portfolio" class="latest-news-area section">
      <div class="section-title-five">
        <div class="container">
          <div class="row">
            <div class="col-12">
              <div class="content">
                <h6>Portfolio</h6>
                <h2 class="fw-bold">Our Real Estate Portfolio</h2>
                <p>Explore curated properties for sale, rent, and purchase assistance.</p>
                <PropertyFilter v-model:buildingType="filters.buildingType" v-model:transactionType="filters.transactionType" v-model:location="filters.location" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="container">
        <div class="row">
          <div v-if="isLoading" class="col-12 text-center py-5">
            <p class="text-muted">Loading properties...</p>
          </div>
          <template v-else>
            <div v-for="item in paginatedPortfolios" :key="item.id" class="col-lg-4 col-md-6 col-12 mb-4">
              <PortfolioCard :property="normalizeForCard(item)" />
            </div>
            <div v-if="filteredPortfolios.length === 0" class="col-12 text-center text-muted">
              <p>No portfolios match the selected filters.</p>
            </div>
          </template>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="row mt-3">
          <div class="col-12 d-flex justify-content-center align-items-center gap-2 flex-wrap">
            <button
              class="btn btn-sm btn-outline-primary"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >← Prev</button>
            <span class="text-muted small">Page {{ currentPage }} of {{ totalPages }} ({{ filteredPortfolios.length }} properties)</span>
            <button
              class="btn btn-sm btn-outline-primary"
              :disabled="currentPage === totalPages"
              @click="currentPage++"
            >Next →</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import PortfolioCard from '../components/PortfolioCard.vue';
import PropertyFilter from '../components/PropertyFilter.vue';
import api from '../services/api';

const company = ref({
  title: 'About ElevanLabs Real Estate',
  profile: 'ElevanLabs provides property rental, buying, and selling assistance through a modern website, structured property portfolio, and AI-powered customer communication.',
  rentalServices: 'Rental services include boarding houses, house rentals, villas, hotels, and apartments for daily, monthly, or yearly needs.',
  buyingServices: 'Buying services help customers identify property options based on location, budget, land size, building size, and facilities.',
  sellingServices: 'Selling services help property owners present property information clearly and connect with potential buyers or renters.'
});

const filters = reactive({ buildingType: '', transactionType: '', location: '' });
const portfolios = ref([]);
const isLoading = ref(true);
const currentPage = ref(1);
const PAGE_SIZE = 12;

/**
 * Normalize a flat JSON property record into the shape expected by PortfolioCard.
 * The JSON uses snake_case keys; PortfolioCard expects camelCase equivalents.
 */
function normalizeForCard(item) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    price: item.price,
    location: item.location?.city || item.location?.province || item.location || '',
    address: item.address,
    buildingArea: item.building_area || item.buildingArea || '',
    landArea: item.land_area || item.landArea || '',
    buildingType: item.building_type || item.buildingType || '',
    transactionType: item.transaction_type || item.transactionType || '',
    facilities: Array.isArray(item.facilities)
      ? item.facilities.join(', ')
      : item.facilities || '',
    imageUrl: item.image || item.imageUrl || ''
  };
}

/**
 * Load portfolio records only from the static JSON catalog.
 * No dummy generator or random portfolio function is used on About Us.
 */
const loadAbout = async () => {
  isLoading.value = true;

  try {
    const res = await fetch('/json_data/indonesia_property_36_provinces_flat.json');
    if (!res.ok) throw new Error(`Property JSON request failed: ${res.status}`);

    const json = await res.json();
    portfolios.value = Array.isArray(json.properties) ? json.properties : [];
  } catch (err) {
    console.error('Failed to load property JSON:', err);
    portfolios.value = [];
  } finally {
    isLoading.value = false;
  }
};

const filteredPortfolios = computed(() => {
  const buildingType = filters.buildingType.toLowerCase();
  const transactionType = filters.transactionType.toLowerCase();
  const location = filters.location.toLowerCase();

  return portfolios.value.filter((item) => {
    const bt = String(item.building_type || item.buildingType || '').toLowerCase();
    const tt = String(item.transaction_type || item.transactionType || '').toLowerCase();
    const loc = [
      item.location?.city,
      item.location?.province,
      item.location?.area,
      item.location,
      item.city,
      item.address
    ].filter(Boolean).join(' ').toLowerCase();

    const matchBuilding = buildingType ? bt === buildingType : true;
    const matchTransaction = transactionType ? tt === transactionType : true;
    const matchLocation = location ? loc.includes(location) : true;
    return matchBuilding && matchTransaction && matchLocation;
  });
});

const totalPages = computed(() => Math.ceil(filteredPortfolios.value.length / PAGE_SIZE));

const paginatedPortfolios = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE;
  return filteredPortfolios.value.slice(start, start + PAGE_SIZE);
});

// Reset to page 1 whenever filters change.
watch(filters, (newFilters) => {
  currentPage.value = 1;
  api.post('/log', { action: 'FILTER_DATA', details: newFilters }).catch(() => {});
}, { deep: true });

onMounted(loadAbout);
</script>
