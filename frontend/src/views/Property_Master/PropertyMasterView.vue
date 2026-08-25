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
                  <label class="col-form-label" for="country_name">Negara <span class="required">*</span></label>
                  <div class="picker-field" :class="{ disabled: isSubmitting }">
                    <input class="form-control form-control-lg form-control-sm"
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
                  <label class="col-form-label" for="province_name">Provinsi <span class="required">*</span></label>
                  <div class="picker-field" :class="{ disabled: isSubmitting || !form.country_id }">
                    <input class="form-control form-control-lg form-control-sm"
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
                  <label class="col-form-label" for="city_name">Kota <span class="required">*</span></label>
                  <div class="picker-field" :class="{ disabled: isSubmitting || !form.province_id }">
                    <input class="form-control form-control-lg form-control-sm"
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
                  <label class="col-form-label" for="district">Kecamatan</label>
                  <input class="form-control form-control-lg form-control-sm" id="district" v-model.trim="form.district" type="text" placeholder="Kecamatan" :disabled="isSubmitting" maxlength="255" autocomplete="off" />
                </div>
                <div class="form-group">
                  <label class="col-form-label" for="area">Area / Kawasan</label>
                  <input class="form-control form-control-lg form-control-sm" id="area" v-model.trim="form.area" type="text" list="area-options" placeholder="Contoh: Citraland, Pakuwon Indah" :disabled="isSubmitting" maxlength="255" autocomplete="off" />
                  <datalist id="area-options">
                    <option v-for="a in areaOptions" :key="a.location_id" :value="a.name" />
                  </datalist>
                  <p class="field-hint">
                    <template v-if="!form.city_id">Pilih kota dulu untuk melihat daftar area yang sudah terdaftar.</template>
                    <template v-else-if="areaOptions.length">{{ areaOptions.length }} area terdaftar di kota ini — pilih dari daftar, atau ketik area baru.</template>
                    <template v-else>Belum ada area terdaftar untuk kota ini. Ketik nama areanya, lalu daftarkan di Master Lokasi agar bisa dipakai ulang.</template>
                  </p>
                </div>
                <div class="form-group">
                  <label class="col-form-label" for="postal_code">Kode Pos</label>
                  <input class="form-control form-control-lg form-control-sm" id="postal_code" v-model.trim="form.postal_code" type="text" placeholder="60123" :disabled="isSubmitting" maxlength="15" autocomplete="off" />
                </div>
              </div>

              <div class="form-group">
                <label class="col-form-label" for="address">Alamat Lengkap</label>
                <input class="form-control form-control-lg form-control-sm" id="address" v-model.trim="form.address" type="text" placeholder="Jl. Contoh No. 1" :disabled="isSubmitting" maxlength="255" autocomplete="off" />
              </div>

              <!-- ── Informasi Utama ── -->
              <div class="section-divider"><span>Informasi Utama</span></div>

              <div class="form-group">
                <label class="col-form-label" for="title">Judul <span class="required">*</span></label>
                <input class="form-control form-control-lg form-control-sm" id="title" v-model.trim="form.title" type="text" placeholder="Contoh: Rumah 2 Lantai Citraland Surabaya" :disabled="isSubmitting" maxlength="100" required autocomplete="off" />
                <p class="field-hint">Maksimal 100 karakter</p>
              </div>

              <div class="form-group">
                <label class="col-form-label" for="description">Deskripsi</label>
                <textarea class="form-control form-control-lg form-control-sm" id="description" v-model.trim="form.description" rows="4" placeholder="Deskripsi lengkap properti..." :disabled="isSubmitting"></textarea>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="col-form-label" for="transaction_type">Transaksi <span class="required">*</span></label>
                  <select id="transaction_type" v-model="form.transaction_type" :disabled="isSubmitting" required @change="onTransactionChange">
                    <option value="" disabled>— Pilih Transaksi —</option>
                    <option v-for="t in TRANSACTION_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="col-form-label" for="building_type">Tipe Bangunan <span class="required">*</span></label>
                  <select id="building_type" v-model="form.building_type" :disabled="isSubmitting" required>
                    <option value="" disabled>— Pilih Tipe —</option>
                    <option v-for="b in BUILDING_TYPES" :key="b.value" :value="b.value">{{ b.label }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="col-form-label" for="price">Harga (Rp) <span class="required">*</span></label>
                  <input id="price" :value="priceDisplay" @input="onPriceInput" type="text" inputmode="numeric" :placeholder="fnReady ? '0' : 'Menyiapkan form...'" autocomplete="off" :disabled="isSubmitting || !fnReady" required class="form-control form-control-lg form-control-sm" />
                </div>
                <div class="form-group">
                  <label class="col-form-label" for="price_type">Tipe Harga <span class="required">*</span></label>
                  <select id="price_type" v-model="form.price_type" :disabled="isSubmitting" required>
                    <option value="" disabled>— Pilih Tipe Harga —</option>
                    <option v-for="pt in filteredPriceTypeOptions" :key="pt.value" :value="pt.value">{{ pt.label }}</option>
                  </select>
                </div>
              </div>

              <!-- ── Detail Bangunan ── -->
              <div class="section-divider"><span>Detail Bangunan</span></div>

              <div class="form-row">
                <div class="form-group">
                  <label class="col-form-label" for="bed_rooms">Kamar Tidur</label>
                  <input class="form-control form-control-lg form-control-sm" id="bed_rooms" v-model="form.bed_rooms" type="number" min="0" placeholder="0" :disabled="isSubmitting" />
                </div>
                <div class="form-group">
                  <label class="col-form-label" for="bath_rooms">Kamar Mandi</label>
                  <input class="form-control form-control-lg form-control-sm" id="bath_rooms" v-model="form.bath_rooms" type="number" min="0" placeholder="0" :disabled="isSubmitting" />
                </div>
                <div class="form-group">
                  <label class="col-form-label" :for="isFloorPosition ? 'floor_location' : 'floor_quantity'">{{ floorLabel }}</label>
                  <input class="form-control form-control-lg form-control-sm"
                    v-if="isFloorPosition"
                    id="floor_location"
                    v-model.trim="form.floor_location"
                    type="text"
                    :placeholder="floorPlaceholder"
                    :disabled="isSubmitting"
                    maxlength="100"
                  />
                  <input class="form-control form-control-lg form-control-sm"
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
                  <label class="col-form-label" for="building_area">Luas Bangunan</label>
                  <input class="form-control form-control-lg form-control-sm" id="building_area" v-model.trim="form.building_area" type="text" placeholder="Contoh: 120 m2" :disabled="isSubmitting" maxlength="100" />
                </div>
                <div class="form-group">
                  <label class="col-form-label" for="land_area">Luas Tanah</label>
                  <input class="form-control form-control-lg form-control-sm" id="land_area" v-model.trim="form.land_area" type="text" placeholder="Contoh: 150 m2" :disabled="isSubmitting" maxlength="100" />
                </div>
                <div class="form-group">
                  <label class="col-form-label" for="electricity_capacity">Daya Listrik (watt)</label>
                  <input class="form-control form-control-lg form-control-sm" id="electricity_capacity" v-model="form.electricity_capacity" type="number" min="0" placeholder="Contoh: 2200" :disabled="isSubmitting" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="col-form-label" for="furnished_status">Status Perabotan</label>
                  <select id="furnished_status" v-model="form.furnished_status" :disabled="isSubmitting">
                    <option value="">— Pilih —</option>
                    <option v-for="f in FURNISHED_OPTIONS" :key="f" :value="f">{{ f }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="col-form-label" for="kpr_status">KPR</label>
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
                <label class="col-form-label">Fasilitas Properti</label>
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

              <!-- ── Gambar Properti ── -->
              <div class="section-divider"><span>Gambar Properti</span></div>

              <div class="form-group">
                <label class="col-form-label">Foto / Gambar</label>
                <p class="form-text mt-0 mb-2">
                  Bisa unggah lebih dari satu gambar (maks. {{ IMAGE_MAX_FILES }} file, {{ IMAGE_MAX_MB }} MB per file).
                  Jika tidak mengunggah gambar, sistem otomatis memakai gambar default sesuai tipe bangunan.
                </p>

                <div class="card">
                  <div class="card-body">
                    <!-- Grid preview: gambar tersimpan + gambar yang menunggu diunggah -->
                    <div
                      v-if="savedImages.length || stagedImages.length"
                      class="row row-cols-2 row-cols-sm-3 row-cols-lg-4 row-cols-xxl-5 g-3 mb-3"
                    >
                      <!-- Tersimpan di database -->
                      <div v-for="img in savedImages" :key="'saved-' + (img.id ?? img.url)" class="col">
                        <div class="card h-100 position-relative overflow-hidden">
                          <div class="ratio ratio-4x3 bg-body-secondary">
                            <img
                              :src="img.url"
                              :alt="img.name || 'Gambar properti'"
                              loading="lazy"
                              class="w-100 h-100 object-fit-cover"
                              @error="onImgError"
                            />
                          </div>

                          <span v-if="img.is_default" class="badge text-bg-secondary position-absolute top-0 start-0 m-2">Default</span>
                          <span v-else class="badge text-bg-success position-absolute top-0 start-0 m-2">Tersimpan</span>

                          <button
                            v-if="img.id"
                            type="button"
                            class="btn btn-danger btn-sm rounded-circle position-absolute top-0 end-0 m-2 d-inline-flex align-items-center justify-content-center p-0"
                            style="width: 1.75rem; height: 1.75rem;"
                            :disabled="isSubmitting || deletingImageId === img.id"
                            :title="img.is_default ? 'Lepas gambar default dari properti ini' : 'Hapus gambar'"
                            @click="askDeleteImage(img)"
                          >
                            <span v-if="deletingImageId === img.id" class="spinner-border spinner-border-sm"></span>
                            <i v-else class="fa-solid fa-xmark"></i>
                          </button>

                          <div class="card-body p-2">
                            <p class="card-text small text-body-secondary text-truncate mb-0" :title="img.name || '—'">
                              {{ img.name || '—' }}
                            </p>
                          </div>
                        </div>
                      </div>

                      <!-- Belum diunggah (staged) -->
                      <div v-for="(st, i) in stagedImages" :key="'staged-' + st.uid" class="col">
                        <div class="card h-100 position-relative overflow-hidden border-warning" style="border-style: dashed;">
                          <div class="ratio ratio-4x3 bg-body-secondary">
                            <img :src="st.preview" :alt="st.file.name" class="w-100 h-100 object-fit-cover" />
                          </div>

                          <span class="badge text-bg-warning position-absolute top-0 start-0 m-2">Belum diunggah</span>

                          <button
                            type="button"
                            class="btn btn-danger btn-sm rounded-circle position-absolute top-0 end-0 m-2 d-inline-flex align-items-center justify-content-center p-0"
                            style="width: 1.75rem; height: 1.75rem;"
                            :disabled="isSubmitting"
                            title="Batalkan gambar ini"
                            @click="removeStaged(i)"
                          >
                            <i class="fa-solid fa-xmark"></i>
                          </button>

                          <div class="card-body p-2">
                            <p class="card-text small text-body-secondary text-truncate mb-0" :title="st.file.name">
                              {{ st.file.name }}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      v-else
                      class="text-center text-body-secondary py-4 mb-3 rounded-3 border border-2"
                      style="border-style: dashed !important;"
                    >
                      <i class="fa-regular fa-images fs-3 d-block mb-2 opacity-50"></i>
                      Belum ada gambar
                    </div>

                    <!-- Aksi -->
                    <div class="d-flex flex-wrap gap-2">
                      <input
                        ref="fileInputRef"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                        multiple
                        class="d-none"
                        @change="onFilesPicked"
                      />
                      <button
                        type="button"
                        class="btn btn-outline-primary btn-sm"
                        :disabled="isSubmitting || isUploadingImages"
                        @click="fileInputRef?.click()"
                      >
                        <i class="fa-solid fa-plus me-1"></i> Pilih Gambar
                      </button>

                      <!-- Mode EDIT: unggah langsung. Mode TAMBAH: ikut saat properti disimpan. -->
                      <button
                        v-if="isEditMode && stagedImages.length"
                        type="button"
                        class="btn btn-primary btn-sm"
                        :disabled="isSubmitting || isUploadingImages"
                        @click="uploadStagedImages()"
                      >
                        <span v-if="isUploadingImages">
                          <span class="spinner-border spinner-border-sm me-1"></span> Mengunggah...
                        </span>
                        <span v-else><i class="fa-solid fa-upload me-1"></i> Unggah {{ stagedImages.length }} Gambar</span>
                      </button>
                    </div>

                    <p v-if="!isEditMode && stagedImages.length" class="form-text mb-0 mt-2">
                      {{ stagedImages.length }} gambar akan diunggah otomatis setelah properti disimpan.
                    </p>
                  </div>
                </div>
              </div>

              <!-- ── Lokasi Patokan (Nearby Landmarks) ── -->
              <div class="section-divider"><span>Lokasi Patokan (Landmarks)</span></div>

              <div class="form-group">
                <label class="col-form-label">Lokasi/Patokan Terdekat</label>
                <p class="field-hint">Tambahkan landmark terdekat (Indomaret, Sekolah, Stasiun, dll) yang membantu pelanggan menemukan properti</p>
                <div class="location-box">
                  <div v-if="form.locations.length === 0" class="location-empty">
                    Belum ada lokasi patokan dipilih
                  </div>
                  <div v-else class="location-chips">
                    <span v-for="loc in form.locations" :key="loc.location_id" class="location-chip">
                      📍 {{ loc.name }}
                      <button type="button" class="chip-x" :disabled="isSubmitting" @click="removeLocation(loc.location_id)">
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    </span>
                  </div>
                  <button type="button" class="btn-pick-location" :disabled="isSubmitting || !form.property_id" @click="showModalLocation()">
                    <i class="fa-solid fa-plus"></i> Pilih Lokasi Patokan
                  </button>
                  <p v-if="!form.property_id" class="field-hint" style="color: #dc3545;">
                    Simpan properti terlebih dahulu sebelum menambahkan lokasi patokan.
                  </p>
                </div>
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
                <button type="submit" class="btn-submit" :disabled="isSubmitting || !fnReady">
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
    <ConfirmModal
      :show="deleteModal.show"
      title="Hapus Properti?"
      :busy="isDeleting"
      @confirm="handleDelete"
      @cancel="closeDeleteModal"
    >
      Properti <strong>"{{ form.title }}"</strong> akan dihapus.
      Tindakan ini tidak dapat dibatalkan.
    </ConfirmModal>
  </section>
</template>

<script setup>
import { reactive, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { toast } from 'vue3-toastify';
import ConfirmModal from '../../components/ConfirmModal.vue';
import {
  getPropertyDetail,
  insertProperty,
  updateProperty,
  togglePropertyStatus,
  deleteProperty,
  getPropertyImages,
  uploadPropertyImages,
  deletePropertyImage
} from '../../services/propertyApi';
import { getCountryList } from '../../services/countryApi';
import { getProvinceList } from '../../services/provinceApi';
import { getCityList } from '../../services/cityApi';
import { getAreaOptions, getNearbyLocationOptions } from '../../services/locationApi';
import { getFacilityList } from '../../services/facilityApi';
import {
  getPropertyLocations,
  bulkAddLocations,
  removeLocationFromProperty
} from '../../services/propertyLocationApi';
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
const FURNISHED_OPTIONS  = ['Full Furnished', 'Semi Furnished', 'Unfurnished'];
const PRICE_TYPE_OPTIONS = [
  { value: 'Night',      label: 'Per Malam (Night)'   },
  { value: 'Daily',      label: 'Per Hari (Daily)'     },
  { value: 'Weekly',     label: 'Per Minggu (Weekly)'  },
  { value: 'Monthly',    label: 'Per Bulan (Monthly)'  },
  { value: 'Yearly',     label: 'Per Tahun (Yearly)'   },
  { value: 'Cash',       label: 'Cash'                 },
  { value: 'Negotiable', label: 'Nego (Negotiable)'    },
  { value: 'Others',     label: 'Lainnya (Others)'     }
];

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
const fnReady           = ref(false);   // true setelah Function_Path (window.formatPriceDisplay) siap

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
  locations:            [],   // [{ location_id, name }]
  title:                '',
  description:          '',
  price:                '',
  price_type:           '',
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

const alert        = reactive({ type: '', message: '' });
const priceDisplay = ref('');

/* ══════════════════════════════════════════════════════════════════════════════
   GAMBAR PROPERTI
   ────────────────────────────────────────────────────────────────────────────
   Dua kelompok state:
     savedImages  — sudah ada di tabel property_images (punya .id), file fisik
                    di /assets/image_data/<PROPERTY_ID>/. Baris dengan
                    is_default:true adalah gambar DEFAULT bersama; menghapusnya
                    hanya melepas relasi, file default TIDAK dihapus backend.
     stagedImages — File yang baru dipilih user, BELUM diunggah. Diperlukan
                    karena mode TAMBAH belum punya property_id (folder tujuan
                    memakai property_id) → diunggah setelah insert berhasil.
══════════════════════════════════════════════════════════════════════════════ */

const IMAGE_MAX_FILES = 10;    // selaras PROPERTY_IMAGE_MAX_FILES di backend
const IMAGE_MAX_MB    = 5;     // selaras PROPERTY_IMAGE_MAX_MB di backend
const ACCEPTED_TYPES  = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif'];

const fileInputRef     = ref(null);
const savedImages      = ref([]);      // [{ id, name, url, is_default }]
const stagedImages     = ref([]);      // [{ uid, file, preview }]
const isUploadingImages = ref(false);
const deletingImageId  = ref(null);

let stagedUid = 0;

/** Bebaskan object URL preview agar tidak bocor memori. */
const revokeStaged = (item) => { try { URL.revokeObjectURL(item.preview); } catch (_) {} };

/** Gambar rusak / hilang di disk → sembunyikan agar layout tidak pecah. */
const onImgError = (e) => { e.target.style.visibility = 'hidden'; };

/** Pilih file dari input → validasi tipe & ukuran → simpan sebagai staged. */
const onFilesPicked = (e) => {
  const picked = Array.from(e.target.files || []);
  e.target.value = '';                        // izinkan memilih file yang sama lagi
  if (!picked.length) return;

  const alreadyCount = savedImages.value.filter(i => i.id && !i.is_default).length + stagedImages.value.length;
  const rejected = [];

  for (const file of picked) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      rejected.push(`${file.name} (format tidak didukung)`);
      continue;
    }
    if (file.size > IMAGE_MAX_MB * 1024 * 1024) {
      rejected.push(`${file.name} (lebih dari ${IMAGE_MAX_MB} MB)`);
      continue;
    }
    if (alreadyCount + stagedImages.value.length >= IMAGE_MAX_FILES) {
      rejected.push(`${file.name} (melewati batas ${IMAGE_MAX_FILES} gambar)`);
      continue;
    }
    stagedImages.value.push({ uid: ++stagedUid, file, preview: URL.createObjectURL(file) });
  }

  if (rejected.length) toast.warning(`Gambar dilewati: ${rejected.join(', ')}`);
};

/** Batalkan satu gambar staged (belum diunggah — tidak menyentuh server). */
const removeStaged = (index) => {
  const [removed] = stagedImages.value.splice(index, 1);
  if (removed) revokeStaged(removed);
};

/** Muat ulang daftar gambar dari server. */
const loadImages = async (pid) => {
  if (!pid) return;
  try {
    const result = await getPropertyImages(pid);
    if (result?.isSuccess === 1) {
      savedImages.value = result.data.response.images || [];
    }
  } catch (err) {
    if (err?.response?.status === 401) return;
    console.warn('Gagal memuat gambar properti:', err?.message);
  }
};

/**
 * Unggah semua gambar staged untuk sebuah property_id.
 * Dipakai di dua tempat: tombol "Unggah" (mode edit) dan setelah insert sukses
 * (mode tambah). Mengembalikan true bila semua berhasil.
 */
const uploadStagedImages = async (pid = null) => {
  const propId = pid || form.property_id;
  if (!propId || stagedImages.value.length === 0) return true;

  isUploadingImages.value = true;
  try {
    const files = stagedImages.value.map(s => s.file);
    const names = stagedImages.value.map(s => s.file.name);
    const result = await uploadPropertyImages(propId, files, names);

    if (result?.isSuccess === 1) {
      savedImages.value = result.data.response.images || [];
      stagedImages.value.forEach(revokeStaged);
      stagedImages.value = [];
      toast.success(result.data.message || 'Gambar berhasil diunggah');
      return true;
    }
    toast.error(result?.data?.message || 'Gagal mengunggah gambar');
    return false;
  } catch (err) {
    if (err?.response?.status === 401) return false;
    toast.error(err?.response?.data?.data?.message || 'Gagal mengunggah gambar');
    return false;
  } finally {
    isUploadingImages.value = false;
  }
};

/**
 * Hapus satu gambar tersimpan.
 * Backend yang memutuskan apakah FILE ikut terhapus: gambar default (folder
 * `properties/`) hanya dilepas relasinya, file-nya dipertahankan karena dipakai
 * bersama properti lain.
 */
const askDeleteImage = async (img) => {
  if (!img?.id || !form.property_id) return;
  deletingImageId.value = img.id;
  try {
    const result = await deletePropertyImage(form.property_id, img.id);
    if (result?.isSuccess === 1) {
      toast.success(result.data.message || 'Gambar berhasil dihapus');
      await loadImages(form.property_id);   // muat ulang → default muncul bila kosong
    } else {
      toast.error(result?.data?.message || 'Gagal menghapus gambar');
    }
  } catch (err) {
    if (err?.response?.status === 401) return;
    toast.error(err?.response?.data?.data?.message || 'Gagal menghapus gambar');
  } finally {
    deletingImageId.value = null;
  }
};

/* ── Field "Lantai" dinamis sesuai tipe bangunan ────────────────── */
const isFloorPosition  = computed(() => FLOOR_POSITION_TYPES.includes(form.building_type));
const floorLabel       = computed(() => (isFloorPosition.value ? 'Posisi Lantai' : 'Jumlah Lantai'));
const floorPlaceholder = computed(() => (isFloorPosition.value ? 'Contoh: Lantai 5' : 'Contoh: 2'));
const floorHint        = computed(() => (isFloorPosition.value
  ? 'Unit berada di lantai berapa (mis. Lantai 5)'
  : 'Jumlah lantai bangunan (mis. 2)'));

/* ── Tipe Harga dinamis sesuai tipe transaksi ─────────────────────── */
const filteredPriceTypeOptions = computed(() => {
  const saleOptions = PRICE_TYPE_OPTIONS.filter(pt => ['Cash', 'Negotiable', 'Others'].includes(pt.value));
  const rentOptions = PRICE_TYPE_OPTIONS.filter(pt => ['Night', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'Others'].includes(pt.value));
  return form.transaction_type === 'Sale' ? saleOptions : (form.transaction_type === 'Rent' ? rentOptions : PRICE_TYPE_OPTIONS);
});

/* ── Helpers ────────────────────────────────────────────────────── */
const setAlert   = (type, message) => { alert.type = type; alert.message = message; };
const clearAlert = () => { alert.type = ''; alert.message = ''; };

const onPriceInput = (e) => {
  const raw = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
  form.price = raw;
  // Format only the integer part while typing (keep decimal as-is so user can type freely)
  let formatted = '';
  if (raw) {
    const dotIdx = raw.indexOf('.');
    const intPart = dotIdx >= 0 ? raw.slice(0, dotIdx) : raw;
    const decPart = dotIdx >= 0 ? raw.slice(dotIdx + 1) : null;
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    formatted = decPart !== null ? `${formattedInt}.${decPart}` : formattedInt;
  }
  priceDisplay.value = formatted;
  e.target.value     = formatted;
};

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

/* ── M143: opsi Area diambil dari MASTER LOKASI (location_type='area') ──────
   Sebelumnya `area` murni free-text, sehingga nilai yang tersimpan sering
   tidak cocok dengan tabel `locations` sama sekali — akibatnya AI tidak bisa
   memetakan "customer minta area X" ke listing mana pun. Datalist tetap
   MENGIZINKAN ketik bebas (agent boleh memasukkan area yang belum terdaftar),
   tapi memunculkan nilai master lebih dulu supaya ejaannya konsisten. */
const areaOptions = ref([]);

const loadAreaOptions = async (cityId) => {
  if (!cityId) { areaOptions.value = []; return; }
  try {
    const res = await getAreaOptions(cityId);
    areaOptions.value = res?.isSuccess === 1 ? (res.data.response.areas || []) : [];
  } catch (_) {
    areaOptions.value = [];   // fail-open: form tetap bisa dipakai walau master gagal dimuat
  }
};

watch(() => form.city_id, (cityId) => { loadAreaOptions(cityId); });

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

/**
 * M148 — daftar "Lokasi/Patokan Terdekat".
 *
 * Dulu memakai getLocationList() polos: SELURUH master lokasi lintas kota, jadi
 * properti di Sidoarjo bisa diberi patokan kawasan Jakarta. Sekarang memakai
 * endpoint khusus yang menegakkan aturan pemilik proyek:
 *   • area & landmark → WAJIB sekota dengan propertinya (form.city_id)
 *   • commercial      → lintas kota (Indomaret/sekolah/stasiun ada di mana saja)
 */
const fetchLocations = async (search, page) => {
  const result = await getNearbyLocationOptions({ search, page, city_id: form.city_id || '' });
  if (result?.isSuccess === 1) {
    const r = result.data.response;
    return { rows: r.locations || [], currentPage: r.pagination?.page || page, lastPage: r.pagination?.totalPages || 1 };
  }
  return { rows: [], currentPage: 1, lastPage: 1 };
};

const showModalLocation = async () => {
  if (!form.property_id) {
    setAlert('warning', 'Simpan properti terlebih dahulu sebelum menambahkan lokasi patokan');
    return;
  }
  modalRef.value?.open({
    title: 'Pilih Lokasi Patokan (Landmarks)', placeholder: 'Ketik nama lokasi, atau * untuk semua',
    headers: ['Lokasi', 'Status'], chunks: ['name', 'status'],
    actionParams: ['location_id', 'name'], multiSelect: true,
    preselected: form.locations.map(l => ({ location_id: l.location_id, name: l.name })),
    fetch: fetchLocations,
    onChoose: async (selections) => {
      try {
        // Get location_ids from selections
        const selectedLocationIds = selections.map(s => s.location_id);

        // Get currently saved locations
        const currentResult = await getPropertyLocations(form.property_id);
        const currentLocationIds = currentResult?.data?.response?.locations?.map(l => l.location_id) || [];

        // Locations to remove (were selected before, not selected now)
        const toRemove = currentLocationIds.filter(id => !selectedLocationIds.includes(id));

        // Locations to add (not selected before, selected now)
        const toAdd = selectedLocationIds.filter(id => !currentLocationIds.includes(id));

        // Remove unselected locations
        for (const locId of toRemove) {
          try {
            await removeLocationFromProperty(form.property_id, locId);
          } catch (e) {
            console.error(`Failed to remove location ${locId}:`, e.message);
          }
        }

        // Add newly selected locations
        if (toAdd.length > 0) {
          try {
            await bulkAddLocations(form.property_id, toAdd);
          } catch (e) {
            console.error('Failed to add locations:', e.message);
          }
        }

        // Update local form with selected locations
        form.locations = selections.map(s => ({ location_id: s.location_id, name: s.name }));
        toast.success('Lokasi patokan berhasil diperbarui');
      } catch (err) {
        console.error('Error updating locations:', err);
        toast.error('Gagal memperbarui lokasi patokan');
      }
    }
  });
};

const removeLocation = async (locationId) => {
  if (!form.property_id) return;
  try {
    await removeLocationFromProperty(form.property_id, locationId);
    form.locations = form.locations.filter(l => l.location_id !== locationId);
    toast.success('Lokasi patokan berhasil dihapus');
  } catch (err) {
    console.error('Error removing location:', err);
    toast.error('Gagal menghapus lokasi patokan');
  }
};

const onTransactionChange = () => {
  // Sewa tidak bisa KPR — paksa N (disabled). Jual → kembalikan default Y.
  form.kpr_status = form.transaction_type === 'Rent' ? 'N' : 'Y';

  // Smart price_type logic: keep if valid, reset to default if null or invalid
  const saleTypes = ['Cash', 'Negotiable', 'Others'];
  const rentTypes = ['Night', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'Others'];
  const isValidForSale = saleTypes.includes(form.price_type);
  const isValidForRent = rentTypes.includes(form.price_type);

  if (form.transaction_type === 'Sale') {
    // Jika price_type null atau tidak valid untuk Sale → set ke Cash (default)
    if (!form.price_type || !isValidForSale) {
      form.price_type = 'Cash';
    }
  } else if (form.transaction_type === 'Rent') {
    // Jika price_type null atau tidak valid untuk Rent → set ke Yearly (default)
    if (!form.price_type || !isValidForRent) {
      form.price_type = 'Yearly';
    }
  }
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
        price_type:           p.price_type           || '',
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
      priceDisplay.value = form.price ? window.formatPriceDisplay(form.price) : '';

      // Gambar sudah disertakan endpoint detail (termasuk fallback default)
      savedImages.value = Array.isArray(p.images) ? p.images : [];

      // Load linked locations for this property
      try {
        const locResult = await getPropertyLocations(propertyId.value);
        if (locResult?.isSuccess === 1) {
          form.locations = (locResult.data.response.locations || []).map(l => ({
            location_id: l.location_id,
            name: l.location?.name || ''
          }));
        }
      } catch (locErr) {
        console.warn('Failed to load property locations:', locErr);
        // Non-fatal error
      }
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
  if (!form.price_type) {
    setAlert('warning', 'Tipe harga wajib dipilih');
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
    price_type:           form.price_type || null,
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
        // Gambar yang masih staged (dipilih tapi belum diunggah) ikut tersimpan.
        if (stagedImages.value.length) await uploadStagedImages(form.property_id);
        setAlert('success', msg);
        setTimeout(clearAlert, 3000);
      } else {
        // Mode TAMBAH: property_id baru tersedia SETELAH insert — folder tujuan
        // upload memakai property_id, jadi gambar diunggah sekarang.
        const newId = result.data.response?.property?.property_id || null;
        if (newId && stagedImages.value.length) {
          form.property_id = newId;
          await uploadStagedImages(newId);
        }
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

/* ── Guard TUNGGAL: tunggu Function_Path (window.formatPriceDisplay) siap ──
   Sama seperti pola di CustomerMasterView / List views — App.vue menyuntikkan
   script secara ASYNC, jadi tidak ada jaminan window.formatPriceDisplay sudah
   ada saat komponen ini mount. Satu guard di sini; loadDetail() (satu-satunya
   pemanggil window.formatPriceDisplay di file ini) baru dijalankan sesudahnya. */
const waitForFunctions = () => new Promise((resolve) => {
  const ready = () => typeof window.formatPriceDisplay === 'function';
  if (ready()) return resolve();
  const timer = setInterval(() => { if (ready()) { clearInterval(timer); resolve(); } }, 50);
});

/* ── Lifecycle ──────────────────────────────────────────────────── */
onMounted(async () => {
  await waitForFunctions();
  fnReady.value = true;
  if (isEditMode.value) loadDetail();
});

// Bebaskan semua object URL preview saat komponen dilepas (cegah memory leak).
onBeforeUnmount(() => {
  stagedImages.value.forEach(revokeStaged);
});
</script>
