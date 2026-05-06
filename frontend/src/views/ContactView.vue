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

            <div v-if="alert.message"
              :class="['alert', alert.type === 'success' ? 'alert-success' : 'alert-danger']"
              role="alert"
            >
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
                  <input
                    ref="phoneInput"
                    id="phone"
                    type="text"
                    v-model="form.phone"
                    placeholder="Phone"
                    inputmode="tel"
                    autocomplete="tel"
                    @input="sanitizePhone"
                  />
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
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import axios from 'axios';
import { toast } from 'vue3-toastify';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const JQUERY_LOCAL_PATH = '/assets/jquery-4.0.0/jquery-4.0.0.min.js';
const PHONE_ALLOWED_REGEX = /[^0-9+\-\s]/g;

const phoneInput = ref(null);
const isSubmitting = ref(false);

const alert = reactive({
  type: '',
  message: ''
});

const form = reactive({
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: ''
});

const setAlert = (type, message) => {
  alert.type = type;
  alert.message = message;
};

const clearAlert = () => {
  alert.type = '';
  alert.message = '';
};

const filterPhoneValue = (value) => String(value || '').replace(PHONE_ALLOWED_REGEX, '');

const sanitizePhone = (event) => {
  const filteredPhone = filterPhoneValue(event?.target?.value ?? form.phone);
  form.phone = filteredPhone;

  if (event?.target && event.target.value !== filteredPhone) {
    event.target.value = filteredPhone;
  }
};

const loadLocalJquery = () => {
  return new Promise((resolve, reject) => {
    if (window.jQuery) {
      resolve(window.jQuery);
      return;
    }

    const existingScript = document.querySelector(`script[src="${JQUERY_LOCAL_PATH}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.jQuery));
      existingScript.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = JQUERY_LOCAL_PATH;
    script.onload = () => resolve(window.jQuery);
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

const bindJqueryPhoneValidation = async () => {
  try {
    const $ = await loadLocalJquery();

    if (!phoneInput.value || !$) return;

    $(phoneInput.value)
      .off('input.contactPhoneValidation')
      .on('input.contactPhoneValidation', function () {
        const originalValue = $(this).val();
        const filteredValue = filterPhoneValue(originalValue);

        if (originalValue !== filteredValue) {
          $(this).val(filteredValue);
        }

        form.phone = filteredValue;
      });
  } catch (error) {
    console.error('Failed to load local jQuery for phone validation:', error);
  }
};

const validateForm = () => {
  const blankSections = [];

  if (!form.name.trim()) blankSections.push('Name');
  if (!form.email.trim()) blankSections.push('Email');
  if (!form.phone.trim()) blankSections.push('Phone');
  if (!form.subject.trim()) blankSections.push('Subject');
  if (!form.message.trim()) blankSections.push('Message');

  if (blankSections.length > 0) {
    return `The following sections are blank: ${blankSections.join(', ')}`;
  }

  return '';
};

const resetForm = () => {
  form.name = '';
  form.email = '';
  form.phone = '';
  form.subject = '';
  form.message = '';
};

const submitForm = async () => {
  clearAlert();
  sanitizePhone();

  const validationError = validateForm();
  if (validationError) {
    setAlert('error', validationError);
    toast.error(validationError);
    return;
  }

  isSubmitting.value = true;

  try {
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      subject: form.subject.trim(),
      message: form.message.trim()
    };

    const response = await axios.post(`${API_BASE_URL}/contact`, payload);
    const successMessage = response.data?.message || 'Message sent successfully.';

    setAlert('success', successMessage);
    toast.success(successMessage);
    resetForm();
  } catch (error) {
    const errorMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      'An error occurred while sending the message.';

    setAlert('error', errorMessage);
    toast.error(errorMessage);
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  bindJqueryPhoneValidation();
});

onBeforeUnmount(() => {
  if (window.jQuery && phoneInput.value) {
    window.jQuery(phoneInput.value).off('input.contactPhoneValidation');
  }
});
</script>
