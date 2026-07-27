<template>
  <!-- ════════════════════════════════════════════════════════════════════
       SearchableSelect.vue — dropdown dengan kotak pencarian di dalamnya
       ────────────────────────────────────────────────────────────────────
       Pengganti <select> biasa untuk daftar panjang (kota / provinsi /
       negara): opsi bisa disaring dengan mengetik, mirip combobox pada
       report MIS Integra.

       Dibuat sebagai komponen Vue (bukan plugin jQuery seperti select2)
       supaya tidak bentrok dengan siklus render Vue saat daftar opsi
       berubah — mis. ketika opsi provinsi ikut berubah setelah filter lain
       dipilih.

       Pemakaian:
         <SearchableSelect
           v-model="filterCity"
           :options="options.cities"
           placeholder="Semua"
           search-placeholder="Cari kota..."
           @change="loadData(1)"
         />

       Bentuk `options` default: [{ id, name }]. Bisa diubah lewat prop
       value-key / label-key bila struktur datanya berbeda.
  ════════════════════════════════════════════════════════════════════════ -->
  <div ref="rootRef" class="ss-root position-relative">
    <button
      type="button"
      class="form-select text-start d-flex align-items-center"
      :class="{ 'ss-open': open }"
      :disabled="disabled"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="listbox"
      @click="toggle"
    >
      <span class="text-truncate" :class="{ 'text-body-secondary': !selectedLabel }">
        {{ selectedLabel || placeholder }}
      </span>
    </button>

    <div v-if="open" class="ss-panel card shadow position-absolute w-100 mt-1">
      <div class="p-2 border-bottom">
        <input
          ref="searchRef"
          v-model="query"
          type="text"
          class="form-control form-control-sm"
          :placeholder="searchPlaceholder"
          autocomplete="off"
          @keydown="onKeydown"
        />
      </div>

      <ul ref="listRef" class="list-unstyled mb-0 ss-list" role="listbox">
        <li v-for="(opt, idx) in filtered" :key="String(opt.value)">
          <button
            type="button"
            class="ss-option w-100 text-start px-3 py-2 border-0 bg-transparent text-truncate"
            :class="{
              'ss-highlight': idx === highlight,
              'fw-semibold text-primary': isSelected(opt)
            }"
            role="option"
            :aria-selected="isSelected(opt) ? 'true' : 'false'"
            :title="opt.label"
            @click="choose(opt)"
            @mousemove="highlight = idx"
          >
            {{ opt.label }}
          </button>
        </li>

        <li v-if="!filtered.length" class="px-3 py-2 small text-body-secondary">
          Tidak ada hasil untuk "{{ query }}"
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';

const props = defineProps({
  modelValue:        { type: [String, Number], default: '' },
  options:           { type: Array,   default: () => [] },
  valueKey:          { type: String,  default: 'id' },
  labelKey:          { type: String,  default: 'name' },
  placeholder:       { type: String,  default: 'Semua' },
  searchPlaceholder: { type: String,  default: 'Cari...' },
  // Label opsi "kosongkan pilihan". Beri null bila opsi ini tidak diinginkan.
  allLabel:          { type: String,  default: 'Semua' },
  disabled:          { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'change']);

const rootRef   = ref(null);
const searchRef = ref(null);
const listRef   = ref(null);

const open      = ref(false);
const query     = ref('');
const highlight = ref(0);

/* Daftar opsi ternormalisasi: { value, label }. Opsi "Semua" (value '')
   selalu ditaruh paling atas bila allLabel diisi. */
const normalized = computed(() => {
  const list = props.options.map(o => ({
    value: o?.[props.valueKey] ?? '',
    label: String(o?.[props.labelKey] ?? o?.[props.valueKey] ?? ''),
  }));
  return props.allLabel === null ? list : [{ value: '', label: props.allLabel }, ...list];
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return normalized.value;
  return normalized.value.filter(o => o.label.toLowerCase().includes(q));
});

const selectedLabel = computed(() => {
  if (props.modelValue === '' || props.modelValue === null || props.modelValue === undefined) return '';
  const hit = normalized.value.find(o => String(o.value) === String(props.modelValue));
  return hit ? hit.label : '';
});

const isSelected = (opt) => String(opt.value) === String(props.modelValue);

/* ── Buka / tutup ─────────────────────────────────────────────────── */
const openPanel = async () => {
  if (props.disabled) return;
  open.value = true;
  // Catatan: query TIDAK direset di sini — closePanel() sudah mengosongkannya.
  // Kalau direset di sini, watch(query) akan ikut terpicu dan menimpa
  // `highlight` di bawah kembali ke 0 saat `await nextTick()`, sehingga opsi
  // yang sedang terpilih gagal tersorot.
  highlight.value = Math.max(0, filtered.value.findIndex(isSelected));
  document.addEventListener('mousedown', onDocMouseDown);
  await nextTick();
  searchRef.value?.focus();
  scrollHighlightIntoView();
};

const closePanel = () => {
  open.value  = false;
  query.value = '';
  document.removeEventListener('mousedown', onDocMouseDown);
};

const toggle = () => (open.value ? closePanel() : openPanel());

const onDocMouseDown = (e) => {
  if (rootRef.value && !rootRef.value.contains(e.target)) closePanel();
};

/* ── Pilih opsi ───────────────────────────────────────────────────── */
const choose = (opt) => {
  closePanel();
  if (String(opt.value) === String(props.modelValue)) return;  // tidak berubah → jangan reload
  emit('update:modelValue', opt.value);
  emit('change', opt.value);
};

/* ── Keyboard: panah untuk navigasi, Enter pilih, Esc tutup ───────── */
const onKeydown = (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!filtered.value.length) return;
    const step = e.key === 'ArrowDown' ? 1 : -1;
    highlight.value = (highlight.value + step + filtered.value.length) % filtered.value.length;
    scrollHighlightIntoView();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const opt = filtered.value[highlight.value];
    if (opt) choose(opt);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closePanel();
  }
};

const scrollHighlightIntoView = () => {
  nextTick(() => {
    const el = listRef.value?.querySelectorAll('.ss-option')?.[highlight.value];
    el?.scrollIntoView({ block: 'nearest' });
  });
};

// Mengetik ulang → sorot balik ke hasil teratas.
watch(query, () => { highlight.value = 0; });

onBeforeUnmount(() => document.removeEventListener('mousedown', onDocMouseDown));
</script>

<style scoped>
.ss-panel  { z-index: 1056; }          /* di atas kartu & sticky header */
.ss-list   { max-height: 240px; overflow-y: auto; }
.ss-option { cursor: pointer; }
.ss-option:hover,
.ss-highlight { background-color: var(--bs-primary-bg-subtle, #cfe2ff); }

/* Samakan tinggi tombol dengan <select> Bootstrap di sebelahnya. */
.form-select.text-start { min-height: calc(1.5em + 0.75rem + 2px); }
</style>
