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

  // Insertar radios de tipo de cliente debajo de Datos del Cliente
  const clienteSection = document.querySelector('section[aria-labelledby="datos-cliente-title"]');
  if (clienteSection && !document.getElementById('tipoClienteRow')) {
    const tipoClienteRow = document.createElement('div');
    tipoClienteRow.className = 'form-row';
    tipoClienteRow.id = 'tipoClienteRow';
    tipoClienteRow.innerHTML = `
      <label style="font-weight:bold;">Tipo de Cliente:</label>
      <label style="margin-left:10px;"><input type="radio" name="tipoCliente" value="final" checked> Consumidor Final</label>
      <label style="margin-left:10px;"><input type="radio" name="tipoCliente" value="mayorista"> Mayorista</label>
    `;
    clienteSection.appendChild(tipoClienteRow);
  }

  // Variable para el tipo de cliente
  let tipoCliente = 'final';
  document.addEventListener('change', function(e) {
    if (e.target.name === 'tipoCliente') {
      tipoCliente = e.target.value;
      renderItems();
    }
  });

  function renderItems() {
    itemsBody.innerHTML = '';
    let subtotal = 0;
    items.forEach((item, idx) => {
      const row = document.createElement('tr');
      let options = '<option value="">Seleccione artículo</option>';
      articulosDisponibles.forEach(art => {
        options += `<option value="${art[3]}" data-codigo="${art[2]}" data-precio="${art[6] || art[5] || ''}">${art[3]}</option>`;
      });
      // Variante: select clásico con búsqueda nativa
      row.innerHTML = `
        <td><input type="text" value="${item.codigo || ''}" class="codigo" maxlength="20" style="width:80px" readonly></td>
        <td>
          <select class="nombre-select" data-idx="${idx}" style="width:220px">
            <option value="">Seleccione artículo</option>
            ${articulosDisponibles.map(art => `<option value="${art[3]}"${item.nombre === art[3] ? ' selected' : ''}>${art[3]}</option>`).join('')}
          </select>
          
        </td>
        <td><input type="number" value="${item.cantidad}" class="cantidad" min="1" style="width:60px"></td>
        <td><input type="text" value="${item.valorU}" class="valorU" min="0" step="0.01" style="width:80px"></td>
        <td class="valorTotal">${(item.cantidad * item.valorU).toLocaleString('es-AR', {maximumFractionDigits:0})}</td>
        <td><button type="button" class="remove-btn" data-idx="${idx}">Eliminar</button></td>
      `;
      itemsBody.appendChild(row);
      subtotal += item.cantidad * item.valorU;
    });
    subtotalInput.value = subtotal.toFixed(2);
    calcularTotalFinal();

    // Eventos para autocompletar y mostrar selección
    itemsBody.querySelectorAll('.nombre-select').forEach((select, idx) => {
      select.addEventListener('change', function() {
        const nombreSel = this.value;
        const art = articulosPorNombre[nombreSel];
        const row = this.closest('tr');
        if (art) {
          items[idx].codigo = art[2];
          items[idx].nombre = art[3];
          // Usar columna 4 para consumidor final, columna 6 para mayorista
          let valorRaw = tipoCliente === 'final' ? (art[4] || '0') : (art[6] || art[5] || '0');
          valorRaw = valorRaw.replace(/\./g, '').replace(',', '.');
          items[idx].valorU = parseInt(valorRaw) || 0;
          row.querySelector('.codigo').value = art[2];
          row.querySelector('.valorU').value = items[idx].valorU;
        } else {
          items[idx].codigo = '';
          items[idx].nombre = '';
          items[idx].valorU = 0;
          row.querySelector('.codigo').value = '';
          row.querySelector('.valorU').value = '';
        }
        row.querySelector('.valorTotal').textContent = (items[idx].cantidad * items[idx].valorU).toLocaleString('es-AR', {maximumFractionDigits:0});
        subtotalInput.value = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0).toLocaleString('es-AR', {maximumFractionDigits:0});
        calcularTotalFinal();
      });
    });
  }

  // Formateo numérico para todos los campos relacionados a valores
  function calcularTotalFinal() {
    let subtotal = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0);
    let recargo = parseInt((recargoInput.value || '0').replace(/\./g, '').replace(',', '.')) || 0;
    let descuento = parseInt((descuentoInput.value || '0').replace(/\./g, '').replace(',', '.')) || 0;
    let envio = parseInt((envioInput.value || '0').replace(/\./g, '').replace(',', '.')) || 0;
    let total = subtotal + recargo + envio - descuento;
    subtotalInput.value = subtotal.toLocaleString('es-AR', {maximumFractionDigits:0});
    totalFinalInput.value = total.toLocaleString('es-AR', {maximumFractionDigits:0});
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
    const nombreInput = row.querySelector('.nombre-input');
    if (nombreInput) items[idx].nombre = nombreInput.value;
    items[idx].cantidad = parseInt(row.querySelector('.cantidad').value) || 1;
    let valorUraw = row.querySelector('.valorU').value.replace(/\./g, '').replace(',', '.');
    items[idx].valorU = parseInt(valorUraw) || 0;
    row.querySelector('.valorTotal').textContent = (items[idx].cantidad * items[idx].valorU).toLocaleString('es-AR', {maximumFractionDigits:0});
    subtotalInput.value = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0).toLocaleString('es-AR', {maximumFractionDigits:0});
    calcularTotalFinal();
  });

  itemsBody.addEventListener('click', function(e) {
    if (e.target.classList.contains('remove-btn')) {
      const idx = parseInt(e.target.dataset.idx);
      items.splice(idx, 1);
      renderItems();
    }
  });

  [recargoInput, descuentoInput, envioInput].forEach(input => {
    input.addEventListener('input', function() {
      // Normalizar y formatear
      let val = this.value.replace(/\./g, '').replace(',', '.');
      this.value = val ? parseInt(val).toLocaleString('es-AR', {maximumFractionDigits:0}) : '';
      calcularTotalFinal();
    });
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
