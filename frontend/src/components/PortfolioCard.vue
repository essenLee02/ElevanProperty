<template>
  <div class="single-news h-100">
    <div class="image">
      <img class="thumb" :src="property.imageUrl" :alt="property.title" style="width:100%;height:250px;object-fit:cover;" />
    </div>
    <div class="content-body">
      <h4 class="title">{{ property.title }}</h4>
      <p>{{ property.description }}</p>
      <p><strong>Price:</strong> {{ property.price }}</p>
      <p><strong>Location:</strong> {{ property.location }} — {{ property.address }}</p>
      <p><strong>Area:</strong> {{ property.buildingArea }} building / {{ property.landArea }} land</p>
      <p><strong>Type:</strong> {{ formatLabel(property.buildingType) }} for {{ formatLabel(property.transactionType) }}</p>
      <p><strong>Facilities:</strong> {{ property.facilities }}</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  property: {
    type: Object,
    required: true
  }
});

const formatLabel = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
</script>
