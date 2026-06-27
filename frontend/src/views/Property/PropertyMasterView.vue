<template>
  <section class="master-form-section">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-xl-9 col-lg-10 col-md-11">

          <!-- Back button -->
          <div class="back-nav">
            <router-link to="/property" class="back-link">
              ← Kembali ke Daftar Properti
            </router-link>
          </div>

          <div class="master-card">
            <!-- Card Header -->
            <div class="card-header">
              <div class="header-left">
                <h2>{{ isEditMode ? 'Edit Properti' : 'Tambah Properti' }}</h2>
                <p>{{ isEditMode ? 'Perbarui informasi properti' : 'Tambahkan properti baru ke master data' }}</p>
              </div>
              <div v-if="isEditMode && form.property_id" class="header-id">
                <span class="id-label">ID</span>
                <span class="id-value">{{ form.property_id }}</span>
              </div>
            </div>

            <!-- Alert -->
            <div v-if="alert.message" :class="['alert', `alert-${alert.type}`]" role="alert">
              {{ alert.message }}
            </div>

            <!-- Loading (edit mode — ambil data dulu) -->
            <div v-if="isLoadingDetail" class="loading-state">
              <div class="spinner-lg"></div>
              <p>Memuat data properti...</p>
            </div>

            <!-- Form -->
            <form v-else @submit.prevent="submitForm" class="master-form">

              <!-- ── Lokasi ── -->
              <div class="section-divider"><span>Lokasi</span></div>

              <div class="form-row">
                <!-- Negara (modal — terhubung database) -->
                <div class="form-group">
                  <label for="country_name">Negara <span class="required">*</span></label>
                  <div class="picker-field" :class="{ disabled: isSubmitting }">
                    <input
                      id="country_name"
                      v-model="form.country_name"
                      type="text"
                      placeholder="Negara — Enter / Tab"
                      :disabled="isSubmitting"
                      autocomplete="off"
                      @keydown="onPickerKey($event, showModalCountry)"
                      @input="onCountryInput"
                    />
                    <button type="button" class="picker-btn" :disabled="isSubmitting" @click="showModalCountry()">
                      <i class="fa-solid fa-magnifying-glass"></i>
                    </button>
                  </div>
                </div>
                <!-- Provinsi (modal — terhubung database) -->
                <div class="form-group">
                  <label for="province_name">Provinsi <span class="required">*</span></label>
                  <div class="picker-field" :class="{ disabled: isSubmitting || !form.country_id }">
                    <input
                      id="province_name"
                      v-model="form.province_name"
                      type="text"
                      :placeholder="form.country_id ? 'Provinsi — Enter / Tab' : 'Pilih negara dulu'"
                      :disabled="isSubmitting || !form.country_id"
                      autocomplete="off"
                      @keydown="onPickerKey($event, showModalProvince)"
                      @input="onProvinceInput"
                    />
                    <button type="button" class="picker-btn" :disabled="isSubmitting || !form.country_id" @click="showModalProvince()">
                      <i class="fa-solid fa-magnifying-glass"></i>
                    </button>
                  </div>
                </div>
                <!-- Kota (modal — terhubung database) -->
                <div class="form-group">
                  <label for="city_name">Kota <span class="required">*</span></label>
                  <div class="picker-field" :class="{ disabled: isSubmitting || !form.province_id }">
                    <input
                      id="city_name"
                      v-model="form.city_name"
                      type="text"
                      :placeholder="form.province_id ? 'Kota — Enter / Tab' : 'Pilih provinsi dulu'"
                      :disabled="isSubmitting || !form.province_id"
                      autocomplete="off"
                      @keydown="onPickerKey($event, showModalCity)"
                      @input="onCityInput"
                    />
                    <button type="button" class="picker-btn" :disabled="isSubmitting || !form.province_id" @click="showModalCity()">
                      <i class="fa-solid fa-magnifying-glass"></i>
                    </button>
                  </div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="district">Kecamatan</label>
                  <input id="district" v-model.trim="form.district" type="text" placeholder="Kecamatan" :disabled="isSubmitting" maxlength="255" autocomplete="off" />
                </div>
                <div class="form-group">
                  <label for="area">Area / Kawasan</label>
                  <input id="area" v-model.trim="form.area" type="text" placeholder="Contoh: Citraland, Pakuwon Indah" :disabled="isSubmitting" maxlength="255" autocomplete="off" />
                </div>
                <div class="form-group">
                  <label for="postal_code">Kode Pos</label>
                  <input id="postal_code" v-model.trim="form.postal_code" type="text" placeholder="60123" :disabled="isSubmitting" maxlength="15" autocomplete="off" />
                </div>
              </div>

              <div class="form-group">
                <label for="address">Alamat Lengkap</label>
                <input id="address" v-model.trim="form.address" type="text" placeholder="Jl. Contoh No. 1" :disabled="isSubmitting" maxlength="255" autocomplete="off" />
              </div>

              <!-- ── Informasi Utama ── -->
              <div class="section-divider"><span>Informasi Utama</span></div>

              <div class="form-group">
                <label for="title">Judul <span class="required">*</span></label>
                <input id="title" v-model.trim="form.title" type="text" placeholder="Contoh: Rumah 2 Lantai Citraland Surabaya" :disabled="isSubmitting" maxlength="100" required autocomplete="off" />
                <p class="field-hint">Maksimal 100 karakter</p>
              </div>

              <div class="form-group">
                <label for="description">Deskripsi</label>
                <textarea id="description" v-model.trim="form.description" rows="4" placeholder="Deskripsi lengkap properti..." :disabled="isSubmitting"></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="transaction_type">Transaksi <span class="required">*</span></label>
                  <select id="transaction_type" v-model="form.transaction_type" :disabled="isSubmitting" required @change="onTransactionChange">
                    <option value="" disabled>— Pilih Transaksi —</option>
                    <option v-for="t in TRANSACTION_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="building_type">Tipe Bangunan <span class="required">*</span></label>
                  <select id="building_type" v-model="form.building_type" :disabled="isSubmitting" required>
                    <option value="" disabled>— Pilih Tipe —</option>
                    <option v-for="b in BUILDING_TYPES" :key="b.value" :value="b.value">{{ b.label }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="price">Harga (Rp) <span class="required">*</span></label>
                  <input id="price" v-model="form.price" type="number" min="0" step="any" placeholder="0" :disabled="isSubmitting" required />
                </div>
              </div>

              <!-- ── Detail Bangunan ── -->
              <div class="section-divider"><span>Detail Bangunan</span></div>

              <div class="form-row">
                <div class="form-group">
                  <label for="bed_rooms">Kamar Tidur</label>
                  <input id="bed_rooms" v-model="form.bed_rooms" type="number" min="0" placeholder="0" :disabled="isSubmitting" />
                </div>
                <div class="form-group">
                  <label for="bath_rooms">Kamar Mandi</label>
                  <input id="bath_rooms" v-model="form.bath_rooms" type="number" min="0" placeholder="0" :disabled="isSubmitting" />
                </div>
                <div class="form-group">
                  <label :for="isFloorPosition ? 'floor_location' : 'floor_quantity'">{{ floorLabel }}</label>
                  <input
                    v-if="isFloorPosition"
                    id="floor_location"
                    v-model.trim="form.floor_location"
                    type="text"
                    :placeholder="floorPlaceholder"
                    :disabled="isSubmitting"
                    maxlength="100"
                  />
                  <input
                    v-else
                    id="floor_quantity"
                    v-model="form.floor_quantity"
                    type="number"
                    min="0"
                    :placeholder="floorPlaceholder"
                    :disabled="isSubmitting"
                  />
                  <p class="field-hint">{{ floorHint }}</p>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="building_area">Luas Bangunan</label>
                  <input id="building_area" v-model.trim="form.building_area" type="text" placeholder="Contoh: 120 m2" :disabled="isSubmitting" maxlength="100" />
                </div>
                <div class="form-group">
                  <label for="land_area">Luas Tanah</label>
                  <input id="land_area" v-model.trim="form.land_area" type="text" placeholder="Contoh: 150 m2" :disabled="isSubmitting" maxlength="100" />
                </div>
                <div class="form-group">
                  <label for="electricity_capacity">Daya Listrik (watt)</label>
                  <input id="electricity_capacity" v-model="form.electricity_capacity" type="number" min="0" placeholder="Contoh: 2200" :disabled="isSubmitting" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="furnished_status">Status Perabotan</label>
                  <select id="furnished_status" v-model="form.furnished_status" :disabled="isSubmitting">
                    <option value="">— Pilih —</option>
                    <option v-for="f in FURNISHED_OPTIONS" :key="f" :value="f">{{ f }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="kpr_status">KPR</label>
                  <select id="kpr_status" v-model="form.kpr_status" :disabled="isSubmitting || form.transaction_type === 'Rent'">
                    <option value="N">Tidak</option>
                    <option value="Y">Ya</option>
                  </select>
                  <p class="field-hint">Hanya untuk transaksi Jual (Sale)</p>
                </div>
                <div class="form-group"></div>
              </div>

              <!-- ── Fasilitas (pilih banyak via modal — terhubung database) ── -->
              <div class="section-divider"><span>Fasilitas</span></div>

              <div class="form-group">
                <label>Fasilitas Properti</label>
                <div class="facility-box">
                  <div v-if="form.facilities.length === 0" class="facility-empty">
                    Belum ada fasilitas dipilih
                  </div>
                  <div v-else class="facility-chips">
                    <span v-for="f in form.facilities" :key="f.facility_id" class="facility-chip">
                      {{ f.name }}
                      <button type="button" class="chip-x" :disabled="isSubmitting" @click="removeFacility(f.facility_id)">
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    </span>
                  </div>
                  <button type="button" class="btn-pick-facility" :disabled="isSubmitting" @click="showModalFacility()">
                    <i class="fa-solid fa-plus"></i> Pilih Fasilitas
                  </button>
                </div>
                <p class="field-hint">Klik "Pilih Fasilitas" untuk memilih lebih dari satu fasilitas.</p>
              </div>

              <!-- ── Info Pembuat/Pengubah (Edit mode only) ── -->
              <div v-if="isEditMode && form.property_id" class="audit-info">
                <div class="audit-divider"><span>Informasi Audit</span></div>

                <div class="audit-grid">
                  <div class="audit-item">
                    <span class="audit-label">Dibuat oleh</span>
                    <span class="audit-value">{{ form.created_by_name || form.created_by || '—' }}</span>
                  </div>
                  <div class="audit-item">
                    <span class="audit-label">Tanggal dibuat</span>
                    <span class="audit-value">{{ formatDate(form.created_date) }}</span>
                  </div>
                  <div class="audit-item">
                    <span class="audit-label">Terakhir diubah oleh</span>
                    <span class="audit-value">{{ form.updated_by_name || form.updated_by || '—' }}</span>
                  </div>
                  <div class="audit-item">
                    <span class="audit-label">Tanggal perubahan</span>
                    <span class="audit-value">{{ formatDate(form.updated_date) }}</span>
                  </div>
                </div>

                <!-- Status & Toggle -->
                <div class="status-bar">
                  <div class="status-info">
                    <span class="audit-label">Status saat ini</span>
                    <span :class="['badge-status', form.status === 1 ? 'badge-aktif' : 'badge-disabled']">
                      {{ form.status === 1 ? 'Aktif' : 'Disabled' }}
                    </span>
                  </div>
                  <div class="status-actions">
                    <button type="button" class="btn-toggle-status" :class="form.status === 1 ? 'btn-toggle-disable' : 'btn-toggle-enable'" :disabled="isTogglingStatus || isDeleting" @click="handleToggleStatus">
                      <span v-if="isTogglingStatus" class="spinner-sm"></span>
                      <span v-else>{{ form.status === 1 ? '🚫 Nonaktifkan' : '✅ Aktifkan' }}</span>
                    </button>
                    <button type="button" class="btn-delete-status" :disabled="isTogglingStatus || isDeleting" @click="openDeleteModal">
                      <span v-if="isDeleting" class="spinner-sm"></span>
                      <span v-else>🗑️ Hapus</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="form-actions">
                <router-link to="/property" class="btn-cancel">Batal</router-link>
                <button type="submit" class="btn-submit" :disabled="isSubmitting">
                  <span v-if="isSubmitting"><span class="spinner-sm"></span> Menyimpan...</span>
                  <span v-else>{{ isEditMode ? '💾 Simpan Perubahan' : '+ Tambah Properti' }}</span>
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>
    </div>

    <!-- Pemilih data (negara/provinsi/kota/fasilitas) — terhubung database -->
    <Modal ref="modalRef" />

    <!-- Confirm Delete Modal -->
    <div v-if="deleteModal.show" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-box">
        <div class="modal-icon">🗑️</div>
        <h3 class="modal-title">Hapus Properti?</h3>
        <p class="modal-desc">
          Properti <strong>"{{ form.title }}"</strong> akan dihapus.
          Tindakan ini tidak dapat dibatalkan.
        </p>
        <div class="modal-actions">
          <button class="btn-modal-cancel" @click="closeDeleteModal" :disabled="isDeleting">Batal</button>
          <button class="btn-modal-confirm btn-confirm-danger" @click="handleDelete" :disabled="isDeleting">
            <span v-if="isDeleting" class="spinner-sm"></span>
            <span v-else>Ya, Hapus</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { toast } from 'vue3-toastify';
import {
  getPropertyDetail,
  insertProperty,
  updateProperty,
  togglePropertyStatus,
  deleteProperty
} from '../../services/propertyApi';
import { getCountryList } from '../../services/countryApi';
import { getProvinceList } from '../../services/provinceApi';
import { getCityList } from '../../services/cityApi';
import { getFacilityList } from '../../services/facilityApi';
import Modal from '../../components/Modal.vue';

const route  = useRoute();
const router = useRouter();

/* ── Ref komponen pemilih data (modal terhubung database) ───────────── */
const modalRef = ref(null);

/* ── Opsi (selaras backend model Property) ───────────────────────── */
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
const FURNISHED_OPTIONS = ['Full Furnished', 'Semi Furnished', 'Unfurnished'];

/* Tipe bangunan yang field "Lantai"-nya bermakna POSISI lantai unit
   (bukan jumlah lantai). Mis. unit apartemen berada di Lantai 5. */
const FLOOR_POSITION_TYPES = ['apartment', 'hotel', 'condo', 'office'];

/* ── Mode detection ─────────────────────────────────────────────── */
const propertyId = computed(() => route.params.property_id || null);
const isEditMode = computed(() => !!propertyId.value);

/* ── State ──────────────────────────────────────────────────────── */
const isLoadingDetail   = ref(false);
const isSubmitting      = ref(false);
const isTogglingStatus  = ref(false);
const isDeleting        = ref(false);

const deleteModal     = reactive({ show: false });

const form = reactive({
  property_id:          '',
  country_id:           '',
  country_name:         '',
  province_id:          '',
  province_name:        '',
  city_id:              '',
  city_name:            '',
  facilities:           [],   // [{ facility_id, name }]
  title:                '',
  description:          '',
  price:                '',
  address:              '',
  area:                 '',
  district:             '',
  postal_code:          '',
  furnished_status:     '',
  bed_rooms:            '',
  bath_rooms:           '',
  electricity_capacity: '',
  building_area:        '',
  land_area:            '',
  floor_location:       '',
  floor_quantity:       '',
  kpr_status:           'Y',
  building_type:        'house',
  transaction_type:     'Sale',
  status:               1,
  created_date:         '',
  created_by:           '',
  created_by_name:      '',
  updated_date:         '',
  updated_by:           '',
  updated_by_name:      ''
});

const alert = reactive({ type: '', message: '' });

/* ── Field "Lantai" dinamis sesuai tipe bangunan ────────────────── */
const isFloorPosition  = computed(() => FLOOR_POSITION_TYPES.includes(form.building_type));
const floorLabel       = computed(() => (isFloorPosition.value ? 'Posisi Lantai' : 'Jumlah Lantai'));
const floorPlaceholder = computed(() => (isFloorPosition.value ? 'Contoh: Lantai 5' : 'Contoh: 2'));
const floorHint        = computed(() => (isFloorPosition.value
  ? 'Unit berada di lantai berapa (mis. Lantai 5)'
  : 'Jumlah lantai bangunan (mis. 2)'));

/* ── Helpers ────────────────────────────────────────────────────── */
const setAlert   = (type, message) => { alert.type = type; alert.message = message; };
const clearAlert = () => { alert.type = ''; alert.message = ''; };

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch (_) {
    return dateStr;
  }
};

/* ── Pemilih lokasi & fasilitas via Modal (terhubung database) ──── */

/** Buka modal jika user menekan Enter atau Tab pada input. */
const onPickerKey = (e, opener) => {
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    opener(e.target.value);
  }
};

