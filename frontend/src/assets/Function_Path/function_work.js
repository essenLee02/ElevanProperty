function saveCheckedItems(affordanceId, data, reload) {
    // Jika reload = true dan affordanceId tidak kosong, hapus semua item
    if (reload && affordanceId) {
        data.length = 0;
    } else {
        var index = data.indexOf(affordanceId);
        // Jika affordanceId belum ada, tambahkan. Jika sudah ada, hapus.
        (index === -1) ? data.push(affordanceId) : data.splice(index, 1);
    }
    return data;
}


function ajaxHit(urlHit, methodHit, headerHit, dataHit, callbackSuccess, callbackError) {
    $.ajax({
        url: urlHit,
        type: methodHit,
        headers: headerHit,
        data: dataHit,
        success: function(response) {
            console.log(response);
            callbackSuccess?.(response); // Hanya panggil jika callbackSuccess ada
        },
        error: function(xhr) {
            console.log(xhr.responseText);
            callbackError?.(xhr); // Hanya panggil jika callbackError ada
        }
    });
}

// function unselectedData(selected = [], checked = [], unselect = [], type = null) {
//     selected = selected.length > 0 && unselect.length > 0 ? selected.filter(code => code.includes(unselect)) : [];
//     checked = checked.length > 0 && unselect.length > 0 ? checked.filter(obj => selected.includes(obj.code)) : [];
//     return type === 'selected' ? selected : checked;
// }
