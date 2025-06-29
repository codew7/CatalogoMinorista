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
      radiosTipoCliente.forEach(radio => radio.disabled = false);
    })
    .catch(() => {
      // Si falla la carga, mantener controles deshabilitados
      addItemBtn.disabled = true;
      radiosTipoCliente.forEach(radio => radio.disabled = true);
    });

  // Variable para el tipo de cliente
    let tipoCliente = 'consumidor final';
    document.addEventListener('change', function(e) {
    if (e.target.name === 'tipoCliente') {
        tipoCliente = e.target.value;
        // Actualizar todos los valores unitarios de los artículos seleccionados
        items.forEach((item, idx) => {
        if (item.nombre && articulosPorNombre[item.nombre]) {
            const art = articulosPorNombre[item.nombre];
            // Usar columna 4 (índice 4) para consumidor final, columna 6 (índice 6) para mayorista
            let valorRaw = tipoCliente === 'consumidor final' ? (art[4] || '0') : (art[6] || '0');
            // Eliminar signos de $ y separadores de mil (coma o punto)
            valorRaw = valorRaw.replace(/\$/g, '').replace(/[.,]/g, '');
            items[idx].valorU = parseInt(valorRaw) || 0;
        }
        });
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
      row.innerHTML = `
        <td><input type="text" value="${item.codigo || ''}" class="codigo" maxlength="20" style="width:80px" readonly></td>
        <td>
          <select class="nombre-select" data-idx="${idx}" style="width:220px">
            <option value="">Seleccione artículo</option>
            ${articulosDisponibles.map(art => `<option value="${art[3]}"${item.nombre === art[3] ? ' selected' : ''}>${art[3]}</option>`).join('')}
          </select>
        </td>
        <td><input type="number" value="${item.cantidad}" class="cantidad" min="1" style="width:60px"></td>
        <td><input type="text" value="${item.valorU}" class="valorU" min="0" step="1" style="width:80px"></td>
        <td class="valorTotal">${(item.cantidad * item.valorU).toLocaleString('es-AR', {maximumFractionDigits:0})}</td>
        <td><button type="button" class="remove-btn" data-idx="${idx}" style="background:#d32f2f;color:#fff;border:none;border-radius:4px;width:32px;height:32px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Eliminar"><span style="font-weight:bold;font-size:20px;line-height:1;">&times;</span></button></td>
      `;
      itemsBody.appendChild(row);
      // --- NUEVO: Calcular valorU y valorC automáticamente si hay artículo seleccionado ---
      if (item.nombre && articulosPorNombre[item.nombre]) {
        const art = articulosPorNombre[item.nombre];
        let valorRaw = tipoCliente === 'consumidor final' ? (art[4] || '0') : (art[6] || '0');
        valorRaw = valorRaw.replace(/\$/g, '').replace(/[.,]/g, '');
        const valorU = parseInt(valorRaw) || 0;
        // Nuevo: valorC desde columna H (índice 7)
        let valorCRaw = art[7] || '0';
        valorCRaw = valorCRaw.replace(/\$/g, '').replace(/[.,]/g, '');
        const valorC = parseInt(valorCRaw) || 0;
        if (item.valorU !== valorU || item.valorC !== valorC) {
          item.valorU = valorU;
          item.valorC = valorC;
          row.querySelector('.valorU').value = valorU;
          row.querySelector('.valorTotal').textContent = (item.cantidad * valorU).toLocaleString('es-AR', {maximumFractionDigits:0});
        }
      }
      subtotal += item.cantidad * item.valorU;
    });
    subtotalInput.value = subtotal.toLocaleString('es-AR', {maximumFractionDigits:0});
    calcularTotalFinal();
    recalcularYActualizarRecargoSiMercadoPago();
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
          // Usar columna 4 (índice 4) para consumidor final, columna 6 (índice 6) para mayorista
          let valorRaw = tipoCliente === 'consumidor final' ? (art[4] || '0') : (art[6] || '0');
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
    items.push({ codigo: '', nombre: '', cantidad: 1, valorU: 0, valorC: 0 }); // valorC inicializado
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
    let valorUraw = row.querySelector('.valorU').value.replace(/,/g, '');
    items[idx].valorU = parseInt(valorUraw) || 0;
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

  // Modal de confirmación para imprimir
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
    box.querySelector('#btnImprimirSi').onclick = () => {
      overlay.remove();
      onSi();
    };
    box.querySelector('#btnImprimirNo').onclick = () => {
      overlay.remove();
      onNo();
    };
  }

  form.addEventListener('submit', function(e) {
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
    // Validar campos cliente
    const nombre = form.nombre.value.trim();
    const telefono = form.telefono.value.trim();
    const direccion = form.direccion.value.trim();
    const dni = form.dni.value.trim();
    const email = form.email.value.trim().toLowerCase();
    const medioPago = form.medioPago.value;

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
    const vendedor = form.vendedor ? form.vendedor.value.trim() : '';
    // Obtener archivo comprobante
    const comprobanteInput = document.getElementById('comprobante');
    const archivo = comprobanteInput && comprobanteInput.files[0];

    // Validar campos obligatorios
    //if (!nombre || !medioPago || !tipoCliente) {
    //  messageDiv.textContent = 'Por favor complete todos los campos obligatorios.';
    //  messageDiv.style.color = 'red';
    //  return;
    //}

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
    }
    // Si hay archivo, subir primero y luego continuar con fetch
    if (archivo) {
      const storageRef = firebase.storage().ref();
      const comprobanteRef = storageRef.child('comprobantes/' + Date.now() + '_' + archivo.name);
      comprobanteRef.put(archivo).then(snapshot => {
        return snapshot.ref.getDownloadURL();
      }).then(url => {
        // Guardar la URL y luego continuar con fetch
        continuarIngresoPedido(url);
      }).catch(() => {
        showPopup('Error al subir el comprobante.', '❌', false);
      });
    } else {
      continuarIngresoPedido();
    }

    function continuarIngresoPedido(comprobanteUrl) {
      fetch('https://api.bluelytics.com.ar/v2/latest')
        .then(r => r.json())
        .then(d => {
          let cotizacionCierre = (d.blue.value_sell || d.blue.sell) + 10;
          const costos = calcularCostos();
          let entrega = 'Local';
          if (direccion && direccion.length > 3) {
            entrega = 'Envios';
          }
          const pedidoObj = {
            timestamp: Date.now(),
            locked: false,
            adminViewed: true,
            cliente: { nombre, telefono, direccion, dni, email, tipoCliente },
            items: items.map(it => ({ codigo: it.codigo, nombre: it.nombre, cantidad: it.cantidad, valorU: it.valorU, valorC: it.valorC })),
            pagos: {
              medioPago,
              recargo,
              descuento,
              envio,
              subtotal,
              totalFinal
            },
            costos,
            status: 'DESPACHADO/ENTREGADO',
            cotizacionCierre: cotizacionCierre,
            costoUSD: costos / cotizacionCierre,
            createdby: 'admin',
            entrega,
            nota,
            vendedor
          };
          if (comprobanteUrl) pedidoObj.comprobanteUrl = comprobanteUrl;
          // ...guardarPedidoFinal como antes...
          function guardarPedidoFinal(pedidoObj) {
            if (pedidoId) {
              const pass = prompt('Ingrese la contraseña para modificar el pedido:');
              if (pass !== '3469' && pass !== '1234') {
                messageDiv.textContent = 'Contraseña incorrecta. No se guardaron los cambios.';
                messageDiv.style.color = 'red';
                return;
              }
              db.ref('pedidos/' + pedidoId).once('value').then(snap => {
                const pedidoAnterior = snap.val();
                if (pedidoAnterior && pedidoAnterior.Orden) {
                  pedidoObj.Orden = pedidoAnterior.Orden;
                }
                if (pass === '3469') {
                  pedidoObj.userOrderModif = 'Admin';
                } else if (pass === '1234') {
                  pedidoObj.userOrderModif = 'Vendedor';
                }
                db.ref('pedidos/' + pedidoId).set(pedidoObj)
                  .then(() => {
                    messageDiv.textContent = 'Pedido modificado correctamente.';
                    messageDiv.style.color = 'green';
                    setTimeout(() => {
                      window.location.href = 'ingresoPedido.html';
                    }, 1000);
                    form.reset();
                    items = [];
                    renderItems();
                    const submitBtn = form.querySelector('button[type="submit"]');
                    if (submitBtn) submitBtn.textContent = 'Ingresar Orden';
                  })
                  .catch(err => {
                    messageDiv.textContent = 'Error al actualizar el pedido.';
                    messageDiv.style.color = 'red';
                  });
              });
            } else {
              db.ref('pedidos').orderByChild('Orden').limitToLast(1).once('value', function(snapshot) {
                let lastOrden = 0;
                snapshot.forEach(function(child) {
                  if (child.val() && child.val().Orden) {
                    lastOrden = parseInt(child.val().Orden, 10) || 0;
                  }
                });
                pedidoObj.Orden = lastOrden + 1;
                db.ref('pedidos').push(pedidoObj)
                  .then(() => {
                    showPopup('Pedido ingresado', '✅', true);
                    form.reset();
                    items = [];
                    renderItems();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  })
                  .catch(err => {
                    showPopup('Error al guardar el pedido.', '❌', false);
                  });
              });
            }
          }
          guardarPedidoFinal(pedidoObj);
        })
        .catch(() => {
          showPopup('No se pudo obtener la cotización del dólar blue.', '❌', false);
        });
    }
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
        if (radio) radio.checked = true;
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
    });
    // Cambiar el texto del botón submit a "Modificar"
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Modificar';
    // Cambiar el submit para actualizar en vez de crear
    form.onsubmit = function(e) {
      e.preventDefault();
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
            items: items.map(it => ({ codigo: it.codigo, nombre: it.nombre, cantidad: it.cantidad, valorU: it.valorU, valorC: it.valorC })),
            pagos: {
              medioPago: form.medioPago.value,
              recargo,
              descuento,
              envio,
              subtotal,
              totalFinal
            },
            costos,
            status: 'DESPACHADO/ENTREGADO',
            cotizacionCierre: cotizacionCierre,
            costoUSD: costos / cotizacionCierre,
            createdby: 'admin',
            entrega
          };
          db.ref('pedidos/' + pedidoId).set(pedidoObj)
            .then(() => {
              messageDiv.textContent = 'Pedido actualizado correctamente.';
              messageDiv.style.color = 'green';
              setTimeout(() => {
                // Si la ventana fue abierta como popup/edición, cerrarla y recargar la principal
                if (window.opener && !window.opener.closed) {
                  window.opener.location.reload();
                  window.close();
                } else {
                  // Si no es popup, redirigir a ingresoPedido.html limpio
                  window.location.href = 'ingresoPedido.html';
                }
              }, 1200);
            })
            .catch(err => {
              messageDiv.textContent = 'Error al actualizar el pedido.';
              messageDiv.style.color = 'red';
            });
        })
        .catch(() => {
          messageDiv.textContent = 'No se pudo obtener la cotización del dólar blue.';
          messageDiv.style.color = 'red';
        });
    };
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
    };
  }

  // Detectar cambio de medio de pago y aplicar recargo automático si corresponde
  function actualizarRecargoMercadoPago() {
    if (form.medioPago.value === 'MercadoPago') {
      let subtotal = items.reduce((acc, it) => acc + (it.cantidad * it.valorU), 0);
      let recargo = Math.round(subtotal * 0.06);
      recargoInput.value = recargo.toLocaleString('es-AR', {maximumFractionDigits:0});
      recargoInput.readOnly = true;
    }
  }

  form.medioPago.addEventListener('change', function() {
    if (form.medioPago.value === 'MercadoPago') {
      actualizarRecargoMercadoPago();
      calcularTotalFinal();
    } else {
      recargoInput.readOnly = false;
      recargoInput.value = '';
      calcularTotalFinal();
    }
  });

  // Actualizar recargo automáticamente si está MercadoPago y cambia el subtotal
  function recalcularYActualizarRecargoSiMercadoPago() {
    if (form.medioPago.value === 'MercadoPago') {
      actualizarRecargoMercadoPago();
      calcularTotalFinal();
    }
  }

  // Llamar a la función después de cada cambio relevante
  // Al agregar/quitar/modificar artículos
  // Al modificar valores manualmente
  itemsBody.addEventListener('input', recalcularYActualizarRecargoSiMercadoPago);
  // Al modificar descuentos/envío
  [descuentoInput, envioInput].forEach(input => {
    input.addEventListener('input', recalcularYActualizarRecargoSiMercadoPago);
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
    }
  } else {
    // Mostrar modal para registrar cliente
    mostrarModalRegistroCliente(form.nombre.value.trim());
  }
});