/** Ketik manual → batalkan id terkait & reset turunannya. */
const onCountryInput = () => {
  form.country_id = '';
  form.province_id = ''; form.province_name = '';
  form.city_id = '';     form.city_name = '';
};
const onProvinceInput = () => {
  form.province_id = '';
  form.city_id = ''; form.city_name = '';
};
const onCityInput = () => { form.city_id = ''; };

/* Fetcher Modal → { rows, currentPage, lastPage } */
const fetchCountries = async (search, page) => {
  const result = await getCountryList({ search, page });
  if (result?.isSuccess === 1) {
    const r = result.data.response;
    return { rows: r.countries || [], currentPage: r.pagination?.page || page, lastPage: r.pagination?.totalPages || 1 };
  }
  return { rows: [], currentPage: 1, lastPage: 1 };
};
const fetchProvinces = async (search, page) => {
  const result = await getProvinceList({ search, page, country_id: form.country_id });
  if (result?.isSuccess === 1) {
    const r = result.data.response;
    return { rows: r.provinces || [], currentPage: r.pagination?.page || page, lastPage: r.pagination?.totalPages || 1 };
  }
  return { rows: [], currentPage: 1, lastPage: 1 };
};
const fetchCities = async (search, page) => {
  const result = await getCityList({ search, page, province_id: form.province_id, country_id: form.country_id });
  if (result?.isSuccess === 1) {
    const r = result.data.response;
    return { rows: r.cities || [], currentPage: r.pagination?.page || page, lastPage: r.pagination?.totalPages || 1 };
  }
  return { rows: [], currentPage: 1, lastPage: 1 };
};
const fetchFacilities = async (search, page) => {
  const result = await getFacilityList({ search, page });
  if (result?.isSuccess === 1) {
    const r = result.data.response;
    return { rows: r.facilities || [], currentPage: r.pagination?.page || page, lastPage: r.pagination?.totalPages || 1 };
  }
  return { rows: [], currentPage: 1, lastPage: 1 };
};

