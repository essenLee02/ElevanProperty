<template>
  <section id="contact" class="contact-section">
    <div class="container">
      <div class="row">
        <div class="col-xl-8 mx-auto">
          <div class="contact-form-wrapper">
            <div class="row">
              <div class="col-xl-10 col-lg-8 mx-auto">
                <div class="section-title text-center">
                  <span>Get in Touch</span>
                  <h2>Ready to Get Started</h2>
                  <p>Contact us for buying, selling, or renting properties. Our AI assistant can also reply to you through WhatsApp.</p>
                </div>
              </div>
            </div>

            <div v-if="alert.message" :class="['alert', alert.type === 'success' ? 'alert-success' : 'alert-danger']" role="alert">
              {{ alert.message }}
            </div>

            <form @submit.prevent="submitForm" class="contact-form">
              <div class="row">
                <div class="col-md-6"><input type="text" v-model.trim="form.name" placeholder="Name" /></div>
                <div class="col-md-6"><input type="email" v-model.trim="form.email" placeholder="Email" /></div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <input ref="phoneInput" id="phone" type="text" v-model="form.phone" placeholder="Phone" inputmode="tel" autocomplete="tel" @input="sanitizePhone" />
                </div>
                <div class="col-md-6"><input type="text" v-model.trim="form.subject" placeholder="Subject" /></div>
              </div>
              <div class="row"><div class="col-12"><textarea v-model.trim="form.message" placeholder="Type Message" rows="5"></textarea></div></div>
              <div class="row"><div class="col-12"><div class="button text-center rounded-buttons"><button type="submit" class="btn primary-btn rounded-full" :disabled="isSubmitting">{{ isSubmitting ? 'Sending...' : 'Send Message' }}</button></div></div></div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { toast } from 'vue3-toastify';
import { submitContact } from '../services/contactApi';

const PHONE_ALLOWED_REGEX = /[^0-9+\-\s]/g;
const phoneInput = ref(null);
const isSubmitting = ref(false);

const alert = reactive({ type: '', message: '' });
const form = reactive({ name: '', email: '', phone: '', subject: '', message: '' });

const setAlert = (type, message) => { alert.type = type; alert.message = message; };
const clearAlert = () => { alert.type = ''; alert.message = ''; };
const filterPhoneValue = (value) => String(value || '').replace(PHONE_ALLOWED_REGEX, '');

const sanitizePhone = (event) => {
  const filteredPhone = filterPhoneValue(event?.target?.value ?? form.phone);
  form.phone = filteredPhone;
  if (event?.target && event.target.value !== filteredPhone) event.target.value = filteredPhone;
};

const bindJqueryPhoneValidation = () => {
  const $ = window.jQuery;
  if (!phoneInput.value || !$) return;
  $(phoneInput.value)
    .off('input.contactPhoneValidation')
    .on('input.contactPhoneValidation', function () {
      const originalValue = $(this).val();
      const filteredValue = filterPhoneValue(originalValue);
      if (originalValue !== filteredValue) $(this).val(filteredValue);
      form.phone = filteredValue;
    });
};

const validateForm = () => {
  const blankSections = [];
  if (!form.name.trim()) blankSections.push('Name');
  if (!form.email.trim()) blankSections.push('Email');
  if (!form.phone.trim()) blankSections.push('Phone');
  if (!form.subject.trim()) blankSections.push('Subject');
  if (!form.message.trim()) blankSections.push('Message');
  if (blankSections.length) return `The following sections are blank: ${blankSections.join(', ')}`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.';
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
    const response = await submitContact({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      subject: form.subject.trim(),
      message: form.message.trim()
    });
    const successMessage = response.data?.message || 'Message sent successfully.';
    if (response.data?.whatsappSent === false && response.data?.aiWhatsappError) {
      const warningMessage = `${successMessage} Detail: ${response.data.aiWhatsappError}`;
      setAlert('error', warningMessage);
      toast.error(warningMessage);
      return;
    }
    setAlert('success', successMessage);
    toast.success(successMessage);
    resetForm();
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.response?.data?.message || 'An error occurred while sending the message.';
    setAlert('error', errorMessage);
    toast.error(errorMessage);
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(bindJqueryPhoneValidation);

onBeforeUnmount(() => {
  if (window.jQuery && phoneInput.value) window.jQuery(phoneInput.value).off('input.contactPhoneValidation');
});
</script>
