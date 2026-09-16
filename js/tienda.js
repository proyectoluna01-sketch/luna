let productosCache = [];
let categoriasCache = [];
let categoriaActiva = null;
let carrito = JSON.parse(localStorage.getItem('carrito_tienda') || '[]');
let telefonoNegocio = null;

document.addEventListener('DOMContentLoaded', async () => {
    await cargarConfigNegocio();
    await cargarCategorias();
    await cargarProductos();
    renderCarrito();
    configurarEventos();
    lucide.createIcons();
});

async function cargarConfigNegocio() {
    const { data } = await sb.from('configuracion_negocio').select('*').eq('id', 1).single();
    if (!data) return;
    document.getElementById('header-nombre').textContent = data.nombre_negocio || 'Tienda';
    document.title = data.nombre_negocio || 'Tienda';
    if (data.logo_url) {
        document.getElementById('header-logo').src = data.logo_url;
        document.getElementById('header-logo').classList.remove('hidden');
    }
    document.getElementById('footer-direccion').textContent = data.direccion || '';
    document.getElementById('footer-telefono').textContent = data.telefono_contacto || '';
    telefonoNegocio = data.telefono_contacto;
}

async function cargarCategorias() {
    const { data } = await sb.from('categorias').select('*').order('nombre');
    categoriasCache = data || [];
    renderCategoriasNav();
}

function renderCategoriasNav() {
    const cont = document.getElementById('lista-categorias-nav');
    const chip = (id, nombre) => `
        <button data-cat="${id ?? ''}" class="chip-categoria px-4 py-1.5 rounded-full text-sm font-medium border transition
            ${categoriaActiva === id ? 'bg-[#B76E79] text-white border-[#B76E79]' : 'bg-white text-[#7D4F58] border-[#F1D9DE] hover:border-[#B76E79]'}">
            ${nombre}
        </button>`;
    cont.innerHTML = chip(null, 'Todos') + categoriasCache.map(c => chip(c.id, c.nombre)).join('');
}

async function cargarProductos() {
    const { data } = await sb.from('productos').select('*, categorias(id, nombre)').order('creado_en', { ascending: false });
    productosCache = data || [];
    renderProductos();
}

function renderProductos() {
    const grid = document.getElementById('grid-productos');
    const sinProductos = document.getElementById('sin-productos');
    const filtrados = categoriaActiva ? productosCache.filter(p => p.categoria_id === categoriaActiva) : productosCache;

    if (filtrados.length === 0) {
        grid.innerHTML = '';
        sinProductos.classList.remove('hidden');
        return;
    }
    sinProductos.classList.add('hidden');

    grid.innerHTML = filtrados.map(p => `
        <div class="tarjeta-producto cursor-pointer group" data-id="${p.id}">
            <div class="aspect-square bg-[#FDF6F7] rounded-xl overflow-hidden mb-3">
                ${p.imagen_url
                    ? `<img src="${p.imagen_url}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">`
                    : `<div class="w-full h-full flex items-center justify-center"><i data-lucide="image" class="h-8 w-8 text-[#E3BFC6]"></i></div>`}
            </div>
            <p class="text-sm text-[#7D4F58] font-medium truncate">${p.nombre}</p>
            <p class="text-[#B76E79] font-semibold">$${parseFloat(p.precio_venta).toFixed(2)}</p>
        </div>
    `).join('');
    lucide.createIcons();
}

let productoModalActual = null;

function abrirModalProducto(id) {
    const p = productosCache.find(x => x.id === id);
    if (!p) return;
    productoModalActual = p;
    document.getElementById('modal-producto-imagen').src = p.imagen_url || '';
    document.getElementById('modal-producto-categoria').textContent = p.categorias?.nombre || '';
    document.getElementById('modal-producto-nombre').textContent = p.nombre;
    document.getElementById('modal-producto-precio').textContent = `$${parseFloat(p.precio_venta).toFixed(2)}`;
    document.getElementById('modal-producto').classList.remove('hidden');
    document.getElementById('modal-producto').classList.add('flex');
}

function cerrarModalProducto() {
    document.getElementById('modal-producto').classList.add('hidden');
    document.getElementById('modal-producto').classList.remove('flex');
}

function guardarCarrito() {
    localStorage.setItem('carrito_tienda', JSON.stringify(carrito));
    renderCarrito();
}

