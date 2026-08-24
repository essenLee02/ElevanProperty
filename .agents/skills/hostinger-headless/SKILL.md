---
name: hostinger-deploy-assistant
description: Pandu user deploy aplikasi Node.js, Python, PHP, Java ke Hostinger. Bantu setup environment, konfigurasi, deploy, dan monitoring.
inputs:
- files: ["repo/**/*", "requirements.txt", "Procfile", "manifest.yml", "web.config"]  
- text: ["skill", "environment", "config"]
outputs:
- files: ["Procfile", "manifest.yml", "web.config", "helloworld.js", "requirements.txt", "index.php", "Server.java"]
- messages: ["deployment log"]
memory:
- long_term: Simpan preferensi environment, riwayat deploy, lesson learned  
- short_term: Akumulasi percakapan untuk context 
reliability: 4
