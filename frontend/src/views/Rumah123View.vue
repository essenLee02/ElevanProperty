<template>
  <div class="rumah123-page">
    <div class="page-header">
      <h1>🏠 Property Search</h1>
      <p>Cari properti di Rumah123 dengan filter lengkap</p>
    </div>

    <!-- Filter Panel -->
    <div class="filter-panel">
      <div class="filter-grid">
        <!-- Listing Type -->
        <div class="filter-group">
          <label>Tipe Listing</label>
          <select v-model="filters.listingType">
            <option value="sale">Dijual</option>
            <option value="rent">Disewa</option>
          </select>
        </div>

        <!-- Location -->
        <div class="filter-group">
          <label>Lokasi</label>
          <input
            v-model="filters.location"
            type="text"
            placeholder="Contoh: Jakarta Selatan, Bandung"
          />
        </div>

        <!-- Property Type -->
        <div class="filter-group">
          <label>Tipe Properti</label>
          <select v-model="filters.propertyType">
            <option value="">Semua</option>
            <option value="house">Rumah</option>
            <option value="apartment">Apartemen</option>
            <option value="land">Tanah</option>
            <option value="shophouse">Ruko</option>
            <option value="villa">Villa</option>
            <option value="office">Kantor</option>
            <option value="warehouse">Gudang</option>
          </select>
        </div>

        <!-- Sort Order -->
        <div class="filter-group">
          <label>Urutkan</label>
          <select v-model="filters.sortOrder">
            <option value="recommended">Rekomendasi</option>
            <option value="price-asc">Harga Terendah</option>
            <option value="price-desc">Harga Tertinggi</option>
            <option value="posted-desc">Terbaru</option>
            <option value="land-size-desc">Luas Tanah</option>
          </select>
        </div>

        <!-- Price Range -->
        <div class="filter-group">
          <label>Harga Min (IDR)</label>
          <input
            v-model="filters.minPrice"
            type="number"
            placeholder="0"
            step="100000000"
          />
        </div>

        <div class="filter-group">
          <label>Harga Max (IDR)</label>
          <input
            v-model="filters.maxPrice"
            type="number"
            placeholder="Tidak terbatas"
            step="100000000"
          />
        </div>

        <!-- Bedrooms -->
        <div class="filter-group">
          <label>Min. Kamar Tidur</label>
          <select v-model="filters.minBedrooms">
            <option value="">Semua</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
          </select>
        </div>

        <!-- Bathrooms -->
        <div class="filter-group">
          <label>Min. Kamar Mandi</label>
          <select v-model="filters.minBathrooms">
            <option value="">Semua</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
          </select>
        </div>

        <!-- Furnishing -->
        <div class="filter-group">
          <label>Kondisi Furnitur</label>
          <select v-model="filters.furnishingCondition">
            <option value="">Semua</option>
            <option value="fully-furnished">Fully Furnished</option>
            <option value="partially-furnished">Semi Furnished</option>
            <option value="unfurnished">Unfurnished</option>
          </select>
        </div>

        <!-- Limit -->
        <div class="filter-group">
          <label>Jumlah Hasil</label>
          <select v-model="filters.limit">
            <option value="10">10 listing</option>
            <option value="20">20 listing</option>
            <option value="50">50 listing</option>
            <option value="100">100 listing</option>
          </select>
        </div>
      </div>

      <div class="filter-actions">
        <button class="btn-search" @click="doSearch" :disabled="loading">
          <span v-if="loading">⏳ Mencari...</span>
          <span v-else>🔍 Cari Properti</span>
        </button>
        <button class="btn-reset" @click="resetFilters">↺ Reset</button>
      </div>
    </div>

    <!-- Status Info -->
    <div v-if="meta" class="search-meta">
      <span>✅ Ditemukan <strong>{{ meta.total }}</strong> properti</span>
      <span v-if="meta.datasetId" class="dataset-id">
        Dataset ID: <code>{{ meta.datasetId }}</code>
      </span>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Mengambil data dari Rumah123 via Apify...</p>
      <p class="loading-note">⏱️ Estimasi: 1-3 menit untuk {{ filters.limit }} listing</p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="error-state">
      <h3>❌ Terjadi Error</h3>
      <p>{{ error }}</p>
      <p v-if="error.includes('APIFY_API_TOKEN')" class="hint">
        💡 Tambahkan <code>APIFY_API_TOKEN</code> ke file <code>.env</code> backend
      </p>
    </div>

    <!-- Results Grid -->
    <div v-if="listings.length > 0 && !loading" class="results-section">
      <h2>Hasil Pencarian ({{ listings.length }} listing)</h2>
      <div class="listings-grid">
        <div
          v-for="listing in listings"
          :key="listing.id"
          class="listing-card"
        >
          <!-- Image -->
          <div class="listing-image">
            <img
              v-if="listing.mediaUrls && listing.mediaUrls[0]"
              :src="listing.mediaUrls[0]"
              :alt="listing.title"
              @error="$event.target.src = 'https://via.placeholder.com/300x200?text=No+Image'"
            />
            <div v-else class="no-image">🏠</div>

            <!-- Badges -->
            <span class="badge-type" :class="listing.listingType === 'Dijual' ? 'badge-sale' : 'badge-rent'">
              {{ listing.listingType }}
            </span>
            <span v-if="listing.propertyType" class="badge-prop">
              {{ listing.propertyType }}
            </span>
          </div>

          <!-- Content -->
          <div class="listing-body">
            <h3 class="listing-title">
              <a :href="listing.url" target="_blank" rel="noopener">{{ listing.title || 'Tanpa Judul' }}</a>
            </h3>

            <!-- Price -->
            <div class="listing-price">{{ listing.price || 'Harga tidak tersedia' }}</div>

            <!-- Location -->
            <div class="listing-location">
              📍 {{ listing.location || listing.city || listing.district || '-' }}
            </div>

            <!-- Specs -->
            <div class="listing-specs">
              <span v-if="listing.bedrooms">🛏️ {{ listing.bedrooms }} KT</span>
              <span v-if="listing.bathrooms">🚿 {{ listing.bathrooms }} KM</span>
              <span v-if="listing.landSize">📐 {{ listing.landSize }}m²</span>
              <span v-if="listing.buildingSize">🏗️ {{ listing.buildingSize }}m²</span>
            </div>

            <!-- Certificate & Condition -->
            <div class="listing-details">
              <span v-if="listing.certificate">📜 {{ listing.certificate }}</span>
              <span v-if="listing.furnishing">🛋️ {{ listing.furnishing }}</span>
            </div>

            <!-- Agent -->
            <div class="listing-agent">
              <span class="agent-name">👤 {{ listing.agentName || 'Agent tidak tersedia' }}</span>
              <span v-if="listing.agencyName" class="agency-name">{{ listing.agencyName }}</span>
            </div>

            <!-- Actions -->
            <div class="listing-actions">
              <a :href="listing.url" target="_blank" class="btn-detail">Lihat Detail</a>
              <a
                v-if="listing.agentWhatsapp"
                :href="`https://wa.me/${listing.agentWhatsapp.replace(/\D/g, '')}`"
                target="_blank"
                class="btn-wa"
              >WhatsApp</a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && !error && searched && listings.length === 0" class="empty-state">
      <p>😕 Tidak ada listing ditemukan dengan filter ini.</p>
      <p>Coba ubah lokasi atau filter pencarian.</p>
    </div>
  </div>
