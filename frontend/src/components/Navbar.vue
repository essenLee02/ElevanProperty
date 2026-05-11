<template>
  <section class="navbar-area navbar-nine sticky">
    <div class="container">
      <div class="row">
        <div class="col-lg-12">
          <nav class="navbar navbar-expand-lg">
            <router-link class="navbar-brand" to="/">
              <img src="/assets/images/logo.svg" alt="Logo" />
            </router-link>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNine"
              aria-controls="navbarNine" aria-expanded="false" aria-label="Toggle navigation">
              <span class="toggler-icon"></span>
              <span class="toggler-icon"></span>
              <span class="toggler-icon"></span>
            </button>

            <div class="collapse navbar-collapse sub-menu-bar" id="navbarNine">
              <ul class="navbar-nav me-auto">
                <li class="nav-item"><router-link class="page-scroll" active-class="active" to="/">Home</router-link></li>
                <li class="nav-item"><router-link class="page-scroll" active-class="active" to="/about">About Us</router-link></li>
                <li class="nav-item"><router-link class="page-scroll" active-class="active" to="/contact">Contact</router-link></li>
              </ul>
            </div>
          </nav>
        </div>
      </div>
    </div>
  </section>
</template>