const showModalCountry = (seed = '') => {
  modalRef.value?.open({
    title: 'Pilih Negara', placeholder: 'Ketik nama negara, atau * untuk semua',
    headers: ['Negara', 'Status'], chunks: ['name', 'status'],
    actionParams: ['country_id', 'name'], multiSelect: false,
    initialSearch: seed || form.country_name, fetch: fetchCountries,
    onChoose: (sel) => {
      form.country_id = sel.country_id; form.country_name = sel.name;
      form.province_id = ''; form.province_name = '';
      form.city_id = '';     form.city_name = '';
    }
  });
};

const showModalProvince = (seed = '') => {
  if (!form.country_id) { setAlert('warning', 'Pilih negara terlebih dahulu'); return; }
  modalRef.value?.open({
    title: 'Pilih Provinsi', placeholder: 'Ketik nama provinsi, atau * untuk semua',
    headers: ['Provinsi', 'Status'], chunks: ['name', 'status'],
    actionParams: ['province_id', 'name'], multiSelect: false,
    initialSearch: seed || form.province_name, fetch: fetchProvinces,
    onChoose: (sel) => {
      form.province_id = sel.province_id; form.province_name = sel.name;
      form.city_id = ''; form.city_name = '';
    }
  });
};

const showModalCity = (seed = '') => {
  if (!form.province_id) { setAlert('warning', 'Pilih provinsi terlebih dahulu'); return; }
  modalRef.value?.open({
    title: 'Pilih Kota', placeholder: 'Ketik nama kota, atau * untuk semua',
    headers: ['Kota', 'Status'], chunks: ['name', 'status'],
    actionParams: ['city_id', 'name'], multiSelect: false,
    initialSearch: seed || form.city_name, fetch: fetchCities,
    onChoose: (sel) => { form.city_id = sel.city_id; form.city_name = sel.name; }
  });
};