</template>

<script>
import { rumah123Api } from '../services/rumah123Api.js'

export default {
  name: 'Rumah123View',
  data() {
    return {
      filters: {
        listingType: 'sale',
        location: 'Jakarta Selatan',
        sortOrder: 'recommended',
        propertyType: '',
        minPrice: null,
        maxPrice: null,
        minBedrooms: '',
        minBathrooms: '',
        furnishingCondition: '',
        limit: 20,
      },
      listings: [],
      meta: null,
      loading: false,
      error: null,
      searched: false,
    }
  },
  methods: {
    async doSearch() {
      this.loading = true
      this.error = null
      this.listings = []
      this.meta = null
      this.searched = true

      try {
        const body = {
          listingType: this.filters.listingType,
          location: this.filters.location,
          sortOrder: this.filters.sortOrder,
          limit: parseInt(this.filters.limit),
        }

        // Hanya kirim propertyType jika dipilih
        if (this.filters.propertyType) {
          body.propertyType = [this.filters.propertyType]
        }

        // Hanya kirim furnishingCondition jika dipilih
        if (this.filters.furnishingCondition) {
          body.furnishingCondition = [this.filters.furnishingCondition]
        }

        if (this.filters.minPrice) body.minPrice = parseInt(this.filters.minPrice)
        if (this.filters.maxPrice) body.maxPrice = parseInt(this.filters.maxPrice)
        if (this.filters.minBedrooms) body.minBedrooms = this.filters.minBedrooms
        if (this.filters.minBathrooms) body.minBathrooms = this.filters.minBathrooms

        const response = await rumah123Api.searchPost(body)

        if (response.data.success) {
          this.listings = response.data.data.listings
          this.meta = response.data.data.meta
        }
      } catch (err) {
        this.error = err.response?.data?.error || err.message || 'Terjadi kesalahan'
      } finally {
        this.loading = false
      }
    },

    resetFilters() {
      this.filters = {
        listingType: 'sale',
        location: '',
        sortOrder: 'recommended',
        propertyType: '',
        minPrice: null,
        maxPrice: null,
        minBedrooms: '',
        minBathrooms: '',
        furnishingCondition: '',
        limit: 20,
      }
      this.listings = []
      this.meta = null
      this.error = null
      this.searched = false
    },

    formatPrice(price) {
      if (!price) return '-'
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(price)
    },
  }
}
</script>

