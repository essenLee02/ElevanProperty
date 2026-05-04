<template>
  <div>
    <!-- ===== service-area start ===== -->
    <section id="services" class="services-area services-eight">
      <div class="section-title-five">
        <div class="container">
          <div class="row">
            <div class="col-12">
              <div class="content">
                <h6>Services</h6>
                <h2 class="fw-bold">Our Best Services</h2>
                <p>We provide various real estate services including selling, buying, and renting properties. Our rental services cover home boarding, house rentals, villas, and hotels.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="container">
        <div class="row">
          <div class="col-lg-4 col-md-6">
            <div class="single-services">
              <div class="service-icon"><i class="lni lni-home"></i></div>
              <div class="service-content">
                <h4>House Rentals</h4>
                <p>Find the best house rentals that suit your family's needs.</p>
              </div>
            </div>
          </div>
          <div class="col-lg-4 col-md-6">
            <div class="single-services">
              <div class="service-icon"><i class="lni lni-apartment"></i></div>
              <div class="service-content">
                <h4>Villas & Hotels</h4>
                <p>Luxury villas and hotels for temporary or long-term stays.</p>
              </div>
            </div>
          </div>
          <div class="col-lg-4 col-md-6">
            <div class="single-services">
              <div class="service-icon"><i class="lni lni-investment"></i></div>
              <div class="service-content">
                <h4>Buying & Selling</h4>
                <p>Rigorous portfolio curation to get the best properties on the market.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Start Portfolio / Latest News Area -->
    <div id="blog" class="latest-news-area section">
      <div class="section-title-five">
        <div class="container">
          <div class="row">
            <div class="col-12">
              <div class="content">
                <h6>Portfolio</h6>
                <h2 class="fw-bold">Our Real Estate Portfolio</h2>
                
                <div class="row mt-4 text-start">
                  <div class="col-md-6">
                    <label class="form-label">Filter by Building Type:</label>
                    <select class="form-select" v-model="filters.buildingType">
                      <option value="">All Types</option>
                      <option value="Villa">Villa</option>
                      <option value="House">House</option>
                      <option value="Apartment">Apartment</option>
                      <option value="Hotel">Hotel</option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Filter by Transaction Type:</label>
                    <select class="form-select" v-model="filters.transactionType">
                      <option value="">All Transactions</option>
                      <option value="Sale">Sale</option>
                      <option value="Rental">Rental</option>
                      <option value="Purchase">Purchase</option>
                    </select>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="container">
        <div class="row">
          <div class="col-lg-4 col-md-6 col-12" v-for="item in filteredPortfolios" :key="item.id">
            <div class="single-news">
              <div class="image">
                <a href="javascript:void(0)"><img class="thumb" :src="item.image" alt="Portfolio Image" style="width:100%;height:250px;object-fit:cover;" /></a>
              </div>
              <div class="content-body">
                <h4 class="title">
                  <a href="javascript:void(0)">{{ item.buildingType }} for {{ item.type }}</a>
                </h4>
                <p><strong>Location:</strong> {{ item.location }}</p>
                <p><strong>Price:</strong> {{ item.price }}</p>
                <p><strong>Area:</strong> {{ item.area }}</p>
              </div>
            </div>
          </div>
          <div v-if="filteredPortfolios.length === 0" class="col-12 text-center text-muted">
            <p>No portfolios match the selected filters.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import axios from 'axios';

const filters = reactive({
  buildingType: '',
  transactionType: ''
});

// Watch for filter changes and log them
watch(filters, (newFilters) => {
  axios.post('http://localhost:5000/api/log', {
    action: 'FILTER_DATA',
    details: JSON.stringify(newFilters)
  }).catch(err => console.error('Failed to log filter action', err));
}, { deep: true });

const portfolios = ref(Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  price: `$${(Math.random() * 500 + 100).toFixed(0)},000`,
  location: `Location ${i + 1}, City`,
  area: `${(Math.random() * 200 + 50).toFixed(0)} sqm`,
  buildingType: ['Villa', 'House', 'Apartment', 'Hotel'][i % 4],
  type: ['Sale', 'Rental', 'Purchase'][i % 3],
  image: `/assets/images/blog/${(i % 3) + 1}.jpg`
})));

const filteredPortfolios = computed(() => {
  return portfolios.value.filter(item => {
    const matchBuilding = filters.buildingType ? item.buildingType === filters.buildingType : true;
    const matchTransaction = filters.transactionType ? item.type === filters.transactionType : true;
    return matchBuilding && matchTransaction;
  });
});
</script>