const showModalFacility = () => {
  modalRef.value?.open({
    title: 'Pilih Fasilitas', placeholder: 'Ketik nama fasilitas, atau * untuk semua',
    headers: ['Fasilitas', 'Status'], chunks: ['name', 'status'],
    actionParams: ['facility_id', 'name'], multiSelect: true,
    preselected: form.facilities.map(f => ({ facility_id: f.facility_id, name: f.name })),
    fetch: fetchFacilities,
    onChoose: (selections) => {
      // selections: array of { facility_id, name }
      form.facilities = selections.map(s => ({ facility_id: s.facility_id, name: s.name }));
    }
  });
};

const removeFacility = (facilityId) => {
  form.facilities = form.facilities.filter(f => f.facility_id !== facilityId);
};

const onTransactionChange = () => {
  // Sewa tidak bisa KPR — paksa N (disabled). Jual → kembalikan default Y.
  form.kpr_status = form.transaction_type === 'Rent' ? 'N' : 'Y';
};

/* ── Load detail (edit mode) ─────────────────────────────────────── */
const loadDetail = async () => {
  isLoadingDetail.value = true;
  clearAlert();
  try {
    const result = await getPropertyDetail(propertyId.value);
    if (result?.isSuccess === 1) {
      const p = result.data.response.property;
      Object.assign(form, {
        property_id:          p.property_id          || '',
        country_id:           p.country_id           || '',
        country_name:         p.country              || '',
        province_id:          p.province_id          || '',
        province_name:        p.province             || '',
        city_id:              p.city_id              || '',
        city_name:            p.city                 || '',
        facilities:           Array.isArray(p.facilities)
          ? p.facilities.map(f => ({ facility_id: f.facility_id, name: f.name }))
          : [],
        title:                p.title                || '',
        description:          p.description          || '',
        price:                p.price                ?? '',
        address:              p.address              || '',
        area:                 p.area                 || '',
        district:             p.district             || '',
        postal_code:          p.postal_code          || '',
        furnished_status:     p.furnished_status     || '',
        bed_rooms:            p.bed_rooms            ?? '',
        bath_rooms:           p.bath_rooms           ?? '',
        electricity_capacity: p.electricity_capacity ?? '',
        building_area:        p.building_area        || '',
        land_area:            p.land_area            || '',
        floor_location:       p.floor_location       || '',
        floor_quantity:       p.floor_quantity       ?? '',
        kpr_status:           p.kpr_status           || 'N',
        building_type:        p.building_type        || '',
        transaction_type:     p.transaction_type     || '',
        status:               p.status               ?? 1,
        created_date:         p.created_date         || '',
        created_by:           p.created_by           || '',
        created_by_name:      p.created_by_name      || '',
        updated_date:         p.updated_date         || '',
        updated_by:           p.updated_by           || '',
        updated_by_name:      p.updated_by_name      || ''
      });
    } else {
      setAlert('danger', result?.data?.message || 'Properti tidak ditemukan');
      setTimeout(() => router.push('/property'), 2000);
    }
  } catch (err) {
    if (err?.response?.status === 401) return;
    const msg = err?.response?.data?.data?.message || err?.message || 'Gagal memuat data properti';
    setAlert('danger', msg);
    setTimeout(() => router.push('/property'), 2000);
  } finally {
    isLoadingDetail.value = false;
  }
};