<style scoped>
.rumah123-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 2rem;
  color: #2c3e50;
}

.page-header p {
  color: #666;
}

/* Filter Panel */
.filter-panel {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.filter-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 6px;
}

.filter-group input,
.filter-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #212529;
  background: white;
  box-sizing: border-box;
}


.filter-actions {
  display: flex;
  gap: 12px;
}

.btn-search {
  background: #0066cc;
  color: white;
  border: none;
  padding: 10px 28px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-search:hover:not(:disabled) { background: #0052a3; }
.btn-search:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-reset {
  background: white;
  color: #495057;
  border: 1px solid #ced4da;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
}

/* Search Meta */
.search-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #d4edda;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 0.9rem;
}

.dataset-id code {
  background: #c3e6cb;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
}

/* Loading */
.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #dee2e6;
  border-top-color: #0066cc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-note {
  font-size: 0.85rem;
  color: #888;
}

/* Error */
.error-state {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
  padding: 20px;
  color: #721c24;
  margin-bottom: 20px;
}

.error-state .hint {
  margin-top: 10px;
  color: #856404;
  background: #fff3cd;
  padding: 10px;
  border-radius: 6px;
}

/* Listings Grid */
.results-section h2 {
  margin-bottom: 16px;
  color: #2c3e50;
}

.listings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

.listing-card {
  border: 1px solid #dee2e6;
  border-radius: 12px;
  overflow: hidden;
  background: white;
  transition: box-shadow 0.2s, transform 0.2s;
}

.listing-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  transform: translateY(-2px);
}

/* Image */
.listing-image {
  position: relative;
  height: 200px;
  background: #f0f0f0;
  overflow: hidden;
}

.listing-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-image {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 4rem;
  background: #f8f9fa;
}

.badge-type {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
}

.badge-sale { background: #28a745; }
.badge-rent { background: #007bff; }

.badge-prop {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(0,0,0,0.6);
  color: white;
}

/* Content */
.listing-body {
  padding: 16px;
}

.listing-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 8px;
  line-height: 1.3;
}

.listing-title a {
  color: #212529;
  text-decoration: none;
}

.listing-title a:hover { color: #0066cc; text-decoration: underline; }

.listing-price {
  font-size: 1.15rem;
  font-weight: 700;
  color: #0066cc;
  margin-bottom: 6px;
}

.listing-location {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 10px;
}

.listing-specs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.listing-specs span {
  background: #f0f4f8;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #495057;
}

.listing-details {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.listing-details span {
  font-size: 0.8rem;
  color: #666;
}

.listing-agent {
  border-top: 1px solid #f0f0f0;
  padding-top: 10px;
  margin-bottom: 12px;
}

.agent-name {
  font-size: 0.82rem;
  color: #555;
  display: block;
}

.agency-name {
  font-size: 0.78rem;
  color: #888;
}

.listing-actions {
  display: flex;
  gap: 8px;
}

.btn-detail {
  flex: 1;
  text-align: center;
  padding: 8px;
  background: #0066cc;
  color: white;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 600;
}

.btn-wa {
  flex: 1;
  text-align: center;
  padding: 8px;
  background: #25d366;
  color: white;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 600;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

@media (max-width: 768px) {
  .filter-grid { grid-template-columns: 1fr 1fr; }
  .listings-grid { grid-template-columns: 1fr; }
}
</style>
