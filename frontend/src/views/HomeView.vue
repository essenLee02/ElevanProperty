<template>
  <div>
    <!-- Start header Area -->
    <section id="hero-area" class="header-area header-eight">
      <div class="container">
        <div class="row align-items-center">
          <div class="col-lg-6 col-md-12 col-12">
            <div class="header-content">
              <h1>ElevanLabs Real Estate</h1>
              <p>
                ElevanLabs was founded on the idea that finding a home should be simple and transparent. The reasons behind our business stem from personal experiences of struggling to find reliable real estate services.
              </p>
              <div class="button">
                <router-link to="/about" class="btn primary-btn">Get Started</router-link>
              </div>
            </div>
          </div>
          <div class="col-lg-6 col-md-12 col-12">
            <div class="header-image">
              <img src="/assets/images/header/hero-image.jpg" alt="#" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Start About Area -->
    <section class="about-area about-five">
      <div class="container">
        <div class="row align-items-center">
          <div class="col-lg-6 col-12">
            <div class="about-image-five">
              <img src="/assets/images/about/about-img1.jpg" alt="about" />
            </div>
          </div>
          <div class="col-lg-6 col-12">
            <div class="about-five-content">
              <h6 class="small-title text-lg">OUR STORY</h6>
              <h2 class="main-title fw-bold">Our team comes with the experience and knowledge</h2>
              <div class="about-five-tab">
                <nav>
                  <div class="nav nav-tabs" id="nav-tab" role="tablist">
                    <button class="nav-link active" id="nav-who-tab" data-bs-toggle="tab" data-bs-target="#nav-who" type="button" role="tab" aria-selected="true">Story & Reasons</button>
                    <button class="nav-link" id="nav-vision-tab" data-bs-toggle="tab" data-bs-target="#nav-vision" type="button" role="tab" aria-selected="false">Our Vision</button>
                    <button class="nav-link" id="nav-mission-tab" data-bs-toggle="tab" data-bs-target="#nav-mission" type="button" role="tab" aria-selected="false">Our Mission</button>
                  </div>
                </nav>
                <div class="tab-content" id="nav-tabContent">
                  <div class="tab-pane fade show active" id="nav-who" role="tabpanel">
                    <p>ElevanLabs bridge the gap between property owners and seekers, offering seamless renting, buying, and selling experiences.</p>
                  </div>
                  <div class="tab-pane fade" id="nav-vision" role="tabpanel">
                    <p>Our vision is to become the most trusted and user-centric real estate platform globally.</p>
                  </div>
                  <div class="tab-pane fade" id="nav-mission" role="tabpanel">
                    <p>Our mission is to empower individuals and families to find their dream spaces by providing accurate data.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
