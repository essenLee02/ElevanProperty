<template>
  <section class="master-list-section">
    <div class="container">

      <!-- Header -->
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h2 class="mb-1">Master Properti</h2>
          <p class="text-body-secondary mb-0">
            Kelola daftar properti (jual / sewa) beserta lokasi dan tipenya
          </p>
        </div>
        <router-link to="/property/add" class="btn btn-primary">
          <i class="fa-solid fa-plus me-1"></i> Tambah Properti
        </router-link>
      </div>

      <!-- ── Filter ─────────────────────────────────────────────── -->
      <div class="card mb-4">
        <div class="card-body">
          <div class="row g-3">
            <!-- Search: label UI singkat, tetapi backend mencari di
                 title / address / description sekaligus. -->
            <div class="col-12 col-lg-4">
              <label class="form-label small fw-semibold mb-1">Pencarian</label>
              <div class="input-group">
                <span class="input-group-text bg-body-secondary border-end-0">
                  <i class="fa-solid fa-magnifying-glass text-body-secondary"></i>
                </span>
                <input
                  v-model="search"
                  type="text"
                  class="form-control border-start-0"
                  placeholder="Search properties..."
                  @input="onSearchInput"
                />
              </div>
            </div>

            <div class="col-6 col-lg-2">
              <label class="form-label small fw-semibold mb-1">Tipe Transaksi</label>
              <select v-model="filterTransaction" class="form-select" @change="loadData(1)">
                <option value="">Semua</option>
                <option v-for="t in TRANSACTION_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>

            <div class="col-6 col-lg-2">
              <label class="form-label small fw-semibold mb-1">Tipe Properti</label>
              <select v-model="filterBuilding" class="form-select" @change="loadData(1)">
                <option value="">Semua</option>
                <option v-for="b in BUILDING_TYPES" :key="b.value" :value="b.value">{{ b.label }}</option>
              </select>
            </div>

            <div class="col-6 col-lg-2">
              <label class="form-label small fw-semibold mb-1">Kondisi Furnitur</label>
              <select v-model="filterFurnished" class="form-select" @change="loadData(1)">
                <option value="">Semua</option>
                <option v-for="f in options.furnished" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>

            <!-- Kota / Provinsi / Negara memakai dropdown ber-search karena
                 daftarnya bisa panjang. -->
            <div class="col-6 col-lg-2">
              <label class="form-label small fw-semibold mb-1">Kota</label>
              <SearchableSelect
                v-model="filterCity"
                :options="options.cities"
                placeholder="Semua"
                search-placeholder="Cari kota..."
                @change="loadData(1)"
              />
            </div>

            <div class="col-6 col-lg-3">
              <label class="form-label small fw-semibold mb-1">Provinsi</label>
              <SearchableSelect
                v-model="filterProvince"
                :options="options.provinces"
                placeholder="Semua"
                search-placeholder="Cari provinsi..."
                @change="loadData(1)"
              />
            </div>

            <div class="col-6 col-lg-3">
              <label class="form-label small fw-semibold mb-1">Negara</label>
              <SearchableSelect
                v-model="filterCountry"
                :options="options.countries"
                placeholder="Semua"
                search-placeholder="Cari negara..."
                @change="loadData(1)"
              />
            </div>

            <!-- Range harga: 0 .. harga tertinggi milik user yang login -->
            <div class="col-12 col-lg-6">
              <label class="form-label small fw-semibold mb-1 d-flex justify-content-between align-items-center">
                <span>Harga Maksimum</span>
                <span class="badge text-bg-primary">
                  {{ priceTouched ? formatRupiah(maxPrice) : 'Semua harga' }}
                </span>
              </label>
              <input
                v-model.number="maxPrice"
                type="range"
                class="form-range"
                min="0"
                :max="priceMax"
                :step="priceStep"
                :disabled="priceMax <= 0"
                @input="priceTouched = true"
                @change="loadData(1)"
              />
              <div class="d-flex justify-content-between small text-body-secondary">
                <span>Rp 0</span>
                <span>{{ formatRupiah(priceMax) }}</span>
              </div>
            </div>
          </div>

          <div class="d-flex flex-wrap align-items-center gap-2 mt-3">
            <button type="button" class="btn btn-outline-secondary btn-sm" @click="resetFilters">
              <i class="fa-solid fa-rotate-left me-1"></i> Reset Filter
            </button>
            <span v-if="!isLoading" class="text-body-secondary small ms-auto">
              Menampilkan <strong>{{ properties.length }}</strong> dari
              <strong>{{ pagination.total }}</strong> properti
            </span>
          </div>
        </div>
      </div>

      <!-- Alert -->
      <div v-if="alert.message" :class="['alert', `alert-${alert.type}`, 'alert-dismissible']" role="alert">
        {{ alert.message }}
        <button type="button" class="btn-close" @click="clearAlert"></button>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="text-body-secondary mt-3 mb-0">Memuat data properti...</p>
      </div>

      <template v-else>
        <!-- ── Grid kartu ──────────────────────────────────────── -->
        <div v-if="properties.length > 0" class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4">
          <div v-for="p in properties" :key="p.property_id" class="col">
            <div class="card h-100 shadow-sm property-card">

              <!-- Gambar: auto-slide ke kiri tiap 3 detik bila > 1 gambar -->
              <div class="position-relative overflow-hidden bg-body-secondary property-media">
                <div
                  class="property-track d-flex h-100"
                  :style="{ transform: `translateX(-${(slideIndex[p.property_id] || 0) * 100}%)` }"
                >
                  <img
                    v-for="(img, idx) in p.images"
                    :key="img.id ?? `def-${idx}`"
                    :src="img.url"
                    :alt="img.name || p.title"
                    loading="lazy"
                    class="property-slide w-100 h-100 object-fit-cover flex-shrink-0"
                    @error="onImgError"
                  />
                </div>

                <!-- Badge transaksi & status -->
                <span
                  class="badge position-absolute top-0 start-0 m-2"
                  :class="p.transaction_type === 'Sale' ? 'text-bg-success' : 'text-bg-info'"
                >
                  {{ p.transaction_type === 'Sale' ? 'Dijual' : 'Disewa' }}
                </span>
                <span
                  v-if="p.status !== 1"
                  class="badge text-bg-danger position-absolute top-0 end-0 m-2"
                >Disabled</span>

                <!-- Indikator jumlah gambar -->
                <div
                  v-if="p.images.length > 1"
                  class="position-absolute bottom-0 start-50 translate-middle-x mb-2 d-flex gap-1"
                >
                  <span
                    v-for="(img, idx) in p.images"
                    :key="`dot-${p.property_id}-${idx}`"
                    class="property-dot rounded-circle"
                    :class="(slideIndex[p.property_id] || 0) === idx ? 'bg-white' : 'bg-white opacity-50'"
                  ></span>
                </div>
              </div>

              <div class="card-body d-flex flex-column">
                <!-- Judul -->
                <h5 class="card-title h6 mb-1 text-truncate" :title="p.title">{{ p.title }}</h5>

                <!-- Harga -->
                <div class="fw-bold text-primary mb-2">{{ p.price_display }}</div>

                <!-- Alamat -->
                <p class="small text-body-secondary mb-1">
                  <i class="fa-solid fa-location-dot me-1"></i>
                  {{ p.address || '-' }}
                </p>

                <!-- Lokasi + kode pos -->
                <p class="small text-body-secondary mb-2">
                  {{ [p.city, p.province, p.country].filter(v => v && v !== '-').join(', ') || '-' }}
                  <span v-if="p.postal_code" class="ms-1">— {{ p.postal_code }}</span>
                </p>

                <!-- Spesifikasi ringkas -->
                <div class="d-flex flex-wrap gap-3 small text-body-secondary mb-2">
                  <span v-if="p.area"><i class="fa-solid fa-map me-1"></i>{{ p.area }}</span>
                  <span v-if="p.building_area"><i class="fa-solid fa-ruler-combined me-1"></i>{{ p.building_area }}</span>
                  <span v-if="p.land_area"><i class="fa-solid fa-vector-square me-1"></i>{{ p.land_area }}</span>
                  <span v-if="p.bed_rooms"><i class="fa-solid fa-bed me-1"></i>{{ p.bed_rooms }}</span>
                  <span v-if="p.bath_rooms"><i class="fa-solid fa-shower me-1"></i>{{ p.bath_rooms }}</span>
                </div>

                <!-- Tipe & furnitur -->
                <div class="d-flex flex-wrap gap-1 mb-2">
                  <span class="badge text-bg-light border">{{ buildingLabel(p.building_type) }}</span>
                  <span v-if="p.furnished_status" class="badge text-bg-light border">{{ p.furnished_status }}</span>
                </div>

                <!-- Fasilitas -->
                <div v-if="p.facilities.length" class="d-flex flex-wrap gap-1 mb-3">
                  <span
                    v-for="f in p.facilities.slice(0, MAX_FACILITY_CHIPS)"
                    :key="`${p.property_id}-${f.facility_id}`"
                    class="badge rounded-pill text-bg-secondary fw-normal"
                  >
                    <i v-if="f.icon" :class="f.icon" class="me-1"></i>{{ f.name || f.facility_id }}
                    <template v-if="f.facility_qty > 1"> ×{{ f.facility_qty }}</template>
                  </span>
                  <span
                    v-if="p.facilities.length > MAX_FACILITY_CHIPS"
                    class="badge rounded-pill text-bg-light border fw-normal"
                    :title="p.facilities.map(f => f.name).filter(Boolean).join(', ')"
                  >+{{ p.facilities.length - MAX_FACILITY_CHIPS }}</span>
                </div>

                <!-- Aksi admin -->
                <div class="d-flex gap-2 mt-auto pt-2 border-top">
                  <router-link
                    :to="`/property/edit/${p.property_id}`"
                    class="btn btn-sm btn-outline-primary flex-fill"
                  >
                    <i class="fa-solid fa-pen me-1"></i> Edit
                  </router-link>
                  <button
                    type="button"
                    class="btn btn-sm flex-fill"
                    :class="p.status === 1 ? 'btn-outline-warning' : 'btn-outline-success'"
                    :disabled="actionLoading === p.property_id"
                    @click="handleToggleStatus(p)"
                  >
                    <i class="fa-solid" :class="p.status === 1 ? 'fa-ban' : 'fa-check'"></i>
                    {{ p.status === 1 ? 'Block' : 'Aktifkan' }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-danger"
                    :disabled="actionLoading === p.property_id"
                    title="Hapus properti"
                    @click="handleDelete(p)"
                  >
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="text-center py-5">
          <div class="display-4 mb-2">🏠</div>
          <p class="text-body-secondary">
            {{ hasActiveFilter ? 'Tidak ada properti yang cocok dengan filter ini.' : 'Belum ada properti yang terdaftar' }}
          </p>
          <button v-if="hasActiveFilter" type="button" class="btn btn-outline-secondary" @click="resetFilters">
            Reset Filter
          </button>
          <router-link v-else to="/property/add" class="btn btn-primary">
            + Tambah Properti Pertama
          </router-link>
        </div>

        <!-- Pagination -->
        <nav v-if="pagination.totalPages > 1" class="mt-4">
          <ul class="pagination justify-content-center flex-wrap">
            <li class="page-item" :class="{ disabled: !pagination.hasPrevPage }">
              <button type="button" class="page-link" @click="loadData(pagination.page - 1)">
                <i class="fa-solid fa-chevron-left"></i>
              </button>
            </li>
            <li
              v-for="pg in pageNumbers"
              :key="pg"
              class="page-item"
              :class="{ active: pg === pagination.page }"
            >
              <button type="button" class="page-link" @click="loadData(pg)">{{ pg }}</button>
            </li>
            <li class="page-item" :class="{ disabled: !pagination.hasNextPage }">
              <button type="button" class="page-link" @click="loadData(pagination.page + 1)">
                <i class="fa-solid fa-chevron-right"></i>
              </button>
            </li>
          </ul>
        </nav>
      </template>

    </div>

    <!-- Confirm Modal -->
    <ConfirmModal
      :show="modal.show"
      :icon="modal.icon"
      :title="modal.title"
      :message="modal.desc"
      :confirm-text="modal.confirmText"
      :confirm-class="modal.confirmClass"
      :busy="modal.loading"
      @confirm="modal.onConfirm"
      @cancel="closeModal"
    />
  </section>
</template>

<script setup>
  import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue';
  import { toast } from 'vue3-toastify';
  import ConfirmModal from '../../components/ConfirmModal.vue';
  import SearchableSelect from '../../components/SearchableSelect.vue';
  import {
    getPropertyList,
    togglePropertyStatus,
    deleteProperty
  } from '../../services/propertyApi';

  /* ── Opsi tipe (selaras backend) ─────────────────────────────────── */
  const TRANSACTION_TYPES = [
    { value: 'Sale', label: 'Jual (Sale)' },
    { value: 'Rent', label: 'Sewa (Rent)' }
  ];
  const BUILDING_TYPES = [
    { value: 'house',          label: 'Rumah' },
    { value: 'apartment',      label: 'Apartemen' },
    { value: 'hotel',          label: 'Hotel' },
    { value: 'villa',          label: 'Villa' },
    { value: 'boarding_house', label: 'Kos' },
    { value: 'shophouse',      label: 'Ruko' },
    { value: 'office',         label: 'Kantor' },
    { value: 'warehouse',      label: 'Gudang' },
    { value: 'store',          label: 'Toko' },
    { value: 'condo',          label: 'Kondominium' },
    { value: 'mansion',        label: 'Mansion' },
    { value: 'others',         label: 'Lainnya' }
  ];
  const BUILDING_LABEL = Object.fromEntries(BUILDING_TYPES.map(b => [b.value, b.label]));
  const buildingLabel  = (v) => BUILDING_LABEL[v] || v || '-';

  const MAX_FACILITY_CHIPS = 4;
  const SLIDE_INTERVAL_MS  = 3000;   // gambar bergeser ke kiri tiap 3 detik

  /* ── State ──────────────────────────────────────────────────────── */
  const properties        = ref([]);
  const isLoading         = ref(false);
  const actionLoading     = ref(null);

  const search            = ref('');
  const filterTransaction = ref('');
  const filterBuilding    = ref('');
  const filterFurnished   = ref('');
  const filterCity        = ref('');
  const filterProvince    = ref('');
  const filterCountry     = ref('');

  // Slider harga. `priceTouched` penting: selama slider belum disentuh kita
  // TIDAK mengirim max_price, supaya properti dengan harga NULL tidak ikut
  // tersaring keluar oleh perbandingan `price <= x`.
  const priceMax     = ref(0);
  const maxPrice     = ref(0);
  const priceTouched = ref(false);

  const options = reactive({ cities: [], provinces: [], countries: [], furnished: [] });

  const slideIndex = reactive({});   // { [property_id]: index gambar aktif }
  let   slideTimer = null;
  let   searchTimer = null;

  const pagination = reactive({
    total: 0, page: 1, pageSize: 10, totalPages: 0, hasNextPage: false, hasPrevPage: false
  });

  const alert = reactive({ type: '', message: '' });

  const modal = reactive({
    show: false, icon: '', title: '', desc: '',
    confirmText: '', confirmClass: '', loading: false, onConfirm: () => {}
  });

  /* ── Computed ───────────────────────────────────────────────────── */
  const priceStep = computed(() => {
    const max = priceMax.value;
    if (max <= 0) return 1;
    // ~100 langkah, dibulatkan agar angkanya "rapi"
    const raw = max / 100;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.max(1, Math.round(raw / mag) * mag);
  });

  const hasActiveFilter = computed(() =>
    !!(search.value || filterTransaction.value || filterBuilding.value || filterFurnished.value
      || filterCity.value || filterProvince.value || filterCountry.value || priceTouched.value)
  );

  const pageNumbers = computed(() => {
    const total = pagination.totalPages;
    const cur   = pagination.page;
    const span  = 2;
    const from  = Math.max(1, cur - span);
    const to    = Math.min(total, cur + span);
    const list  = [];
    for (let i = from; i <= to; i++) list.push(i);
    return list;
  });

  /* ── Helpers ────────────────────────────────────────────────────── */
  const setAlert   = (type, message) => { alert.type = type; alert.message = message; };
  const clearAlert = () => { alert.type = ''; alert.message = ''; };
  const openModal  = (opts) => Object.assign(modal, { show: true, loading: false, ...opts });
  const closeModal = () => { if (!modal.loading) modal.show = false; };

  const formatRupiah = (val) => {
    const n = Number(val);
    if (!isFinite(n)) return 'Rp 0';
    return 'Rp ' + n.toLocaleString('id-ID');
  };

  /** Gambar rusak / hilang di disk → sembunyikan agar layout tidak pecah. */
  const onImgError = (e) => { e.target.style.visibility = 'hidden'; };

  /* ── Data loading ───────────────────────────────────────────────── */
  const loadData = async (page = 1) => {
    if (page < 1 || (pagination.totalPages && page > pagination.totalPages)) return;

    isLoading.value = true;
    clearAlert();
    try {
      const params = {
        page,
        search:           search.value || undefined,
        transaction_type: filterTransaction.value || undefined,
        building_type:    filterBuilding.value || undefined,
        furnished_status: filterFurnished.value || undefined,
        city_id:          filterCity.value || undefined,
        province_id:      filterProvince.value || undefined,
        country_id:       filterCountry.value || undefined,
        max_price:        priceTouched.value ? maxPrice.value : undefined
      };
      const result = await getPropertyList(params);

      if (result?.isSuccess === 1) {
        const res = result.data.response || {};
        properties.value = (res.properties || []).map(p => ({
          ...p,
          images:     Array.isArray(p.images) ? p.images : [],
          facilities: Array.isArray(p.facilities) ? p.facilities : []
        }));
        Object.assign(pagination, res.pagination || {});

        // Batas slider datang dari backend (harga tertinggi milik user).
        const newMax = Number(res.meta?.price_max || 0);
        if (newMax !== priceMax.value) {
          priceMax.value = newMax;
          if (!priceTouched.value) maxPrice.value = newMax;
        }

        Object.assign(options, {
          cities:    res.options?.cities    || [],
          provinces: res.options?.provinces || [],
          countries: res.options?.countries || [],
          furnished: res.options?.furnished || []
        });

        resetSlides();
      } else {
        setAlert('danger', result?.data?.message || 'Gagal memuat data');
      }
    } catch (err) {
      if (err?.response?.status === 401) return;
      setAlert('danger', err?.response?.data?.data?.message || err?.message || 'Gagal memuat data properti');
    } finally {
      isLoading.value = false;
    }
  };

  const onSearchInput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadData(1), 400);
  };

  const resetFilters = () => {
    search.value            = '';
    filterTransaction.value = '';
    filterBuilding.value    = '';
    filterFurnished.value   = '';
    filterCity.value        = '';
    filterProvince.value    = '';
    filterCountry.value     = '';
    priceTouched.value      = false;
    maxPrice.value          = priceMax.value;
    loadData(1);
  };

  /* ── Carousel gambar (geser ke kiri tiap 3 detik) ────────────────── */
  const resetSlides = () => {
    Object.keys(slideIndex).forEach(k => delete slideIndex[k]);
    properties.value.forEach(p => { slideIndex[p.property_id] = 0; });
  };

  const startSlideTimer = () => {
    stopSlideTimer();
    slideTimer = setInterval(() => {
      properties.value.forEach(p => {
        const total = p.images.length;
        if (total > 1) {
          slideIndex[p.property_id] = ((slideIndex[p.property_id] || 0) + 1) % total;
        }
      });
    }, SLIDE_INTERVAL_MS);
  };

  const stopSlideTimer = () => {
    if (slideTimer) { clearInterval(slideTimer); slideTimer = null; }
  };

  /* ── Aksi: toggle status (block/unblock) ────────────────────────── */
  const handleToggleStatus = (property) => {
    const isActive = property.status === 1;
    openModal({
      icon:         isActive ? '🚫' : '✅',
      title:        isActive ? 'Nonaktifkan Properti?' : 'Aktifkan Properti?',
      desc:         `Properti "${property.title}" akan diubah menjadi ${isActive ? 'Disabled' : 'Aktif'}.`,
      confirmText:  isActive ? 'Ya, Disable' : 'Ya, Aktifkan',
      confirmClass: isActive ? 'btn-confirm-danger' : 'btn-confirm-success',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = property.property_id;
        try {
          const result = await togglePropertyStatus(property.property_id);
          if (result?.isSuccess === 1) {
            toast.success(result.data.message || 'Status berhasil diubah');
            await loadData(pagination.page);
          } else {
            toast.error(result?.data?.message || 'Gagal mengubah status');
          }
        } catch (err) {
          toast.error(err?.response?.data?.data?.message || 'Gagal mengubah status');
        } finally {
          modal.loading = false;
          modal.show = false;
          actionLoading.value = null;
        }
      }
    });
  };

  /* ── Aksi: delete (soft delete → status 3) ──────────────────────── */
  const handleDelete = (property) => {
    openModal({
      icon:         '🗑️',
      title:        'Hapus Properti?',
      desc:         `Properti "${property.title}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
      confirmText:  'Ya, Hapus',
      confirmClass: 'btn-confirm-danger',
      onConfirm:    async () => {
        modal.loading = true;
        actionLoading.value = property.property_id;
        try {
          const result = await deleteProperty(property.property_id);
          if (result?.isSuccess === 1) {
            toast.success(result.data.message || 'Properti berhasil dihapus');
            const newPage = properties.value.length === 1 && pagination.page > 1
              ? pagination.page - 1 : pagination.page;
            await loadData(newPage);
          } else {
            toast.error(result?.data?.message || 'Gagal menghapus properti');
          }
        } catch (err) {
          toast.error(err?.response?.data?.data?.message || 'Gagal menghapus properti');
        } finally {
          modal.loading = false;
          modal.show = false;
          actionLoading.value = null;
        }
      }
    });
  };

  /* ── Lifecycle ──────────────────────────────────────────────────── */
  onMounted(async () => {
    await loadData(1);
    startSlideTimer();
  });

  onBeforeUnmount(() => {
    stopSlideTimer();
    clearTimeout(searchTimer);
  });
</script>

<style scoped>
/* Rel gambar: satu baris memanjang, digeser dengan transform sehingga
   gambar berikutnya masuk dari kanan ke kiri. */
.property-media  { height: 210px; }
.property-track  { width: 100%; transition: transform 0.6s ease-in-out; }
.property-slide  { width: 100%; }
.property-dot    { width: 7px; height: 7px; display: inline-block; }

.property-card   { transition: transform 0.15s ease, box-shadow 0.15s ease; }
.property-card:hover { transform: translateY(-3px); }
</style>
