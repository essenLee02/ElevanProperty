<template>
  <section id="contact" class="contact-section">
    <div class="container">
      <div class="row">
        <div class="col-xl-8 mx-auto">
          <div class="contact-form-wrapper">
            <div class="row">
              <div class="col-xl-10 col-lg-8 mx-auto">
                <div class="section-title text-center">
                  <span> Get in Touch </span>
                  <h2>Ready to Get Started</h2>
                  <p>Contact us for any inquiries regarding buying, selling, or renting properties.</p>
                </div>
              </div>
            </div>

            <div v-if="alert.message" :class="['alert', alert.type === 'success' ? 'alert-success' : 'alert-danger']">
              {{ alert.message }}
            </div>

            <form @submit.prevent="submitForm" class="contact-form">
              <div class="row">
                <div class="col-md-6">
                  <input type="text" v-model.trim="form.name" placeholder="Name" />
                </div>
                <div class="col-md-6">
                  <input type="email" v-model.trim="form.email" placeholder="Email" />
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <input type="text" v-model.trim="form.phone" placeholder="Phone" />
                </div>
                <div class="col-md-6">
                  <input type="text" v-model.trim="form.subject" placeholder="Subject" />
                </div>
              </div>
              <div class="row">
                <div class="col-12">
                  <textarea v-model.trim="form.message" placeholder="Type Message" rows="5"></textarea>
                </div>
              </div>
              <div class="row">
                <div class="col-12">
                  <div class="button text-center rounded-buttons">
                    <button type="submit" class="btn primary-btn rounded-full" :disabled="isSubmitting">
                      {{ isSubmitting ? 'Sending...' : 'Send Message' }}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { toast } from 'vue3-toastify';
import api from '../services/api';

const form = reactive({
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: ''
});

const isSubmitting = ref(false);
const alert = reactive({
  type: '',
  message: ''
});

const resetForm = () => {
  form.name = '';
  form.email = '';
  form.phone = '';
  form.subject = '';
  form.message = '';
};

const showError = (message) => {
  alert.type = 'error';
  alert.message = message;
  toast.error(message);
};

const showSuccess = (message) => {
  alert.type = 'success';
  alert.message = message;
  toast.success(message);
};

const validateForm = () => {
  const blankSections = [];
  if (!form.name) blankSections.push('Name');
  if (!form.email) blankSections.push('Email');
  if (!form.phone) blankSections.push('Phone');
  if (!form.subject) blankSections.push('Subject');
  if (!form.message) blankSections.push('Message');

  return blankSections;
};

const submitForm = async () => {
  alert.type = '';
  alert.message = '';

  const blankSections = validateForm();

  if (blankSections.length > 0) {
    showError(`The following sections are blank: ${blankSections.join(', ')}`);
    return;
  }

  isSubmitting.value = true;

  try {
    const response = await api.post('/contact', { ...form });

    if (response.data.success) {
      showSuccess(response.data.message || 'Message sent successfully!');
      resetForm();
    } else {
      showError(response.data.error || 'Failed to send message.');
    }
  } catch (error) {
    showError(error.response?.data?.error || 'An error occurred while sending the message.');
  } finally {
    isSubmitting.value = false;
  }
};
</script>
