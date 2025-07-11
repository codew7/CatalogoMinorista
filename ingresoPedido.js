// Script para ingresoPedido.html: manejo de formulario, artículos dinámicos y registro en Firebase

document.addEventListener('DOMContentLoaded', function() {
  // --- TAB = Agregar Artículo ---
  document.addEventListener('keydown', function(e) {
    // Solo si es TAB, sin Shift, y no en textarea ni en select2 search
    if (e.key === 'Tab' && !e.shiftKey) {
      const active = document.activeElement;
      // No interceptar si está en textarea, input tipo hidden, o en el buscador de select2
      if (active && (
        active.tagName === 'TEXTAREA' ||
        (active.tagName === 'INPUT' && active.type === 'hidden') ||
        (active.classList && active.classList.contains('select2-search__field'))
      )) {
        return;
      }
      e.preventDefault();
      // Simular click en el botón Agregar Artículo
      const btn = document.getElementById('addItemBtn');
      if (btn && !btn.disabled) btn.click();
    }
  });
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

  // Deshabilitar controles hasta que termine la carga de artículos
  addItemBtn.disabled = true;
  // Radios de tipo de cliente
  let radiosTipoCliente = [];
  // Insertar radios de tipo de cliente debajo de Datos del Cliente
  const clienteSection = document.querySelector('section[aria-labelledby="datos-cliente-title"]');
  if (clienteSection && !document.getElementById('tipoClienteRow')) {
    const tipoClienteRow = document.createElement('div');
    tipoClienteRow.className = 'form-row';
    tipoClienteRow.id = 'tipoClienteRow';
    tipoClienteRow.innerHTML = `
      <label style="font-weight:bold;">Tipo de Cliente:</label>
      <label style="margin-left:10px;"><input type="radio" name="tipoCliente" value="consumidor final" checked> Consumidor</label>
      <label style="margin-left:10px;"><input type="radio" name="tipoCliente" value="mayorista"> Mayorista</label>
    `;
    clienteSection.appendChild(tipoClienteRow);
    // Guardar referencia a los radios
    radiosTipoCliente = Array.from(tipoClienteRow.querySelectorAll('input[type="radio"][name="tipoCliente"]'));
    // Deshabilitar radios
    radiosTipoCliente.forEach(radio => radio.disabled = true);
  } else if (clienteSection) {
    radiosTipoCliente = Array.from(document.querySelectorAll('input[type="radio"][name="tipoCliente"]'));
    radiosTipoCliente.forEach(radio => radio.disabled = true);
  }

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
      // Habilitar controles después de cargar
      addItemBtn.disabled = false;
      // Mantener tipoCliente como solo lectura
      radiosTipoCliente.forEach(radio => radio.disabled = true);
    })
    .catch(() => {
      // Si falla la carga, mantener controles deshabilitados
      addItemBtn.disabled = true;
      radiosTipoCliente.forEach(radio => radio.disabled = true);
    });

  // Helper: always read current cliente type from DOM
function getTipoCliente() {
  const sel = document.querySelector('input[name="tipoCliente"]:checked');
  return sel ? sel.value : 'consumidor final';
}

  function renderItems() {
    itemsBody.innerHTML = '';
    let subtotal = 0;
    // Obtener tipo de cliente actual
    const currentTipo = getTipoCliente();
    // Ordenar artículos alfabéticamente por nombre antes de renderizar
    const articulosOrdenados = [...articulosDisponibles].sort((a, b) => {
      const nombreA = (a[3] || '').toLowerCase();
      const nombreB = (b[3] || '').toLowerCase();
      return nombreA.localeCompare(nombreB, 'es');
    });
    items.forEach((item, idx) => {
      const row = document.createElement('tr');
      let options = '<option value="">Seleccione artículo</option>';
      articulosOrdenados.forEach(art => {
        options += `<option value="${art[3]}" data-codigo="${art[2]}" data-precio="${art[6] || art[5] || ''}">${art[3]}</option>`;
      });
      row.innerHTML = `
        <td><input type="text" value="${item.codigo || ''}" class="codigo" maxlength="20" style="width:80px" readonly></td>
        <td>
          <select class="nombre-select" data-idx="${idx}" style="width:220px">
            <option value="">Seleccione artículo</option>
            ${articulosOrdenados.map(art => `<option value="${art[3]}"${item.nombre === art[3] ? ' selected' : ''}>${art[3]}</option>`).join('')}
          </select>
        </td>
        <td><input type="number" value="${item.cantidad}" class="cantidad" min="1" style="width:60px"></td>
        <td><input type="text" value="${item.valorU}" class="valorU" min="0" step="1" style="width:80px"></td>
        <td class="valorTotal">${(item.cantidad * item.valorU).toLocaleString('es-AR', {maximumFractionDigits:0})}</td>
        <td><button type="button" class="remove-btn" data-idx="${idx}" style="background:#d32f2f;color:#fff;border:none;border-radius:4px;width:32px;height:32px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Eliminar"><span style="font-weight:bold;font-size:20px;line-height:1;">&times;</span></button></td>
      `;
      itemsBody.appendChild(row);
      // Inicializar Select2 en el select de artículo
      var $select = $(row).find('.nombre-select');
      $select.select2({
        placeholder: 'Seleccione artículo',
        width: '95%'
      });
      $select.on('select2:select', function(e) {
        this.dispatchEvent(new Event('change', { bubbles: true }));
      });
      // Si es la última fila agregada y se acaba de agregar, abrir Select2 automáticamente
      if (idx === items.length - 1 && window._abrirSelect2NuevaFila) {
        setTimeout(function() {
          $select.select2('open');
          // Forzar foco en el input de búsqueda de Select2
          setTimeout(function() {
            var $search = $('.select2-container--open .select2-search__field');
            if ($search.length) $search[0].focus();
          }, 50);
        }, 0);
      }
      // --- NUEVO: Calcular valorU y valorC automáticamente si hay artículo seleccionado ---
      if (item.nombre && articulosPorNombre[item.nombre]) {
        const art = articulosPorNombre[item.nombre];
        // Usar columna según tipo de cliente seleccionado
        let valorRaw = currentTipo === 'consumidor final' ? (art[4] || '0') : (art[6] || '0');
        valorRaw = valorRaw.replace(/\$/g, '').replace(/[.,]/g, '');
        const valorU = parseInt(valorRaw) || 0;
        // Nuevo: valorC desde columna H (índice 7)
        let valorCRaw = art[7] || '0';
        valorCRaw = valorCRaw.replace(/\$/g, '').replace(/[.,]/g, '');
        const valorC = parseInt(valorCRaw) || 0;
        // Nuevo: categoria desde columna A (índice 0)
        const categoria = art[0] || '';
        if (item.valorU !== valorU || item.valorC !== valorC || item.categoria !== categoria) {
          item.valorU = valorU;
          item.valorC = valorC;
          item.categoria = categoria;
          row.querySelector('.valorU').value = valorU;
          row.querySelector('.valorTotal').textContent = (item.cantidad * valorU).toLocaleString('es-AR', {maximumFractionDigits:0});
        }
      }
      subtotal += item.cantidad * item.valorU;
    });
    subtotalInput.value = subtotal.toLocaleString('es-AR', {maximumFractionDigits:0});
    calcularTotalFinal();
    recalcularYActualizarRecargoSiMedioPago();
    calcularCostos();

    // Eventos para autocompletar y mostrar selección
    itemsBody.querySelectorAll('.nombre-select').forEach((select, idx) => {
      select.addEventListener('change', function() {
        const nombreSel = this.value;
        const art = articulosPorNombre[nombreSel];
        const row = this.closest('tr');
        if (art) {
          items[idx].codigo = art[2];
          items[idx].nombre = art[3];
          // Leer tipo de cliente actual
          const currentTipo = getTipoCliente();
          // Asignar valorU según tipo
          let valorRaw = currentTipo === 'consumidor final' ? (art[4] || '0') : (art[6] || '0');
          valorRaw = valorRaw.replace(/\$/g, '').replace(/[.,]/g, '');
          items[idx].valorU = parseInt(valorRaw) || 0;
          // Asignar valorC desde columna H (índice 7)
          let valorCRaw = art[7] || '0';
          valorCRaw = valorCRaw.replace(/\$/g, '').replace(/[.,]/g, '');
          items[idx].valorC = parseInt(valorCRaw) || 0;
          row.querySelector('.codigo').value = art[2];
          row.querySelector('.valorU').value = items[idx].valorU;
        } else {
          items[idx].codigo = '';
          items[idx].nombre = '';
          items[idx].valorU = 0;
          items[idx].valorC = 0;
          row.querySelector('.codigo').value = '';
          row.querySelector('.valorU').value = '';
        }
        row.querySelector('.valorTotal').textContent = (items[idx].cantidad * items[idx].valorU).toLocaleString('es-AR', {maximumFractionDigits:0});
        subtotalInput.value = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0).toLocaleString('es-AR', {maximumFractionDigits:0});
        calcularTotalFinal();
      });
    });
    // Evento para eliminar fila (botón eliminar)
    itemsBody.querySelectorAll('.remove-btn').forEach((btn, idx) => {
      btn.addEventListener('click', function() {
        items.splice(idx, 1);
        renderItems();
      });
    });
  }

  // Formateo numérico para todos los campos relacionados a valores
  function calcularTotalFinal() {
    let subtotal = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0);
    let recargo = parseInt((recargoInput.value || '0').replace(/\D/g, '')) || 0;
    let descuento = parseInt((descuentoInput.value || '0').replace(/\D/g, '')) || 0;
    let envio = parseInt((envioInput.value || '0').replace(/\D/g, '')) || 0;
    let total = subtotal + recargo + envio - descuento;
    // Usar punto como separador de miles para todos los campos
    const formatMiles = n => n ? n.toLocaleString('es-AR').replace(/,/g, '.').replace(/\./g, (m, o, s) => s && s.length > 3 ? '.' : '.') : '';
    subtotalInput.value = formatMiles(subtotal);
    recargoInput.value = recargo ? formatMiles(recargo) : '';
    descuentoInput.value = descuento ? formatMiles(descuento) : '';
    envioInput.value = envio ? formatMiles(envio) : '';
    totalFinalInput.value = formatMiles(total);
  }

