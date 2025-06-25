// Script para ingresoPedido.html: manejo de formulario, artículos dinámicos y registro en Firebase

document.addEventListener('DOMContentLoaded', function() {
  // Firebase ya está inicializado en el HTML

  // Elementos del DOM
  const form = document.getElementById('orderForm');
  const itemsBody = document.getElementById('itemsBody');
  const addItemBtn = document.getElementById('addItemBtn');
  const subtotalInput = document.getElementById('subtotal');
  const totalFinalInput = document.getElementById('totalFinal');
  const recargoInput = document.getElementById('recargo');
  const descuentoInput = document.getElementById('descuento');
  const envioInput = document.getElementById('envio');
  const messageDiv = document.getElementById('message');

  let items = [];

  // === CARGA DE ARTÍCULOS DESDE GOOGLE SHEETS ===
  let articulosDisponibles = [];
  let articulosPorCodigo = {};
  let articulosPorNombre = {};

  // Cargar artículos al iniciar
  fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_SHEETS_CONFIG.RANGO}?key=${GOOGLE_SHEETS_CONFIG.API_KEY}`)
    .then(response => response.json())
    .then(data => {
      const items = data.values || [];
      articulosDisponibles = items.filter(item => item[4]?.toLowerCase() !== 'no disponible');
      articulosDisponibles.forEach(item => {
        articulosPorCodigo[item[2]] = item;
        articulosPorNombre[item[3]] = item;
      });
    });

  // Cargar Select2
  const select2Script = document.createElement('script');
  select2Script.src = 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js';
  document.head.appendChild(select2Script);
  const select2CSS = document.createElement('link');
  select2CSS.rel = 'stylesheet';
  select2CSS.href = 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css';
  document.head.appendChild(select2CSS);

  function renderItems() {
    itemsBody.innerHTML = '';
    let subtotal = 0;
    items.forEach((item, idx) => {
      const row = document.createElement('tr');
      // Select2 para artículos
      let options = '<option value="">Seleccione artículo</option>';
      articulosDisponibles.forEach(art => {
        options += `<option value="${art[3]}" data-codigo="${art[2]}" data-precio="${art[6] || art[5] || ''}">${art[3]}</option>`;
      });
      row.innerHTML = `
        <td><input type="text" value="${item.codigo || ''}" class="codigo" maxlength="20" style="width:80px" readonly></td>
        <td>
          <select class="nombre-select" data-idx="${idx}" style="width:180px">${options}</select>
        </td>
        <td><input type="number" value="${item.cantidad}" class="cantidad" min="1" style="width:60px"></td>
        <td><input type="number" value="${item.valorU}" class="valorU" min="0" step="0.01" style="width:80px"></td>
        <td class="valorTotal">${(item.cantidad * item.valorU).toFixed(2)}</td>
        <td><button type="button" class="remove-btn" data-idx="${idx}">Eliminar</button></td>
      `;
      itemsBody.appendChild(row);
      subtotal += item.cantidad * item.valorU;
    });
    subtotalInput.value = subtotal.toFixed(2);
    calcularTotalFinal();

    // Inicializar Select2 y eventos
    if (window.$ && window.$.fn && window.$.fn.select2) {
      document.querySelectorAll('.nombre-select').forEach((select, idx) => {
        $(select).select2({
          dropdownParent: $(select).closest('td'),
          width: 'style',
          placeholder: 'Seleccione artículo',
          allowClear: true
        });
        // Set value
        if (items[idx].nombre) $(select).val(items[idx].nombre).trigger('change');
        $(select).off('change').on('change', function(e) {
          const nombreSel = this.value;
          const art = articulosPorNombre[nombreSel];
          if (art) {
            items[idx].codigo = art[2];
            items[idx].nombre = art[3];
            items[idx].valorU = parseFloat(art[6] || art[5] || 0);
            row.querySelector('.codigo').value = art[2];
            row.querySelector('.valorU').value = items[idx].valorU;
          } else {
            items[idx].codigo = '';
            items[idx].nombre = '';
            items[idx].valorU = 0;
            row.querySelector('.codigo').value = '';
            row.querySelector('.valorU').value = '';
          }
          // No llamar renderItems aquí para evitar perder el foco
        });
      });
    } else {
      select2Script.onload = renderItems; // Reintentar cuando cargue
    }
  }

  function calcularTotalFinal() {
    let subtotal = parseFloat(subtotalInput.value) || 0;
    let recargo = parseFloat(recargoInput.value) || 0;
    let descuento = parseFloat(descuentoInput.value) || 0;
    let envio = parseFloat(envioInput.value) || 0;
    let total = subtotal + recargo + envio - descuento;
    totalFinalInput.value = total.toFixed(2);
  }

  addItemBtn.addEventListener('click', function() {
    items.push({ codigo: '', nombre: '', cantidad: 1, valorU: 0 });
    renderItems();
  });

  itemsBody.addEventListener('input', function(e) {
    const row = e.target.closest('tr');
    if (!row) return;
    const idx = Array.from(itemsBody.children).indexOf(row);
    if (idx < 0) return;
    items[idx].codigo = row.querySelector('.codigo').value;
    const select = row.querySelector('.nombre-select');
    if (select) items[idx].nombre = select.value;
    items[idx].cantidad = parseInt(row.querySelector('.cantidad').value) || 1;
    items[idx].valorU = parseFloat(row.querySelector('.valorU').value) || 0;
    // No llamar renderItems aquí para evitar perder el foco
    subtotalInput.value = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0).toFixed(2);
    calcularTotalFinal();
    row.querySelector('.valorTotal').textContent = (items[idx].cantidad * items[idx].valorU).toFixed(2);
  });

  itemsBody.addEventListener('click', function(e) {
    if (e.target.classList.contains('remove-btn')) {
      const idx = parseInt(e.target.dataset.idx);
      items.splice(idx, 1);
      renderItems();
    }
  });

  [recargoInput, descuentoInput, envioInput].forEach(input => {
    input.addEventListener('input', calcularTotalFinal);
  });

  form.addEventListener('reset', function() {
    items = [];
    setTimeout(() => {
      renderItems();
      messageDiv.textContent = '';
      subtotalInput.value = '';
      totalFinalInput.value = '';
    }, 0);
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    // Validar campos cliente
    const nombre = form.nombre.value.trim();
    const telefono = form.telefono.value.trim();
    const direccion = form.direccion.value.trim();
    const dni = form.dni.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const medioPago = form.medioPago.value;
    const recargo = parseFloat(form.recargo.value) || 0;
    const descuento = parseFloat(form.descuento.value) || 0;
    const envio = parseFloat(form.envio.value) || 0;
    const subtotal = parseFloat(form.subtotal.value) || 0;
    const totalFinal = parseFloat(form.totalFinal.value) || 0;

    //if (!nombre || !telefono || !direccion || !dni || !email || !medioPago) {
    //  messageDiv.textContent = 'Por favor complete todos los campos obligatorios.';
    //  messageDiv.style.color = 'red';
    //  return;
    //}
    if (items.length === 0) {
      messageDiv.textContent = 'Debe agregar al menos un artículo.';
      messageDiv.style.color = 'red';
      return;
    }
    // Validar artículos
    for (const item of items) {
      if (!item.nombre || item.cantidad <= 0 || item.valorU < 0) {
        messageDiv.textContent = 'Complete correctamente los datos de los artículos.';
        messageDiv.style.color = 'red';
        return;
      }
    }
    // Construir objeto pedido
    const pedidoObj = {
      timestamp: Date.now(),
      locked: false,
      adminViewed: false,
      cliente: { nombre, telefono, direccion, dni, email },
      items: items.map(it => ({ codigo: it.codigo, nombre: it.nombre, cantidad: it.cantidad, valorU: it.valorU })),
      pagos: {
        medioPago,
        recargo,
        descuento,
        envio,
        subtotal,
        totalFinal
      }
    };
    // Guardar en Firebase
    db.ref('pedidos').push(pedidoObj)
      .then(() => {
        messageDiv.textContent = 'Pedido ingresado correctamente.';
        messageDiv.style.color = 'green';
        form.reset();
        items = [];
        renderItems();
      })
      .catch(err => {
        messageDiv.textContent = 'Error al guardar el pedido.';
        messageDiv.style.color = 'red';
      });
  });

  // Inicializar tabla vacía
  renderItems();
});
