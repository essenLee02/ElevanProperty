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
                  <input type="text" v-model="form.name" placeholder="Name" />
                </div>
                <div class="col-md-6">
                  <input type="email" v-model="form.email" placeholder="Email" />
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <input
                    id="phone"
                    type="text"
                    v-model="form.phone"
                    placeholder="Phone"
                    inputmode="tel"
                    autocomplete="tel"
                  />
                </div>
                <div class="col-md-6">
                  <input type="text" v-model="form.subject" placeholder="Subject" />
                </div>
              </div>
              <div class="row">
                <div class="col-12">
                  <textarea v-model="form.message" placeholder="Type Message" rows="5"></textarea>
                </div>
              </div>
              <div class="row">
                <div class="col-12">
                  <div class="button text-center rounded-buttons">
                    <button type="submit" class="btn primary-btn rounded-full">
                      Send Message
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
  import { reactive, onMounted, onBeforeUnmount } from 'vue';
  import axios from 'axios';
  import { toast } from 'vue3-toastify';

  const form = reactive({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const phoneRegex = /^[0-9+\-\s]+$/;

  const cleanPhoneValue = (value) => {
    return String(value || '').replace(/[^0-9+\-\s]/g, '');
  };

  const loadJQuery = () => {
    if (window.jQuery) {
      return Promise.resolve(window.jQuery);
    }

    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-contact-jquery="true"]');

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.jQuery));
        existingScript.addEventListener('error', reject);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://code.jquery.com/jquery-4.0.0.min.js';
      script.async = true;
      script.setAttribute('data-contact-jquery', 'true');
      script.onload = () => resolve(window.jQuery);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const phoneInputHandler = function () {
    const $ = window.jQuery;
    const currentValue = $(this).val();
    const cleanedValue = cleanPhoneValue(currentValue);

    if (currentValue !== cleanedValue) {
      $(this).val(cleanedValue);
    }

    form.phone = cleanedValue;
  };

  onMounted(async () => {
    try {
      const $ = await loadJQuery();

      $('#phone').on('input paste keyup', phoneInputHandler);
    } catch (error) {
      console.error('Failed to load jQuery for phone validation:', error);
    }
  });

  onBeforeUnmount(() => {
    if (window.jQuery) {
      window.jQuery('#phone').off('input paste keyup', phoneInputHandler);
    }
  });

  const submitForm = async () => {
    form.phone = cleanPhoneValue(form.phone);

    const blankSections = [];
    if (!form.name) blankSections.push('Name');
    if (!form.email) blankSections.push('Email');
    if (!form.phone) blankSections.push('Phone');
    if (!form.subject) blankSections.push('Subject');
    if (!form.message) blankSections.push('Message');

    if (blankSections.length > 0) {
      toast.error(`The following sections are blank: ${blankSections.join(', ')}`);
      return;
    }

    if (!phoneRegex.test(form.phone)) {
      toast.error('Phone only accepts numbers, +, -, and spaces.');
      return;
    }

    try {
      const response = await axios.post('http://localhost:5000/api/contact', form);
      if (response.data.success) {
        toast.success(response.data.message);
        form.name = '';
        form.email = '';
        form.phone = '';
        form.subject = '';
        form.message = '';
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('An error occurred while sending the message.');
      }
    }
  };
</script>