/* ── Submit ──────────────────────────────────────────────────────── */
const submitForm = async () => {
  clearAlert();

  if (!form.country_id || !form.province_id || !form.city_id) {
    setAlert('warning', 'Negara, provinsi, dan kota wajib dipilih');
    return;
  }
  if (!form.title.trim()) {
    setAlert('warning', 'Judul wajib diisi');
    return;
  }
  if (!form.transaction_type) {
    setAlert('warning', 'Tipe transaksi wajib dipilih');
    return;
  }
  if (!form.building_type) {
    setAlert('warning', 'Tipe bangunan wajib dipilih');
    return;
  }
  if (form.price === '' || Number(form.price) < 0) {
    setAlert('warning', 'Harga wajib diisi dan tidak boleh negatif');
    return;
  }

  isSubmitting.value = true;

  // Konversi field numerik kosong → null agar tidak terkirim sebagai string kosong
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

  const payload = {
    country_id:           form.country_id,
    province_id:          form.province_id,
    city_id:              form.city_id,
    title:                form.title,
    description:          form.description || null,
    price:                num(form.price),
    address:              form.address || null,
    area:                 form.area || null,
    district:             form.district || null,
    postal_code:          form.postal_code || null,
    furnished_status:     form.furnished_status || null,
    bed_rooms:            num(form.bed_rooms),
    bath_rooms:           num(form.bath_rooms),
    electricity_capacity: num(form.electricity_capacity),
    building_area:        form.building_area    || null,
    land_area:            form.land_area        || null,
    floor_location:       form.floor_location   || null,
    floor_quantity:       num(form.floor_quantity),
    kpr_status:           form.transaction_type === 'Rent' ? 'N' : (form.kpr_status || 'N'),
    building_type:        form.building_type,
    transaction_type:     form.transaction_type,
    // Fasilitas terpilih (multi-select via modal) — disinkronkan backend
    facilities:           form.facilities.map(f => ({ facility_id: f.facility_id }))
  };

  try {
    let result;
    if (isEditMode.value) {
      result = await updateProperty(propertyId.value, payload);
    } else {
      result = await insertProperty(payload);
    }

    if (result?.isSuccess === 1) {
      const msg = result.data.message || (isEditMode.value ? 'Properti berhasil diperbarui' : 'Properti berhasil ditambahkan');
      toast.success(msg);

      if (isEditMode.value) {
        const p = result.data.response.property;
        Object.assign(form, {
          updated_date:    p.updated_date    || '',
          updated_by:      p.updated_by      || '',
          updated_by_name: p.updated_by_name || ''
        });
        setAlert('success', msg);
        setTimeout(clearAlert, 3000);
      } else {
        router.push('/property');
      }
    } else {
      setAlert('danger', result?.data?.message || 'Gagal menyimpan data');
    }
  } catch (err) {
    const msg = err?.response?.data?.data?.message || err?.message || 'Terjadi kesalahan';
    setAlert('danger', msg);
  } finally {
    isSubmitting.value = false;
  }
};

