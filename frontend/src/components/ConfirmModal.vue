<template>
  <!-- ════════════════════════════════════════════════════════════════════
       ConfirmModal.vue — dialog konfirmasi reusable (hapus / nonaktifkan / dsb.)
       ────────────────────────────────────────────────────────────────────
       Menggantikan blok modal-overlay yang sebelumnya diduplikat di setiap
       Master/List view. Memakai kelas CSS global (elevan-components.css):
       modal-overlay / modal-box / modal-icon / modal-title / modal-desc /
       modal-actions / btn-modal-cancel / btn-modal-confirm / btn-confirm-*.

       Pemakaian statis (Master view):
         <ConfirmModal :show="deleteModal.show" title="Hapus Fasilitas?"
                       :busy="isDeleting" @confirm="handleDelete" @cancel="closeDeleteModal">
           Fasilitas <strong>"{{ form.name }}"</strong> akan dihapus.
           Tindakan ini tidak dapat dibatalkan.
         </ConfirmModal>

       Pemakaian dinamis (List view — toggle & delete satu modal):
         <ConfirmModal :show="modal.show" :icon="modal.icon" :title="modal.title"
                       :message="modal.desc" :confirm-text="modal.confirmText"
                       :confirm-class="modal.confirmClass" :busy="modal.loading"
                       @confirm="modal.onConfirm" @cancel="closeModal" />
  ════════════════════════════════════════════════════════════════════════ -->
  <div v-if="show" class="modal-overlay" @click.self="onCancel">
    <div class="modal-box">
      <div class="modal-icon">{{ icon }}</div>
      <h3 class="modal-title">{{ title }}</h3>
      <p class="modal-desc">
        <slot>{{ message }}</slot>
      </p>
      <div class="modal-actions">
        <button class="btn-modal-cancel" @click="onCancel" :disabled="busy">{{ cancelText }}</button>
        <button
          :class="['btn-modal-confirm', confirmClass]"
          @click="$emit('confirm')"
          :disabled="busy"
        >
          <span v-if="busy" class="spinner-sm"></span>
          <span v-else>{{ confirmText }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  show:         { type: Boolean, default: false },
  icon:         { type: String,  default: '🗑️' },
  title:        { type: String,  default: 'Konfirmasi' },
  message:      { type: String,  default: '' },        // dipakai bila slot tidak diisi
  confirmText:  { type: String,  default: 'Ya, Hapus' },
  cancelText:   { type: String,  default: 'Batal' },
  confirmClass: { type: String,  default: 'btn-confirm-danger' },
  busy:         { type: Boolean, default: false },     // true → tombol disabled + spinner
});

const emit = defineEmits(['confirm', 'cancel']);

// Cegah tutup (klik overlay / tombol batal) saat aksi sedang berjalan.
const onCancel = () => { if (!props.busy) emit('cancel'); };
</script>