function agregarAlCarrito(producto) {
    const existente = carrito.find(i => i.id === producto.id);
    if (existente) existente.cantidad += 1;
    else carrito.push({ id: producto.id, nombre: producto.nombre, precio: parseFloat(producto.precio_venta), imagen_url: producto.imagen_url, cantidad: 1 });
    guardarCarrito();
    abrirCarrito();
}

function cambiarCantidad(id, delta) {
    const item = carrito.find(i => i.id === id);
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) carrito = carrito.filter(i => i.id !== id);
    guardarCarrito();
}

function renderCarrito() {
    const cont = document.getElementById('items-carrito');
    const contador = document.getElementById('carrito-contador');
    const totalItems = carrito.reduce((acc, i) => acc + i.cantidad, 0);

    if (totalItems > 0) { contador.textContent = totalItems; contador.classList.remove('hidden'); }
    else contador.classList.add('hidden');

    if (carrito.length === 0) {
        cont.innerHTML = '<p class="text-center text-[#B8909A] mt-10">Tu carrito está vacío</p>';
    } else {
        cont.innerHTML = carrito.map(i => `
            <div class="flex items-center gap-3">
                <div class="h-16 w-16 rounded-lg bg-[#FDF6F7] overflow-hidden shrink-0">
                    ${i.imagen_url ? `<img src="${i.imagen_url}" class="w-full h-full object-cover">` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-[#7D4F58] truncate">${i.nombre}</p>
                    <p class="text-sm text-[#B76E79] font-semibold">$${i.precio.toFixed(2)}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn-cant-menos w-6 h-6 rounded-full border border-[#EAC7CE] text-[#7D4F58]" data-id="${i.id}">-</button>
                    <span class="text-sm w-4 text-center">${i.cantidad}</span>
                    <button class="btn-cant-mas w-6 h-6 rounded-full border border-[#EAC7CE] text-[#7D4F58]" data-id="${i.id}">+</button>
                </div>
            </div>
        `).join('');
    }

    const total = carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
    document.getElementById('carrito-total').textContent = `$${total.toFixed(2)}`;
}

function abrirCarrito() {
    document.getElementById('panel-carrito').classList.remove('translate-x-full');
    document.getElementById('overlay-carrito').classList.remove('hidden');
}

function cerrarCarrito() {
    document.getElementById('panel-carrito').classList.add('translate-x-full');
    document.getElementById('overlay-carrito').classList.add('hidden');
}

function enviarPedidoWhatsapp() {
    if (carrito.length === 0) return;
    if (!telefonoNegocio) { alert('El negocio aún no configuró un teléfono de contacto.'); return; }

    const lineas = carrito.map(i => `- ${i.cantidad}x ${i.nombre} ($${(i.precio * i.cantidad).toFixed(2)})`).join('\n');
    const total = carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
    const mensaje = `Hola! Quiero hacer este pedido:\n\n${lineas}\n\nTotal: $${total.toFixed(2)}`;
    const telefonoLimpio = telefonoNegocio.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

function configurarEventos() {
    document.getElementById('lista-categorias-nav').addEventListener('click', (e) => {
        const btn = e.target.closest('.chip-categoria');
        if (!btn) return;
        categoriaActiva = btn.dataset.cat || null;
        renderCategoriasNav();
        renderProductos();
    });

    document.getElementById('grid-productos').addEventListener('click', (e) => {
        const card = e.target.closest('.tarjeta-producto');
        if (card) abrirModalProducto(card.dataset.id);
    });

    document.getElementById('btn-cerrar-modal-producto').addEventListener('click', cerrarModalProducto);
    document.getElementById('modal-producto').addEventListener('click', (e) => {
        if (e.target.id === 'modal-producto') cerrarModalProducto();
    });

    document.getElementById('btn-agregar-carrito').addEventListener('click', () => {
        if (productoModalActual) agregarAlCarrito(productoModalActual);
        cerrarModalProducto();
    });

    document.getElementById('btn-abrir-carrito').addEventListener('click', abrirCarrito);
    document.getElementById('btn-cerrar-carrito').addEventListener('click', cerrarCarrito);
    document.getElementById('overlay-carrito').addEventListener('click', cerrarCarrito);

    document.getElementById('items-carrito').addEventListener('click', (e) => {
        const masBtn = e.target.closest('.btn-cant-mas');
        const menosBtn = e.target.closest('.btn-cant-menos');
        if (masBtn) cambiarCantidad(masBtn.dataset.id, 1);
        if (menosBtn) cambiarCantidad(menosBtn.dataset.id, -1);
    });

    document.getElementById('btn-checkout-whatsapp').addEventListener('click', enviarPedidoWhatsapp);
}