/* ── Toggle status (dari halaman edit) ──────────────────────────── */
const handleToggleStatus = async () => {
  isTogglingStatus.value = true;
  try {
    const result = await togglePropertyStatus(propertyId.value);
    if (result?.isSuccess === 1) {
      form.status = result.data.response.status;
      toast.success(result.data.message || 'Status berhasil diubah');
    } else {
      toast.error(result?.data?.message || 'Gagal mengubah status');
    }
  } catch (err) {
    toast.error(err?.response?.data?.data?.message || 'Gagal mengubah status');
  } finally {
    isTogglingStatus.value = false;
  }
};

/* ── Soft delete (status → 3) dari halaman edit ─────────────────── */
const openDeleteModal  = () => { deleteModal.show = true; };
const closeDeleteModal = () => { if (!isDeleting.value) deleteModal.show = false; };

const handleDelete = async () => {
  isDeleting.value = true;
  try {
    const result = await deleteProperty(propertyId.value);
    if (result?.isSuccess === 1) {
      toast.success(result.data.message || 'Properti berhasil dihapus');
      deleteModal.show = false;
      router.push('/property');
    } else {
      toast.error(result?.data?.message || 'Gagal menghapus properti');
    }
  } catch (err) {
    if (err?.response?.status === 401) return;
    toast.error(err?.response?.data?.data?.message || 'Gagal menghapus properti');
  } finally {
    isDeleting.value = false;
  }
};