addItemBtn.addEventListener('click', function() {
  window._abrirSelect2NuevaFila = true;
  items.push({ codigo: '', nombre: '', cantidad: 1, valorU: 0, valorC: 0, categoria: '' });
  renderItems();
  window._abrirSelect2NuevaFila = false;
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
    let valorUraw = row.querySelector('.valorU').value.replace(/,/g, '');
    items[idx].valorU = parseInt(valorUraw) || 0;
    // Actualizar categoria si corresponde
    if (items[idx].nombre && articulosPorNombre[items[idx].nombre]) {
      items[idx].categoria = articulosPorNombre[items[idx].nombre][0] || '';
    }
    row.querySelector('.valorTotal').textContent = (items[idx].cantidad * items[idx].valorU).toLocaleString('es-AR', {maximumFractionDigits:0});
    subtotalInput.value = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0).toLocaleString('es-AR', {maximumFractionDigits:0});
    calcularTotalFinal();
  });

  [recargoInput, descuentoInput, envioInput].forEach(input => {
    input.addEventListener('input', function() {
      // Normalizar y formatear
      let val = this.value.replace(/\D/g, '');
      // Formatear con punto como separador de miles
      this.value = val ? Number(val).toLocaleString('es-AR').replace(/,/g, '.') : '';
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

  // --- MODAL DE CONFIRMACIÓN PARA IMPRIMIR ---
  function mostrarModalImprimirOrden(onSi, onNo) {
    // Eliminar modal previo si existe
    const old = document.getElementById('modalImprimirOrden');
    if (old) old.remove();
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.id = 'modalImprimirOrden';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.35)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';
    // Modal box
    const box = document.createElement('div');
    box.style.background = '#fff';
    box.style.padding = '32px 24px 20px 24px';
    box.style.borderRadius = '10px';
    box.style.boxShadow = '0 2px 16px rgba(0,0,0,0.18)';
    box.style.textAlign = 'center';
    box.innerHTML = `
      <div style="font-size:1.2em;margin-bottom:18px;">¿Desea imprimir la Orden de pedido?</div>
      <button id="btnImprimirSi" style="background:#6c4eb6;color:#fff;padding:8px 24px;margin:0 12px;border:none;border-radius:4px;font-size:1em;">Sí</button>
      <button id="btnImprimirNo" style="background:#aaa;color:#fff;padding:8px 24px;margin:0 12px;border:none;border-radius:4px;font-size:1em;">No</button>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    // Eventos
    function keyHandler(e) {
      if (overlay.style.display !== 'flex') return;
      if (e.key === 'Enter') {
        box.querySelector('#btnImprimirSi').click();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        box.querySelector('#btnImprimirNo').click();
        e.preventDefault();
      }
    }
    document.addEventListener('keydown', keyHandler);
    function cleanup() {
      document.removeEventListener('keydown', keyHandler);
    }
    box.querySelector('#btnImprimirSi').onclick = () => {
      overlay.remove();
      cleanup();
      onSi();
    };
    box.querySelector('#btnImprimirNo').onclick = () => {
      overlay.remove();
      cleanup();
      onNo();
    };
  }

  // --- SUBMIT GLOBAL SOLO PARA ALTAS ---
  form.addEventListener('submit', function(e) {
    if (pedidoId) return; // Si es edición, no ejecutar alta
    e.preventDefault();
    mostrarModalImprimirOrden(
      function() {
        generarReciboYImprimir();
        setTimeout(() => { ingresarPedido(); }, 1000);
      },
      function() {
        ingresarPedido();
      }
    );
  });

  // Extraer la lógica de ingreso de pedido a una función reutilizable
  function ingresarPedido() {
    // Validar campos obligatorios
    const nombre = form.nombre.value.trim();
    const telefono = form.telefono.value.trim();
    const direccion = form.direccion.value.trim();
    const dni = form.dni.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const medioPago = form.medioPago.value;
    const vendedor = form.vendedor ? form.vendedor.value.trim() : '';
    const tipoClienteRadio = document.querySelector('input[name="tipoCliente"]:checked');
    const tipoCliente = tipoClienteRadio ? tipoClienteRadio.value : '';

    if (!nombre) {
      showPopup('Debe completar el campo Nombre de cliente.', '❗', false);
      return;
    }
    if (!tipoCliente) {
      showPopup('Debe seleccionar el Tipo de Cliente.', '❗', false);
      return;
    }
    if (!medioPago) {
      showPopup('Debe seleccionar el Medio de Pago.', '❗', false);
      return;
    }
    if (!vendedor) {
      showPopup('Debe completar el campo Vendedor.', '❗', false);
      return;
    }

    // Procesar y guardar subtotal y total como enteros (solo dígitos)
    function onlyDigits(str) {
      return (str + '').replace(/\D/g, '');
    }
    const recargo = parseInt(onlyDigits(form.recargo.value), 10) || 0;
    const descuento = parseInt(onlyDigits(form.descuento.value), 10) || 0;
    const envio = parseInt(onlyDigits(form.envio.value), 10) || 0;
    const subtotal = parseInt(onlyDigits(form.subtotal.value), 10) || 0;
    const totalFinal = parseInt(onlyDigits(form.totalFinal.value), 10) || 0;
    const nota = form.nota ? form.nota.value.trim() : '';

    if (items.length === 0) {
      showPopup('Debe agregar al menos un artículo.', '❗', false);
      return;
    }
    // Validar artículos
    for (const item of items) {
      if (!item.nombre || item.cantidad <= 0 || item.valorU < 0) {
        showPopup('Complete correctamente los datos de los artículos.', '❗', false);
        return;
      }
      // Asegurar que valorC nunca sea undefined
      if (typeof item.valorC === 'undefined' || item.valorC === null) {
        item.valorC = 0;
      }
      // Asegurar que categoria nunca sea undefined
      if (typeof item.categoria === 'undefined' || item.categoria === null) {
        if (item.nombre && articulosPorNombre[item.nombre]) {
          item.categoria = articulosPorNombre[item.nombre][0] || '';
        } else {
          item.categoria = '';
        }
      }
    }
    // Obtener cotización blue en tiempo real
    fetch('https://api.bluelytics.com.ar/v2/latest')
      .then(r => r.json())
      .then(d => {
        if (!d.blue || (typeof d.blue.value_sell === 'undefined' && typeof d.blue.sell === 'undefined')) {
          throw new Error('cotizacion');
        }
        let cotizacionCierre = (d.blue.value_sell || d.blue.sell) + 10;
        // Construir objeto pedido
        const costos = calcularCostos();
        // Determinar tipo de entrega
        let entrega = 'Local';
        if (direccion && direccion.length > 3) {
          entrega = 'Envios';
        }

        // Obtener fecha de creación solo al crear el pedido
        function getFechaActual() {
          const now = new Date();
          const pad = n => n.toString().padStart(2, '0');
          return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        }

        const pedidoObj = {
          timestamp: Date.now(),
          locked: false,
          adminViewed: true,
          cliente: { nombre, telefono, direccion, dni, email, tipoCliente },
          items: items.map(it => ({ codigo: it.codigo, nombre: it.nombre, cantidad: it.cantidad, valorU: it.valorU, valorC: it.valorC, categoria: it.categoria })),
          pagos: {
            medioPago,
            recargo,
            descuento,
            envio,
            subtotal,
            totalFinal,
            costos,
            ganancia: subtotal - costos
          },
          status: 'DESPACHADO/ENTREGADO',
          cotizacionCierre: cotizacionCierre,
          costoUSD: costos / cotizacionCierre,
          createdby: 'admin',
          entrega,
          nota,
          vendedor,
        };
        // Guardar en Firebase
        if (pedidoId) {
          db.ref('pedidos/' + pedidoId).once('value').then(snap => {
            const pedidoAnterior = snap.val();
            // CONSERVAR lastOrderUpdate si existe
            if (pedidoAnterior && pedidoAnterior.lastOrderUpdate) {
              pedidoObj.lastOrderUpdate = pedidoAnterior.lastOrderUpdate;
            }
            // CONSERVAR fecha original si existe
            if (pedidoAnterior && pedidoAnterior.fecha) {
              pedidoObj.fecha = pedidoAnterior.fecha;
            }
            db.ref('pedidos/' + pedidoId).set(pedidoObj)
              .then(() => {
                // Registrar movimientos de inventario también en edición
                registrarMovimientosInventario(items, pedidoObj.cotizacionCierre, pedidoId);
                messageDiv.textContent = 'Pedido actualizado correctamente.';
                messageDiv.style.color = 'green';
                setTimeout(() => {
                  if (window.opener && !window.opener.closed) {
                    window.opener.location.reload();
                    window.close();
                  } else {
                    window.location.href = 'ingresoPedido.html';
                  }
                }, 1200);
              })
              .catch(err => {
                messageDiv.textContent = 'Error al actualizar el pedido.';
                messageDiv.style.color = 'red';
              });
          });
        } else {

          // Agregar campo fecha solo al crear el pedido
          pedidoObj.fecha = getFechaActual();
          // Usar push para obtener el id generado
          const pedidoRef = db.ref('pedidos').push();
          pedidoRef.set(pedidoObj)
            .then(() => {
              // Registrar movimientos de inventario usando el id generado
              registrarMovimientosInventario(items, pedidoObj.cotizacionCierre, pedidoRef.key);
              showPopup('Pedido ingresado', '✅', true);
              form.reset();
              items = [];
              renderItems();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            })
            .catch(err => {
              showPopup('Error al guardar el pedido.', '❌', false);
            });
        }
      })
      .catch(err => {
        if (err && err.message === 'cotizacion') {
          showPopup('No se pudo obtener la cotización del dólar blue.', '❌', false);
        } else {
          showPopup('Ocurrió un error inesperado al guardar el pedido.', '❌', false);
        }
      });
  }

  // --- POPUP MODAL ---
  function showPopup(message, emoji, autoClose) {
    // Remove existing popup if any
    const old = document.getElementById('popupPedidoMsg');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'popupPedidoMsg';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.35)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '99999';
    overlay.innerHTML = `
      <div style="background:#fff;padding:32px 24px;border-radius:16px;box-shadow:0 4px 32px #0002;min-width:320px;max-width:90vw;display:flex;flex-direction:column;align-items:center;">
        <div style="font-size:3rem;">${emoji}</div>
        <div style="font-size:1.3rem;margin:18px 0 10px 0;text-align:center;">${message}</div>
        <button id="popupPedidoOk" style="margin-top:10px;background:#6c4eb6;color:#fff;padding:8px 32px;border:none;border-radius:6px;font-size:1.1rem;cursor:pointer;">Ok</button>
      </div>
    `;
    document.body.appendChild(overlay);
    // Close on Ok
    overlay.querySelector('#popupPedidoOk').onclick = function() {
      overlay.remove();
    };
    // Close on click outside
    overlay.onclick = function(e) {
      if (e.target === overlay) overlay.remove();
    };
    // Optional auto close
    if (autoClose) {
      setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
      }, 2500);
    }
    // Soporte Enter/Escape
    function keyHandler(e) {
      if (overlay.style.display !== 'flex') return;
      if (e.key === 'Enter' || e.key === 'Escape') {
        overlay.remove();
        cleanup();
        e.preventDefault();
      }
    }
    function cleanup() {
      document.removeEventListener('keydown', keyHandler);
    }
    document.addEventListener('keydown', keyHandler);
  }

  // === SOPORTE EDICIÓN DE PEDIDOS ===
  // Si hay un parámetro id en la URL, cargar el pedido y rellenar el formulario para editar
  const urlParams = new URLSearchParams(window.location.search);
  const pedidoId = urlParams.get('id');
  if (pedidoId) {
    db.ref('pedidos/' + pedidoId).once('value').then(snap => {
      const pedido = snap.val();
      if (!pedido) return;
      // Rellenar datos del cliente
      form.nombre.value = pedido.cliente?.nombre || '';
      form.telefono.value = pedido.cliente?.telefono || '';
      form.direccion.value = pedido.cliente?.direccion || '';
      form.dni.value = pedido.cliente?.dni || '';
      form.email.value = pedido.cliente?.email || '';
      // Rellenar tipo de cliente si existe
      if (pedido.cliente?.tipoCliente) {
        const radio = document.querySelector(`input[name="tipoCliente"][value="${pedido.cliente.tipoCliente}"]`);
        if (radio) {
          radio.checked = true;
          tipoCliente = pedido.cliente.tipoCliente; // <-- ACTUALIZAR VARIABLE INTERNA
          // Forzar actualización de valores de artículos según tipoCliente
          items.forEach((item, idx) => {
            if (item.nombre && articulosPorNombre[item.nombre]) {
              const art = articulosPorNombre[item.nombre];
              let valorRaw = tipoCliente === 'consumidor final' ? (art[4] || '0') : (art[6] || '0');
              valorRaw = valorRaw.replace(/\$/g, '').replace(/[.,]/g, '');
              items[idx].valorU = parseInt(valorRaw) || 0;
            }
          });
        }
      }
      // Rellenar items
      items = (pedido.items || []).map(it => ({
        codigo: it.codigo || '',
        nombre: it.nombre || '',
        cantidad: it.cantidad || 1,
        valorU: it.valorU || 0,
        valorC: typeof it.valorC !== 'undefined' ? it.valorC : 0
      }));
      renderItems();
      // Rellenar pagos
      form.medioPago.value = pedido.pagos?.medioPago || '';
      form.recargo.value = pedido.pagos?.recargo ? Number(String(pedido.pagos.recargo).replace(/\D/g, '')).toLocaleString('es-AR').replace(/,/g, '.') : '';
      form.descuento.value = pedido.pagos?.descuento ? Number(String(pedido.pagos.descuento).replace(/\D/g, '')).toLocaleString('es-AR').replace(/,/g, '.') : '';
      form.envio.value = pedido.pagos?.envio ? Number(String(pedido.pagos.envio).replace(/\D/g, '')).toLocaleString('es-AR').replace(/,/g, '.') : '';
      // Mostrar subtotal y total como enteros con separador de miles
      form.subtotal.value = pedido.pagos?.subtotal ? parseInt((pedido.pagos.subtotal + '').replace(/\D/g, ''), 10).toLocaleString('es-AR').replace(/,/g, '.') : '';
      form.totalFinal.value = pedido.pagos?.totalFinal ? parseInt((pedido.pagos.totalFinal + '').replace(/\D/g, ''), 10).toLocaleString('es-AR').replace(/,/g, '.') : '';
      // Autocompletar nota y vendedor si existen
      if (form.nota) form.nota.value = pedido.nota || '';
      if (form.vendedor) form.vendedor.value = pedido.vendedor || '';

      // --- SOLO LECTURA SI locked: true ---
      if (pedido.locked === true) {
        // Eliminar movimientos de inventario asociados a este pedido cancelado
        if (pedidoId) {
          db.ref('movimientos').orderByChild('pedidoId').equalTo(pedidoId).once('value', function(snapshot) {
            const updates = {};
            snapshot.forEach(child => {
              updates[child.key] = null;
            });
            if (Object.keys(updates).length > 0) {
              db.ref('movimientos').update(updates).catch(err => {
                console.error('Error eliminando movimientos por cancelación:', err, updates);
              });
            }
          });
        }
        // Deshabilitar todos los campos del formulario
        Array.from(form.elements).forEach(el => {
          el.disabled = true;
        });
        // Deshabilitar selects y radios fuera del form (por si acaso)
        document.querySelectorAll('input[type="radio"], select').forEach(el => {
          el.disabled = true;
        });
        // Deshabilitar botones de acción
        document.querySelectorAll('button, input[type="button"]').forEach(btn => {
          btn.disabled = true;
        });
        // Mostrar mensaje de solo lectura
        let lockedMsg = document.getElementById('lockedMsg');
        if (!lockedMsg) {
          lockedMsg = document.createElement('div');
          lockedMsg.id = 'lockedMsg';
          lockedMsg.textContent = 'Este pedido está cancelado y no puede modificarse.';
          lockedMsg.style = 'background:#ffe0e0;color:#b00;padding:10px 18px;margin-bottom:12px;border-radius:6px;font-weight:bold;text-align:center;';
          form.parentNode.insertBefore(lockedMsg, form);
        }
      }
    });
    // Cambiar el texto del botón submit a "Modificar"
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Modificar';
    // Cambiar el submit para actualizar en vez de crear
    form.onsubmit = function(e) {
      e.preventDefault();
      mostrarModalPasswordEdicion(function(contrasena) {
        if (!contrasena) return; // Si se cancela, no continuar
        mostrarModalImprimirOrden(
          function() { // Sí imprimir
            generarReciboYImprimir();
            setTimeout(() => { modificarPedido(contrasena); }, 1000);
          },
          function() { // No imprimir
            modificarPedido(contrasena);
          }
        );
      });
    };

    // Nueva función para modificar el pedido (solo si la contraseña fue correcta y no se canceló nada)
    function modificarPedido(contrasena) {
      // Validar artículos
      for (const item of items) {
        if (!item.nombre || item.cantidad <= 0 || item.valorU < 0) {
          messageDiv.textContent = 'Complete correctamente los datos de los artículos.';
          messageDiv.style.color = 'red';
          return;
        }
        if (typeof item.valorC === 'undefined' || item.valorC === null) {
          item.valorC = 0;
        }
        // Asegurar que categoria nunca sea undefined y siempre actualizada
        if (item.nombre && articulosPorNombre[item.nombre]) {
          item.categoria = articulosPorNombre[item.nombre][0] || '';
        } else {
          item.categoria = '';
        }
      }
      // Procesar y guardar subtotal y total como enteros (solo dígitos)
      function onlyDigits(str) {
        return (str + '').replace(/\D/g, '');
      }
      const subtotal = parseInt(onlyDigits(form.subtotal.value), 10) || 0;
      const totalFinal = parseInt(onlyDigits(form.totalFinal.value), 10) || 0;
      const recargo = parseInt(onlyDigits(form.recargo.value), 10) || 0;
      const descuento = parseInt(onlyDigits(form.descuento.value), 10) || 0;
      const envio = parseInt(onlyDigits(form.envio.value), 10) || 0;
      const nota = form.nota ? form.nota.value.trim() : '';
      const vendedor = form.vendedor ? form.vendedor.value.trim() : '';
      // Obtener cotización blue en tiempo real
      fetch('https://api.bluelytics.com.ar/v2/latest')
        .then(r => r.json())
        .then(d => {
          let cotizacionCierre = (d.blue.value_sell || d.blue.sell) + 10;
          const costos = calcularCostos();
          // Determinar tipo de entrega
          let entrega = 'Local';
          if (form.direccion.value.trim() && form.direccion.value.trim().length > 7) {
            entrega = 'Envios';
          }
          const pedidoObj = {
            timestamp: Date.now(),
            locked: false,
            adminViewed: true,
            cliente: { nombre: form.nombre.value.trim(), telefono: form.telefono.value.trim(), direccion: form.direccion.value.trim(), dni: form.dni.value.trim(), email: form.email.value.trim().toLowerCase(), tipoCliente: document.querySelector('input[name="tipoCliente"]:checked')?.value || '' },
            items: items.map(it => ({ codigo: it.codigo, nombre: it.nombre, cantidad: it.cantidad, valorU: it.valorU, valorC: it.valorC, categoria: it.categoria })),
            pagos: {
              medioPago: form.medioPago.value,
              recargo,
              descuento,
              envio,
              subtotal,
              totalFinal,
              costos,
              ganancia: subtotal - costos
            },
            status: 'DESPACHADO/ENTREGADO',
            cotizacionCierre: cotizacionCierre,
            costoUSD: costos / cotizacionCierre,
            createdby: 'admin',
            entrega,
            nota,
            vendedor,
            lastOrderUpdate: contrasena
          };
          // CONSERVAR fecha original si existe
          db.ref('pedidos/' + pedidoId).once('value').then(snap => {
            const pedido = snap.val();
            if (pedido && pedido.fecha) {
              pedidoObj.fecha = pedido.fecha;
            }
            db.ref('pedidos/' + pedidoId).set(pedidoObj)
              .then(() => {
                // Registrar movimientos de inventario también en edición
                registrarMovimientosInventario(items, pedidoObj.cotizacionCierre, pedidoId);
                messageDiv.textContent = 'Pedido actualizado correctamente.';
                messageDiv.style.color = 'green';
                setTimeout(() => {
                  if (window.opener && !window.opener.closed) {
                    window.opener.location.reload();
                    window.close();
                  } else {
                    window.location.href = 'ingresoPedido.html';
                  }
                }, 1200);
              })
              .catch(err => {
                messageDiv.textContent = 'Error al actualizar el pedido.';
                messageDiv.style.color = 'red';
              });
          });
        })
        .catch(() => {
          messageDiv.textContent = 'No se pudo obtener la cotización del dólar blue.';
          messageDiv.style.color = 'red';
        });
    }
  }

  // Hacer campos de cliente solo lectura (excepto nombre)
  form.telefono.readOnly = true;
  form.direccion.readOnly = true;
  form.dni.readOnly = true;
  form.email.readOnly = true;

  // Botón Editar Cliente
  const editarClienteBtn = document.getElementById('editarClienteBtn');
  if (editarClienteBtn) {
    editarClienteBtn.onclick = function() {
      // Obtener datos actuales del formulario
      const nombre = form.nombre.value.trim();
      const telefono = form.telefono.value.trim();
      const direccion = form.direccion.value.trim();
      const dni = form.dni.value.trim();
      const email = form.email.value.trim();
      let tipoCliente = 'consumidor final';
      const tipoRadio = document.querySelector('input[name="tipoCliente"]:checked');
      if (tipoRadio) tipoCliente = tipoRadio.value;
      mostrarModalRegistroCliente(nombre, telefono, direccion, dni, email, tipoCliente, true);
      // Forzar display flex para asegurar que el modal esté visible
      const modal = document.getElementById('modalRegistroCliente');
      if (modal) modal.style.display = 'flex';
    };
    // Soporte teclado: Enter abre modal, Escape cierra modal si está abierto o blurea el botón
    editarClienteBtn.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        editarClienteBtn.click();
      } else if (e.key === 'Escape') {
        // Si el modal está abierto, ciérralo
        const modal = document.getElementById('modalRegistroCliente');
        if (modal && (modal.style.display === 'flex' || modal.style.display === '')) {
          const cancelarBtn = modal.querySelector('#cancelarNuevoCliente');
          if (cancelarBtn) cancelarBtn.click();
        } else {
          // Si no hay modal, blurea el botón
          editarClienteBtn.blur();
        }
      }
    });
  }

  // Detectar cambio de medio de pago y aplicar recargo automático si corresponde
  function actualizarRecargoAutomatico() {
    if (form.medioPago.value === 'MercadoPago') {
      let subtotal = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0);
      let recargo = Math.round(subtotal * 0.06);
      recargoInput.value = recargo.toLocaleString('es-AR', {maximumFractionDigits:0});
      // recargoInput.readOnly = true; // Ahora siempre editable
    } else if (form.medioPago.value === 'Transferencia') {
      let subtotal = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0);
      let recargo = Math.round(subtotal * 0.02);
      recargoInput.value = recargo.toLocaleString('es-AR', {maximumFractionDigits:0});
      // recargoInput.readOnly = true; // Ahora siempre editable
    } else {
      // recargoInput.readOnly = false; // Siempre editable
      recargoInput.value = '';
    }
  }

  form.medioPago.addEventListener('change', function() {
    actualizarRecargoAutomatico();
    calcularTotalFinal();
  });

  // Actualizar recargo automáticamente si está MercadoPago o Transferencia y cambia el subtotal
  function recalcularYActualizarRecargoSiMedioPago() {
    if (form.medioPago.value === 'MercadoPago' || form.medioPago.value === 'Transferencia') {
      actualizarRecargoAutomatico();
      calcularTotalFinal();
    }
  }

  // Llamar a la función después de cada cambio relevante
  // Al agregar/quitar/modificar artículos
  // Al modificar valores manualmente
  itemsBody.addEventListener('input', recalcularYActualizarRecargoSiMedioPago);
  // Al modificar descuentos/envío
  [descuentoInput, envioInput].forEach(input => {
    input.addEventListener('input', recalcularYActualizarRecargoSiMedioPago);
  });

  // === Calcular Costos ===
  function calcularCostos() {
    let costos = 0;
    items.forEach(item => {
      if (item.nombre && articulosPorNombre[item.nombre]) {
        const art = articulosPorNombre[item.nombre];
        // Columna H = índice 7
        let costoRaw = art[7] || '0';
        costoRaw = costoRaw.replace(/\$/g, '').replace(/[.,]/g, '');
        const costoUnitario = parseInt(costoRaw) || 0;
        costos += costoUnitario * (item.cantidad || 0);
      }
    });
    return costos;
  }

  // === CLIENTES: Autocompletar y registro ===
let clientesRegistrados = [];
let clientesPorNombre = {};

// Crear datalist para autocompletar nombre
let datalistClientes = document.getElementById('clientesDatalist');
if (!datalistClientes) {
  datalistClientes = document.createElement('datalist');
  datalistClientes.id = 'clientesDatalist';
  document.body.appendChild(datalistClientes);
}
form.nombre.setAttribute('list', 'clientesDatalist');

// Cargar clientes desde Firebase
function cargarClientes() {
  db.ref('clientes').once('value').then(snap => {
    clientesRegistrados = [];
    clientesPorNombre = {};
    datalistClientes.innerHTML = '';
    snap.forEach(child => {
      const cli = child.val();
      if (cli && cli.nombre) {
        clientesRegistrados.push(cli);
        clientesPorNombre[cli.nombre.toLowerCase()] = cli;
        const opt = document.createElement('option');
        opt.value = cli.nombre;
        datalistClientes.appendChild(opt);
      }
    });
  });
}
cargarClientes();

// Al salir del input nombre, validar si existe
form.nombre.addEventListener('blur', function() {
  const nombre = form.nombre.value.trim().toLowerCase();
  if (!nombre) return;
  if (clientesPorNombre[nombre]) {
    // Autocompletar datos
    const cli = clientesPorNombre[nombre];
    form.telefono.value = cli.telefono || '';
    form.direccion.value = cli.direccion || '';
    form.dni.value = cli.dni || '';
    form.email.value = cli.email || '';
    // Restaurar tipoCliente si existe
    if (cli.tipoCliente) {
      const radio = document.querySelector(`input[name="tipoCliente"][value="${cli.tipoCliente}"]`);
      if (radio) radio.checked = true;
      tipoCliente = cli.tipoCliente; // <-- ACTUALIZAR VARIABLE INTERNA
    }
  } else {
    // Mostrar modal para registrar cliente
    mostrarModalRegistroCliente(form.nombre.value.trim());
  }
});

// Modal vistoso para registrar o editar cliente
function mostrarModalRegistroCliente(nombrePrellenado = '', telefonoPrellenado, direccionPrellenado, dniPrellenado, emailPrellenado, tipoClientePrellenado = 'consumidor final', esEdicion = false) {
  let modal = document.getElementById('modalRegistroCliente');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalRegistroCliente';
    modal.innerHTML = `
      <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;">
        <div style="background:#fff;padding:32px 24px;border-radius:12px;box-shadow:0 4px 32px #0002;min-width:320px;max-width:90vw;">
          <h2 style='color:#6c4eb6;margin-bottom:16px;'>${esEdicion ? 'Editar cliente' : 'Registrar nuevo cliente'}</h2>
          <form id='formNuevoCliente'>
            <div style='margin-bottom:10px;'><input type='text' name='nombre' placeholder='Nombre' required style='width:95%;padding:8px;' value="${nombrePrellenado||''}"></div>
            <div style='margin-bottom:10px;'><input type='text' name='telefono' placeholder='Teléfono' style='width:95%;padding:8px;' value="${telefonoPrellenado||''}"></div>
            <div style='margin-bottom:10px;'><input type='text' name='direccion' placeholder='Dirección' style='width:95%;padding:8px;' value="${direccionPrellenado||''}"></div>
            <div style='margin-bottom:10px;'><input type='text' name='dni' placeholder='DNI' style='width:95%;padding:8px;' value="${dniPrellenado||''}"></div>
            <div style='margin-bottom:10px;'><input type='email' name='email' placeholder='Email' style='width:95%;padding:8px;' value="${emailPrellenado||''}"></div>
            <div style='margin-bottom:10px;display:flex;align-items:center;gap:10px;'>
              <label style='font-weight:bold;'>Tipo de Cliente:</label>
              <label style='margin-left:10px;'><input type='radio' name='tipoClienteModal' value='consumidor final' ${tipoClientePrellenado === 'consumidor final' ? 'checked' : ''}> Consumidor</label>
              <label style='margin-left:10px;'><input type='radio' name='tipoClienteModal' value='mayorista' ${tipoClientePrellenado === 'mayorista' ? 'checked' : ''}> Mayorista</label>
            </div>
            <div style='display:flex;gap:10px;justify-content:flex-end;'>
              <button type='button' id='cancelarNuevoCliente' style='background:#eee;color:#333;padding:8px 16px;border:none;border-radius:4px;'>Cancelar</button>
              <button type='submit' style='background:#6c4eb6;color:#fff;padding:8px 16px;border:none;border-radius:4px;'>${esEdicion ? 'Guardar' : 'Registrar'}</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    modal.style.display = 'flex';
    modal.querySelector('input[name="nombre"]').value = nombrePrellenado||'';
    if (typeof telefonoPrellenado !== 'undefined') modal.querySelector('input[name="telefono"]').value = telefonoPrellenado||'';
    if (typeof direccionPrellenado !== 'undefined') modal.querySelector('input[name="direccion"]').value = direccionPrellenado||'';
    if (typeof dniPrellenado !== 'undefined') modal.querySelector('input[name="dni"]').value = dniPrellenado||'';
    if (typeof emailPrellenado !== 'undefined') modal.querySelector('input[name="email"]').value = emailPrellenado||'';
    const tipoClienteRadio = modal.querySelectorAll('input[name="tipoClienteModal"]');
    tipoClienteRadio.forEach(radio => {
      radio.checked = (radio.value === tipoClientePrellenado);
    });
    // Cambiar título y botón
    modal.querySelector('h2').textContent = esEdicion ? 'Editar cliente' : 'Registrar nuevo cliente';
    modal.querySelector('button[type="submit"]').textContent = esEdicion ? 'Guardar' : 'Registrar';
  }
  // Cancelar
  modal.querySelector('#cancelarNuevoCliente').onclick = function() {
    modal.remove();
    cleanup();
  };
  // Registrar/Guardar
  modal.querySelector('#formNuevoCliente').onsubmit = function(e) {
    e.preventDefault();
    const nombre = this.nombre.value.trim();
    let tipoCliente = 'consumidor final';
    const tipoRadio = this.querySelector('input[name="tipoClienteModal"]:checked');
    if (tipoRadio) tipoCliente = tipoRadio.value;
    if (!nombre || !tipoCliente) return;
    // Si es edición, actualiza el cliente en Firebase si existe
    if (esEdicion) {
      // Buscar el cliente por nombre (case-insensitive)
      const nombreKey = nombre.toLowerCase();
      let clienteId = null;
      let clienteEncontrado = null;
      // Buscar el id del cliente en el snapshot cargado
      db.ref('clientes').once('value').then(snap => {
        snap.forEach(child => {
          const cli = child.val();
          if (cli && cli.nombre && cli.nombre.toLowerCase() === nombreKey) {
            clienteId = child.key;
            clienteEncontrado = cli;
          }
        });
        if (clienteId) {
          db.ref('clientes/' + clienteId).update({ nombre, telefono: this.telefono.value.trim(), direccion: this.direccion.value.trim(), dni: this.dni.value.trim(), email: this.email.value.trim(), tipoCliente })
            .then(() => {
              cargarClientes();
              form.nombre.value = nombre;
              form.telefono.value = this.telefono.value.trim();
              form.direccion.value = this.direccion.value.trim();
              form.dni.value = this.dni.value.trim();
              form.email.value = this.email.value.trim();
              if (tipoCliente) {
                const radio = document.querySelector(`input[name="tipoCliente"][value="${tipoCliente}"]`);
                if (radio) radio.checked = true;
                tipoCliente = tipoCliente; // <-- ACTUALIZAR VARIABLE INTERNA
              }
              modal.remove();
            });
        } else {
          // Si no existe, solo actualiza el formulario
          form.nombre.value = nombre;
          form.telefono.value = this.telefono.value.trim();
          form.direccion.value = this.direccion.value.trim();
          form.dni.value = this.dni.value.trim();
          form.email.value = this.email.value.trim();
          if (tipoCliente) {
            const radio = document.querySelector(`input[name="tipoCliente"][value="${tipoCliente}"]`);
            if (radio) radio.checked = true;
            tipoCliente = tipoCliente; // <-- ACTUALIZAR VARIABLE INTERNA
          }
          modal.remove();
        }
      });
      return;
    }
    // Guardar en Firebase
    db.ref('clientes').push({ nombre, telefono: this.telefono.value.trim(), direccion: this.direccion.value.trim(), dni: this.dni.value.trim(), email: this.email.value.trim(), tipoCliente })
      .then(() => {
        cargarClientes();
        form.nombre.value = nombre;
        form.telefono.value = this.telefono.value.trim();
        form.direccion.value = this.direccion.value.trim();
        form.dni.value = this.dni.value.trim();
        form.email.value = this.email.value.trim();
        if (tipoCliente) {
          const radio = document.querySelector(`input[name="tipoCliente"][value="${tipoCliente}"]`);
          if (radio) radio.checked = true;
        }
        modal.remove();
      });
  };
  // Soporte Enter/Escape
  function keyHandler(e) {
    if (modal.style.display !== 'flex') return;
    // Solo confirmar con Enter si el foco está en un input o textarea
    if (e.key === 'Enter' && document.activeElement.tagName !== 'BUTTON') {
      modal.querySelector('button[type="submit"]').click();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      modal.querySelector('#cancelarNuevoCliente').click();
      e.preventDefault();
    }
  }
  function cleanup() {
    document.removeEventListener('keydown', keyHandler);
  }
  document.addEventListener('keydown', keyHandler);
}

// Botón Imprimir
  const imprimirBtn = document.querySelector('.actions button.secondary');
  if (imprimirBtn) {
    imprimirBtn.addEventListener('click', function() {
      generarReciboYImprimir();
    });
  }

  function generarReciboYImprimir() {
    // Obtener datos del formulario
    const nombre = form.nombre.value.trim();
    const telefono = form.telefono.value.trim();
    const direccion = form.direccion.value.trim();
    const dni = form.dni.value.trim();
    const email = form.email.value.trim();
    const tipoCliente = document.querySelector('input[name="tipoCliente"]:checked')?.value || '';
    const medioPago = form.medioPago.value;
    const subtotal = form.subtotal.value;
    const recargo = form.recargo.value;
    const descuento = form.descuento.value;
    const envio = form.envio.value;
    const totalFinal = form.totalFinal.value;
    // Items
    let itemsHtml = '';
    items.forEach(it => {
      itemsHtml += `<tr><td>${it.codigo||''}</td><td>${it.nombre||''}</td><td style='text-align:right;'>${it.cantidad||''}</td><td style='text-align:right;'>${it.valorU||''}</td><td style='text-align:right;'>${(it.cantidad*it.valorU)||''}</td></tr>`;
    });
    // Recibo HTML
    const reciboHtml = `
      <html>
      <head>
        <title>Orden de Pedido</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; color: #111; background: #fff; }
          .recibo-box { margin: 0 auto; border: 1px dashed #333; padding: 24px 18px; background: #fff; }
          h2 { text-align: left; font-size: 1.3em; margin: 0 0 12px 0; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { border-bottom: 1px dotted #aaa; padding: 4px 2px; font-size: 0.90em; }
          th { background: #eee; font-weight: bold; text-align: left; }
          .totales td { border: none; font-weight: bold; }
          .label { width: 110px; display: inline-block; }
          @media print { button { display: none !important; } }
        </style>
      </head>
      <body>
        <div class='recibo-box'>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <h2 style="margin:0;">Orden de Pedido</h2>
            <img src="logo.png" alt="Logo" style="height:48px;max-width:180px;object-fit:contain;">
          </div>
          <div style="font-size:0.90em; margin-bottom: 5px;">${new Date().toLocaleString('es-AR', { hour12: false })}</div>
          <div><span class='label'>Nombre:</span> ${nombre}</div>
          <div><span class='label'>Teléfono:</span> ${telefono}</div>
          <div><span class='label'>Dirección:</span> ${direccion}</div>
          <div><span class='label'>DNI:</span> ${dni}</div>
          <div><span class='label'>Email:</span> ${email}</div>
          <div><span class='label'>Tipo:</span> ${tipoCliente}</div>
          <hr style='margin:10px 0;'>
          <table>
            <thead>
              <tr><th>Cod</th><th>Artículo</th><th>Cant</th><th>Valor</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <table>
            <tr class='totales'><td>Subtotal</td><td style='text-align:right;'>${subtotal}</td></tr>
            <tr class='totales'><td>Medio de Pago</td><td style='text-align:right;'>${medioPago}</td></tr>
            <tr class='totales'><td>Recargo</td><td style='text-align:right;'>${recargo}</td></tr>
            <tr class='totales'><td>Descuento</td><td style='text-align:right;'>${descuento}</td></tr>
            <tr class='totales'><td>Costo de Envío</td><td style='text-align:right;'>${envio}</td></tr>
            <tr class='totales'><td>Total</td><td style='text-align:right;font-size:1.1em;'>${totalFinal}</td></tr>
          </table>
        </div>
        <script>window.onload = function(){ window.print(); }<\/script>
      </body>
      </html>
    `;
    // Abrir ventana e imprimir
    const w = window.open('', '_blank', 'width=600,height=800');
    w.document.write(reciboHtml);
    w.document.close();
  }

  // Inicializar tabla vacía
  renderItems();

  // Mostrar/ocultar comprobante de transferencia según medio de pago
  function actualizarVisibilidadComprobanteTransferencia() {
    const comprobanteRow = document.getElementById('comprobanteRow');
    if (!comprobanteRow) return;
    if (form.medioPago.value === 'Transferencia') {
      comprobanteRow.style.display = '';
    } else {
      comprobanteRow.style.display = 'none';
    }
  }
  // Ejecutar al cargar
  actualizarVisibilidadComprobanteTransferencia();
  // Ejecutar al cambiar medio de pago
  form.medioPago.addEventListener('change', actualizarVisibilidadComprobanteTransferencia);

  // === MODAL CONTRASEÑA PARA MODIFICAR PEDIDO ===
  // Agregar estilos para el modal de contraseña (extraído del HTML de eliminación)
  const styleModalPassword = document.createElement('style');
  styleModalPassword.innerHTML = `
    #modalPassword {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.3);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    #modalPassword > div {
      background: #fff;
      border-radius: 8px;
      padding: 24px;
      min-width: 300px;
      box-shadow: 0 2px 16px #0002;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    #modalPassword input[type="password"] {
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #ccc;
      margin-bottom: 16px;
      width: 100%;
    }
    #modalPassword .modal-btns {
      display: flex;
      gap: 10px;
    }
    #modalPassword .modal-btns button {
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      cursor: pointer;
    }
    #modalPassword .modal-btns .eliminar {
      background: #f44336;
    }
    #modalPassword .modal-btns .cancelar {
      background: #888;
    }
    #modalPassword .msg-error {
      color: #f44336;
      margin-top: 10px;
      display: none;
    }
  `;
  document.head.appendChild(styleModalPassword);

  function mostrarModalPasswordEdicion(onConfirm) {
    let modal = document.getElementById('modalPassword');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalPassword';
      modal.innerHTML = `
        <div>
          <h3 style="color:#4b2e83; margin-bottom:16px;">Confirmar modificación</h3>
          <p style="margin-bottom:12px; color:#333;">Ingrese la contraseña para modificar el pedido:</p>
          <input id="inputPasswordEdicion" type="password" placeholder="Contraseña">
          <div class="modal-btns">
            <button id="btnConfirmarEdicion" class="eliminar">Modificar</button>
            <button id="btnCancelarEdicion" class="cancelar">Cancelar</button>
          </div>
          <span id="msgPasswordErrorEdicion" class="msg-error">Contraseña incorrecta</span>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      modal.style.display = 'flex';
      modal.querySelector('#inputPasswordEdicion').value = '';
      modal.querySelector('#msgPasswordErrorEdicion').style.display = 'none';
    }
    modal.style.display = 'flex';
    const input = modal.querySelector('#inputPasswordEdicion');
    input.focus();
    // Bandera para evitar doble ejecución
    let accionRealizada = false;
    function keyHandler(e) {
      if (modal.style.display !== 'flex') return;
      if (e.key === 'Enter') {
        modal.querySelector('#btnConfirmarEdicion').click();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        modal.querySelector('#btnCancelarEdicion').click();
        e.preventDefault();
      }
    }
    document.addEventListener('keydown', keyHandler);
    function cleanup() {
      document.removeEventListener('keydown', keyHandler);
    }
    modal.querySelector('#btnConfirmarEdicion').onclick = function() {
      if (accionRealizada) return;
      const pass = input.value;
      if (pass !== '3469' && pass !== '1234') {
        modal.querySelector('#msgPasswordErrorEdicion').style.display = 'block';
        return; // Detener aquí, no llamar onConfirm
      }
      accionRealizada = true;
      modal.style.display = 'none';
      cleanup();
      onConfirm(pass);
    };
    modal.querySelector('#btnCancelarEdicion').onclick = function() {
      if (accionRealizada) return;
      accionRealizada = true;
      modal.style.display = 'none';
      cleanup();
      // No llamar onConfirm, solo cerrar y detener
    };
  }

  // --- REGISTRO DE MOVIMIENTOS DE INVENTARIO ---
  function registrarMovimientosInventario(items, cotizacionCierre, pedidoId) {
    if (!Array.isArray(items) || !cotizacionCierre || !pedidoId) return;
    // 1. Eliminar movimientos previos de este pedido (por pedidoId)
    db.ref('movimientos').orderByChild('pedidoId').equalTo(pedidoId).once('value', function(snapshot) {
      const updates = {};
      snapshot.forEach(child => {
        updates[child.key] = null;
      });
      if (Object.keys(updates).length > 0) {
        db.ref('movimientos').update(updates).catch(err => {
          console.error('Error eliminando movimientos previos:', err, updates);
        });
      }
      // 2. Registrar los nuevos movimientos
      items.forEach((item) => {
        try {
          if (!item || !item.codigo || !item.nombre || !item.cantidad || !item.valorU) return;
          const timestamp = new Date().toISOString();
          const now = new Date();
          const pad = n => n.toString().padStart(2, '0');
          const id = `mov_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}_${item.codigo}_${pedidoId}`;
          const movimiento = {
            timestamp: timestamp,
            codigo: item.codigo,
            nombre: item.nombre,
            cantidad: parseInt(item.cantidad, 10) || 0,
            valorC: parseInt(item.valorC, 10) || 0,
            valorU: parseInt(item.valorU, 10) || 0,
            cotizacionCierre: cotizacionCierre,
            tipo: 'SALIDA',
            pedidoId: pedidoId
          };
          db.ref('movimientos/' + id).set(movimiento)
            .catch(err => {
              console.error('Error registrando movimiento de inventario:', err, movimiento);
            });
        } catch (err) {
          console.error('Error inesperado al registrar movimiento de inventario:', err, item);
        }
      });
    });
  }
});