// Modal vistoso para registrar o editar cliente
function mostrarModalRegistroCliente(nombrePrellenado = '', telefonoPrellenado = '', direccionPrellenado = '', dniPrellenado = '', emailPrellenado = '', tipoClientePrellenado = 'consumidor final', esEdicion = false) {
  let modal = document.getElementById('modalRegistroCliente');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalRegistroCliente';
    modal.innerHTML = `
      <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:9999;">
        <div style="background:#fff;padding:32px 24px;border-radius:12px;box-shadow:0 4px 32px #0002;min-width:320px;max-width:90vw;">
          <h2 style='color:#6c4eb6;margin-bottom:16px;'>${esEdicion ? 'Editar cliente' : 'Registrar nuevo cliente'}</h2>
          <form id='formNuevoCliente'>
            <div style='margin-bottom:10px;'><input type='text' name='nombre' placeholder='Nombre' required style='width:100%;padding:8px;' value="${nombrePrellenado||''}"></div>
            <div style='margin-bottom:10px;'><input type='text' name='telefono' placeholder='Teléfono' required style='width:100%;padding:8px;' value="${telefonoPrellenado||''}"></div>
            <div style='margin-bottom:10px;'><input type='text' name='direccion' placeholder='Dirección' required style='width:100%;padding:8px;' value="${direccionPrellenado||''}"></div>
            <div style='margin-bottom:10px;'><input type='text' name='dni' placeholder='DNI' required style='width:100%;padding:8px;' value="${dniPrellenado||''}"></div>
            <div style='margin-bottom:10px;'><input type='email' name='email' placeholder='Email' required style='width:100%;padding:8px;' value="${emailPrellenado||''}"></div>
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
    modal.querySelector('input[name="telefono"]').value = telefonoPrellenado||'';
    modal.querySelector('input[name="direccion"]').value = direccionPrellenado||'';
    modal.querySelector('input[name="dni"]').value = dniPrellenado||'';
    modal.querySelector('input[name="email"]').value = emailPrellenado||'';
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
  };
  // Registrar/Guardar
  modal.querySelector('#formNuevoCliente').onsubmit = function(e) {
    e.preventDefault();
    const nombre = this.nombre.value.trim();
    const telefono = this.telefono.value.trim();
    const direccion = this.direccion.value.trim();
    const dni = this.dni.value.trim();
    const email = this.email.value.trim();
    let tipoCliente = 'consumidor final';
    const tipoRadio = this.querySelector('input[name="tipoClienteModal"]:checked');
    if (tipoRadio) tipoCliente = tipoRadio.value;
    if (!nombre || !telefono || !direccion || !dni || !email) return;
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
          db.ref('clientes/' + clienteId).update({ nombre, telefono, direccion, dni, email, tipoCliente })
            .then(() => {
              cargarClientes();
              form.nombre.value = nombre;
              form.telefono.value = telefono;
              form.direccion.value = direccion;
              form.dni.value = dni;
              form.email.value = email;
              if (tipoCliente) {
                const radio = document.querySelector(`input[name="tipoCliente"][value="${tipoCliente}"]`);
                if (radio) radio.checked = true;
              }
              modal.remove();
            });
        } else {
          // Si no existe, solo actualiza el formulario
          form.nombre.value = nombre;
          form.telefono.value = telefono;
          form.direccion.value = direccion;
          form.dni.value = dni;
          form.email.value = email;
          if (tipoCliente) {
            const radio = document.querySelector(`input[name="tipoCliente"][value="${tipoCliente}"]`);
            if (radio) radio.checked = true;
          }
          modal.remove();
        }
      });
      return;
    }
    // Guardar en Firebase
    db.ref('clientes').push({ nombre, telefono, direccion, dni, email, tipoCliente })
      .then(() => {
        cargarClientes();
        form.nombre.value = nombre;
        form.telefono.value = telefono;
        form.direccion.value = direccion;
        form.dni.value = dni;
        form.email.value = email;
        if (tipoCliente) {
          const radio = document.querySelector(`input[name="tipoCliente"][value="${tipoCliente}"]`);
          if (radio) radio.checked = true;
        }
        modal.remove();
      });
  };
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

  // --- INICIALIZAR FIREBASE STORAGE ---
  // Si no está ya inicializado, inicializar Storage (usando compat)
  if (!firebase.storage) {
    // Cargar el SDK de Storage si no está presente
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/firebasejs/9.6.1/firebase-storage-compat.js';
    script.onload = function() {
      // Storage cargado
    };
    document.head.appendChild(script);
  }

  // Inicializar tabla vacía
  renderItems();
});