/* ── Lifecycle ──────────────────────────────────────────────────── */
onMounted(() => {
  if (isEditMode.value) loadDetail();
});
</script>

<style scoped>
.master-form-section {
  min-height: calc(100vh - 80px);
  padding: 36px 0 60px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

/* ── Back nav ────────────────────────────────────────────────────── */
.back-nav { margin-bottom: 16px; }
.back-link { color: #667eea; font-size: 14px; font-weight: 600; text-decoration: none; }
.back-link:hover { text-decoration: underline; }

/* ── Card ────────────────────────────────────────────────────────── */
.master-card { background: white; border-radius: 16px; padding: 36px 32px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08); }

/* ── Card header ─────────────────────────────────────────────────── */
.card-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
.card-header h2 { font-size: 22px; font-weight: 700; color: #2d3748; margin: 0 0 4px; }
.card-header p  { font-size: 13px; color: #718096; margin: 0; }

.header-id { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.id-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #a0aec0; font-weight: 600; }
.id-value { font-size: 13px; font-weight: 700; color: #667eea; background: #ebf4ff; padding: 3px 10px; border-radius: 20px; }

/* ── Alert ──────────────────────────────────────────────────────── */
.alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
.alert-danger  { background: #fed7d7; color: #742a2a; border: 1px solid #feb2b2; }
.alert-success { background: #c6f6d5; color: #22543d; border: 1px solid #9ae6b4; }
.alert-warning { background: #fefcbf; color: #744210; border: 1px solid #faf089; }

/* ── Loading ────────────────────────────────────────────────────── */
.loading-state { display: flex; flex-direction: column; align-items: center; padding: 48px 20px; color: #718096; gap: 16px; }
.spinner-lg { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #667eea; border-radius: 50%; animation: spin 0.7s linear infinite; }
.spinner-sm { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: currentColor; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Section divider ────────────────────────────────────────────── */
.section-divider { position: relative; text-align: center; margin: 26px 0 18px; }
.section-divider::before { content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #e2e8f0; }
.section-divider span { position: relative; background: white; padding: 0 12px; font-size: 12px; font-weight: 700; color: #667eea; text-transform: uppercase; letter-spacing: 0.6px; }

/* ── Form ────────────────────────────────────────────────────────── */
.master-form .form-group { margin-bottom: 18px; flex: 1; }
.form-row { display: flex; gap: 16px; flex-wrap: wrap; }
.form-row .form-group { min-width: 180px; }
.master-form label { display: block; margin-bottom: 6px; font-weight: 600; color: #2d3748; font-size: 14px; }
.required { color: #e53e3e; margin-left: 2px; }

.master-form input[type="text"],
.master-form input[type="number"],
.master-form textarea,
.master-form select {
  width: 100%;
  padding: 11px 14px;
  font-size: 14px;
  border: 1px solid #cbd5e0;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  font-family: inherit;
  background: white;
}
.master-form textarea { resize: vertical; }
.master-form input:focus, .master-form select:focus, .master-form textarea:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15); }
.master-form input:disabled, .master-form select:disabled, .master-form textarea:disabled { background: #edf2f7; cursor: not-allowed; color: #718096; }

.field-hint { margin: 5px 0 0; font-size: 12px; color: #a0aec0; }

/* ── Picker field (input + tombol modal) ────────────────────────── */
.picker-field { display: flex; gap: 8px; }
.picker-field input { flex: 1; }
.picker-field.disabled { opacity: 0.7; }
.picker-btn {
  flex: 0 0 auto; width: 46px; border: 1px solid #cbd5e0; border-radius: 8px;
  background: #f7fafc; color: #667eea; cursor: pointer; font-size: 15px; transition: all 0.15s;
}
.picker-btn:hover:not(:disabled) { background: #edf2f7; border-color: #667eea; }
.picker-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Fasilitas (chips multi-select) ─────────────────────────────── */
.facility-box { border: 1px solid #cbd5e0; border-radius: 10px; padding: 14px; background: #fff; }
.facility-empty { color: #a0aec0; font-size: 13px; margin-bottom: 12px; }
.facility-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.facility-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: #ebf4ff; color: #2b6cb0; border: 1px solid #bee3f8;
  padding: 5px 10px; border-radius: 20px; font-size: 13px; font-weight: 600;
}
.chip-x { border: none; background: none; color: #2b6cb0; cursor: pointer; font-size: 12px; padding: 0; line-height: 1; opacity: 0.7; }
.chip-x:hover:not(:disabled) { opacity: 1; color: #c53030; }
.chip-x:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-pick-facility {
  display: inline-flex; align-items: center; gap: 6px;
  background: #f7fafc; border: 1px dashed #cbd5e0; color: #667eea;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s;
}
.btn-pick-facility:hover:not(:disabled) { background: #edf2f7; border-color: #667eea; }
.btn-pick-facility:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Audit info ─────────────────────────────────────────────────── */
.audit-info { margin-top: 8px; margin-bottom: 20px; }
.audit-divider { position: relative; text-align: center; margin: 24px 0 18px; }
.audit-divider::before { content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #e2e8f0; }
.audit-divider span { position: relative; background: white; padding: 0 12px; font-size: 11px; font-weight: 600; color: #a0aec0; text-transform: uppercase; letter-spacing: 0.5px; }

.audit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f7fafc; border-radius: 10px; padding: 16px; border: 1px solid #e2e8f0; margin-bottom: 16px; }
.audit-item { display: flex; flex-direction: column; gap: 3px; }
.audit-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #a0aec0; font-weight: 600; }
.audit-value { font-size: 13px; font-weight: 600; color: #4a5568; }

/* ── Status bar ─────────────────────────────────────────────────── */
.status-bar { display: flex; align-items: center; justify-content: space-between; background: #f7fafc; border-radius: 10px; padding: 14px 16px; border: 1px solid #e2e8f0; gap: 12px; flex-wrap: wrap; }
.status-info { display: flex; align-items: center; gap: 10px; }
.badge-status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
.badge-aktif    { background: #c6f6d5; color: #22543d; }
.badge-disabled { background: #fed7d7; color: #742a2a; }

.btn-toggle-status { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; min-width: 130px; justify-content: center; }
.btn-toggle-status:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-toggle-disable { background: #fed7d7; color: #742a2a; }
.btn-toggle-disable:hover:not(:disabled) { background: #feb2b2; }
.btn-toggle-enable  { background: #c6f6d5; color: #22543d; }
.btn-toggle-enable:hover:not(:disabled)  { background: #9ae6b4; }

.status-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.btn-delete-status { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid #feb2b2; background: white; color: #c53030; transition: all 0.15s; justify-content: center; }
.btn-delete-status:hover:not(:disabled) { background: #fff5f5; border-color: #fc8181; }
.btn-delete-status:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Confirm Delete Modal ───────────────────────────────────────── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal-box { background: white; border-radius: 14px; padding: 28px 26px; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); }
.modal-icon { font-size: 40px; margin-bottom: 10px; }
.modal-title { font-size: 18px; font-weight: 700; color: #2d3748; margin: 0 0 8px; }
.modal-desc { font-size: 14px; color: #718096; margin: 0 0 22px; line-height: 1.5; }
.modal-actions { display: flex; gap: 10px; justify-content: center; }
.btn-modal-cancel { padding: 10px 24px; border: 1px solid #e2e8f0; background: white; color: #4a5568; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
.btn-modal-cancel:hover:not(:disabled) { background: #f7fafc; }
.btn-modal-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-modal-confirm { padding: 10px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; min-width: 100px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; color: white; }
.btn-modal-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-confirm-danger { background: #e53e3e; }
.btn-confirm-danger:hover:not(:disabled) { background: #c53030; }

/* ── Form actions ───────────────────────────────────────────────── */
.form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 28px; padding-top: 24px; border-top: 1px solid #e2e8f0; }
.btn-cancel { display: inline-flex; align-items: center; padding: 11px 24px; border: 1px solid #e2e8f0; background: white; color: #4a5568; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; transition: all 0.15s; }
.btn-cancel:hover { background: #f7fafc; color: #2d3748; }
.btn-submit { display: inline-flex; align-items: center; gap: 6px; padding: 11px 28px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
.btn-submit:hover:not(:disabled) { opacity: 0.9; }
.btn-submit:disabled { opacity: 0.55; cursor: not-allowed; }

/* ── Responsive ─────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .form-row { flex-direction: column; gap: 0; }
}
@media (max-width: 576px) {
  .master-card { padding: 24px 16px; }
  .audit-grid { grid-template-columns: 1fr; }
  .form-actions { flex-direction: column-reverse; gap: 10px; }
  .btn-cancel, .btn-submit { width: 100%; justify-content: center; }
  .card-header { flex-direction: column; }
  .header-id { align-items: flex-start; }
}
</style>
