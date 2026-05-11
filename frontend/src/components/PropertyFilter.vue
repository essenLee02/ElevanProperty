<template>
  <div class="row mt-4 text-start">
    <div class="col-md-4 mb-3">
      <label class="form-label">Filter by Building Type:</label>
      <select class="form-select" :value="buildingType" @change="$emit('update:buildingType', $event.target.value)">
        <option value="">All Types</option>
        <option value="house">House</option>
        <option value="villa">Villa</option>
        <option value="hotel">Hotel</option>
        <option value="boarding_house">Boarding House</option>
        <option value="apartment">Apartment</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div class="col-md-4 mb-3">
      <label class="form-label">Filter by Transaction Type:</label>
      <select class="form-select" :value="transactionType" @change="$emit('update:transactionType', $event.target.value)">
        <option value="">All Transactions</option>
        <option value="sale">Sale</option>
        <option value="rent">Rent</option>
        <option value="purchase">Purchase</option>
      </select>
    </div>
    <div class="col-md-4 mb-3">
      <label class="form-label">Filter by Location:</label>
      <input class="form-control" :value="location" placeholder="City or location" @input="$emit('update:location', $event.target.value)" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  buildingType: { type: String, default: '' },
  transactionType: { type: String, default: '' },
  location: { type: String, default: '' }
});

defineEmits(['update:buildingType', 'update:transactionType', 'update:location']);
</script>
