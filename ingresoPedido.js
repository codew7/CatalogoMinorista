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

  function renderItems() {
    itemsBody.innerHTML = '';
    let subtotal = 0;
    items.forEach((item, idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><input type="text" value="${item.codigo}" class="codigo" maxlength="20" style="width:80px"></td>
        <td><input type="text" value="${item.nombre}" class="nombre" maxlength="50"></td>
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
    items[idx].nombre = row.querySelector('.nombre').value;
    items[idx].cantidad = parseInt(row.querySelector('.cantidad').value) || 1;
    items[idx].valorU = parseFloat(row.querySelector('.valorU').value) || 0;
    renderItems();
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

    if (!nombre || !telefono || !direccion || !dni || !email || !medioPago) {
      messageDiv.textContent = 'Por favor complete todos los campos obligatorios.';
      messageDiv.style.color = 'red';
      return;
    }
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
