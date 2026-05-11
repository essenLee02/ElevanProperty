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
          <div v-for="item in filteredPortfolios" :key="item.id" class="col-lg-4 col-md-6 col-12 mb-4">
            <PortfolioCard :property="item" />
          </div>
          <div v-if="filteredPortfolios.length === 0" class="col-12 text-center text-muted">
            <p>No portfolios match the selected filters.</p>
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
import { getAboutData } from '../services/aboutApi';
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

const fallbackPortfolios = Array.from({ length: 40 }, (_, index) => {
  const buildingTypes = ['villa', 'house', 'apartment', 'hotel', 'boarding_house'];
  const transactionTypes = ['sale', 'rent', 'purchase'];
  const cities = ['Surabaya', 'Malang', 'Sidoarjo', 'Batu', 'Madiun', 'Semarang', 'Yogyakarta', 'Bandung'];
  const buildingType = buildingTypes[index % buildingTypes.length];
  const transactionType = transactionTypes[index % transactionTypes.length];
  const city = cities[index % cities.length];
  return {
    id: index + 1,
    title: `${city} ${buildingType.replace('_', ' ')} ${index + 1}`,
    description: `Curated ${buildingType.replace('_', ' ')} option for ${transactionType} customers in ${city}.`,
    price: transactionType === 'rent' ? `Rp ${8 + (index % 20)} juta / bulan` : `Rp ${(650 + index * 85).toLocaleString('id-ID')} juta`,
    location: city,
    address: `Jl. Property ${index + 1}, ${city}`,
    buildingArea: `${80 + index * 7} m²`,
    landArea: `${100 + index * 8} m²`,
    buildingType,
    transactionType,
    facilities: 'AC, Parking, Security',
    imageUrl: `/assets/images/blog/${(index % 3) + 1}.jpg`
  };
});

const loadAbout = async () => {
  try {
    const response = await getAboutData();
    company.value = response.data?.data?.company || company.value;
    portfolios.value = response.data?.data?.portfolios || fallbackPortfolios;
  } catch (error) {
    portfolios.value = fallbackPortfolios;
  }
};

const filteredPortfolios = computed(() => {
  const buildingType = filters.buildingType.toLowerCase();
  const transactionType = filters.transactionType.toLowerCase();
  const location = filters.location.toLowerCase();
  return portfolios.value.filter((item) => {
    const matchBuilding = buildingType ? String(item.buildingType).toLowerCase() === buildingType : true;
    const matchTransaction = transactionType ? String(item.transactionType).toLowerCase() === transactionType : true;
    const matchLocation = location ? String(item.location || item.city || '').toLowerCase().includes(location) : true;
    return matchBuilding && matchTransaction && matchLocation;
  });
});

watch(filters, (newFilters) => {
  api.post('/log', { action: 'FILTER_DATA', details: newFilters }).catch(() => {});
}, { deep: true });

onMounted(loadAbout);
</script>
